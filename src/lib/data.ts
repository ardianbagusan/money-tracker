import 'server-only';
import { cache } from 'react';
import { sql, ensureSchema, getSettings } from './db';
import { advance, nowLocal } from './dates';
import type { Category, Goal, Item, Recurring, Tx, Wallet } from './types';

const TX_COLS = sql`t.id, t.type, t.amount, t.title, t.note, t.category_id, t.wallet_id, t.to_wallet_id,
  to_char(t.occurred_at, 'YYYY-MM-DD"T"HH24:MI') as occurred_at, t.source, t.recurring_id,
  exists(select 1 from receipts r where r.transaction_id = t.id) as has_receipt,
  (select count(*)::int from transaction_items i where i.transaction_id = t.id) as item_count`;

/** Adds any recurring transactions that have come due since the last visit. */
async function runRecurring(now: string) {
  const due = await sql<any[]>`select id, type, amount, title, note, category_id, wallet_id, to_wallet_id, frequency, anchor_day,
    to_char(next_at, 'YYYY-MM-DD"T"HH24:MI') as next_at
    from recurring where active and next_at <= ${now}::text::timestamp`;
  for (const r of due) {
    let at: string = r.next_at;
    let guard = 0;
    while (at <= now && guard++ < 400) {
      const next = advance(at, r.frequency, r.anchor_day ?? undefined);
      // Claim this occurrence first. If another request already moved next_at, skip,
      // so two page loads at the same moment can never add the same occurrence twice.
      const claimed = await sql`update recurring set next_at = ${next}::text::timestamp
        where id = ${r.id} and next_at = ${at}::text::timestamp and active returning id`;
      if (!claimed.length) break;
      await sql`insert into transactions (type, amount, title, note, category_id, wallet_id, to_wallet_id, occurred_at, source, recurring_id)
        values (${r.type}, ${r.amount}, ${r.title}, ${r.note}, ${r.category_id}, ${r.wallet_id}, ${r.to_wallet_id}, ${at}::text::timestamp, 'recurring', ${r.id})`;
      at = next;
    }
  }
}

export const getBase = cache(async function getBase() {
  await ensureSchema();
  const settings = await getSettings();
  const now = nowLocal(settings.timezone);
  await runRecurring(now);
  const [categories, wallets] = await Promise.all([
    sql<Category[]>`select * from categories order by kind, sort, id`,
    sql<Wallet[]>`select w.*, w.initial_balance + coalesce((
        select sum(case
          when t.type = 'income' and t.wallet_id = w.id then t.amount
          when t.type = 'expense' and t.wallet_id = w.id then -t.amount
          when t.type = 'transfer' and t.wallet_id = w.id then -t.amount
          when t.type = 'transfer' and t.to_wallet_id = w.id then t.amount
          when t.type = 'adjust' and t.wallet_id = w.id then t.amount
          else 0 end)
        from transactions t where t.wallet_id = w.id or t.to_wallet_id = w.id), 0)::bigint as balance
      from wallets w order by w.archived, w.sort, w.id`,
  ]);
  return { settings, now, today: now.slice(0, 10), categories: [...categories], wallets: [...wallets] };
});

export type TxFilter = {
  from?: string; // inclusive date
  to?: string; // exclusive date
  types?: string[];
  categoryIds?: number[];
  walletIds?: number[];
  q?: string;
  recurringOnly?: boolean;
  sort?: 'newest' | 'oldest' | 'highest' | 'lowest';
  limit?: number;
};

export async function getTransactions(f: TxFilter = {}): Promise<Tx[]> {
  await ensureSchema();
  const q = f.q?.trim();
  const qAmount = q ? Number(q.replace(/[^\d]/g, '')) : 0;
  const order =
    f.sort === 'oldest' ? sql`t.occurred_at asc, t.id asc`
    : f.sort === 'highest' ? sql`abs(t.amount) desc, t.occurred_at desc`
    : f.sort === 'lowest' ? sql`abs(t.amount) asc, t.occurred_at desc`
    : sql`t.occurred_at desc, t.id desc`;
  const rows = await sql<Tx[]>`select ${TX_COLS}
    from transactions t
    left join categories c on c.id = t.category_id
    left join wallets w on w.id = t.wallet_id
    where true
    ${f.from ? sql`and t.occurred_at >= ${f.from}::text::timestamp` : sql``}
    ${f.to ? sql`and t.occurred_at < ${f.to}::text::timestamp` : sql``}
    ${f.types?.length ? sql`and t.type in ${sql(f.types)}` : sql``}
    ${f.categoryIds?.length ? sql`and t.category_id in ${sql(f.categoryIds)}` : sql``}
    ${f.walletIds?.length ? sql`and (t.wallet_id in ${sql(f.walletIds)} or t.to_wallet_id in ${sql(f.walletIds)})` : sql``}
    ${f.recurringOnly ? sql`and t.recurring_id is not null` : sql``}
    ${q ? sql`and (t.title ilike ${'%' + q + '%'} or t.note ilike ${'%' + q + '%'} or c.name ilike ${'%' + q + '%'}
          or w.name ilike ${'%' + q + '%'} ${qAmount ? sql`or abs(t.amount) = ${qAmount}` : sql``})` : sql``}
    order by ${order}
    limit ${f.limit ?? 1000}`;
  return [...rows];
}

export async function getTransaction(id: number) {
  await ensureSchema();
  const [tx] = await sql<Tx[]>`select ${TX_COLS} from transactions t where t.id = ${id}`;
  if (!tx) return null;
  const items = await sql<Item[]>`select id, name, amount, kind from transaction_items where transaction_id = ${id} order by sort, id`;
  return { tx, items: [...items] };
}

export async function getRecurring(): Promise<Recurring[]> {
  await ensureSchema();
  const rows = await sql<Recurring[]>`select id, type, amount, title, category_id, wallet_id, to_wallet_id, frequency,
    to_char(next_at, 'YYYY-MM-DD"T"HH24:MI') as next_at, active from recurring order by active desc, next_at`;
  return [...rows];
}

export async function getBudgets(): Promise<Record<number, number>> {
  const rows = await sql`select category_id, amount from budgets`;
  return Object.fromEntries(rows.map((r) => [r.category_id, r.amount]));
}

export async function getGoals(): Promise<Goal[]> {
  const rows = await sql<Goal[]>`select id, name, emoji, target, saved from goals order by created_at`;
  return [...rows];
}

/** Money in and out per month for a year (transfers and adjustments excluded). */
export async function getYearByMonth(year: number) {
  const rows = await sql`select extract(month from occurred_at)::int as m,
      coalesce(sum(amount) filter (where type = 'expense'), 0)::bigint as out,
      coalesce(sum(amount) filter (where type = 'income'), 0)::bigint as inc
    from transactions
    where occurred_at >= ${`${year}-01-01`}::text::timestamp and occurred_at < ${`${year + 1}-01-01`}::text::timestamp
    group by 1`;
  const out = Array(12).fill(0);
  const inc = Array(12).fill(0);
  for (const r of rows) {
    out[r.m - 1] = r.out;
    inc[r.m - 1] = r.inc;
  }
  return { out, inc };
}
