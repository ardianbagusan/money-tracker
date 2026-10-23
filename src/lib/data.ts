import 'server-only';
import { cache } from 'react';
import { db, getSettings, type Sql } from './db';
import { advance, nowLocal } from './dates';
import type { CalEvent, EmailImport, FoodItem, FoodMoment, Trade, Category, Goal, Item, JournalEntry, JournalTag, Recurring, Tx, Wallet, Workout } from './types';

const TX_COLS = `t.id, t.type, t.amount, t.title, t.note, t.category_id, t.wallet_id, t.to_wallet_id,
  to_char(t.occurred_at, 'YYYY-MM-DD"T"HH24:MI') as occurred_at, t.source, t.recurring_id,
  exists(select 1 from receipts r where r.transaction_id = t.id) as has_receipt,
  (select count(*)::int from transaction_items i where i.transaction_id = t.id) as item_count`;

/** Adds any recurring transactions that have come due since the last visit. */
async function runRecurring(sql: Sql, now: string) {
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
  const sql = await db();
  const settings = await getSettings(sql);
  const now = nowLocal(settings.timezone);
  await runRecurring(sql, now);
  const [categories, tags, wallets] = await Promise.all([
    sql<Category[]>`select * from categories order by kind, sort, id`,
    sql<JournalTag[]>`select id, name, emoji, sort, archived from journal_tags order by sort, id`,
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
  return { settings, now, today: now.slice(0, 10), categories: [...categories], wallets: [...wallets], tags: [...tags] };
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
  const sql = await db();
  const q = f.q?.trim();
  const qAmount = q ? Number(q.replace(/[^\d]/g, '')) : 0;
  const order =
    f.sort === 'oldest' ? sql`t.occurred_at asc, t.id asc`
    : f.sort === 'highest' ? sql`abs(t.amount) desc, t.occurred_at desc`
    : f.sort === 'lowest' ? sql`abs(t.amount) asc, t.occurred_at desc`
    : sql`t.occurred_at desc, t.id desc`;
  const rows = await sql<Tx[]>`select ${sql.unsafe(TX_COLS)}
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
  const sql = await db();
  const [tx] = await sql<Tx[]>`select ${sql.unsafe(TX_COLS)} from transactions t where t.id = ${id}`;
  if (!tx) return null;
  const items = await sql<Item[]>`select id, name, amount, kind from transaction_items where transaction_id = ${id} order by sort, id`;
  return { tx, items: [...items] };
}

export async function getRecurring(): Promise<Recurring[]> {
  const sql = await db();
  const rows = await sql<Recurring[]>`select id, type, amount, title, category_id, wallet_id, to_wallet_id, frequency,
    to_char(next_at, 'YYYY-MM-DD"T"HH24:MI') as next_at, active from recurring order by active desc, next_at`;
  return [...rows];
}

export async function getBudgets(): Promise<Record<number, number>> {
  const sql = await db();
  const rows = await sql`select category_id, amount from budgets`;
  return Object.fromEntries(rows.map((r) => [r.category_id, r.amount]));
}

export async function getGoals(): Promise<Goal[]> {
  const sql = await db();
  const rows = await sql<Goal[]>`select id, name, emoji, target, saved from goals order by created_at`;
  return [...rows];
}

/** Money in and out per month for a year (transfers and adjustments excluded). */
export async function getYearByMonth(year: number) {
  const sql = await db();
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

// ---------------- Journal ----------------
const JOURNAL_COLS = `id, to_char(occurred_at, 'YYYY-MM-DD"T"HH24:MI') as occurred_at, mood, energy, tag_ids, note`;

export async function getJournal(from?: string, to?: string, limit = 2000): Promise<JournalEntry[]> {
  const sql = await db();
  const rows = await sql<JournalEntry[]>`select ${sql.unsafe(JOURNAL_COLS)} from journal_entries where true
    ${from ? sql`and occurred_at >= ${from}::text::timestamp` : sql``}
    ${to ? sql`and occurred_at < ${to}::text::timestamp` : sql``}
    order by occurred_at desc, id desc limit ${limit}`;
  return [...rows];
}

// ---------------- Sports ----------------
const WORKOUT_COLS = `id, sport, to_char(occurred_at, 'YYYY-MM-DD"T"HH24:MI') as occurred_at, duration_sec, distance_m, effort,
  avg_hr, tennis_format, result, score, note`;

export async function getWorkouts(from?: string, to?: string, sport?: string, limit = 2000): Promise<Workout[]> {
  const sql = await db();
  const rows = await sql<Workout[]>`select ${sql.unsafe(WORKOUT_COLS)} from workouts where true
    ${from ? sql`and occurred_at >= ${from}::text::timestamp` : sql``}
    ${to ? sql`and occurred_at < ${to}::text::timestamp` : sql``}
    ${sport ? sql`and sport = ${sport}` : sql``}
    order by occurred_at desc, id desc limit ${limit}`;
  return [...rows];
}

// ---------------- Calendar ----------------
export async function getEvents(): Promise<CalEvent[]> {
  const sql = await db();
  const rows = await sql<CalEvent[]>`select id, title, note, to_char(start_at, 'YYYY-MM-DD"T"HH24:MI') as start_at, all_day, repeat, alert_minutes
    from events order by start_at`;
  return [...rows];
}

export async function getPushDeviceCount() {
  const sql = await db();
  const [{ n }] = await sql`select count(*)::int as n from push_subscriptions`;
  return n as number;
}

/** Spending per day (expenses only) for linking money with mood. */
export async function getDailySpending(from: string, to: string): Promise<Record<string, number>> {
  const sql = await db();
  const rows = await sql`select to_char(occurred_at, 'YYYY-MM-DD') as d, sum(amount)::bigint as s from transactions
    where type = 'expense' and occurred_at >= ${from}::text::timestamp and occurred_at < ${to}::text::timestamp group by 1`;
  return Object.fromEntries(rows.map((r) => [r.d, r.s]));
}

/** Emails waiting for a decision. maybe_dup: a transaction with the same amount within a day already exists. */
export async function getEmailImports(): Promise<EmailImport[]> {
  const sql = await db();
  return sql<EmailImport[]>`select e.id, e.sender, e.subject, e.snippet, to_char(e.received_at, 'YYYY-MM-DD"T"HH24:MI') as received_at,
      e.type, e.amount, e.title, e.category_id, e.wallet_id, e.source_name, e.hint, e.status,
      (e.amount is not null and exists(select 1 from transactions t where t.amount = e.amount and t.type = e.type
        and t.occurred_at between e.received_at - interval '1 day' and e.received_at + interval '1 day')) as maybe_dup
    from email_imports e where e.status in ('pending', 'unreadable') order by e.received_at desc limit 200`;
}

export async function getEmailImportCount() {
  const sql = await db();
  const [r] = await sql`select count(*)::int as n from email_imports where status = 'pending'`;
  return r.n as number;
}

/** Wallet that email imports use when the sender doesn't name one (same rule as the import route). */
export async function getImportWalletId(): Promise<number | null> {
  const sql = await db();
  const [pref] = await sql`select value from settings where key = 'import_wallet'`;
  const ws = await sql`select id, kind from wallets where not archived order by is_default desc, id`;
  const w = ws.find((x) => x.id === Number(pref?.value)) ?? ws.find((x) => x.kind === 'bank') ?? ws[0];
  return w?.id ?? null;
}

// ---------------- Food ----------------
export async function getFoodItems(): Promise<FoodItem[]> {
  const sql = await db();
  const rows = await sql<FoodItem[]>`select id, name, aliases, kind, portion_g, kcal_100g::float as kcal_100g, protein_100g::float as protein_100g,
    carbs_100g::float as carbs_100g, fat_100g::float as fat_100g, source, uses from food_items where not archived order by uses desc, name`;
  return rows;
}

/** Meals between two dates (to is exclusive), newest first, with their items and sticker info. */
export async function getFoodMoments(from: string, to: string, limit = 500): Promise<FoodMoment[]> {
  const sql = await db();
  return sql<FoodMoment[]>`select m.id, to_char(m.occurred_at, 'YYYY-MM-DD"T"HH24:MI') as occurred_at, m.place, m.people, m.rating, m.favorite, m.note,
      coalesce((select json_agg(json_build_object('id', e.id, 'moment_id', e.moment_id, 'food_item_id', e.food_item_id, 'name', e.name, 'kind', e.kind,
        'grams', e.grams, 'kcal', e.kcal, 'protein_g', e.protein_g::float, 'carbs_g', e.carbs_g::float, 'fat_g', e.fat_g::float, 'tags', e.tags,
        'cutout', (select json_build_object('id', c.id, 'width', c.width, 'height', c.height, 'canvas', case jsonb_typeof(c.canvas) when 'string' then (c.canvas #>> '{}')::jsonb else c.canvas end) from food_cutouts c where c.entry_id = e.id))
        order by e.sort, e.id) from food_entries e where e.moment_id = m.id), '[]') as entries
    from food_moments m where m.occurred_at >= ${from}::text::timestamp and m.occurred_at < ${to}::text::timestamp
    order by m.occurred_at desc limit ${limit}`;
}

/** Calories per day, for the month view and insights. */
export async function getFoodDailyKcal(from: string, to: string): Promise<Record<string, number>> {
  const sql = await db();
  const rows = await sql`select to_char(m.occurred_at, 'YYYY-MM-DD') as d, sum(e.kcal)::int as k from food_moments m join food_entries e on e.moment_id = m.id
    where m.occurred_at >= ${from}::text::timestamp and m.occurred_at < ${to}::text::timestamp group by 1`;
  return Object.fromEntries(rows.map((r) => [r.d, r.k]));
}

// ---------------- Stocks ----------------
export async function getTrades(): Promise<Trade[]> {
  const sql = await db();
  return sql<Trade[]>`select t.id, t.ticker, t.status, t.setup, t.timeframe, t.stop::float as stop, t.target::float as target, t.tags, t.context,
      t.emotion_entry, t.emotion_exit, t.rationale, t.review, t.followed_plan,
      to_char(t.opened_at, 'YYYY-MM-DD"T"HH24:MI') as opened_at, to_char(t.closed_at, 'YYYY-MM-DD"T"HH24:MI') as closed_at,
      coalesce((select json_agg(json_build_object('id', f.id, 'side', f.side, 'price', f.price::float, 'lots', f.lots, 'fee', f.fee,
        'filled_at', to_char(f.filled_at, 'YYYY-MM-DD"T"HH24:MI')) order by f.filled_at, f.id) from trade_fills f where f.trade_id = t.id), '[]') as fills
    from trades t order by (t.status = 'open') desc, coalesce(t.closed_at, t.opened_at) desc`;
}
