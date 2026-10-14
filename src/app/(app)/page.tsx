import Link from 'next/link';
import { getBase, getBudgets, getTransactions } from '@/lib/data';
import { greeting, monthName, partOfDay, periodFor, shortDate, weekday } from '@/lib/dates';
import { rpShort } from '@/lib/format';
import { Money } from '@/components/Money';
import { QuickAdd } from '@/components/QuickAdd';
import { HideToggle } from '@/components/HideToggle';
import { TxList } from '@/components/TxList';
import { IChevR, IGear } from '@/components/icons';

export default async function Overview() {
  const base = await getBase();
  const { today, now, categories, wallets } = base;
  const per = periodFor(today, base.settings.periodStart);
  const [periodTx, recent, budgets] = await Promise.all([
    getTransactions({ from: per.from, to: per.to, types: ['expense', 'income'] }),
    getTransactions({ limit: 6 }),
    getBudgets(),
  ]);

  const out = periodTx.filter((t) => t.type === 'expense');
  const spent = out.reduce((s, t) => s + t.amount, 0);
  const earned = periodTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const todayOut = out.filter((t) => t.occurred_at.startsWith(today));
  const todaySum = todayOut.reduce((s, t) => s + t.amount, 0);

  const byCat = new Map<number, number>();
  for (const t of out) byCat.set(t.category_id ?? 0, (byCat.get(t.category_id ?? 0) ?? 0) + t.amount);
  const catRows = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const max = catRows[0]?.[1] ?? 1;
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const active = wallets.filter((w) => !w.archived);
  const total = active.reduce((s, w) => s + (w.balance ?? 0), 0);
  const budgetTotal = Object.values(budgets).reduce((s, v) => s + v, 0);
  const budgetSpent = out.filter((t) => t.category_id && budgets[t.category_id]).reduce((s, t) => s + t.amount, 0);

  const pod = partOfDay(now);
  const night = pod === 'night';
  const pm = Number(per.from.slice(5, 7));
  const periodLabel = base.settings.periodStart === 1 ? `${monthName(pm, true)} spending` : `Spending since ${shortDate(per.from)}`;
  const todayLine =
    todayOut.length === 0
      ? 'Nothing has gone out today yet.'
      : `Today ${rpShort(todaySum)} has gone out in ${todayOut.length} ${todayOut.length === 1 ? 'payment' : 'payments'}.`;

  return (
    <>
      <div className="topbar mobile-only" style={{ display: 'flex' }}>
        <span className="brand" style={{ padding: 0 }}><span className="brand-mark" aria-hidden />Telaga</span>
        <span style={{ display: 'flex', gap: 8 }}>
          <Link href="/budgets" className="btn" style={{ minHeight: 44 }}>Budgets</Link>
          <Link href="/settings" className="icon-btn" aria-label="Settings"><IGear /></Link>
        </span>
      </div>

      <section className={`hero${night ? ' night' : ''}`} style={{ backgroundImage: `url(/art/hero-${pod}.jpg)`, marginTop: 12 }}>
        <div className="hero-date">{weekday(today)}, {shortDate(today)}</div>
        <h1 className="hero-greet">{greeting(now)}.</h1>
        <p className="hero-line">{todayLine}</p>
        <div className="hero-amount">
          <span className="big"><Money value={spent} /></span>
          <HideToggle />
        </div>
        <div className="hero-caption">
          {periodLabel}, day {per.dayIndex} of {per.totalDays}
        </div>
        <QuickAdd />
      </section>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="stack">
          <section className="glass card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Where it went</h2>
                <p className="card-sub">This period, by category</p>
              </div>
              <Link className="link" href="/reports">Reports</Link>
            </div>
            {catRows.length === 0 ? (
              <div className="empty"><strong>No spending yet this period</strong>Your categories will show up here as you add expenses.</div>
            ) : (
              catRows.slice(0, 7).map(([cid, amt]) => {
                const c = catMap.get(cid);
                const b = budgets[cid];
                return (
                  <Link key={cid} href={`/history?cat=${cid}`} className="cat-line">
                    <span className="bubble" style={{ background: `${c?.color ?? '#9CC8F2'}2e` }} aria-hidden>{c?.emoji ?? '✨'}</span>
                    <span>
                      <span className="cat-line-top">
                        <span>{c?.name ?? 'No category'}</span>
                        <span>
                          <Money value={amt} />
                          {b ? <span className="faint" style={{ fontWeight: 600 }}> of {rpShort(b)}</span> : null}
                        </span>
                      </span>
                      <span className="bar">
                        <span style={{ width: `${Math.max(3, (b ? Math.min(1, amt / b) : amt / max) * 100)}%`, background: b && amt > b ? 'var(--rose)' : c?.color ?? 'var(--mist)' }} />
                      </span>
                    </span>
                  </Link>
                );
              })
            )}
          </section>

          <section className="glass card">
            <div className="card-head">
              <h2 className="card-title">Recent</h2>
              <Link className="link" href="/history">See all</Link>
            </div>
            <TxList txs={recent} today={today} />
          </section>
        </div>

        <div className="stack">
          <section className="glass card">
            <div className="card-head" style={{ marginBottom: 6 }}>
              <div>
                <h2 className="card-title">This period</h2>
                <p className="card-sub">{shortDate(per.from)} to {shortDate(new Date(Date.parse(per.to) - 86400000).toISOString().slice(0, 10))}, {per.daysLeft} {per.daysLeft === 1 ? 'day' : 'days'} left</p>
              </div>
            </div>
            <div className="stats" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="stat"><div className="stat-label">Money in</div><div className="stat-value pos"><Money value={earned} short /></div></div>
              <div className="stat"><div className="stat-label">Money out</div><div className="stat-value"><Money value={spent} short /></div></div>
            </div>
            {budgetTotal > 0 && (
              <Link href="/budgets" style={{ display: 'block', marginTop: 14 }}>
                <div className="cat-line-top" style={{ fontSize: 14 }}>
                  <span>Budgets</span>
                  <span className={budgetSpent > budgetTotal ? 'warn' : 'muted'}>
                    <Money value={Math.abs(budgetTotal - budgetSpent)} short /> {budgetSpent > budgetTotal ? 'over' : 'left'}
                  </span>
                </div>
                <span className="bar">
                  <span style={{ width: `${Math.min(100, (budgetSpent / budgetTotal) * 100)}%`, background: budgetSpent > budgetTotal ? 'var(--rose)' : 'var(--leaf)' }} />
                  <span className="pace" style={{ left: `${(per.dayIndex / per.totalDays) * 100}%` }} />
                </span>
              </Link>
            )}
          </section>

          <section className="glass card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Balances</h2>
                <p className="card-sub">All wallets together</p>
              </div>
              <Link className="link" href="/wallets">Wallets</Link>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 10 }} className={total < 0 ? 'warn' : ''}>
              <Money value={total} />
            </div>
            <div className="rows">
              {active.slice(0, 5).map((w) => (
                <Link key={w.id} href={`/history?wallet=${w.id}&range=all`} className="row" style={{ gridTemplateColumns: 'auto 1fr auto auto' }}>
                  <span className="bubble" style={{ background: 'rgba(156,200,242,.16)', width: 38, height: 38, fontSize: 18 }} aria-hidden>{w.emoji}</span>
                  <span className="row-title">{w.name}</span>
                  <span className={`row-amt ${(w.balance ?? 0) < 0 ? 'warn' : ''}`}><Money value={w.balance ?? 0} /></span>
                  <IChevR width={16} className="faint" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
