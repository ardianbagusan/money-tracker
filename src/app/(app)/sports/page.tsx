import Link from 'next/link';
import { getBase, getWorkouts } from '@/lib/data';
import { addDays, shortDate } from '@/lib/dates';
import { fmtDuration, fmtHours, fmtPace, km, pace } from '@/lib/life';
import { SectionTabs } from '@/components/AppShell';
import { OpenSheet, WorkoutRow } from '@/components/LifeBits';
import { IRun, ITennis } from '@/components/icons';
import type { Workout } from '@/lib/types';

const RANGES = [
  { v: 30, label: '30 days' },
  { v: 90, label: '90 days' },
  { v: 365, label: '1 year' },
];

/** Monday of the week containing `d` */
function weekStart(d: string) {
  const dt = new Date(`${d.slice(0, 10)}T00:00:00Z`);
  const dow = (dt.getUTCDay() + 6) % 7;
  return addDays(d.slice(0, 10), -dow);
}

export default async function SportsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const base = await getBase();
  const { today } = base;
  const days = RANGES.some((r) => String(r.v) === sp.days) ? Number(sp.days) : 30;
  const from = addDays(today, -(days - 1));
  const twelveWeeksAgo = addDays(weekStart(today), -7 * 11);
  const [all, chartRuns] = await Promise.all([
    getWorkouts(from, addDays(today, 1)),
    getWorkouts(twelveWeeksAgo, addDays(today, 1), 'running'),
  ]);
  const runs = all.filter((w) => w.sport === 'running');
  const tennis = all.filter((w) => w.sport === 'tennis');

  const runKm = runs.reduce((s, r) => s + (r.distance_m ?? 0), 0);
  const runSec = runs.reduce((s, r) => s + r.duration_sec, 0);
  const avgPace = runKm ? runSec / (runKm / 1000) : 0;
  const longest = runs.reduce<Workout | null>((b, r) => (!b || (r.distance_m ?? 0) > (b.distance_m ?? 0) ? r : b), null);
  const fastest = runs.filter((r) => (r.distance_m ?? 0) >= 3000).reduce<Workout | null>((b, r) => (!b || pace(r.duration_sec, r.distance_m) < pace(b.duration_sec, b.distance_m) ? r : b), null);

  const weeks = Array.from({ length: 12 }, (_, i) => {
    const ws = addDays(twelveWeeksAgo, i * 7);
    const m = chartRuns.filter((r) => weekStart(r.occurred_at) === ws).reduce((s, r) => s + (r.distance_m ?? 0), 0);
    return { ws, km: m / 1000 };
  });
  const maxWeek = Math.max(1, ...weeks.map((w) => w.km));

  const tSec = tennis.reduce((s, t) => s + t.duration_sec, 0);
  const singles = tennis.filter((t) => t.tennis_format === 'singles');
  const doubles = tennis.filter((t) => t.tennis_format === 'doubles');
  const won = tennis.filter((t) => t.result === 'won').length;
  const lost = tennis.filter((t) => t.result === 'lost').length;
  const singlesSec = singles.reduce((s, t) => s + t.duration_sec, 0);

  return (
    <>
      <SectionTabs section="life" />
      <div className="page-head">
        <div>
          <h1 className="page-title">Sports</h1>
          <p className="page-sub">Running and tennis in the last {days === 365 ? 'year' : `${days} days`}</p>
        </div>
        <div className="head-actions" style={{ alignItems: 'center' }}>
          <div className="seg" role="group" aria-label="Range">
            {RANGES.map((r) => <Link key={r.v} href={`/sports?days=${r.v}`} aria-current={days === r.v}>{r.label}</Link>)}
          </div>
          <OpenSheet req={{ kind: 'workout', sport: 'running' }} className="btn btn-primary"><IRun /> Log run</OpenSheet>
          <OpenSheet req={{ kind: 'workout', sport: 'tennis' }}><ITennis /> Log tennis</OpenSheet>
        </div>
      </div>

      <div className="grid-even" style={{ marginBottom: 16 }}>
        <section className="glass card">
          <div className="card-head"><div><h2 className="card-title">Running</h2><p className="card-sub">{runs.length} {runs.length === 1 ? 'run' : 'runs'}</p></div></div>
          <div className="stats" style={{ marginBottom: 14 }}>
            <div className="stat"><div className="stat-label">Distance</div><div className="stat-value num">{km(runKm, 1)} km</div></div>
            <div className="stat"><div className="stat-label">Time</div><div className="stat-value num">{fmtHours(runSec)}</div></div>
            <div className="stat"><div className="stat-label">Avg pace</div><div className="stat-value num">{fmtPace(avgPace)}</div></div>
          </div>
          <h3 className="card-title" style={{ fontSize: 15 }}>Kilometres per week</h3>
          <p className="card-sub" style={{ marginBottom: 8 }}>Last 12 weeks</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 4, alignItems: 'end', height: 130 }}>
            {weeks.map((w) => (
              <div key={w.ws} title={`Week of ${shortDate(w.ws)}: ${w.km.toFixed(1)} km`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 3 }}>
                <span className="faint num" style={{ fontSize: 10.5, fontWeight: 700 }}>{w.km ? w.km.toFixed(w.km < 10 ? 1 : 0) : ''}</span>
                <span style={{ width: '78%', height: `${(w.km / maxWeek) * 80}%`, minHeight: w.km ? 4 : 2, borderRadius: '4px 4px 2px 2px', background: w.km ? '#3987e5' : 'rgba(156,200,242,.1)' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }} className="faint">
            <span style={{ fontSize: 11.5, fontWeight: 600 }}>{shortDate(weeks[0].ws)}</span>
            <span style={{ fontSize: 11.5, fontWeight: 600 }}>This week</span>
          </div>
          {(longest || fastest) && (
            <div className="rows" style={{ marginTop: 14 }}>
              {longest && <div className="row" style={{ gridTemplateColumns: '1fr auto', cursor: 'default' }}><span><strong>Longest run</strong><span className="row-meta">{shortDate(longest.occurred_at)}</span></span><span className="row-amt num">{km(longest.distance_m)} km</span></div>}
              {fastest && <div className="row" style={{ gridTemplateColumns: '1fr auto', cursor: 'default' }}><span><strong>Fastest pace (3 km or more)</strong><span className="row-meta">{shortDate(fastest.occurred_at)}, {km(fastest.distance_m)} km in {fmtDuration(fastest.duration_sec)}</span></span><span className="row-amt num">{fmtPace(pace(fastest.duration_sec, fastest.distance_m))} /km</span></div>}
            </div>
          )}
        </section>

        <section className="glass card">
          <div className="card-head"><div><h2 className="card-title">Tennis</h2><p className="card-sub">{tennis.length} {tennis.length === 1 ? 'session' : 'sessions'}</p></div></div>
          <div className="stats" style={{ marginBottom: 14 }}>
            <div className="stat"><div className="stat-label">Time on court</div><div className="stat-value num">{fmtHours(tSec)}</div></div>
            <div className="stat"><div className="stat-label">Singles</div><div className="stat-value num">{singles.length}</div></div>
            <div className="stat"><div className="stat-label">Doubles</div><div className="stat-value num">{doubles.length}</div></div>
          </div>
          {tSec > 0 && (
            <>
              <div className="cat-line-top" style={{ fontSize: 14 }}>
                <span>Singles {fmtHours(singlesSec)}</span>
                <span>Doubles {fmtHours(tSec - singlesSec)}</span>
              </div>
              <span className="bar" style={{ height: 14, display: 'flex' }}>
                <span style={{ width: `${(singlesSec / tSec) * 100}%`, background: '#199e70' }} />
                <span style={{ width: 2, background: '#14284f' }} />
                <span style={{ flex: 1, background: '#c98500' }} />
              </span>
            </>
          )}
          {won + lost > 0 && (
            <p style={{ margin: '14px 0 0', fontWeight: 700 }}>
              Record: <span className="pos">{won} won</span>, {lost} lost
              <span className="faint" style={{ fontWeight: 600 }}> ({Math.round((won / (won + lost)) * 100)}% of matches with a result)</span>
            </p>
          )}
          {tennis.length === 0 && <p className="muted" style={{ fontSize: 14 }}>No tennis in this period. Log a session with how long you played and whether it was singles or doubles.</p>}
        </section>
      </div>

      <section className="glass card">
        <h2 className="card-title" style={{ marginBottom: 12 }}>All workouts</h2>
        {all.length === 0 ? (
          <div className="empty"><strong>No workouts yet</strong>Log a run or a tennis session with the buttons above.</div>
        ) : (
          <div className="rows">{all.map((w) => <WorkoutRow key={w.id} w={w} showDate />)}</div>
        )}
      </section>
    </>
  );
}
