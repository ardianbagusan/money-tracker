import { OTHER_COLOR } from './palette';

export type Slice = { id: number | string; label: string; emoji?: string; value: number; color: string; href?: string };

/** Keeps the biggest 7 slices and folds the rest into "Other", so colours never repeat side by side. */
export function foldSlices(slices: Slice[], keep = 7): Slice[] {
  const sorted = [...slices].sort((a, b) => b.value - a.value);
  if (sorted.length <= keep + 1) return sorted;
  const rest = sorted.slice(keep);
  return [...sorted.slice(0, keep), { id: 'other', label: `${rest.length} more`, value: rest.reduce((s, x) => s + x.value, 0), color: OTHER_COLOR }];
}

