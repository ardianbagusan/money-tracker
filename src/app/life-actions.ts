'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { currentUser, db, getLifeSettings, requireAuth, type Sql } from '@/lib/db';
import { sendToAll } from '@/lib/push';
import type { CutoutCanvas, FoodKind, Trade } from '@/lib/types';

type Result = { ok: boolean; id?: number; error?: string; info?: string };

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

const isLocalTime = (s: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s || '');
const clampInt = (v: any, lo: number, hi: number) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.min(hi, Math.max(lo, n));
};

// ---------------- Journal ----------------
export async function saveJournal(p: { id?: number; occurred_at: string; mood: number; energy: string | null; tag_ids: number[]; note: string }) {
  return guard(async (sql) => {
    if (!isLocalTime(p.occurred_at)) throw new Error('Pick a valid date and time.');
    const mood = clampInt(p.mood, 1, 5);
    if (!mood) throw new Error('Pick how you feel.');
    const energy = ['low', 'medium', 'high'].includes(p.energy ?? '') ? p.energy : null;
    const tags = [...new Set((p.tag_ids || []).map(Number).filter(Boolean))];
    const note = (p.note || '').trim().slice(0, 5000);
    if (p.id) {
      await sql`update journal_entries set occurred_at = ${p.occurred_at}::text::timestamp, mood = ${mood}, energy = ${energy},
        tag_ids = ${tags}::int[], note = ${note} where id = ${p.id}`;
      return { ok: true, id: p.id };
    }
    const [r] = await sql`insert into journal_entries (occurred_at, mood, energy, tag_ids, note)
      values (${p.occurred_at}::text::timestamp, ${mood}, ${energy}, ${tags}::int[], ${note}) returning id`;
    return { ok: true, id: r.id };
  });
}

export async function deleteJournal(id: number) {
  return guard(async (sql) => {
    await sql`delete from journal_entries where id = ${id}`;
    return { ok: true };
  });
}

export async function saveTag(t: { id?: number; name: string; emoji: string }) {
  return guard(async (sql) => {
    const name = (t.name || '').trim().slice(0, 30);
    if (!name) throw new Error('Give the activity a name.');
    const emoji = (t.emoji || '✨').trim().slice(0, 8) || '✨';
    if (t.id) await sql`update journal_tags set name = ${name}, emoji = ${emoji} where id = ${t.id}`;
    else await sql`insert into journal_tags (name, emoji, sort) values (${name}, ${emoji}, (select coalesce(max(sort), 0) + 1 from journal_tags))`;
    return { ok: true };
  });
}

export async function archiveTag(id: number, archived: boolean) {
  return guard(async (sql) => {
    await sql`update journal_tags set archived = ${archived} where id = ${id}`;
    return { ok: true };
  });
}

// ---------------- Sports ----------------
export async function saveWorkout(p: {
  id?: number; sport: 'running' | 'tennis'; occurred_at: string; duration_sec: number; distance_m: number | null; effort: number | null;
  avg_hr: number | null; tennis_format: string | null; result: string | null; score: string; note: string;
}) {
  return guard(async (sql) => {
    if (!['running', 'tennis'].includes(p.sport)) throw new Error('Pick a sport.');
    if (!isLocalTime(p.occurred_at)) throw new Error('Pick a valid date and time.');
    const duration = clampInt(p.duration_sec, 0, 24 * 3600);
    if (!duration) throw new Error('Enter how long it took.');
    const distance = p.sport === 'running' ? clampInt(p.distance_m, 0, 1_000_000) : null;
    if (p.sport === 'running' && !distance) throw new Error('Enter the distance.');
    const effort = clampInt(p.effort, 1, 10);
    const hr = p.sport === 'running' ? clampInt(p.avg_hr, 30, 250) : null;
    const format = p.sport === 'tennis' ? (['singles', 'doubles'].includes(p.tennis_format ?? '') ? p.tennis_format : null) : null;
    if (p.sport === 'tennis' && !format) throw new Error('Pick singles or doubles.');
    const result = p.sport === 'tennis' && ['won', 'lost', 'draw'].includes(p.result ?? '') ? p.result : null;
    const score = p.sport === 'tennis' ? (p.score || '').trim().slice(0, 60) : '';
    const note = (p.note || '').trim().slice(0, 2000);
    if (p.id) {
      await sql`update workouts set sport = ${p.sport}, occurred_at = ${p.occurred_at}::text::timestamp, duration_sec = ${duration},
        distance_m = ${distance}, effort = ${effort}, avg_hr = ${hr}, tennis_format = ${format}, result = ${result}, score = ${score},
        note = ${note} where id = ${p.id}`;
      return { ok: true, id: p.id };
    }
    const [r] = await sql`insert into workouts (sport, occurred_at, duration_sec, distance_m, effort, avg_hr, tennis_format, result, score, note)
      values (${p.sport}, ${p.occurred_at}::text::timestamp, ${duration}, ${distance}, ${effort}, ${hr}, ${format}, ${result}, ${score}, ${note})
      returning id`;
    return { ok: true, id: r.id };
  });
}

export async function deleteWorkout(id: number) {
  return guard(async (sql) => {
    await sql`delete from workouts where id = ${id}`;
    return { ok: true };
  });
}

// ---------------- Calendar ----------------
export async function saveEvent(p: { id?: number; title: string; note: string; start_at: string; all_day: boolean; repeat: string; alert_minutes: number | null }) {
  return guard(async (sql) => {
    const title = (p.title || '').trim().slice(0, 120);
    if (!title) throw new Error('Give the event a title.');
    if (!isLocalTime(p.start_at)) throw new Error('Pick a valid date and time.');
    const repeat = ['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(p.repeat) ? p.repeat : 'none';
    const alert = p.alert_minutes === null || p.alert_minutes === undefined ? null : clampInt(p.alert_minutes, 0, 60 * 24 * 14);
    const note = (p.note || '').trim().slice(0, 2000);
    if (p.id) {
      await sql`update events set title = ${title}, note = ${note}, start_at = ${p.start_at}::text::timestamp, all_day = ${!!p.all_day},
        repeat = ${repeat}, alert_minutes = ${alert} where id = ${p.id}`;
      // Times changed, so forget which alerts were already sent for future occurrences.
      await sql`delete from event_alerts_sent where event_id = ${p.id} and occurrence_at >= now()::timestamp - interval '1 day'`;
      return { ok: true, id: p.id };
    }
    const [r] = await sql`insert into events (title, note, start_at, all_day, repeat, alert_minutes)
      values (${title}, ${note}, ${p.start_at}::text::timestamp, ${!!p.all_day}, ${repeat}, ${alert}) returning id`;
    return { ok: true, id: r.id };
  });
}

export async function deleteEvent(id: number) {
  return guard(async (sql) => {
    await sql`delete from events where id = ${id}`;
    return { ok: true };
  });
}

// ---------------- Push devices ----------------
export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, label: string) {
  return guard(async (sql) => {
    if (!sub?.endpoint?.startsWith('https://') || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error('This device did not return a valid subscription.');
    await sql`insert into push_subscriptions (endpoint, p256dh, auth, label) values (${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth}, ${(label || '').slice(0, 80)})
      on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, label = excluded.label`;
    return { ok: true };
  });
}

export async function removePushSubscription(endpoint: string) {
  return guard(async (sql) => {
    await sql`delete from push_subscriptions where endpoint = ${endpoint}`;
    return { ok: true };
  });
}

export async function sendTestPush() {
  return guard(async (sql) => {
    const h = await headers();
    const host = h.get('x-forwarded-host') || h.get('host') || '';
    const proto = h.get('x-forwarded-proto') || 'https';
    const r = await sendToAll(sql, { title: (await currentUser()).name, body: 'Alerts are working on this device. 🌤️', url: '/calendar', tag: 'test' }, `${proto}://${host}`);
    if (r.devices === 0) throw new Error('No device has alerts turned on yet.');
    if (r.sent === 0) throw new Error(`Sending failed: ${r.failures[0] ?? 'unknown error'}`);
    return { ok: true, info: `Sent to ${r.sent} of ${r.devices} ${r.devices === 1 ? 'device' : 'devices'}.` };
  });
}

const num = (v: any, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : 0;
};
const KINDS: FoodKind[] = ['food', 'drink', 'other'];
const cleanTags = (t: any) => [...new Set((Array.isArray(t) ? t : []).map((x) => String(x).trim().toLowerCase().slice(0, 30)).filter(Boolean))].slice(0, 12);
const cleanCanvas = (c: any): CutoutCanvas => ({
  x: num(c?.x ?? 0.5, 0, 1), y: num(c?.y ?? 0.5, 0, 1), rot: num(c?.rot ?? 0, -360, 360), scale: num(c?.scale ?? 1, 0.3, 3), z: Math.round(num(c?.z ?? 0, 0, 10000)),
});

/** A sticker sent from the phone: a small WebP or PNG with transparency. */
function decodeImage(dataUrl: string) {
  const m = /^data:image\/(webp|png);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) throw new Error('A cutout image is not a valid picture.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 700_000) throw new Error('A cutout image is too large.');
  return buf;
}

export type EntryPayload = {
  id?: number;
  food_item_id: number | null;
  name: string;
  kind: FoodKind;
  grams: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  tags: string[];
  cutout:
    | { action: 'keep' }
    | { action: 'remove' }
    | { action: 'set'; image: string; width: number; height: number; method: 'tap' | 'lasso' | 'whole'; outline: unknown[] };
};
export type MomentPayload = {
  id?: number;
  occurred_at: string;
  place: string;
  people: string[];
  rating: number | null;
  favorite: boolean;
  note: string;
  entries: EntryPayload[];
};

export async function saveMoment(p: MomentPayload) {
  return guard(async (sql) => {
    if (!isLocalTime(p.occurred_at)) throw new Error('Pick a valid date and time.');
    const entries = (p.entries || []).slice(0, 20);
    if (!entries.length) throw new Error('Add at least one item.');
    for (const e of entries) if (!(e.name || '').trim()) throw new Error('Every item needs a name.');
    const people = cleanTags(p.people).map((x) => x.slice(0, 40));
    const rating = p.rating ? Math.round(num(p.rating, 1, 5)) : null;
    const place = (p.place || '').trim().slice(0, 80);
    const note = (p.note || '').trim().slice(0, 3000);

    return sql.begin(async (tx: any) => {
      let momentId = p.id;
      if (momentId) {
        const [m] = await tx`update food_moments set occurred_at = ${p.occurred_at}::text::timestamp, place = ${place}, people = ${people}::text[],
          rating = ${rating}, favorite = ${!!p.favorite}, note = ${note} where id = ${momentId} returning id`;
        if (!m) throw new Error('This meal no longer exists.');
        const keep = entries.map((e) => Number(e.id)).filter(Boolean);
        await tx`delete from food_entries where moment_id = ${momentId} ${keep.length ? tx`and id not in ${tx(keep)}` : tx``}`;
      } else {
        const [m] = await tx`insert into food_moments (occurred_at, place, people, rating, favorite, note)
          values (${p.occurred_at}::text::timestamp, ${place}, ${people}::text[], ${rating}, ${!!p.favorite}, ${note}) returning id`;
        momentId = m.id;
      }
      // Stickers already on this day's canvas, so a new one lands on top.
      const [{ z }] = await tx`select coalesce(max((c.canvas->>'z')::int), 0)::int as z from food_cutouts c join food_entries e on e.id = c.entry_id
        join food_moments m on m.id = e.moment_id where m.occurred_at::date = ${p.occurred_at.slice(0, 10)}::date`;
      let nextZ = z + 1;

      let i = 0;
      for (const e of entries) {
        const kind = KINDS.includes(e.kind) ? e.kind : 'food';
        const vals = {
          name: e.name.trim().slice(0, 80),
          grams: e.grams ? Math.round(num(e.grams, 0, 5000)) : null,
          kcal: Math.round(num(e.kcal, 0, 10000)),
          p: num(e.protein_g, 0, 1000), c: num(e.carbs_g, 0, 1000), f: num(e.fat_g, 0, 1000),
          tags: cleanTags(e.tags),
        };
        let itemId = e.food_item_id ? Number(e.food_item_id) : null;
        // A new dish typed by hand with calories joins your list, so next time it's one tap.
        if (!itemId && vals.kcal > 0 && vals.grams) {
          const [ex] = await tx`select id from food_items where lower(name) = lower(${vals.name}) and not archived limit 1`;
          if (ex) itemId = ex.id;
          else {
            const [ni] = await tx`insert into food_items (name, kind, portion_g, kcal_100g, source) values (${vals.name}, ${kind}, ${vals.grams}, 0, 'custom') returning id`;
            itemId = ni.id;
          }
        }
        let entryId = e.id ? Number(e.id) : 0;
        if (entryId) {
          const [row] = await tx`update food_entries set food_item_id = ${itemId}, name = ${vals.name}, kind = ${kind}, grams = ${vals.grams}, kcal = ${vals.kcal},
            protein_g = ${vals.p}, carbs_g = ${vals.c}, fat_g = ${vals.f}, tags = ${vals.tags}::text[], sort = ${i}
            where id = ${entryId} and moment_id = ${momentId} returning id`;
          if (!row) entryId = 0;
        }
        if (!entryId) {
          const [row] = await tx`insert into food_entries (moment_id, food_item_id, name, kind, grams, kcal, protein_g, carbs_g, fat_g, tags, sort)
            values (${momentId}, ${itemId}, ${vals.name}, ${kind}, ${vals.grams}, ${vals.kcal}, ${vals.p}, ${vals.c}, ${vals.f}, ${vals.tags}::text[], ${i}) returning id`;
          entryId = row.id;
        }
        i++;

        // Remember your version of the dish: its per-100 g values follow what you saved.
        if (itemId && vals.grams && vals.grams > 0) {
          const k = 100 / vals.grams;
          await tx`update food_items set uses = uses + ${e.id ? 0 : 1}, kcal_100g = ${Math.round(vals.kcal * k * 10) / 10},
            protein_100g = ${Math.round(vals.p * k * 10) / 10}, carbs_100g = ${Math.round(vals.c * k * 10) / 10}, fat_100g = ${Math.round(vals.f * k * 10) / 10}
            where id = ${itemId}`;
        }

        const c = e.cutout ?? { action: 'keep' };
        if (c.action === 'remove') await tx`delete from food_cutouts where entry_id = ${entryId}`;
        if (c.action === 'set') {
          const img = decodeImage(c.image);
          const method = ['tap', 'lasso', 'whole'].includes(c.method) ? c.method : 'lasso';
          const outline = (Array.isArray(c.outline) ? c.outline : []).slice(0, 400);
          // Scatter new stickers a little so they don't stack exactly.
          // A replaced sticker gets a new id (so phones never show a cached old picture) but keeps its spot.
          const [old] = await tx`delete from food_cutouts where entry_id = ${entryId} returning canvas`;
          const canvas = old?.canvas
            ? cleanCanvas(typeof old.canvas === 'string' ? JSON.parse(old.canvas) : old.canvas)
            : cleanCanvas({ x: 0.2 + Math.random() * 0.6, y: 0.25 + Math.random() * 0.5, rot: Math.round(Math.random() * 24 - 12), scale: 1, z: nextZ++ });
          await tx`insert into food_cutouts (entry_id, image, width, height, method, outline, canvas)
            values (${entryId}, ${img}, ${Math.round(num(c.width, 1, 2000))}, ${Math.round(num(c.height, 1, 2000))}, ${method}, ${tx.json(outline)}, ${tx.json(canvas)})`;
        }
      }
      return { ok: true, id: momentId };
    }) as Promise<Result>;
  });
}

export async function deleteMoment(id: number) {
  return guard(async (sql) => {
    await sql`delete from food_moments where id = ${Number(id) || 0}`;
    return { ok: true };
  });
}

/** Called when a sticker is dragged, turned or resized on the canvas. No page refresh needed. */
export async function moveCutout(id: number, canvas: CutoutCanvas) {
  try {
    await requireAuth();
    const sql = await db();
    await sql`update food_cutouts set canvas = ${sql.json(cleanCanvas(canvas))} where id = ${Number(id) || 0}`;
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Could not save the position.' };
  }
}

export async function saveFoodItem(it: { id?: number; name: string; aliases: string; kind: FoodKind; portion_g: number; kcal: number; protein_g: number; carbs_g: number; fat_g: number }) {
  return guard(async (sql) => {
    const name = (it.name || '').trim().slice(0, 80);
    if (!name) throw new Error('Give the dish a name.');
    const g = Math.round(num(it.portion_g, 1, 5000)) || 100;
    const k = 100 / g;
    const v = (x: number) => Math.round(num(x, 0, 10000) * k * 10) / 10;
    const kind = KINDS.includes(it.kind) ? it.kind : 'food';
    if (it.id) {
      await sql`update food_items set name = ${name}, aliases = ${(it.aliases || '').slice(0, 200)}, kind = ${kind}, portion_g = ${g},
        kcal_100g = ${v(it.kcal)}, protein_100g = ${v(it.protein_g)}, carbs_100g = ${v(it.carbs_g)}, fat_100g = ${v(it.fat_g)} where id = ${it.id}`;
      return { ok: true, id: it.id };
    }
    const [r] = await sql`insert into food_items (name, aliases, kind, portion_g, kcal_100g, protein_100g, carbs_100g, fat_100g)
      values (${name}, ${(it.aliases || '').slice(0, 200)}, ${kind}, ${g}, ${v(it.kcal)}, ${v(it.protein_g)}, ${v(it.carbs_g)}, ${v(it.fat_g)}) returning id`;
    return { ok: true, id: r.id };
  });
}

export async function archiveFoodItem(id: number) {
  return guard(async (sql) => {
    await sql`update food_items set archived = true where id = ${Number(id) || 0}`;
    return { ok: true };
  });
}

export async function saveLifeSetting(key: 'food_goal_kcal' | 'stock_capital' | 'stock_fee_buy' | 'stock_fee_sell' | 'stock_lot', value: string) {
  return guard(async (sql) => {
    const n = Number(String(value).replace(',', '.'));
    const ok =
      key === 'food_goal_kcal' ? n >= 500 && n <= 10000 :
      key === 'stock_capital' ? n >= 0 && n <= 1e13 :
      key === 'stock_lot' ? Number.isInteger(n) && n >= 1 && n <= 10000 :
      n >= 0 && n <= 5;
    if (!ok) throw new Error('That value is out of range.');
    await sql`insert into settings (key, value) values (${key}, ${String(n)}) on conflict (key) do update set value = excluded.value`;
    return { ok: true };
  });
}

/** What the meal logger needs: your food list, and places and people you used before. */
export async function loadFoodData() {
  await requireAuth();
  const sql = await db();
  const { getFoodItems } = await import('@/lib/data');
  const [items, places, people] = await Promise.all([
    getFoodItems(),
    sql`select place, count(*)::int as n from food_moments where place <> '' group by place order by n desc limit 30`,
    sql`select p, count(*)::int as n from food_moments, unnest(people) p group by p order by n desc limit 30`,
  ]);
  return { items, places: places.map((r) => r.place as string), people: people.map((r) => r.p as string) };
}

const list = (v: any, max = 12) => [...new Set((Array.isArray(v) ? v : []).map((x) => String(x).trim().slice(0, 40)).filter(Boolean))].slice(0, max);
const pos = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export type TradePayload = {
  id?: number;
  ticker: string;
  setup: string;
  timeframe: string;
  stop: number | null;
  target: number | null;
  tags: string[];
  context: string[];
  emotion_entry: string;
  emotion_exit: string;
  rationale: string;
  review: string;
  followed_plan: boolean | null;
  fills: { side: 'buy' | 'sell'; price: number; lots: number; fee: number; filled_at: string }[];
};

export async function saveTrade(p: TradePayload) {
  return guard(async (sql) => {
    const ticker = (p.ticker || '').trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, '').slice(0, 12);
    if (!ticker) throw new Error('Enter the ticker, e.g. BBRI.');
    const fills = (p.fills || []).slice(0, 60).map((f) => ({
      side: f.side === 'sell' ? 'sell' : 'buy',
      price: pos(f.price),
      lots: Math.round(Number(f.lots) || 0),
      fee: Math.max(0, Math.round(Number(f.fee) || 0)),
      filled_at: f.filled_at,
    }));
    if (!fills.some((f) => f.side === 'buy')) throw new Error('Add at least one buy.');
    for (const f of fills) {
      if (!f.price) throw new Error('Every fill needs a price.');
      if (f.lots <= 0) throw new Error('Every fill needs at least 1 lot.');
      if (!isLocalTime(f.filled_at)) throw new Error('Every fill needs a valid date and time.');
    }
    const bought = fills.filter((f) => f.side === 'buy').reduce((s, f) => s + f.lots, 0);
    const sold = fills.filter((f) => f.side === 'sell').reduce((s, f) => s + f.lots, 0);
    if (sold > bought) throw new Error(`You sell ${sold} lots but bought only ${bought}.`);
    const opened = fills.filter((f) => f.side === 'buy').map((f) => f.filled_at).sort()[0];
    // A position closes by itself once everything bought has been sold.
    const closed = sold === bought ? fills.filter((f) => f.side === 'sell').map((f) => f.filled_at).sort().at(-1)! : null;
    const fp = p.followed_plan === true || p.followed_plan === false ? p.followed_plan : null;
    const text = (v: string, n: number) => (v || '').trim().slice(0, n);

    return sql.begin(async (tx: any) => {
      let id = p.id;
      const cols = {
        ticker, status: closed ? 'closed' : 'open', setup: text(p.setup, 40), timeframe: text(p.timeframe, 20), stop: pos(p.stop), target: pos(p.target),
        emotion_entry: text(p.emotion_entry, 30), emotion_exit: text(p.emotion_exit, 30), rationale: text(p.rationale, 3000), review: text(p.review, 3000),
      };
      if (id) {
        const [r] = await tx`update trades set ticker = ${cols.ticker}, status = ${cols.status}, setup = ${cols.setup}, timeframe = ${cols.timeframe},
          stop = ${cols.stop}, target = ${cols.target}, tags = ${list(p.tags)}::text[], context = ${list(p.context)}::text[],
          emotion_entry = ${cols.emotion_entry}, emotion_exit = ${cols.emotion_exit}, rationale = ${cols.rationale}, review = ${cols.review},
          followed_plan = ${fp}, opened_at = ${opened}::text::timestamp, closed_at = ${closed}::text::timestamp where id = ${id} returning id`;
        if (!r) throw new Error('This trade no longer exists.');
        await tx`delete from trade_fills where trade_id = ${id}`;
      } else {
        const [r] = await tx`insert into trades (ticker, status, setup, timeframe, stop, target, tags, context, emotion_entry, emotion_exit, rationale, review, followed_plan, opened_at, closed_at)
          values (${cols.ticker}, ${cols.status}, ${cols.setup}, ${cols.timeframe}, ${cols.stop}, ${cols.target}, ${list(p.tags)}::text[], ${list(p.context)}::text[],
            ${cols.emotion_entry}, ${cols.emotion_exit}, ${cols.rationale}, ${cols.review}, ${fp}, ${opened}::text::timestamp, ${closed}::text::timestamp) returning id`;
        id = r.id;
      }
      for (const f of fills)
        await tx`insert into trade_fills (trade_id, side, price, lots, fee, filled_at) values (${id}, ${f.side}, ${f.price}, ${f.lots}, ${f.fee}, ${f.filled_at}::text::timestamp)`;
      return { ok: true, id };
    }) as Promise<Result>;
  });
}

export async function deleteTrade(id: number) {
  return guard(async (sql) => {
    await sql`delete from trades where id = ${Number(id) || 0}`;
    return { ok: true };
  });
}

/** One trade plus the fee and lot settings the form needs. */
export async function loadTrade(id?: number): Promise<{ trade: Trade | null; feeBuy: number; feeSell: number; lot: number }> {
  await requireAuth();
  const s = await getLifeSettings();
  let trade: Trade | null = null;
  if (id) {
    const { getTrades } = await import('@/lib/data');
    trade = (await getTrades()).find((t) => t.id === Number(id)) ?? null;
  }
  return { trade, feeBuy: s.feeBuy, feeSell: s.feeSell, lot: s.lot };
}
