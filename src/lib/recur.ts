// Repeating events: list the occurrences that fall inside a time window.
// Works on local wall-time strings "YYYY-MM-DDTHH:mm".
import type { CalEvent } from './types';

const toMs = (s: string) => Date.parse(`${s.length === 10 ? s + 'T00:00' : s}:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 16);
const DAY = 86400000;

function daysIn(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Occurrence start times of `ev` with from <= start < to. */
export function occurrences(ev: Pick<CalEvent, 'start_at' | 'repeat'>, from: string, to: string, max = 400): string[] {
  const start = toMs(ev.start_at);
  const a = toMs(from);
  const b = toMs(to);
  const out: string[] = [];
  if (ev.repeat === 'none') {
    if (start >= a && start < b) out.push(ev.start_at);
    return out;
  }
  if (ev.repeat === 'daily' || ev.repeat === 'weekly') {
    const step = ev.repeat === 'daily' ? DAY : 7 * DAY;
    let k = Math.max(0, Math.ceil((a - start) / step));
    for (let t = start + k * step; t < b && out.length < max; t = start + ++k * step) out.push(fromMs(t));
    return out;
  }
  // monthly / yearly keep the original day of month, clamped to shorter months
  const y0 = Number(ev.start_at.slice(0, 4));
  const m0 = Number(ev.start_at.slice(5, 7));
  const d0 = Number(ev.start_at.slice(8, 10));
  const time = ev.start_at.slice(10) || 'T00:00';
  const stepM = ev.repeat === 'monthly' ? 1 : 12;
  const ay = Number(from.slice(0, 4));
  const am = Number(from.slice(5, 7));
  let k = Math.max(0, Math.floor(((ay - y0) * 12 + (am - m0)) / stepM) - 1);
  for (let guard = 0; guard < max + 24; guard++, k++) {
    const total = y0 * 12 + (m0 - 1) + k * stepM;
    const y = Math.floor(total / 12);
    const m = (total % 12) + 1;
    const d = Math.min(d0, daysIn(y, m));
    const s = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}${time}`;
    const t = toMs(s);
    if (t >= b) break;
    if (t >= a) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

export function addMinutes(s: string, mins: number) {
  return fromMs(toMs(s) + mins * 60000);
}
