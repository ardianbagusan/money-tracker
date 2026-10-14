import { addDays, periodFor } from './dates';
import type { TxFilter } from './data';

export type HistoryParams = Record<string, string | undefined>;

export const RANGES = [
  { v: 'period', label: 'This period' },
  { v: '30d', label: 'Last 30 days' },
  { v: '90d', label: 'Last 90 days' },
  { v: 'year', label: 'This year' },
  { v: 'all', label: 'All time' },
];

const ids = (s?: string) => (s ? s.split(',').map(Number).filter(Boolean) : []);

/** Turns the History page's URL into a database filter. */
export function filterFromParams(p: HistoryParams, today: string, periodStart: number): TxFilter {
  const tomorrow = addDays(today, 1);
  let from: string | undefined;
  let to: string | undefined;
  const range = p.from || p.to ? 'custom' : p.range || 'period';
  if (range === 'custom') {
    from = p.from;
    to = p.to ? addDays(p.to, 1) : undefined;
  } else if (range === 'period') {
    const per = periodFor(today, periodStart);
    from = per.from;
    to = per.to;
  } else if (range === '30d') {
    from = addDays(today, -29);
    to = tomorrow;
  } else if (range === '90d') {
    from = addDays(today, -89);
    to = tomorrow;
  } else if (range === 'year') {
    from = `${today.slice(0, 4)}-01-01`;
    to = `${Number(today.slice(0, 4)) + 1}-01-01`;
  }
  return {
    from,
    to,
    types: p.type ? p.type.split(',').filter((t) => ['expense', 'income', 'transfer', 'adjust'].includes(t)) : undefined,
    categoryIds: ids(p.cat),
    walletIds: ids(p.wallet),
    q: p.q,
    recurringOnly: p.rec === '1',
    sort: (['newest', 'oldest', 'highest', 'lowest'].includes(p.sort ?? '') ? p.sort : 'newest') as TxFilter['sort'],
  };
}
