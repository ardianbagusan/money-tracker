// Formatting for workouts. Safe in browser and server code.
export function fmtDuration(sec: number) {
  const s = Math.round(sec || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** "1 h 20 min", "45 min" — for totals */
export function fmtHours(sec: number) {
  const m = Math.round((sec || 0) / 60);
  const h = Math.floor(m / 60);
  return h ? `${h} h ${m % 60 ? `${m % 60} min` : ''}`.trim() : `${m} min`;
}

export function km(m: number | null | undefined, digits = 2) {
  return ((m || 0) / 1000).toFixed(digits).replace(/\.?0+$/, '') || '0';
}

/** seconds per km -> "5:32" */
export function fmtPace(secPerKm: number) {
  if (!isFinite(secPerKm) || secPerKm <= 0) return '–';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`;
}

export const pace = (durationSec: number, distanceM: number | null) => (distanceM ? durationSec / (distanceM / 1000) : 0);

export const EFFORT = [
  '', 'Very easy', 'Easy', 'Light', 'Moderate', 'Steady', 'Somewhat hard', 'Hard', 'Very hard', 'Near max', 'All out',
];
