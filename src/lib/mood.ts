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
