'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { currentUser, db, type Sql } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { sendToAll } from '@/lib/push';

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
