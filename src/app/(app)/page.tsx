import Link from 'next/link';
import { getBase, getBudgets, getEvents, getJournal, getTransactions, getWorkouts } from '@/lib/data';
import { addDays, dayLabel, greeting, monthName, partOfDay, periodFor, shortDate, weekday } from '@/lib/dates';
import { MOODS, moodOf } from '@/lib/mood';
import { occurrences } from '@/lib/recur';
import { fmtHours, km } from '@/lib/sport';
import { OpenSheet } from '@/components/LifeBits';
import { rpShort } from '@/lib/format';
import { Money } from '@/components/Money';
import { QuickAdd } from '@/components/QuickAdd';
import { HideToggle } from '@/components/HideToggle';
import { TxList } from '@/components/TxList';
import { IBell, IChevR, IGear } from '@/components/icons';

export default async function Overview() {
  const base = await getBase();
  const { today, now, categories, wallets } = base;
  const per = periodFor(today, base.settings.periodStart);
  const weekAgo = addDays(today, -6);
  const [periodTx, recent, budgets, journal7, workouts7, events] = await Promise.all([
    getTransactions({ from: per.from, to: per.to, types: ['expense', 'income'] }),
    getTransactions({ limit: 6 }),
    getBudgets(),
    getJournal(weekAgo, addDays(today, 1)),
    getWorkouts(weekAgo, addDays(today, 1)),
    getEvents(),
  ]);
  const todayEntries = journal7.filter((e) => e.occurred_at.startsWith(today));
  const todayMood = todayEntries.length ? todayEntries.reduce((s, e) => s + e.mood, 0) / todayEntries.length : 0;
  const weekMood = journal7.length ? journal7.reduce((s, e) => s + e.mood, 0) / journal7.length : 0;
  const runs7 = workouts7.filter((w) => w.sport === 'running');
  const tennis7 = workouts7.filter((w) => w.sport === 'tennis');
  const upcoming = events
    .flatMap((ev) => occurrences(ev, `${now}`, `${addDays(today, 8)}T00:00`, 5).map((occ) => ({ ev, occ })))
    .sort((a, b) => (a.occ < b.occ ? -1 : 1))
    .slice(0, 4);

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
  // The sky follows today's mood once it's logged; before that, the time of day.
  const heroImg = todayMood ? `/art/mood-${Math.round(todayMood)}.jpg` : `/art/hero-${pod}.jpg`;
  const heroDark = todayMood ? Math.round(todayMood) <= 2 : pod === 'night';
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

      <section className={`hero${heroDark ? ' dark' : ''}`} style={{ backgroundImage: `url(${heroImg})`, marginTop: 12 }}>
        <div className="hero-date">{weekday(today)}, {shortDate(today)}</div>
        <h1 className="hero-greet">{greeting(now)}.</h1>
        {todayMood ? (
          <OpenSheet req={{ kind: 'journal' }} className="hero-mood-btn" label="Add another journal entry">
            <span className="hero-mood">
              <span className="big-face" aria-hidden>{moodOf(todayMood).emoji}</span>
              <span>
                <strong>You feel {moodOf(todayMood).label.toLowerCase()} today</strong>
                <span>{moodOf(todayMood).sky} skies. {todayEntries.length === 1 ? 'Tap to add another entry.' : `${todayEntries.length} entries today.`}</span>
              </span>
            </span>
          </OpenSheet>
        ) : (
          <>
            <p className="hero-line">How are you feeling today?</p>
            <div className="mood-quick">
              {MOODS.map((m) => (
                <OpenSheet key={m.v} req={{ kind: 'journal', mood: m.v }} className="" label={`Log mood: ${m.label}`}>
                  <span aria-hidden>{m.emoji}</span>
                </OpenSheet>
              ))}
            </div>
          </>
        )}
        <QuickAdd />
      </section>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="stack">
          <section className="glass card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Summary</h2>
                <p className="card-sub">{periodLabel}, day {per.dayIndex} of {per.totalDays}. {todayLine}</p>
              </div>
              <Link className="link" href="/reports">Details</Link>
            </div>
            <div className="hero-amount" style={{ marginTop: 0, marginBottom: 10 }}>
              <span className="big" style={{ fontSize: 'clamp(30px, 9vw, 40px)' }}><Money value={spent} /></span>
              <HideToggle />
            </div>
            <p className="card-sub" style={{ margin: '0 0 6px' }}>Where the money went</p>
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
            <div className="card-head">
              <div>
                <h2 className="card-title">Coming up</h2>
                <p className="card-sub">Next 7 days</p>
              </div>
              <Link className="link" href="/calendar">Calendar</Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="muted" style={{ fontSize: 14, margin: 0 }}>Nothing planned. Add a reminder from the + button.</p>
            ) : (
              <div className="rows">
                {upcoming.map(({ ev, occ }) => (
                  <Link key={ev.id + occ} href={`/calendar?d=${occ.slice(0, 10)}`} className="row" style={{ gridTemplateColumns: 'auto minmax(0,1fr)' }}>
                    <span className="bubble" style={{ background: 'rgba(245,176,122,.16)', width: 40, height: 40, fontSize: 12.5, fontWeight: 800, color: '#ffd9bb' }}>
                      {ev.all_day ? 'Day' : occ.slice(11, 16)}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span className="row-title" style={{ display: 'block' }}>{ev.title}</span>
                      <span className="row-meta"><span>{dayLabel(occ, today)}</span>{ev.alert_minutes !== null && <IBell aria-label="Has alert" />}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="glass card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Your week</h2>
                <p className="card-sub">Last 7 days</p>
              </div>
              <Link className="link" href="/journal">Journal</Link>
            </div>
            <div className="stats">
              <div className="stat"><div className="stat-label">Mood</div><div className="stat-value">{weekMood ? `${moodOf(weekMood).emoji} ${weekMood.toFixed(1)}` : '–'}</div></div>
              <div className="stat"><div className="stat-label">Running</div><div className="stat-value num">{km(runs7.reduce((s, r) => s + (r.distance_m ?? 0), 0), 1)} km</div></div>
              <div className="stat"><div className="stat-label">Tennis</div><div className="stat-value num">{tennis7.length ? fmtHours(tennis7.reduce((s, t) => s + t.duration_sec, 0)) : '–'}</div></div>
            </div>
          </section>

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
