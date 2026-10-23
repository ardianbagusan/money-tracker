import { SectionTabs } from '@/components/AppShell';
import Link from 'next/link';
import { getBase, getBudgets, getTransactions } from '@/lib/data';
import { addDays, periodFor, shortDate } from '@/lib/dates';
import { rpShort } from '@/lib/format';
import { Money } from '@/components/Money';
import { BudgetActions } from './BudgetActions';

export default async function Budgets() {
  const base = await getBase();
  const { today, categories, settings } = base;
  const per = periodFor(today, settings.periodStart);
  const [budgets, txs] = await Promise.all([getBudgets(), getTransactions({ from: per.from, to: per.to, types: ['expense'] })]);
  const spentBy = new Map<number, number>();
  for (const t of txs) spentBy.set(t.category_id ?? 0, (spentBy.get(t.category_id ?? 0) ?? 0) + t.amount);

  const expenseCats = categories.filter((c) => c.kind === 'expense');
  const budgeted = expenseCats.filter((c) => budgets[c.id]);
  const unbudgeted = expenseCats.filter((c) => !budgets[c.id] && (spentBy.get(c.id) ?? 0) > 0).sort((a, b) => (spentBy.get(b.id) ?? 0) - (spentBy.get(a.id) ?? 0));
  const totalBudget = budgeted.reduce((s, c) => s + budgets[c.id], 0);
  const totalSpent = budgeted.reduce((s, c) => s + (spentBy.get(c.id) ?? 0), 0);
  const pace = per.dayIndex / per.totalDays;
  const left = totalBudget - totalSpent;
  const daysLeftIncl = per.daysLeft + 1;
  const lastDay = addDays(per.to, -1);

  return (
    <>
      <SectionTabs section="money" />
      <div className="page-head">
        <div>
          <h1 className="page-title">Budgets</h1>
          <p className="page-sub">
            {shortDate(per.from)} to {shortDate(lastDay)}, {per.daysLeft} {per.daysLeft === 1 ? 'day' : 'days'} left
          </p>
        </div>
        <BudgetActions categories={expenseCats.filter((c) => !c.archived || budgets[c.id])} budgets={budgets} periodStart={settings.periodStart}
          spentBy={Object.fromEntries(spentBy)} />
      </div>

      {budgeted.length === 0 ? (
        <section className="glass card">
          <div className="empty">
            <strong>No budgets yet</strong>
            Set a monthly limit on the categories you want to watch. You will see how much is left and whether you are spending faster than the month is passing.
          </div>
        </section>
      ) : (
        <div className="grid-2">
          <div className="stack">
            <section className="glass card">
              <div className="card-head">
                <div>
                  <h2 className="card-title">{left >= 0 ? 'Left to spend' : 'Over budget'}</h2>
                  <p className="card-sub">Across {budgeted.length} budgeted {budgeted.length === 1 ? 'category' : 'categories'}</p>
                </div>
              </div>
              <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }} className={left < 0 ? 'warn' : ''}>
                <Money value={Math.abs(left)} />
              </div>
              <p className="muted" style={{ margin: '8px 0 14px', fontSize: 14 }}>
                {left > 0 ? <>About <span className="money num">{rpShort(left / daysLeftIncl)}</span> a day for the rest of the period. </> : null}
                Spent <Money value={totalSpent} short /> of <Money value={totalBudget} short />.
              </p>
              <span className="bar" style={{ height: 14 }}>
                <span style={{ width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%`, background: totalSpent > totalBudget ? 'var(--rose)' : totalSpent / totalBudget > pace ? 'var(--sun)' : 'var(--leaf)' }} />
                <span className="pace" style={{ left: `${pace * 100}%` }} title="Where you would be if spending were spread evenly" />
              </span>
              <p className="faint" style={{ fontSize: 12.5, margin: '8px 0 0' }}>The white line marks today. Bars past it mean you are spending faster than the period is passing.</p>
            </section>

            <section className="glass card">
              <h2 className="card-title" style={{ marginBottom: 8 }}>By category</h2>
              {budgeted
                .sort((a, b) => (spentBy.get(b.id) ?? 0) / budgets[b.id] - (spentBy.get(a.id) ?? 0) / budgets[a.id])
                .map((c) => {
                  const s = spentBy.get(c.id) ?? 0;
                  const b = budgets[c.id];
                  const ratio = s / b;
                  const color = ratio > 1 ? 'var(--rose)' : ratio > pace + 0.1 ? 'var(--sun)' : 'var(--leaf)';
                  const status = ratio > 1 ? 'Over budget' : ratio > pace + 0.1 ? 'Ahead of pace' : 'On track';
                  return (
                    <Link key={c.id} href={`/history?cat=${c.id}`} className="cat-line">
                      <span className="bubble" style={{ background: `${c.color}2e` }} aria-hidden>{c.emoji}</span>
                      <span>
                        <span className="cat-line-top">
                          <span>{c.name}</span>
                          <span className={ratio > 1 ? 'warn' : ''}><Money value={s} short /> <span className="faint">of {rpShort(b)}</span></span>
                        </span>
                        <span className="bar">
                          <span style={{ width: `${Math.max(2, Math.min(100, ratio * 100))}%`, background: color }} />
                          <span className="pace" style={{ left: `${pace * 100}%` }} />
                        </span>
                        <span className="row-meta" style={{ marginTop: 6 }}>
                          <span className={ratio > 1 ? 'warn' : ''}>{status}</span>
                          <span className="faint">{ratio > 1 ? `${rpShort(s - b)} over` : `${rpShort(b - s)} left`}</span>
                        </span>
                      </span>
                    </Link>
                  );
                })}
            </section>
          </div>

          <section className="glass card">
            <h2 className="card-title">Spending without a budget</h2>
            <p className="card-sub" style={{ marginBottom: 10 }}>This period</p>
            {unbudgeted.length === 0 ? (
              <p className="muted" style={{ fontSize: 14 }}>Everything you spent this period is in a budgeted category.</p>
            ) : (
              <div className="rows">
                {unbudgeted.map((c) => (
                  <Link key={c.id} href={`/history?cat=${c.id}`} className="row">
                    <span className="bubble" style={{ background: `${c.color}2e`, width: 38, height: 38, fontSize: 18 }} aria-hidden>{c.emoji}</span>
                    <span className="row-title">{c.name}</span>
                    <span className="row-amt"><Money value={spentBy.get(c.id) ?? 0} /></span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
