'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db, type Sql } from '@/lib/db';
import { randomBytes } from 'crypto';
import { requireAuth } from '@/lib/auth';
import { COOKIE } from '@/lib/session';
import { advance } from '@/lib/dates';
import type { Draft, Item } from '@/lib/types';

type Result = { ok: boolean; id?: number; error?: string };

/** Checks the login, opens the signed-in person's database, runs the change, refreshes the screens. */
async function guard(fn: (sql: Sql) => Promise<Result>): Promise<Result> {
  try {
    await requireAuth();
    const sql = await db();
    const r = await fn(sql);
    revalidatePath('/', 'layout');
    return r;
  } catch (e: any) {
    console.error(e);
    return { ok: false, error: e?.message === 'Not signed in' ? 'You were signed out. Reload the page and sign in.' : e?.message || 'Something went wrong.' };
  }
}

const int = (v: any) => (v === null || v === undefined || v === '' ? null : Math.round(Number(v)));
const isLocalTime = (s: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s);

async function walletBalance(sql: Sql, walletId: number, excludeTx?: number) {
  const [r] = await sql`select w.initial_balance + coalesce((select sum(case
      when t.type = 'income' and t.wallet_id = w.id then t.amount
      when t.type = 'expense' and t.wallet_id = w.id then -t.amount
      when t.type = 'transfer' and t.wallet_id = w.id then -t.amount
      when t.type = 'transfer' and t.to_wallet_id = w.id then t.amount
      when t.type = 'adjust' and t.wallet_id = w.id then t.amount else 0 end)
    from transactions t where (t.wallet_id = w.id or t.to_wallet_id = w.id)
    ${excludeTx ? sql`and t.id <> ${excludeTx}` : sql``}), 0)::bigint as balance
    from wallets w where w.id = ${walletId}`;
  return r?.balance ?? 0;
}

export type TxPayload = {
  id?: number;
  type: 'expense' | 'income' | 'transfer' | 'adjust';
  amount: number; // for adjust: the new wallet balance the user typed
  title: string;
  note: string;
  category_id: number | null;
  wallet_id: number;
  to_wallet_id: number | null;
  occurred_at: string;
  repeat: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  items: Item[];
  receipt: { action: 'keep' } | { action: 'remove' } | { action: 'set'; dataUrl: string };
  source?: string;
};

export async function saveTransaction(p: TxPayload) {
  return guard(async (sql) => {
    const type = p.type;
    if (!['expense', 'income', 'transfer', 'adjust'].includes(type)) throw new Error('Pick a transaction type.');
    const walletId = int(p.wallet_id);
    if (!walletId) throw new Error('Pick a wallet.');
    if (!isLocalTime(p.occurred_at)) throw new Error('Pick a valid date and time.');
    let amount = Math.round(Number(p.amount) || 0);
    if (type !== 'adjust' && amount <= 0) throw new Error('Enter an amount above zero.');
    const toWallet = type === 'transfer' ? int(p.to_wallet_id) : null;
    if (type === 'transfer' && (!toWallet || toWallet === walletId)) throw new Error('Pick two different wallets for a transfer.');
    if (type === 'adjust') amount = amount - (await walletBalance(sql, walletId, p.id));
    const categoryId = type === 'expense' || type === 'income' ? int(p.category_id) : null;
    const title = (p.title || '').trim().slice(0, 120);
    const note = (p.note || '').trim().slice(0, 1000);

    let id = p.id ? Number(p.id) : 0;
    if (id) {
      await sql`update transactions set type = ${type}, amount = ${amount}, title = ${title}, note = ${note}, category_id = ${categoryId},
        wallet_id = ${walletId}, to_wallet_id = ${toWallet}, occurred_at = ${p.occurred_at}::text::timestamp where id = ${id}`;
    } else {
      const [row] = await sql`insert into transactions (type, amount, title, note, category_id, wallet_id, to_wallet_id, occurred_at, source)
        values (${type}, ${amount}, ${title}, ${note}, ${categoryId}, ${walletId}, ${toWallet}, ${p.occurred_at}::text::timestamp, ${p.source || 'manual'})
        returning id`;
      id = row.id;
      if (p.repeat && p.repeat !== 'none' && type !== 'adjust') {
        const anchor = Number(p.occurred_at.slice(8, 10));
        const next = advance(p.occurred_at, p.repeat, anchor);
        const [rule] = await sql`insert into recurring (type, amount, title, note, category_id, wallet_id, to_wallet_id, frequency, next_at, anchor_day)
          values (${type}, ${amount}, ${title}, ${note}, ${categoryId}, ${walletId}, ${toWallet}, ${p.repeat}, ${next}::text::timestamp, ${anchor}) returning id`;
        await sql`update transactions set recurring_id = ${rule.id} where id = ${id}`;
      }
    }

    // Receipt breakdown
    await sql`delete from transaction_items where transaction_id = ${id}`;
    const items = (p.items || []).filter((i) => Number(i.amount) > 0 || (i.name || '').trim());
    let sort = 0;
    for (const it of items) {
      const kind = ['item', 'tax', 'fee', 'discount'].includes(it.kind) ? it.kind : 'item';
      await sql`insert into transaction_items (transaction_id, name, amount, kind, sort)
        values (${id}, ${(it.name || '').trim().slice(0, 120)}, ${Math.max(0, Math.round(Number(it.amount) || 0))}, ${kind}, ${sort++})`;
    }

    // Receipt photo
    if (p.receipt?.action === 'remove') await sql`delete from receipts where transaction_id = ${id}`;
    if (p.receipt?.action === 'set') {
      const m = p.receipt.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
      if (!m) throw new Error('That photo format is not supported. Use a JPG or PNG.');
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > 3_000_000) throw new Error('That photo is too large. Try a smaller one.');
      await sql`insert into receipts (transaction_id, mime, data) values (${id}, ${m[1]}, ${buf})
        on conflict (transaction_id) do update set mime = excluded.mime, data = excluded.data`;
    }
    return { ok: true, id };
  });
}

export async function saveDrafts(drafts: Draft[], occurredAt: string) {
  return guard(async (sql) => {
    if (!isLocalTime(occurredAt)) throw new Error('Invalid time.');
    for (const d of drafts) {
      const amount = Math.round(Number(d.amount) || 0);
      if (amount <= 0) throw new Error('Every draft needs an amount above zero.');
      if (!d.wallet_id) throw new Error('Every draft needs a wallet.');
      await sql`insert into transactions (type, amount, title, category_id, wallet_id, occurred_at, source)
        values (${d.type === 'income' ? 'income' : 'expense'}, ${amount}, ${(d.title || '').trim().slice(0, 120)},
          ${int(d.category_id)}, ${int(d.wallet_id)}, ${occurredAt}::text::timestamp, 'quick')`;
    }
    return { ok: true };
  });
}

export async function loadTransaction(id: number) {
  await requireAuth();
  const { getTransaction } = await import('@/lib/data');
  return getTransaction(Number(id));
}

export async function deleteTransactions(ids: number[]) {
  return guard(async (sql) => {
    const clean = ids.map(Number).filter(Boolean);
    if (clean.length) await sql`delete from transactions where id in ${sql(clean)}`;
    return { ok: true };
  });
}

// Recurring rules
export async function setRecurringActive(id: number, active: boolean) {
  return guard(async (sql) => {
    await sql`update recurring set active = ${active} where id = ${id}`;
    return { ok: true };
  });
}
export async function deleteRecurring(id: number) {
  return guard(async (sql) => {
    await sql`delete from recurring where id = ${id}`;
    return { ok: true };
  });
}

// Categories
export async function saveCategory(c: { id?: number; name: string; emoji: string; color: string; kind: 'expense' | 'income'; keywords: string }) {
  return guard(async (sql) => {
    const name = (c.name || '').trim().slice(0, 40);
    if (!name) throw new Error('Give the category a name.');
    const keywords = (c.keywords || '')
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean)
      .join(',');
    const emoji = (c.emoji || '✨').trim().slice(0, 8) || '✨';
    if (c.id) {
      await sql`update categories set name = ${name}, emoji = ${emoji}, color = ${c.color}, keywords = ${keywords} where id = ${c.id}`;
    } else {
      const kind = c.kind === 'income' ? 'income' : 'expense';
      await sql`insert into categories (name, emoji, color, kind, keywords, sort)
        values (${name}, ${emoji}, ${c.color}, ${kind}, ${keywords}, (select coalesce(max(sort), 0) + 1 from categories))`;
    }
    return { ok: true };
  });
}
export async function archiveCategory(id: number, archived: boolean) {
  return guard(async (sql) => {
    await sql`update categories set archived = ${archived} where id = ${id}`;
    return { ok: true };
  });
}

// Wallets
export async function saveWallet(w: {
  id?: number; name: string; kind: string; emoji: string; initial_balance: number; credit_limit: number | null; due_day: number | null;
}) {
  return guard(async (sql) => {
    const name = (w.name || '').trim().slice(0, 40);
    if (!name) throw new Error('Give the wallet a name.');
    const kind = ['cash', 'bank', 'ewallet', 'credit', 'savings'].includes(w.kind) ? w.kind : 'cash';
    const due = kind === 'credit' ? int(w.due_day) : null;
    if (due !== null && (due < 1 || due > 31)) throw new Error('Due day must be between 1 and 31.');
    const limit = kind === 'credit' ? int(w.credit_limit) : null;
    const emoji = (w.emoji || '💵').trim().slice(0, 8) || '💵';
    const initial = Math.round(Number(w.initial_balance) || 0);
    if (w.id) {
      await sql`update wallets set name = ${name}, kind = ${kind}, emoji = ${emoji}, initial_balance = ${initial},
        credit_limit = ${limit}, due_day = ${due} where id = ${w.id}`;
    } else {
      const [{ n }] = await sql`select count(*)::int as n from wallets where not archived`;
      await sql`insert into wallets (name, kind, emoji, initial_balance, credit_limit, due_day, is_default, sort)
        values (${name}, ${kind}, ${emoji}, ${initial}, ${limit}, ${due}, ${n === 0}, (select coalesce(max(sort), 0) + 1 from wallets))`;
    }
    return { ok: true };
  });
}
export async function setDefaultWallet(id: number) {
  return guard(async (sql) => {
    await sql`update wallets set is_default = (id = ${id})`;
    return { ok: true };
  });
}
export async function archiveWallet(id: number, archived: boolean) {
  return guard(async (sql) => {
    const [{ n }] = await sql`select count(*)::int as n from wallets where not archived and id <> ${id}`;
    if (archived && n === 0) throw new Error('Keep at least one wallet.');
    await sql`update wallets set archived = ${archived}, is_default = case when ${archived} then false else is_default end where id = ${id}`;
    await sql`update wallets set is_default = true where id = (select id from wallets where not archived order by sort, id limit 1)
      and not exists (select 1 from wallets where is_default and not archived)`;
    return { ok: true };
  });
}

// Budgets and period
export async function saveBudgets(entries: { category_id: number; amount: number }[]) {
  return guard(async (sql) => {
    for (const e of entries) {
      const amt = Math.round(Number(e.amount) || 0);
      if (amt > 0)
        await sql`insert into budgets (category_id, amount) values (${e.category_id}, ${amt})
          on conflict (category_id) do update set amount = excluded.amount`;
      else await sql`delete from budgets where category_id = ${e.category_id}`;
    }
    return { ok: true };
  });
}

export async function saveSetting(key: 'timezone' | 'period_start', value: string) {
  return guard(async (sql) => {
    if (key === 'period_start') {
      const n = Number(value);
      if (!(n >= 1 && n <= 28)) throw new Error('Pick a day between 1 and 28.');
    }
    if (key === 'timezone') {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
      } catch {
        throw new Error('Unknown time zone.');
      }
    }
    await sql`insert into settings (key, value) values (${key}, ${String(value)}) on conflict (key) do update set value = excluded.value`;
    return { ok: true };
  });
}

// Goals
export async function saveGoal(g: { id?: number; name: string; emoji: string; target: number; saved: number }) {
  return guard(async (sql) => {
    const name = (g.name || '').trim().slice(0, 60);
    if (!name) throw new Error('Give the goal a name.');
    const target = Math.round(Number(g.target) || 0);
    if (target <= 0) throw new Error('Enter a target above zero.');
    const saved = Math.max(0, Math.round(Number(g.saved) || 0));
    const emoji = (g.emoji || '🌱').trim().slice(0, 8) || '🌱';
    if (g.id) await sql`update goals set name = ${name}, emoji = ${emoji}, target = ${target}, saved = ${saved} where id = ${g.id}`;
    else await sql`insert into goals (name, emoji, target, saved) values (${name}, ${emoji}, ${target}, ${saved})`;
    return { ok: true };
  });
}
export async function addToGoal(id: number, amount: number) {
  return guard(async (sql) => {
    const a = Math.round(Number(amount) || 0);
    if (!a) throw new Error('Enter an amount.');
    await sql`update goals set saved = greatest(0, saved + ${a}) where id = ${id}`;
    return { ok: true };
  });
}
export async function deleteGoal(id: number) {
  return guard(async (sql) => {
    await sql`delete from goals where id = ${id}`;
    return { ok: true };
  });
}

export async function signOut() {
  const store = await cookies();
  store.delete(COOKIE);
  redirect('/login');
}

// Email imports
export type ImportDecision = { id: number; type: 'expense' | 'income'; amount: number; title: string; category_id: number | null; wallet_id: number | null; occurred_at: string };

export async function addImports(list: ImportDecision[]) {
  return guard(async (sql) => {
    for (const d of list) {
      const amount = Math.round(Number(d.amount) || 0);
      if (amount <= 0) throw new Error('Every item needs an amount above zero.');
      if (!d.wallet_id) throw new Error('Pick a wallet for every item.');
      if (!isLocalTime(d.occurred_at)) throw new Error('Invalid date.');
      // Claim the email first so a double tap can't add it twice.
      const [claimed] = await sql`update email_imports set status = 'added' where id = ${int(d.id)} and status in ('pending','unreadable') returning id`;
      if (!claimed) continue;
      const [t] = await sql`insert into transactions (type, amount, title, category_id, wallet_id, occurred_at, source)
        values (${d.type === 'income' ? 'income' : 'expense'}, ${amount}, ${(d.title || '').trim().slice(0, 120)},
          ${int(d.category_id)}, ${int(d.wallet_id)}, ${d.occurred_at}::text::timestamp, 'email') returning id`;
      await sql`update email_imports set transaction_id = ${t.id} where id = ${claimed.id}`;
    }
    return { ok: true };
  });
}

export async function dismissImports(ids: number[]) {
  return guard(async (sql) => {
    const clean = ids.map(Number).filter(Boolean);
    if (clean.length) await sql`update email_imports set status = 'dismissed' where id in ${sql(clean)} and status in ('pending','unreadable')`;
    return { ok: true };
  });
}

/** Makes a new Gmail import key; the old script stops working until it gets the new one. */
export async function newImportKey() {
  return guard(async (sql) => {
    await sql`update settings set value = ${randomBytes(24).toString('base64url')} where key = 'import_key'`;
    return { ok: true };
  });
}
