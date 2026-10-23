import Link from 'next/link';
import { SectionTabs } from '@/components/AppShell';
import { OpenSheet } from '@/components/LifeBits';
import { DayCanvas, FoodGoal, FoodList, MomentCard, momentKcal } from '@/components/FoodViews';
import { getBase, getFoodDailyKcal, getFoodMoments } from '@/lib/data';
import { getLifeSettings } from '@/lib/db';
import { addDays, addMonths, daysInMonth, monthName, shortDate, weekday, ymd } from '@/lib/dates';
import { IChevL, IChevR } from '@/components/icons';

const VIEWS = [
  { v: 'day', label: 'Day' },
  { v: 'moments', label: 'Moments' },
  { v: 'month', label: 'Month' },
  { v: 'list', label: 'List' },
];

export default async function FoodPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const base = await getBase();
  const { today } = base;
  const life = await getLifeSettings();
  const goal = life.foodGoalKcal;
  const view = VIEWS.some((v) => v.v === sp.view) ? sp.view : 'day';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.d || '') ? sp.d : today;
  const q = (v: string, extra = '') => `/food?view=${v}${extra}`;

  let body: React.ReactNode = null;
  if (view === 'day') {
    const moments = await getFoodMoments(day, addDays(day, 1));
    const asc = [...moments].reverse();
    const sum = (k: 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g') => moments.reduce((s, m) => s + m.entries.reduce((a, e) => a + Number(e[k] || 0), 0), 0);
    const kcal = sum('kcal');
    const pct = Math.min(100, (kcal / goal) * 100);
    body = (
      <>
        <div className="day-nav">
          <Link className="icon-btn" href={q('day', `&d=${addDays(day, -1)}`)} aria-label="Previous day"><IChevL /></Link>
          <strong>{day === today ? 'Today' : `${weekday(day)}, ${shortDate(day)}`}</strong>
          {day < today ? <Link className="icon-btn" href={q('day', `&d=${addDays(day, 1)}`)} aria-label="Next day"><IChevR /></Link> : <span style={{ width: 44 }} />}
        </div>
        <DayCanvas moments={moments} />
        <section className="glass card" style={{ marginTop: 14 }}>
          <div className="cat-line-top" style={{ fontSize: 15 }}>
            <span><strong className="num" style={{ fontSize: 22 }}>{kcal.toLocaleString('id-ID')}</strong> <span className="muted">of {goal.toLocaleString('id-ID')} kcal</span></span>
            <span className={kcal > goal ? 'warn' : 'muted'}>{kcal > goal ? `${(kcal - goal).toLocaleString('id-ID')} over` : `${(goal - kcal).toLocaleString('id-ID')} left`}</span>
          </div>
          <span className="bar" style={{ marginTop: 8 }}><span style={{ width: `${Math.max(2, pct)}%`, background: kcal > goal ? 'var(--rose)' : 'var(--ember)' }} /></span>
          <div className="stats" style={{ marginTop: 12 }}>
            <div className="stat"><div className="stat-label">Protein</div><div className="stat-value num">{Math.round(sum('protein_g'))} g</div></div>
            <div className="stat"><div className="stat-label">Carbs</div><div className="stat-value num">{Math.round(sum('carbs_g'))} g</div></div>
            <div className="stat"><div className="stat-label">Fat</div><div className="stat-value num">{Math.round(sum('fat_g'))} g</div></div>
          </div>
          <p className="faint" style={{ fontSize: 12.5, margin: '10px 0 0' }}>Estimates from your food list. Starter values are rough averages; correct them when you log and the app remembers.</p>
        </section>
        <section className="glass card" style={{ marginTop: 14 }}>
          <div className="card-head">
            <h2 className="card-title">Meals</h2>
            <OpenSheet req={{ kind: 'meal', date: day }} className="btn btn-primary">🍜 Log a meal</OpenSheet>
          </div>
          {asc.length === 0 ? <p className="muted" style={{ margin: 0 }}>Nothing logged{day === today ? ' yet today' : ' this day'}.</p> : (
            <div className="rows">{asc.map((m) => <MomentCard key={m.id} m={m} />)}</div>
          )}
        </section>
      </>
    );
  } else if (view === 'moments') {
    const moments = await getFoodMoments(addDays(today, -59), addDays(today, 1), 200);
    body = (
      <section className="glass card">
        <div className="card-head"><div><h2 className="card-title">Moments</h2><p className="card-sub">Last 60 days, newest first</p></div></div>
        {moments.length === 0 ? <p className="muted" style={{ margin: 0 }}>No meals yet.</p> : <div className="rows">{moments.map((m) => <MomentCard key={m.id} m={m} showDate />)}</div>}
      </section>
    );
  } else if (view === 'month') {
    const ym = /^\d{4}-\d{2}$/.test(sp.m || '') ? sp.m : today.slice(0, 7);
    const y = Number(ym.slice(0, 4)), mo = Number(ym.slice(5, 7));
    const first = ymd(y, mo, 1);
    const nextM = addMonths(y, mo, 1), prevM = addMonths(y, mo, -1);
    const end = ymd(nextM.y, nextM.m, 1);
    const [kcalByDay, moments] = await Promise.all([getFoodDailyKcal(first, end), getFoodMoments(first, end)]);
    // Biggest sticker of each day = the one with the most calories
    const pic = new Map<string, number>();
    const best = new Map<string, number>();
    for (const m of moments) for (const e of m.entries) {
      const d = m.occurred_at.slice(0, 10);
      if (e.cutout && e.kcal >= (best.get(d) ?? -1)) { best.set(d, e.kcal); pic.set(d, e.cutout.id); }
    }
    const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
    const n = daysInMonth(y, mo);
    const cells = [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => ymd(y, mo, i + 1))];
    const days = Object.values(kcalByDay);
    const avg = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0;
    body = (
      <section className="glass card">
        <div className="card-head">
          <Link className="icon-btn" href={q('month', `&m=${prevM.y}-${String(prevM.m).padStart(2, '0')}`)} aria-label="Previous month"><IChevL /></Link>
          <div style={{ textAlign: 'center' }}><h2 className="card-title">{monthName(mo, true)} {y}</h2><p className="card-sub">{days.length ? `${days.length} days logged, average ${avg.toLocaleString('id-ID')} kcal` : 'No meals logged'}</p></div>
          <Link className="icon-btn" href={q('month', `&m=${nextM.y}-${String(nextM.m).padStart(2, '0')}`)} aria-label="Next month"><IChevR /></Link>
        </div>
        <div className="food-month">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="food-month-head">{d}</span>)}
          {cells.map((d, i) => {
            if (!d) return <span key={`b${i}`} />;
            const k = kcalByDay[d];
            const state = k === undefined ? '' : k > goal * 1.05 ? 'over' : k >= goal * 0.85 ? 'near' : 'under';
            return (
              <Link key={d} href={q('day', `&d=${d}`)} className={`food-day${d === today ? ' today' : ''}`} aria-label={`${shortDate(d)}${k ? `, ${k} kcal` : ''}`}>
                <span className="food-day-n">{Number(d.slice(8))}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {pic.get(d) ? <img src={`/api/image/cutout/${pic.get(d)}`} alt="" /> : null}
                {state && <span className={`food-dot ${state}`} />}
              </Link>
            );
          })}
        </div>
        <p className="faint" style={{ fontSize: 12.5, margin: '10px 0 0' }}>Dot: 🟢 under 85% of your goal · 🟠 near it · 🔴 more than 5% over.</p>
      </section>
    );
  } else {
    const moments = await getFoodMoments(addDays(today, -364), addDays(today, 1), 1000);
    body = <section className="glass card"><FoodList moments={moments} /></section>;
  }

  return (
    <>
      <SectionTabs section="life" />
      <div className="page-head">
        <div>
          <h1 className="page-title">Food</h1>
          <p className="page-sub">What you ate, as a scrapbook. <FoodGoal goal={goal} /></p>
        </div>
        <div className="head-actions"><OpenSheet req={{ kind: 'meal' }} className="btn btn-primary">🍜 Log a meal</OpenSheet></div>
      </div>
      <nav className="chips" style={{ marginBottom: 14 }} aria-label="Food views">
        {VIEWS.map((v) => <Link key={v.v} href={q(v.v)} className="chip" aria-current={view === v.v ? 'page' : undefined} aria-pressed={view === v.v}>{v.label}</Link>)}
      </nav>
      {body}
    </>
  );
}
