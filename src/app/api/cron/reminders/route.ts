import { timingSafeEqual } from 'crypto';
import { activeUsers, clientFor, ensureSchema, getSecretSetting, getSettings, type Sql } from '@/lib/db';
import { addMinutes, nowLocal, occurrences, shortDate } from '@/lib/dates';
import { sendToAll } from '@/lib/push';
import type { CalEvent } from '@/lib/types';

// Called every minute by a free outside scheduler (cron-job.org), because
// Vercel's free plan can only run scheduled jobs once a day.
// One link serves everyone: it sends due alerts for each person from their own database.

export const dynamic = 'force-dynamic';

const GRACE_MIN = 15; // if a ping is missed, still send alerts up to 15 minutes late
const ALL_DAY_HOUR = 9; // all-day events alert relative to 09:00 that day

function keyOk(given: string, real: string) {
  if (!given || !real || given.length !== real.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(real));
}

function leadText(m: number) {
  if (m % 1440 === 0) return `${m / 1440} ${m === 1440 ? 'day' : 'days'}`;
  if (m % 60 === 0) return `${m / 60} ${m === 60 ? 'hour' : 'hours'}`;
  return `${m} min`;
}

async function sendDue(sql: Sql, origin: string) {
  const { timezone } = await getSettings(sql);
  const now = nowLocal(timezone);
  const windowStart = addMinutes(now, -GRACE_MIN);
  const events = await sql<CalEvent[]>`select id, title, note, to_char(start_at, 'YYYY-MM-DD"T"HH24:MI') as start_at, all_day, repeat, alert_minutes
    from events where alert_minutes is not null`;
  const due: { ev: CalEvent; occ: string }[] = [];
  for (const ev of events) {
    // alert time = event start (09:00 for all-day) minus the chosen lead time
    const shift = (ev.all_day ? ALL_DAY_HOUR * 60 : 0) - (ev.alert_minutes ?? 0);
    for (const occ of occurrences(ev, addMinutes(windowStart, -shift), addMinutes(now, -shift + 1), 5)) due.push({ ev, occ });
  }
  let sent = 0;
  for (const { ev, occ } of due) {
    // Record first; if another ping already claimed this alert, skip it.
    const claimed = await sql`insert into event_alerts_sent (event_id, occurrence_at) values (${ev.id}, ${occ}::text::timestamp)
      on conflict do nothing returning event_id`;
    if (!claimed.length) continue;
    const when = ev.all_day ? `${shortDate(occ)}, all day` : `${shortDate(occ)} at ${occ.slice(11, 16)}`;
    const lead = ev.alert_minutes ? ` (in ${leadText(ev.alert_minutes)})` : '';
    await sendToAll(sql, { title: ev.title, body: `${when}${lead}${ev.note ? `\n${ev.note.slice(0, 120)}` : ''}`, url: `/calendar?d=${occ.slice(0, 10)}`, tag: `ev-${ev.id}-${occ}` }, origin);
    sent++;
  }
  await sql`delete from event_alerts_sent where sent_at < now() - interval '60 days'`;
  return { now, checked: events.length, sent };
}

async function handle(req: Request) {
  const url = new URL(req.url);
  const given = url.searchParams.get('key') || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const users = activeUsers();
  // The link is valid if its key matches any person's key (each person's Settings shows their own).
  let ok = false;
  for (const u of users) {
    await ensureSchema(u.id);
    if (keyOk(given, await getSecretSetting('cron_key', clientFor(u.id)))) ok = true;
  }
  if (!ok) return new Response('Forbidden', { status: 403 });

  const origin = `${url.protocol}//${url.host}`;
  const results: Record<string, unknown> = {};
  for (const u of users) {
    try {
      results[`user${u.id}`] = await sendDue(clientFor(u.id), origin);
    } catch (e: any) {
      console.error(e);
      results[`user${u.id}`] = { error: 'failed' };
    }
  }
  return Response.json({ ok: true, ...results });
}

export const GET = handle;
export const POST = handle;
