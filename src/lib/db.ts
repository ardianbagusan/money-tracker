import 'server-only';
import postgres from 'postgres';
import { randomBytes } from 'crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { COOKIE, verifyToken } from './session';

export type Sql = ReturnType<typeof postgres>;

declare global {
  // eslint-disable-next-line no-var
  var __clients: Map<number, Sql> | undefined;
  // eslint-disable-next-line no-var
  var __schemaReady: Map<number, Promise<void>> | undefined;
}

/**
 * People who can sign in. Each has their own password and their own database,
 * so one person's data can never appear in the other's screens.
 *  - User 1 uses the original database (DATABASE_URL), so existing data stays put.
 *  - User 2 uses a second database in the same Neon project, created automatically.
 */
export const USERS = [
  { id: 1, name: process.env.APP_NAME_1 || 'Moni', passwordEnv: 'APP_PASSWORD', dbName: null as string | null },
  { id: 2, name: process.env.APP_NAME_2 || 'haavaana', passwordEnv: 'APP_PASSWORD_2', dbName: process.env.APP_DB_2 || 'haavaana' },
];
export type User = (typeof USERS)[number];

export function activeUsers() {
  return USERS.filter((u) => !!process.env[u.passwordEnv]);
}
export function userById(id: number) {
  return USERS.find((u) => u.id === id) ?? null;
}

const MISSING = 'postgres://missing:missing@missing-database-url.invalid/missing';

function urlFor(u: User) {
  const base = process.env.DATABASE_URL || MISSING;
  if (!u.dbName) return base;
  if (process.env.DATABASE_URL_2) return process.env.DATABASE_URL_2;
  const url = new URL(base);
  url.pathname = `/${u.dbName}`;
  return url.toString();
}

function makeClient(url: string) {
  const local = /localhost|127\.0\.0\.1/.test(url);
  return postgres(url, {
    ssl: local ? false : 'require',
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
    onnotice: () => {},
    types: {
      // Rupiah amounts are whole numbers and fit safely in a JS number.
      bigint: { to: 20, from: [20], serialize: (x: number) => String(Math.round(x)), parse: (x: string) => Number(x) },
    },
  });
}

/** Database client for one user. */
export function clientFor(userId: number): Sql {
  const u = userById(userId);
  if (!u) throw new Error('Unknown user');
  globalThis.__clients ??= new Map();
  let c = globalThis.__clients.get(userId);
  if (!c) {
    c = makeClient(urlFor(u));
    globalThis.__clients.set(userId, c);
  }
  return c;
}

/** The signed-in user for this request, from the login cookie. */
export const currentUserId = cache(async (): Promise<number> => {
  const store = await cookies();
  const uid = await verifyToken(store.get(COOKIE)?.value);
  if (!uid || !userById(uid)) throw new Error('Not signed in');
  return uid;
});

export async function currentUser() {
  return userById(await currentUserId())!;
}

/** Database of the signed-in user, with its tables ready. */
export async function db(): Promise<Sql> {
  const uid = await currentUserId();
  await ensureSchema(uid);
  return clientFor(uid);
}

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

-- Journal and mood
create table if not exists journal_tags (
  id serial primary key,
  name text not null,
  emoji text not null default '✨',
  sort int not null default 0,
  archived boolean not null default false
);
create table if not exists journal_entries (
  id serial primary key,
  occurred_at timestamp not null,
  mood int not null check (mood between 1 and 5),
  energy text check (energy in ('low','medium','high')),
  tag_ids int[] not null default '{}',
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists journal_occurred_idx on journal_entries (occurred_at desc);

-- Sports
create table if not exists workouts (
  id serial primary key,
  sport text not null check (sport in ('running','tennis')),
  occurred_at timestamp not null,
  duration_sec int not null check (duration_sec > 0),
  distance_m int,
  effort int check (effort between 1 and 10),
  avg_hr int,
  tennis_format text check (tennis_format in ('singles','doubles')),
  result text check (result in ('won','lost','draw')),
  score text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists workouts_occurred_idx on workouts (occurred_at desc);

-- Calendar and reminders
create table if not exists events (
  id serial primary key,
  title text not null,
  note text not null default '',
  start_at timestamp not null,
  all_day boolean not null default false,
  repeat text not null default 'none' check (repeat in ('none','daily','weekly','monthly','yearly')),
  alert_minutes int,
  created_at timestamptz not null default now()
);
create table if not exists event_alerts_sent (
  event_id int not null references events(id) on delete cascade,
  occurrence_at timestamp not null,
  sent_at timestamptz not null default now(),
  primary key (event_id, occurrence_at)
);
create table if not exists email_imports (
  id serial primary key,
  message_id text not null unique,
  sender text not null default '',
  subject text not null default '',
  snippet text not null default '',
  received_at timestamp not null,
  type text check (type in ('expense','income')),
  amount bigint,
  title text not null default '',
  category_id int references categories(id) on delete set null,
  wallet_id int references wallets(id) on delete set null,
  source_name text not null default '',
  hint text not null default '',
  status text not null default 'pending' check (status in ('pending','added','dismissed','unreadable')),
  transaction_id int references transactions(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists email_imports_status_idx on email_imports (status, received_at desc);
create table if not exists food_items (
  id serial primary key,
  name text not null,
  aliases text not null default '',
  kind text not null default 'food' check (kind in ('food','drink','other')),
  portion_g int not null default 100,
  kcal_100g numeric not null default 0,
  protein_100g numeric not null default 0,
  carbs_100g numeric not null default 0,
  fat_100g numeric not null default 0,
  source text not null default 'custom',
  uses int not null default 0,
  archived boolean not null default false
);
create table if not exists food_moments (
  id serial primary key,
  occurred_at timestamp not null,
  place text not null default '',
  people text[] not null default '{}',
  rating smallint,
  favorite boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists food_moments_at_idx on food_moments (occurred_at desc);
create table if not exists food_entries (
  id serial primary key,
  moment_id int not null references food_moments(id) on delete cascade,
  food_item_id int references food_items(id) on delete set null,
  name text not null,
  kind text not null default 'food' check (kind in ('food','drink','other')),
  grams int,
  kcal int not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  tags text[] not null default '{}',
  sort int not null default 0
);
create table if not exists food_cutouts (
  id serial primary key,
  entry_id int not null unique references food_entries(id) on delete cascade,
  image bytea not null,
  width int not null,
  height int not null,
  method text not null default 'lasso' check (method in ('tap','lasso','whole')),
  outline jsonb not null default '[]',
  canvas jsonb not null default '{"x":0.5,"y":0.5,"rot":0,"scale":1,"z":0}'
);
create table if not exists trades (
  id serial primary key,
  ticker text not null,
  status text not null default 'open' check (status in ('open','closed')),
  setup text not null default '',
  timeframe text not null default '',
  stop numeric,
  target numeric,
  tags text[] not null default '{}',
  context text[] not null default '{}',
  emotion_entry text not null default '',
  emotion_exit text not null default '',
  rationale text not null default '',
  review text not null default '',
  followed_plan boolean,
  opened_at timestamp not null,
  closed_at timestamp,
  created_at timestamptz not null default now()
);
create table if not exists trade_fills (
  id serial primary key,
  trade_id int not null references trades(id) on delete cascade,
  side text not null check (side in ('buy','sell')),
  price numeric not null,
  lots int not null,
  fee bigint not null default 0,
  filled_at timestamp not null
);
create table if not exists push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  label text not null default '',
  created_at timestamptz not null default now()
);
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

// name, aliases, kind, typical portion (g or ml), kcal, protein g, carbs g, fat g — for that portion.
// Rough averages for common Indonesian and everyday food; real dishes vary a lot. Edit them in the app.
const FOOD_SEED: [string, string, 'food' | 'drink' | 'other', number, number, number, number, number][] = [
  ['Nasi putih', 'rice,nasi', 'food', 150, 195, 4, 43, 0.4],
  ['Nasi goreng', 'fried rice', 'food', 250, 420, 12, 58, 15],
  ['Nasi uduk', '', 'food', 200, 360, 7, 55, 12],
  ['Nasi kuning', '', 'food', 200, 340, 7, 55, 10],
  ['Nasi padang', 'padang', 'food', 450, 750, 30, 85, 32],
  ['Nasi campur', 'mixed rice', 'food', 400, 650, 25, 80, 25],
  ['Bubur ayam', 'porridge', 'food', 400, 370, 15, 55, 10],
  ['Mie goreng', 'fried noodles', 'food', 250, 450, 11, 60, 18],
  ['Mie ayam', 'chicken noodles', 'food', 300, 420, 18, 55, 14],
  ['Indomie goreng', 'instant noodles,mie instan', 'food', 85, 380, 8, 52, 15],
  ['Indomie kuah', 'instant noodle soup', 'food', 75, 350, 7, 48, 14],
  ['Kwetiau goreng', 'kway teow', 'food', 300, 500, 14, 70, 18],
  ['Bakso', 'meatball soup', 'food', 350, 300, 18, 25, 14],
  ['Soto ayam', 'soto', 'food', 350, 310, 20, 22, 15],
  ['Sate ayam', 'satay', 'food', 200, 450, 38, 12, 28],
  ['Ayam goreng', 'fried chicken', 'food', 120, 300, 24, 6, 20],
  ['Ayam geprek', '', 'food', 200, 520, 30, 25, 33],
  ['Ayam bakar', 'grilled chicken', 'food', 150, 280, 30, 6, 15],
  ['Rendang', 'beef', 'food', 100, 195, 20, 5, 11],
  ['Gado-gado', 'gado gado,salad peanut', 'food', 300, 400, 15, 30, 25],
  ['Pecel', '', 'food', 250, 350, 13, 30, 20],
  ['Ketoprak', '', 'food', 350, 450, 15, 55, 18],
  ['Capcay', 'cap cay,stir fry vegetables', 'food', 250, 200, 8, 15, 12],
  ['Pempek', 'empek', 'food', 200, 380, 14, 55, 11],
  ['Siomay', '', 'food', 250, 360, 18, 35, 16],
  ['Batagor', '', 'food', 200, 420, 16, 35, 24],
  ['Martabak manis', 'terang bulan', 'food', 100, 330, 6, 45, 14],
  ['Martabak telur', '', 'food', 100, 250, 10, 20, 15],
  ['Gorengan', 'bakwan,pisang goreng,risoles', 'food', 40, 110, 2, 10, 7],
  ['Tempe goreng', 'tempe', 'food', 50, 175, 10, 8, 12],
  ['Tahu goreng', 'tahu,tofu', 'food', 50, 115, 7, 3, 9],
  ['Telur ceplok', 'fried egg,telur', 'food', 60, 110, 7, 0.5, 9],
  ['Telur rebus', 'boiled egg', 'food', 55, 75, 6, 0.5, 5],
  ['Roti tawar (2 lembar)', 'bread', 'food', 60, 160, 5, 30, 2],
  ['Croissant', '', 'food', 60, 240, 5, 27, 12],
  ['Donat', 'donut', 'food', 60, 250, 4, 30, 13],
  ['Kue (1 potong)', 'cake', 'food', 80, 300, 4, 40, 14],
  ['Pizza (1 slice)', '', 'food', 110, 290, 12, 33, 12],
  ['Burger', '', 'food', 220, 540, 25, 40, 30],
  ['Kentang goreng', 'french fries,fries', 'food', 115, 360, 4, 45, 17],
  ['Steak', 'beef steak', 'food', 200, 500, 50, 0, 33],
  ['Spaghetti bolognese', 'pasta', 'food', 350, 550, 25, 70, 18],
  ['Ramen', '', 'food', 500, 550, 22, 70, 20],
  ['Sushi (6 pcs)', '', 'food', 180, 300, 10, 55, 4],
  ['Dimsum (4 pcs)', 'dim sum,siu mai', 'food', 120, 240, 10, 25, 11],
  ['Salad', '', 'food', 200, 150, 4, 12, 10],
  ['Pisang', 'banana', 'food', 100, 90, 1, 23, 0.3],
  ['Apel', 'apple', 'food', 150, 80, 0.4, 21, 0.2],
  ['Air mineral', 'water,aqua', 'drink', 600, 0, 0, 0, 0],
  ['Es teh manis', 'sweet iced tea,teh', 'drink', 300, 120, 0, 30, 0],
  ['Teh tawar', 'plain tea', 'drink', 250, 2, 0, 0, 0],
  ['Teh botol', 'bottled tea', 'drink', 350, 120, 0, 30, 0],
  ['Kopi hitam', 'black coffee,americano', 'drink', 200, 5, 0.3, 0, 0],
  ['Kopi susu gula aren', 'es kopi susu,kopi susu', 'drink', 250, 200, 5, 30, 6],
  ['Cafe latte', 'latte,cappuccino', 'drink', 250, 150, 8, 12, 8],
  ['Susu', 'milk', 'drink', 250, 150, 8, 12, 8],
  ['Jus jeruk', 'orange juice', 'drink', 250, 110, 2, 26, 0.5],
  ['Jus alpukat', 'avocado juice', 'drink', 300, 320, 3, 35, 18],
  ['Boba milk tea', 'bubble tea,boba', 'drink', 500, 450, 3, 80, 12],
  ['Soda', 'cola,coke,sprite', 'drink', 330, 140, 0, 35, 0],
  ['Es kelapa muda', 'coconut', 'drink', 300, 100, 1, 20, 1],
  ['Keripik', 'chips', 'other', 30, 160, 2, 15, 10],
  ['Cokelat', 'chocolate', 'other', 40, 210, 3, 24, 12],
  ['Es krim', 'ice cream', 'other', 70, 140, 2, 16, 7],
];

const TAG_SEED: [string, string][] = [
  ['Work', '💼'], ['Study', '📚'], ['Family', '🏡'], ['Friends', '🧑‍🤝‍🧑'], ['Exercise', '🏃'], ['Outdoors', '🌳'],
  ['Rest', '😴'], ['Good food', '🍜'], ['Hobby', '🎨'], ['Travel', '🧳'], ['Date', '💞'], ['Sick', '🤒'],
];

async function setup(sql: Sql) {
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

  const [{ fc }] = await sql`select count(*)::int as fc from food_items`;
  if (fc === 0) {
    // Starter list: approximate values per typical portion, converted to per 100 g.
    for (const [name, aliases, kind, g, kcal, p, c, f] of FOOD_SEED) {
      const k = 100 / g;
      await sql`insert into food_items (name, aliases, kind, portion_g, kcal_100g, protein_100g, carbs_100g, fat_100g, source)
        values (${name}, ${aliases}, ${kind}, ${g}, ${Math.round(kcal * k * 10) / 10}, ${Math.round(p * k * 10) / 10}, ${Math.round(c * k * 10) / 10}, ${Math.round(f * k * 10) / 10}, 'starter')`;
    }
  }
  await sql`insert into settings (key, value) values ('food_goal_kcal', '2000'), ('stock_capital', '0'), ('stock_fee_buy', '0.15'), ('stock_fee_sell', '0.25'), ('stock_lot', '100') on conflict do nothing`;

  const [{ tc }] = await sql`select count(*)::int as tc from journal_tags`;
  if (tc === 0) {
    let i = 0;
    for (const [name, emoji] of TAG_SEED) await sql`insert into journal_tags (name, emoji, sort) values (${name}, ${emoji}, ${i++})`;
  }

  // Keys for push alerts and for the reminder pinger, made once per database.
  // Kept in the database so you don't have to create or paste any extra secrets.
  const [{ vk }] = await sql`select count(*)::int as vk from settings where key = 'vapid_public'`;
  if (vk === 0) {
    const webpush = (await import('web-push')).default;
    const keys = webpush.generateVAPIDKeys();
    await sql`insert into settings (key, value) values ('vapid_public', ${keys.publicKey}), ('vapid_private', ${keys.privateKey}) on conflict do nothing`;
  }
  const cronKey = randomBytes(24).toString('base64url');
  await sql`insert into settings (key, value) values ('cron_key', ${cronKey}) on conflict do nothing`;
  const importKey = randomBytes(24).toString('base64url');
  await sql`insert into settings (key, value) values ('import_key', ${importKey}) on conflict do nothing`;
}

/** Creates the user's database if needed, then tables and starter data. Runs once per server instance. */
async function prepare(userId: number) {
  const u = userById(userId)!;
  if (u.dbName && !process.env.DATABASE_URL_2) {
    // Second user: make sure their database exists in the same Neon project.
    const main = clientFor(1);
    const [exists] = await main`select 1 as ok from pg_database where datname = ${u.dbName}`;
    if (!exists) {
      if (!/^[a-z0-9_]+$/.test(u.dbName)) throw new Error('APP_DB_2 may only use lowercase letters, digits and _.');
      try {
        await main.unsafe(`create database "${u.dbName}"`);
      } catch (e: any) {
        if (!/already exists/.test(e?.message ?? '')) {
          throw new Error(`Could not create the database "${u.dbName}" for ${u.name}. Create it in the Neon console (Databases → New database, name "${u.dbName}"), then sign in again. (${e?.message ?? e})`);
        }
      }
    }
  }
  await setup(clientFor(userId));
}

export function ensureSchema(userId: number) {
  if (!process.env.DATABASE_URL) return Promise.reject(new Error('DATABASE_URL is not set. Add it in Vercel → Settings → Environment Variables, then redeploy.'));
  globalThis.__schemaReady ??= new Map();
  let p = globalThis.__schemaReady.get(userId);
  if (!p) {
    p = prepare(userId).catch((e) => {
      globalThis.__schemaReady!.delete(userId);
      throw e;
    });
    globalThis.__schemaReady.set(userId, p);
  }
  return p;
}

export async function getSettings(sqlArg?: Sql): Promise<{ timezone: string; periodStart: number; vapidPublic: string }> {
  const sql = sqlArg ?? (await db());
  const rows = await sql`select key, value from settings where key in ('timezone', 'period_start', 'vapid_public')`;
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    timezone: m.timezone || 'Asia/Jakarta',
    periodStart: Math.min(28, Math.max(1, Number(m.period_start) || 1)),
    vapidPublic: m.vapid_public || '',
  };
}

/** Secret values that never leave the server. */
/** Plain settings for food goals and stock journal (not secret). */
export async function getLifeSettings(sqlArg?: Sql) {
  const sql = sqlArg ?? (await db());
  const rows = await sql`select key, value from settings where key in ('food_goal_kcal','stock_capital','stock_fee_buy','stock_fee_sell','stock_lot')`;
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    foodGoalKcal: Number(m.food_goal_kcal) || 2000,
    stockCapital: Number(m.stock_capital) || 0,
    feeBuy: Number(m.stock_fee_buy ?? 0.15),
    feeSell: Number(m.stock_fee_sell ?? 0.25),
    lot: Number(m.stock_lot) || 100,
  };
}

export async function getSecretSetting(key: 'vapid_private' | 'vapid_public' | 'cron_key' | 'import_key', sqlArg?: Sql) {
  const sql = sqlArg ?? (await db());
  const [r] = await sql`select value from settings where key = ${key}`;
  return (r?.value as string) || '';
}

/** Second line of defence: every server action checks the login cookie itself too. Returns the user id. */
export async function requireAuth() {
  return currentUserId();
}
