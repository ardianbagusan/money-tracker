import Link from 'next/link';
import { getBase, getDailySpending, getJournal, getWorkouts } from '@/lib/data';
import { addDays, monthName, weekday } from '@/lib/dates';
import { MOODS, moodColor, moodOf, quadrant } from '@/lib/mood';
import { rpShort } from '@/lib/format';
import { SectionTabs } from '@/components/AppShell';
import { MoodTrend } from '@/components/MoodTrend';
import { OpenSheet } from '@/components/LifeBits';
import type { JournalEntry } from '@/lib/types';

const RANGES = [
  { v: 30, label: '30 days' },
  { v: 90, label: '90 days' },
  { v: 365, label: '1 year' },
];
const MIN_DAYS = 3; // a comparison needs at least this many days on each side

function dayAverages(entries: JournalEntry[]) {
  const m = new Map<string, number[]>();
  for (const e of entries) {
    const d = e.occurred_at.slice(0, 10);
    m.set(d, [...(m.get(d) ?? []), e.mood]);
  }
  return new Map([...m].map(([d, xs]) => [d, xs.reduce((a, b) => a + b, 0) / xs.length]));
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export default async function Insights({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const base = await getBase();
  const { today, tags } = base;
  const days = RANGES.some((r) => String(r.v) === sp.days) ? Number(sp.days) : 90;
  const from = addDays(today, -(days - 1));
  const to = addDays(today, 1);
  const year = Number(today.slice(0, 4));
  const [entries, yearEntries, workouts, spend] = await Promise.all([
    getJournal(from, to),
    getJournal(`${year}-01-01`, `${year + 1}-01-01`),
    getWorkouts(from, to),
    getDailySpending(from, to),
  ]);
  const avgByDay = dayAverages(entries);
  const loggedDays = [...avgByDay.keys()];

  if (entries.length === 0) {
    return (
      <>
        <SectionTabs section="life" />
        <div className="page-head"><div><h1 className="page-title">Mood insights</h1><p className="page-sub">Patterns from your journal</p></div></div>
        <section className="glass card empty">
          <strong>No journal entries in this period yet</strong>
          Log your mood for a couple of weeks and patterns appear here: your trend, best weekdays, and which activities go with better days.
          <div style={{ marginTop: 14 }}><OpenSheet req={{ kind: 'journal' }} className="btn btn-primary">Write today’s entry</OpenSheet></div>
        </section>
      </>
    );
  }

  // Headline numbers
  const overall = mean([...avgByDay.values()]);
  let streak = 0;
  for (let d = avgByDay.has(today) ? today : addDays(today, -1); avgByDay.has(d); d = addDays(d, -1)) streak++;
  const counts = MOODS.map((m) => entries.filter((e) => e.mood === m.v).length);

  // Trend: one point per day in range
  const trend = Array.from({ length: days }, (_, i) => {
    const d = addDays(from, i);
    return { d, avg: avgByDay.has(d) ? avgByDay.get(d)! : null };
  });

  // Weekday averages (Mon first)
  const wd = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((name) => {
    const xs = loggedDays.filter((d) => weekday(d) === name).map((d) => avgByDay.get(d)!);
    return { name, avg: xs.length ? mean(xs) : null, n: xs.length };
  });

  // Activities: average mood on days with the tag vs days without
  const tagDays = new Map<number, Set<string>>();
  for (const e of entries) for (const t of e.tag_ids) {
    if (!tagDays.has(t)) tagDays.set(t, new Set());
    tagDays.get(t)!.add(e.occurred_at.slice(0, 10));
  }
  const impacts = [...tagDays.entries()]
    .map(([id, set]) => {
      const withT = loggedDays.filter((d) => set.has(d)).map((d) => avgByDay.get(d)!);
      const without = loggedDays.filter((d) => !set.has(d)).map((d) => avgByDay.get(d)!);
      return { tag: tags.find((t) => t.id === id), n: withT.length, nOther: without.length, diff: mean(withT) - mean(without), avg: mean(withT) };
    })
    .filter((x) => x.tag && x.n >= MIN_DAYS && x.nOther >= MIN_DAYS)
    .sort((a, b) => b.diff - a.diff);

  // Links with other parts of the app
  const workoutDays = new Set(workouts.map((w) => w.occurred_at.slice(0, 10)));
  const moodWith = loggedDays.filter((d) => workoutDays.has(d)).map((d) => avgByDay.get(d)!);
  const moodWithout = loggedDays.filter((d) => !workoutDays.has(d)).map((d) => avgByDay.get(d)!);
  const lowDays = loggedDays.filter((d) => avgByDay.get(d)! <= 2.5);
  const okDays = loggedDays.filter((d) => avgByDay.get(d)! > 2.5);
  const spendLow = mean(lowDays.map((d) => spend[d] ?? 0));
  const spendOk = mean(okDays.map((d) => spend[d] ?? 0));

  // Mood Meter grid
  const quad: Record<string, number> = { yellow: 0, green: 0, red: 0, blue: 0 };
  let withEnergy = 0;
  for (const e of entries) {
    if (e.energy) withEnergy++;
    const q = quadrant(e.mood, e.energy);
    if (q) quad[q.key]++;
  }

  // Year in pixels
  const yearAvg = dayAverages(yearEntries);

  return (
    <>
      <SectionTabs section="life" />
      <div className="page-head">
        <div>
          <h1 className="page-title">Mood insights</h1>
          <p className="page-sub">From {loggedDays.length} logged {loggedDays.length === 1 ? 'day' : 'days'} in the last {days === 365 ? 'year' : `${days} days`}</p>
        </div>
        <div className="seg" role="group" aria-label="Range">
          {RANGES.map((r) => <Link key={r.v} href={`/journal/insights?days=${r.v}`} aria-current={days === r.v}>{r.label}</Link>)}
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat glass">
          <div className="stat-label">Average mood</div>
          <div className="stat-value">{moodOf(overall).emoji} {moodOf(overall).label}</div>
          <div className="faint" style={{ fontSize: 12.5, fontWeight: 600 }}>{overall.toFixed(1)} out of 5</div>
        </div>
        <div className="stat glass">
          <div className="stat-label">Days logged</div>
          <div className="stat-value">{loggedDays.length}<span className="faint" style={{ fontSize: 15 }}> / {days}</span></div>
          <div className="faint" style={{ fontSize: 12.5, fontWeight: 600 }}>{Math.round((loggedDays.length / days) * 100)}% of days</div>
        </div>
        <div className="stat glass">
          <div className="stat-label">Streak</div>
          <div className="stat-value">{streak} {streak === 1 ? 'day' : 'days'}</div>
          <div className="faint" style={{ fontSize: 12.5, fontWeight: 600 }}>{avgByDay.has(today) ? 'including today' : 'log today to keep it'}</div>
        </div>
      </div>

      <section className="glass card" style={{ marginBottom: 16 }}>
        <div className="card-head"><div><h2 className="card-title">Mood over time</h2><p className="card-sub">Thin line: each day. Thick line: 7-day average, which shows the trend better.</p></div></div>
        <MoodTrend days={trend} />
      </section>

      <div className="grid-even" style={{ marginBottom: 16 }}>
        <section className="glass card">
          <h2 className="card-title">By day of the week</h2>
          <p className="card-sub" style={{ marginBottom: 12 }}>Average mood, with how many days it is based on</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, alignItems: 'end', height: 170 }}>
            {wd.map((w) => (
              <div key={w.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}
                title={w.avg ? `${w.name}: ${w.avg.toFixed(1)} from ${w.n} days` : `${w.name}: no entries`}>
                <span style={{ fontSize: 18 }}>{w.avg ? moodOf(w.avg).emoji : ''}</span>
                <span style={{ width: '70%', borderRadius: '6px 6px 2px 2px', background: w.avg ? moodColor(w.avg) : 'rgba(156,200,242,.08)', height: `${w.avg ? (w.avg / 5) * 100 : 4}%`, minHeight: 4 }} />
                <span className="faint" style={{ fontSize: 12, fontWeight: 700 }}>{w.name.slice(0, 3)}</span>
                <span className="faint" style={{ fontSize: 11 }}>{w.n}d</span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass card">
          <h2 className="card-title">How often each mood</h2>
          <p className="card-sub" style={{ marginBottom: 12 }}>All entries in this period</p>
          <div className="stack" style={{ gap: 8 }}>
            {MOODS.slice().reverse().map((m) => {
              const c = counts[m.v - 1];
              return (
                <div key={m.v} style={{ display: 'grid', gridTemplateColumns: '28px 64px 1fr 34px', gap: 8, alignItems: 'center', fontWeight: 700, fontSize: 14 }}>
                  <span style={{ fontSize: 20 }}>{m.emoji}</span>
                  <span>{m.label}</span>
                  <span className="bar"><span style={{ width: `${(c / Math.max(1, entries.length)) * 100}%`, background: m.color }} /></span>
                  <span className="faint num" style={{ textAlign: 'right' }}>{c}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid-even" style={{ marginBottom: 16 }}>
        <section className="glass card">
          <h2 className="card-title">Activities and your mood</h2>
          <p className="card-sub" style={{ marginBottom: 12 }}>Average mood on days with each activity, compared with days without it</p>
          {impacts.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>Tag activities in your entries. Each needs at least {MIN_DAYS} days with it and {MIN_DAYS} without before it shows here.</p>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {impacts.slice(0, 10).map((x) => (
                <div key={x.tag!.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 14.5 }}>
                    {x.tag!.emoji} {x.tag!.name}
                    <span className="faint" style={{ fontWeight: 600, fontSize: 12.5 }}> {x.n} days</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ flex: 1, height: 10, position: 'relative', background: 'rgba(156,200,242,.08)', borderRadius: 99 }}>
                      <span style={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 1.5, background: 'var(--faint)' }} />
                      <span style={{ position: 'absolute', top: 0, bottom: 0, borderRadius: 99, background: x.diff >= 0 ? MOODS[4].color : MOODS[0].color,
                        left: x.diff >= 0 ? '50%' : `${50 - Math.min(50, Math.abs(x.diff) * 25)}%`, width: `${Math.min(50, Math.abs(x.diff) * 25)}%` }} />
                    </span>
                    <span className="num" style={{ fontWeight: 800, fontSize: 13, width: 34, textAlign: 'right' }}>{x.diff >= 0 ? '+' : '−'}{Math.abs(x.diff).toFixed(1)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="faint" style={{ fontSize: 12.5, margin: '12px 0 0' }}>These show what tends to happen together, not what causes what. Small numbers of days can mislead.</p>
        </section>

        <section className="glass card">
          <h2 className="card-title">Mood, exercise and money</h2>
          <p className="card-sub" style={{ marginBottom: 12 }}>Linking your journal with sports and spending</p>
          <div className="stack" style={{ gap: 12 }}>
            {moodWith.length >= MIN_DAYS && moodWithout.length >= MIN_DAYS ? (
              <div className="row" style={{ gridTemplateColumns: '1fr', cursor: 'default' }}>
                <span>
                  <strong>On days you ran or played tennis</strong>
                  <span className="muted" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginTop: 4 }}>
                    Mood {mean(moodWith).toFixed(1)} vs {mean(moodWithout).toFixed(1)} on other days ({moodWith.length} vs {moodWithout.length} days)
                  </span>
                </span>
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 14, margin: 0 }}>Exercise link: needs at least {MIN_DAYS} logged days with a workout and {MIN_DAYS} without.</p>
            )}
            {lowDays.length >= MIN_DAYS && okDays.length >= MIN_DAYS ? (
              <div className="row" style={{ gridTemplateColumns: '1fr', cursor: 'default' }}>
                <span>
                  <strong>Spending on low-mood days</strong>
                  <span className="muted" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginTop: 4 }}>
                    <span className="money">{rpShort(spendLow)}</span> a day when mood was Bad or Awful, vs <span className="money">{rpShort(spendOk)}</span> on other days ({lowDays.length} vs {okDays.length} days)
                  </span>
                </span>
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 14, margin: 0 }}>Spending link: needs at least {MIN_DAYS} low-mood days and {MIN_DAYS} other days.</p>
            )}
          </div>

          <h3 className="card-title" style={{ fontSize: 16, marginTop: 18 }}>Mood and energy</h3>
          <p className="card-sub" style={{ marginBottom: 10 }}>Based on the Yale Mood Meter. {withEnergy ? `${withEnergy} entries had an energy level.` : 'Add an energy level to entries to fill this in.'}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              { k: 'red', label: 'Stressed, tense', sub: 'unpleasant, high energy', c: '#e66767' },
              { k: 'yellow', label: 'Excited, energised', sub: 'pleasant, high energy', c: '#c98500' },
              { k: 'blue', label: 'Down, drained', sub: 'unpleasant, low energy', c: '#3987e5' },
              { k: 'green', label: 'Calm, content', sub: 'pleasant, low energy', c: '#199e70' },
            ].map((q) => (
              <div key={q.k} style={{ padding: 10, borderRadius: 14, background: `${q.c}22`, boxShadow: `inset 0 0 0 1px ${q.c}55` }}>
                <div style={{ fontWeight: 800, fontSize: 20 }} className="num">{quad[q.k]}</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{q.label}</div>
                <div className="faint" style={{ fontSize: 11.5 }}>{q.sub}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="glass card">
        <h2 className="card-title">{year} in pixels</h2>
        <p className="card-sub" style={{ marginBottom: 12 }}>One square per day, coloured by that day’s average mood</p>
        <div style={{ overflowX: 'auto' }}>
          <div className="pixels" style={{ minWidth: 520 }}>
            <span />
            {Array.from({ length: 31 }, (_, i) => <span key={i} style={{ textAlign: 'center' }}>{(i + 1) % 5 === 0 || i === 0 ? i + 1 : ''}</span>)}
            {Array.from({ length: 12 }, (_, mi) => {
              const m = mi + 1;
              const dim = new Date(Date.UTC(year, m, 0)).getUTCDate();
              return [
                <span key={`l${m}`}>{monthName(m)}</span>,
                ...Array.from({ length: 31 }, (_, di) => {
                  if (di >= dim) return <i key={`${m}-${di}`} className="none" />;
                  const d = `${year}-${String(m).padStart(2, '0')}-${String(di + 1).padStart(2, '0')}`;
                  const a = yearAvg.get(d);
                  return <i key={d} title={`${di + 1} ${monthName(m)}: ${a ? moodOf(a).label : 'no entry'}`} style={a ? { background: moodColor(a) } : d === today ? { outline: '1.5px solid var(--ember)' } : undefined} />;
                }),
              ];
            })}
          </div>
        </div>
        <div className="legend-scale" aria-hidden>
          {MOODS.map((m) => (<span key={m.v} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 8 }}><i style={{ background: m.color }} />{m.label}</span>))}
        </div>
      </section>
    </>
  );
}
