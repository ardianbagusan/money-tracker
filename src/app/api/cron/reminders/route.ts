// Called every minute by a free outside scheduler (cron-job.org), because
// Vercel's free plan can only run scheduled jobs once a day.
// It sends a push alert for every reminder whose alert time has just arrived.
import { timingSafeEqual } from 'crypto';
import { sql, ensureSchema, getSecretSetting, getSettings } from '@/lib/db';
import { nowLocal, shortDate } from '@/lib/dates';
import { addMinutes, occurrences } from '@/lib/recur';
import { sendToAll } from '@/lib/push';
import type { CalEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

const GRACE_MIN = 15; // if a ping is missed, still send alerts up to 15 minutes late
const ALL_DAY_HOUR = 9; // all-day events alert relative to 09:00 that day

function keyOk(given: string, real: string) {
  if (!given || !real || given.length !== real.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(real));
}

async function handle(req: Request) {
  await ensureSchema();
  const url = new URL(req.url);
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const real = await getSecretSetting('cron_key');
  if (!keyOk(url.searchParams.get('key') || bearer, real)) return new Response('Forbidden', { status: 403 });

  const { timezone } = await getSettings();
  const now = nowLocal(timezone);
  const windowStart = addMinutes(now, -GRACE_MIN);
  const events = await sql<CalEvent[]>`select id, title, note, to_char(start_at, 'YYYY-MM-DD"T"HH24:MI') as start_at, all_day, repeat, alert_minutes
    from events where alert_minutes is not null`;

  const due: { ev: CalEvent; occ: string }[] = [];
  for (const ev of events) {
    // alert time = event start (09:00 for all-day) minus the chosen lead time
    const shift = (ev.all_day ? ALL_DAY_HOUR * 60 : 0) - (ev.alert_minutes ?? 0);
    const from = addMinutes(windowStart, -shift);
    const to = addMinutes(now, -shift + 1);
    for (const occ of occurrences(ev, from, to, 5)) due.push({ ev, occ });
  }

  const origin = `${url.protocol}//${url.host}`;
  let sent = 0;
  for (const { ev, occ } of due) {
    // Record first; if another ping already claimed this alert, skip it.
    const claimed = await sql`insert into event_alerts_sent (event_id, occurrence_at) values (${ev.id}, ${occ}::text::timestamp)
      on conflict do nothing returning event_id`;
    if (!claimed.length) continue;
    const when = ev.all_day ? `${shortDate(occ)}, all day` : `${shortDate(occ)} at ${occ.slice(11, 16)}`;
    const lead = ev.alert_minutes ? ` (in ${leadText(ev.alert_minutes)})` : '';
    await sendToAll({ title: ev.title, body: `${when}${lead}${ev.note ? `\n${ev.note.slice(0, 120)}` : ''}`, url: `/calendar?d=${occ.slice(0, 10)}`, tag: `ev-${ev.id}-${occ}` }, origin);
    sent++;
  }
  await sql`delete from event_alerts_sent where sent_at < now() - interval '60 days'`;
  return Response.json({ ok: true, now, checked: events.length, sent });
}

function leadText(m: number) {
  if (m % 1440 === 0) return `${m / 1440} ${m === 1440 ? 'day' : 'days'}`;
  if (m % 60 === 0) return `${m / 60} ${m === 60 ? 'hour' : 'hours'}`;
  return `${m} min`;
}

export const GET = handle;
export const POST = handle;
