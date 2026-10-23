import { SectionTabs } from '@/components/AppShell';
import Link from 'next/link';
import { getBase, getTransactions, getYearByMonth } from '@/lib/data';
import { addMonths, daysInMonth, monthName, ymd } from '@/lib/dates';
import { OTHER_COLOR, foldSlices, rpShort, type Slice } from '@/lib/format';
import type { Category, Tx } from '@/lib/types';
import { Money } from '@/components/Money';
import { Donut, Heatmap, MonthBars, Sankey, SliceLegend, TrendLine, type SankeyInput } from '@/components/charts';
import { IChevL, IChevR } from '@/components/icons';

function slicesFor(out: Tx[], cats: Map<number, Category>, from: string, toIncl: string): Slice[] {
  const m = new Map<number, number>();
  for (const t of out) m.set(t.category_id ?? 0, (m.get(t.category_id ?? 0) ?? 0) + t.amount);
  return [...m.entries()].map(([id, value]) => {
    const c = cats.get(id);
    return { id, value, label: c?.name ?? 'No category', emoji: c?.emoji, color: c?.color ?? OTHER_COLOR, href: `/history?cat=${id}&from=${from}&to=${toIncl}` };
  });
}

function sankeyFor(out: Tx[], income: number, slices: Slice[]): SankeyInput {
  const top = foldSlices(slices, 6);
  const topIds = new Set(top.map((s) => s.id));
  return {
    income,
    categories: top.map((s) => {
      const txs = s.id === 'other' ? out.filter((t) => !topIds.has(t.category_id ?? 0)) : out.filter((t) => (t.category_id ?? 0) === s.id);
      const byTitle = new Map<string, { label: string; value: number }>();
      for (const t of txs) {
        const key = (t.title || 'Untitled').trim().toLowerCase();
        const cur = byTitle.get(key) ?? { label: t.title.trim() || 'Untitled', value: 0 };
        cur.value += t.amount;
        byTitle.set(key, cur);
      }
      const places = [...byTitle.values()].sort((a, b) => b.value - a.value);
      const keep = places.slice(0, 2);
      const rest = places.slice(2).reduce((s, p) => s + p.value, 0);
      if (rest > 0) keep.push({ label: `${places.length - 2} more`, value: rest });
      return { id: s.id, label: s.label, color: s.color, value: s.value, places: keep };
    }),
  };
}

export default async function Reports({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const base = await getBase();
  const { today, categories } = base;
  const cats = new Map(categories.map((c) => [c.id, c]));
  const view = sp.view === 'year' ? 'year' : 'month';
  const ty = Number(today.slice(0, 4));
  const tm = Number(today.slice(5, 7));
  const y = Number(sp.y) || ty;
  const m = Math.min(12, Math.max(1, Number(sp.m) || tm));

  const nav = (yy: number, mm?: number) => `/reports?view=${view}&y=${yy}${mm ? `&m=${mm}` : ''}`;
  const isCurrent = view === 'month' ? y === ty && m === tm : y === ty;
  const prev = view === 'month' ? addMonths(y, m, -1) : { y: y - 1, m };
  const next = view === 'month' ? addMonths(y, m, 1) : { y: y + 1, m };

  const from = view === 'month' ? ymd(y, m, 1) : `${y}-01-01`;
  const to = view === 'month' ? ymd(addMonths(y, m, 1).y, addMonths(y, m, 1).m, 1) : `${y + 1}-01-01`;
  const lastDay = view === 'month' ? ymd(y, m, daysInMonth(y, m)) : `${y}-12-31`;

  const txs = await getTransactions({ from, to, types: ['expense', 'income'], sort: 'oldest' });
  const out = txs.filter((t) => t.type === 'expense');
  const spent = out.reduce((s, t) => s + t.amount, 0);
  const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const slices = slicesFor(out, cats, from, lastDay);
  const folded = foldSlices(slices);

  const totalDays = view === 'month' ? daysInMonth(y, m) : (Date.parse(to) - Date.parse(from)) / 86400000;
  const elapsed = isCurrent ? (view === 'month' ? Number(today.slice(8, 10)) : Math.round((Date.parse(today) - Date.parse(from)) / 86400000) + 1) : totalDays;
  const perDay = elapsed > 0 ? spent / elapsed : 0;

  // Month-only data
  let daily: Record<string, number> = {};
  let curDaily: number[] = [];
  let prevDaily: number[] = [];
  if (view === 'month') {
    for (const t of out) daily[t.occurred_at.slice(0, 10)] = (daily[t.occurred_at.slice(0, 10)] ?? 0) + t.amount;
    curDaily = Array.from({ length: daysInMonth(y, m) }, (_, i) => daily[ymd(y, m, i + 1)] ?? 0);
    const pm = addMonths(y, m, -1);
    const prevTx = await getTransactions({ from: ymd(pm.y, pm.m, 1), to: from, types: ['expense'] });
    const pd: Record<string, number> = {};
    for (const t of prevTx) pd[t.occurred_at.slice(0, 10)] = (pd[t.occurred_at.slice(0, 10)] ?? 0) + t.amount;
    prevDaily = Array.from({ length: daysInMonth(pm.y, pm.m) }, (_, i) => pd[ymd(pm.y, pm.m, i + 1)] ?? 0);
  }
  const yearData = view === 'year' ? await getYearByMonth(y) : null;
  const title = view === 'month' ? `${monthName(m)} ${y}` : String(y);

  return (
    <>
      <SectionTabs section="money" />
      <div className="page-head">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-sub">{view === 'month' ? `${monthName(m, true)} ${y}` : `The year ${y}`}{isCurrent ? ', so far' : ''}</p>
        </div>
        <div className="head-actions" style={{ alignItems: 'center' }}>
          <div className="seg" role="group" aria-label="View">
            <Link href={`/reports?view=month&y=${y}&m=${view === 'year' ? (y === ty ? tm : 12) : m}`} aria-current={view === 'month'}>Monthly</Link>
            <Link href={`/reports?view=year&y=${y}`} aria-current={view === 'year'}>Yearly</Link>
          </div>
          <div className="stepper">
            <Link href={nav(prev.y, view === 'month' ? prev.m : undefined)} aria-label="Previous"><IChevL /></Link>
            <strong>{title}</strong>
            {isCurrent ? <span className="dis" aria-hidden><IChevR /></span> : <Link href={nav(next.y, view === 'month' ? next.m : undefined)} aria-label="Next"><IChevR /></Link>}
          </div>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat glass"><div className="stat-label">Money out</div><div className="stat-value"><Money value={spent} short /></div></div>
        <div className="stat glass"><div className="stat-label">Money in</div><div className="stat-value pos"><Money value={income} short /></div></div>
        <div className="stat glass">
          <div className="stat-label">{income - spent >= 0 ? 'Left over' : 'Overspent'}</div>
          <div className={`stat-value ${income - spent < 0 ? 'warn' : ''}`}><Money value={Math.abs(income - spent)} short /></div>
        </div>
      </div>

      <div className="grid-even">
        {view === 'month' ? (
          <section className="glass card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Daily spending</h2>
                <p className="card-sub">Average <span className="money num">{rpShort(perDay)}</span> a day. Tap a day to see its transactions.</p>
              </div>
            </div>
            <Heatmap year={y} month={m} totals={daily} today={today} />
          </section>
        ) : (
          <section className="glass card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Month by month</h2>
                <p className="card-sub">Average <span className="money num">{rpShort(perDay * 30.4)}</span> spent a month</p>
              </div>
            </div>
            <MonthBars out={yearData!.out} inc={yearData!.inc} year={y} currentMonth={y === ty ? tm : undefined} />
          </section>
        )}

        <section className="glass card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Where the money went</h2>
              <p className="card-sub">Hover a slice, or tap a category for its transactions</p>
            </div>
          </div>
          {slices.length === 0 ? (
            <div className="empty"><strong>No spending in {title}</strong>Expenses you add will be grouped by category here.</div>
          ) : (
            <div className="donut-wrap">
              <Donut slices={folded} centerTop="Money out" />
              <SliceLegend slices={folded} perDay={elapsed} />
            </div>
          )}
        </section>
      </div>

      {view === 'month' && (
        <section className="glass card" style={{ marginTop: 16 }}>
          <div className="card-head">
            <div>
              <h2 className="card-title">Spending pace</h2>
              <p className="card-sub">Running total through the month, compared with the month before</p>
            </div>
          </div>
          <TrendLine current={curDaily} previous={prevDaily} labelCur={monthName(m)} labelPrev={monthName(addMonths(y, m, -1).m)}
            todayIndex={isCurrent ? Number(today.slice(8, 10)) : curDaily.length} />
        </section>
      )}

      <section className="glass card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div>
            <h2 className="card-title">Follow the money</h2>
            <p className="card-sub">From money in, into categories, then the things you paid for</p>
          </div>
        </div>
        <Sankey data={sankeyFor(out, income, slices)} />
      </section>
      <p className="faint" style={{ fontSize: 13, marginTop: 14 }}>Transfers between your own wallets and balance adjustments are not counted as money in or out.</p>
    </>
  );
}
