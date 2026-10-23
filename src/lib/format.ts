

// Rupiah formatting and parsing. Safe to use in both server and browser code.

const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

/** 1234567 -> "Rp 1.234.567" */
export function rp(n: number, opts: { sign?: boolean } = {}) {
  const v = Math.round(n || 0);
  const s = `Rp ${nf.format(Math.abs(v))}`;
  if (v < 0) return `−${s}`;
  if (opts.sign && v > 0) return `+${s}`;
  return s;
}

/** 1234567 -> "Rp 1,2jt", 40000 -> "Rp 40rb" */
export function rpShort(n: number) {
  const v = Math.abs(Math.round(n || 0));
  const neg = n < 0 ? '−' : '';
  const trim = (x: number) => (Math.round(x * 10) / 10).toString().replace('.', ',');
  if (v >= 1_000_000_000) return `${neg}Rp ${trim(v / 1_000_000_000)}M`;
  if (v >= 1_000_000) return `${neg}Rp ${trim(v / 1_000_000)}jt`;
  if (v >= 1_000) return `${neg}Rp ${trim(v / 1_000)}rb`;
  return `${neg}Rp ${v}`;
}

/** Digits only, grouped with dots, for amount inputs: 40000 -> "40.000" */
export function groupDigits(n: number | string) {
  const d = String(n ?? '').replace(/[^\d]/g, '');
  if (!d) return '';
  return nf.format(Number(d));
}

const MULT: Record<string, number> = {
  rb: 1e3, ribu: 1e3, k: 1e3, rbu: 1e3,
  jt: 1e6, juta: 1e6, m: 1e6, mio: 1e6,
  miliar: 1e9, milyar: 1e9, b: 1e9,
};

/**
 * Reads amounts the way people type them in Indonesia:
 * "40rb", "40 rb", "1,5jt", "1.5 juta", "Rp 40.000", "40000", "25k".
 * Returns null if no amount is found.
 */
export function parseAmount(text: string): number | null {
  if (!text) return null;
  const m = String(text)
    .toLowerCase()
    .match(/(\d+(?:[.,]\d+)*)\s*(rb|ribu|rbu|k|jt|juta|mio|miliar|milyar|m|b)?\b/);
  if (!m) return null;
  return amountFromMatch(m[1], m[2]);
}

export function amountFromMatch(num: string, suffix?: string) {
  const mult = suffix ? MULT[suffix] ?? 1 : 1;
  if (mult > 1) {
    // With a suffix, a single separator is a decimal point: "1,5jt" = 1.500.000
    const parts = num.split(/[.,]/);
    const value = parts.length === 2 && parts[1].length <= 2 ? Number(`${parts[0]}.${parts[1]}`) : Number(parts.join(''));
    return Math.round(value * mult);
  }
  // Without a suffix, dots and commas are thousand separators: "40.000" = 40000
  const parts = num.split(/[.,]/);
  if (parts.length > 1 && parts.slice(1).every((p) => p.length === 3)) return Number(parts.join(''));
  if (parts.length === 2 && parts[1].length <= 2) return Math.round(Number(`${parts[0]}.${parts[1]}`));
  return Number(parts.join(''));
}

// Chart colours. Checked for colour-blind separation and contrast on the navy
// surface (#14284f). Categories pick from this list; gray is for "Other".
export const CHART_COLORS = ['#d95926', '#3987e5', '#199e70', '#c98500', '#d55181', '#9085e9', '#e66767', '#2fa6b8'];
export const OTHER_COLOR = '#8396bb';
export const ALL_COLORS = [...CHART_COLORS, OTHER_COLOR];

export type Slice = { id: number | string; label: string; emoji?: string; value: number; color: string; href?: string };

/** Keeps the biggest 7 slices and folds the rest into "Other", so colours never repeat side by side. */
export function foldSlices(slices: Slice[], keep = 7): Slice[] {
  const sorted = [...slices].sort((a, b) => b.value - a.value);
  if (sorted.length <= keep + 1) return sorted;
  const rest = sorted.slice(keep);
  return [...sorted.slice(0, keep), { id: 'other', label: `${rest.length} more`, value: rest.reduce((s, x) => s + x.value, 0), color: OTHER_COLOR }];
}
