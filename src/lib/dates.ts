// Dates are stored as local wall time ("2026-10-14T11:14") in the time zone set
// in Settings, so a coffee at 23:30 in Jakarta always counts on that day.

export function nowLocal(tz: string, at: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
}

export const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

export function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addMonths(y: number, m: number, delta: number) {
  const t = y * 12 + (m - 1) + delta;
  return { y: Math.floor(t / 12), m: (t % 12) + 1 };
}

export function addDays(date: string, n: number) {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Budget period containing `today`, given the day the period starts on (1–28). */
export function periodFor(today: string, startDay: number) {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const d = Number(today.slice(8, 10));
  const start = d >= startDay ? { y, m } : addMonths(y, m, -1);
  const next = addMonths(start.y, start.m, 1);
  const from = ymd(start.y, start.m, startDay);
  const to = ymd(next.y, next.m, startDay); // exclusive
  const totalDays = Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
  const dayIndex = Math.round((Date.parse(today.slice(0, 10)) - Date.parse(from)) / 86400000) + 1;
  return { from, to, totalDays, dayIndex, daysLeft: totalDays - dayIndex };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const monthName = (m: number, long = false) => (long ? MONTHS_LONG : MONTHS)[m - 1];

export function weekday(date: string) {
  return WEEKDAYS[new Date(`${date.slice(0, 10)}T00:00:00Z`).getUTCDay()];
}

/** "2026-10-14" -> "14 Oct" (adds the year if it isn't `currentYear`) */
export function shortDate(date: string, currentYear?: number) {
  const y = Number(date.slice(0, 4));
  const s = `${Number(date.slice(8, 10))} ${monthName(Number(date.slice(5, 7)))}`;
  return currentYear && y !== currentYear ? `${s} ${y}` : s;
}

export function dayLabel(date: string, today: string) {
  const d = date.slice(0, 10);
  if (d === today.slice(0, 10)) return 'Today';
  if (d === addDays(today, -1)) return 'Yesterday';
  return `${weekday(d)}, ${shortDate(d, Number(today.slice(0, 4)))}`;
}

export function partOfDay(time: string) {
  const h = Number(time.slice(11, 13));
  if (h >= 5 && h < 9) return 'dawn';
  if (h >= 9 && h < 16) return 'day';
  if (h >= 16 && h < 19) return 'dusk';
  return 'night';
}

export function greeting(time: string) {
  const h = Number(time.slice(11, 13));
  if (h >= 4 && h < 11) return 'Good morning';
  if (h >= 11 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 22) return 'Good evening';
  return 'Good night';
}

/** Advance a recurring date by one step. Monthly keeps the day, clamped to month end. */
export function advance(at: string, freq: 'daily' | 'weekly' | 'monthly' | 'yearly', anchorDay?: number) {
  const time = at.slice(10) || 'T09:00';
  if (freq === 'daily') return addDays(at, 1) + time;
  if (freq === 'weekly') return addDays(at, 7) + time;
  const y = Number(at.slice(0, 4));
  const m = Number(at.slice(5, 7));
  const d = anchorDay ?? Number(at.slice(8, 10));
  const n = freq === 'monthly' ? addMonths(y, m, 1) : { y: y + 1, m };
  return ymd(n.y, n.m, Math.min(d, daysInMonth(n.y, n.m))) + time;
}
