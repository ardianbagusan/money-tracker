import 'server-only';
import postgres from 'postgres';

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __schemaReady: Promise<void> | undefined;
}

function makeClient() {
  // Missing URL is reported by ensureSchema() with a clear message; never at build time.
  const url = process.env.DATABASE_URL || 'postgres://missing:missing@missing-database-url.invalid/missing';
  const local = /localhost|127\.0\.0\.1/.test(url);
  return postgres(url, {
    ssl: local ? false : 'require',
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
    types: {
      // Rupiah amounts are whole numbers and fit safely in a JS number.
      bigint: { to: 20, from: [20], serialize: (x: number) => String(Math.round(x)), parse: (x: string) => Number(x) },
    },
  });
}

export const sql = globalThis.__sql ?? (globalThis.__sql = makeClient());

const SCHEMA = `
create table if not exists settings (key text primary key, value text not null);

create table if not exists categories (
  id serial primary key,
  name text not null,
  emoji text not null default '✨',
  color text not null default '#8396bb',
  kind text not null check (kind in ('expense','income')),
  keywords text not null default '',
  sort int not null default 0,
  archived boolean not null default false
);

create table if not exists wallets (
  id serial primary key,
  name text not null,
  kind text not null default 'cash' check (kind in ('cash','bank','ewallet','credit','savings')),
  emoji text not null default '💵',
  initial_balance bigint not null default 0,
  credit_limit bigint,
  due_day int,
  is_default boolean not null default false,
  archived boolean not null default false,
  sort int not null default 0
);

create table if not exists recurring (
  id serial primary key,
  type text not null,
  amount bigint not null,
  title text not null default '',
  note text not null default '',
  category_id int references categories(id) on delete set null,
  wallet_id int references wallets(id) on delete cascade,
  to_wallet_id int references wallets(id) on delete cascade,
  frequency text not null check (frequency in ('daily','weekly','monthly','yearly')),
  next_at timestamp not null,
  anchor_day int,
  active boolean not null default true
);

create table if not exists transactions (
  id serial primary key,
  type text not null check (type in ('expense','income','transfer','adjust')),
  amount bigint not null,
  title text not null default '',
  note text not null default '',
  category_id int references categories(id) on delete set null,
  wallet_id int not null references wallets(id) on delete cascade,
  to_wallet_id int references wallets(id) on delete cascade,
  occurred_at timestamp not null,
  source text not null default 'manual',
  recurring_id int references recurring(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists tx_occurred_idx on transactions (occurred_at desc);

create table if not exists transaction_items (
  id serial primary key,
  transaction_id int not null references transactions(id) on delete cascade,
  name text not null default '',
  amount bigint not null,
  kind text not null default 'item' check (kind in ('item','tax','fee','discount')),
  sort int not null default 0
);
create index if not exists items_tx_idx on transaction_items (transaction_id);

create table if not exists receipts (
  transaction_id int primary key references transactions(id) on delete cascade,
  mime text not null,
  data bytea not null
);

create table if not exists budgets (
  category_id int primary key references categories(id) on delete cascade,
  amount bigint not null
);

create table if not exists goals (
  id serial primary key,
  name text not null,
  emoji text not null default '🌱',
  target bigint not null,
  saved bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists login_attempts (ip text not null, at timestamptz not null default now());
`;

const EXPENSE_SEED: [string, string, string, string][] = [
  ['Food & drink', '🍜', '#d95926', 'makan,makanan,nasi,mie,bakso,sate,ayam,kopi,coffee,teh,jajan,snack,sarapan,lunch,dinner,resto,warteg,boba,gofood,grabfood,shopeefood'],
  ['Transport', '🛵', '#3987e5', 'parkir,parking,bensin,pertalite,pertamax,bbm,grab,gojek,ojek,ojol,taxi,taksi,tol,bus,kereta,krl,mrt,lrt,transjakarta,tj,angkot,train,uber'],
  ['Groceries', '🛒', '#199e70', 'belanja,indomaret,alfamart,supermarket,sayur,buah,beras,telur,groceries,pasar'],
  ['Bills', '💡', '#c98500', 'listrik,pln,token,air,pdam,internet,wifi,indihome,pulsa,kuota,data,tagihan,bill,bpjs'],
  ['Home', '🏡', '#9085e9', 'sewa,kos,kost,kontrakan,rent,laundry,galon,gas'],
  ['Shopping', '🛍️', '#d55181', 'shopee,tokopedia,lazada,baju,sepatu,celana,beli,shopping'],
  ['Health', '🌿', '#2fa6b8', 'obat,dokter,apotek,klinik,rumah sakit,vitamin,gym'],
  ['Fun', '🎬', '#e66767', 'netflix,spotify,youtube,bioskop,nonton,game,steam,konser,hiburan'],
  ['Learning', '📚', '#3987e5', 'buku,kursus,course,les,sekolah,kuliah,udemy'],
  ['Giving', '🎁', '#d95926', 'kado,hadiah,zakat,sedekah,donasi,infaq,amal,gift'],
  ['Other', '✨', '#8396bb', ''],
];
const INCOME_SEED: [string, string, string, string][] = [
  ['Salary', '💼', '#199e70', 'gaji,salary,payroll,upah,honor,stipend'],
  ['Bonus', '🎉', '#c98500', 'bonus,thr,insentif'],
  ['Side income', '🌱', '#2fa6b8', 'freelance,proyek,project,jualan,komisi'],
  ['Other income', '💰', '#3987e5', 'transfer masuk,refund,cashback,terima,dapat'],
];

async function setup() {
  await sql.unsafe(SCHEMA);
  const [{ count }] = await sql`select count(*)::int as count from categories`;
  if (count === 0) {
    let i = 0;
    for (const [name, emoji, color, keywords] of EXPENSE_SEED)
      await sql`insert into categories (name, emoji, color, kind, keywords, sort) values (${name}, ${emoji}, ${color}, 'expense', ${keywords}, ${i++})`;
    for (const [name, emoji, color, keywords] of INCOME_SEED)
      await sql`insert into categories (name, emoji, color, kind, keywords, sort) values (${name}, ${emoji}, ${color}, 'income', ${keywords}, ${i++})`;
  }
  const [{ wc }] = await sql`select count(*)::int as wc from wallets`;
  if (wc === 0) await sql`insert into wallets (name, kind, emoji, is_default) values ('Cash', 'cash', '💵', true)`;
  await sql`insert into settings (key, value) values ('timezone', 'Asia/Jakarta'), ('period_start', '1') on conflict do nothing`;
}

/** Creates tables and starter data the first time the app talks to a fresh database. */
export function ensureSchema() {
  if (!process.env.DATABASE_URL) return Promise.reject(new Error('DATABASE_URL is not set. Add it in Vercel → Settings → Environment Variables, then redeploy.'));
  if (!globalThis.__schemaReady) {
    globalThis.__schemaReady = setup().catch((e) => {
      globalThis.__schemaReady = undefined;
      throw e;
    });
  }
  return globalThis.__schemaReady;
}

export async function getSettings(): Promise<{ timezone: string; periodStart: number }> {
  await ensureSchema();
  const rows = await sql`select key, value from settings`;
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { timezone: m.timezone || 'Asia/Jakarta', periodStart: Math.min(28, Math.max(1, Number(m.period_start) || 1)) };
}
