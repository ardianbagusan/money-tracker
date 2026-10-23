

// Mood scale shared by the journal, the overview and the charts.
// Colours run from rainy blue (1) through grey (3) to sunny orange (5),
// matching the weather paintings. Blue vs orange stays distinguishable for
// colour-blind readers, and every chart also labels moods in words.
export const MOODS = [
  { v: 1, label: 'Awful', emoji: '😢', color: '#3f6fd1', weather: 'storm', sky: 'Stormy' },
  { v: 2, label: 'Bad', emoji: '😕', color: '#7c9be0', weather: 'rain', sky: 'Rainy' },
  { v: 3, label: 'Okay', emoji: '🙂', color: '#8a93a8', weather: 'cloudy', sky: 'Cloudy' },
  { v: 4, label: 'Good', emoji: '😃', color: '#eeb06a', weather: 'sunny', sky: 'Sunny' },
  { v: 5, label: 'Great', emoji: '😆', color: '#e5772c', weather: 'radiant', sky: 'Clear and bright' },
] as const;

export const moodOf = (v: number) => MOODS[Math.min(5, Math.max(1, Math.round(v))) - 1];

/** Colour for an average mood like 3.6, blended between the two nearest steps. */
export function moodColor(avg: number) {
  const lo = Math.max(1, Math.min(5, Math.floor(avg)));
  const hi = Math.min(5, lo + 1);
  const t = Math.max(0, Math.min(1, avg - lo));
  const a = hex(MOODS[lo - 1].color);
  const b = hex(MOODS[hi - 1].color);
  const mix = a.map((x, i) => Math.round(x + (b[i] - x) * t));
  return `rgb(${mix.join(',')})`;
}
function hex(h: string) {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export const ENERGY = [
  { v: 'low', label: 'Low energy', short: 'Low' },
  { v: 'medium', label: 'Medium energy', short: 'Medium' },
  { v: 'high', label: 'High energy', short: 'High' },
] as const;

/** Mood Meter quadrant (Yale) from mood + energy, for the dashboard grid. */
export function quadrant(mood: number, energy: string | null) {
  if (!energy || energy === 'medium' || mood === 3) return null;
  const pleasant = mood >= 4;
  const high = energy === 'high';
  if (pleasant && high) return { key: 'yellow', label: 'Excited, energised' };
  if (pleasant && !high) return { key: 'green', label: 'Calm, content' };
  if (!pleasant && high) return { key: 'red', label: 'Stressed, tense' };
  return { key: 'blue', label: 'Down, drained' };
}

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
