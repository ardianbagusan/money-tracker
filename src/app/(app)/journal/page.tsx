import Link from 'next/link';
import { getBase, getJournal, getWorkouts } from '@/lib/data';
import { addDays, shortDate } from '@/lib/dates';
import { MOODS, moodColor, moodOf } from '@/lib/mood';
import { SectionTabs } from '@/components/AppShell';
import { LifeFeed, OpenSheet } from '@/components/LifeBits';
import { IBook, IRun, ITennis } from '@/components/icons';

const RANGES = [
  { v: '30', label: 'Last 30 days' },
  { v: '90', label: 'Last 90 days' },
  { v: 'all', label: 'All' },
];

export default async function JournalPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const base = await getBase();
  const { today } = base;
  const range = RANGES.some((r) => r.v === sp.range) ? sp.range : '30';
  const from = range === 'all' ? undefined : addDays(today, -(Number(range) - 1));
  const [entries, workouts, recent] = await Promise.all([
    getJournal(from),
    getWorkouts(from),
    getJournal(addDays(today, -13)),
  ]);

  // Last 14 days as a strip of coloured days
  const byDay = new Map<string, number[]>();
  for (const e of recent) {
    const d = e.occurred_at.slice(0, 10);
    byDay.set(d, [...(byDay.get(d) ?? []), e.mood]);
  }
  const strip = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today, i - 13);
    const ms = byDay.get(d);
    return { d, avg: ms ? ms.reduce((a, b) => a + b, 0) / ms.length : 0 };
  });
  const loggedToday = byDay.has(today);

  return (
    <>
      <SectionTabs section="life" />
      <div className="page-head">
        <div>
          <h1 className="page-title">Journal</h1>
          <p className="page-sub">{entries.length} {entries.length === 1 ? 'entry' : 'entries'} and {workouts.length} {workouts.length === 1 ? 'workout' : 'workouts'} {range === 'all' ? 'in total' : `in the last ${range} days`}</p>
        </div>
        <div className="head-actions">
          <OpenSheet req={{ kind: 'workout', sport: 'running' }}><IRun /> Run</OpenSheet>
          <OpenSheet req={{ kind: 'workout', sport: 'tennis' }}><ITennis /> Tennis</OpenSheet>
          <OpenSheet req={{ kind: 'journal' }} className="btn btn-primary"><IBook /> New entry</OpenSheet>
        </div>
      </div>

      <section className="glass card" style={{ marginBottom: 16 }}>
        <div className="card-head" style={{ marginBottom: 10 }}>
          <div>
            <h2 className="card-title">{loggedToday ? 'Your last two weeks' : 'How are you today?'}</h2>
            <p className="card-sub">{loggedToday ? 'Each square is a day, coloured by mood.' : 'Tap a face to write today’s entry.'}</p>
          </div>
          <Link className="link" href="/journal/insights">Insights</Link>
        </div>
        {!loggedToday && (
          <div className="mood-quick" style={{ marginTop: 0, marginBottom: 14 }}>
            {MOODS.map((m) => (
              <OpenSheet key={m.v} req={{ kind: 'journal', mood: m.v }} className="" label={`Log mood: ${m.label}`}>
                <span aria-hidden>{m.emoji}</span>
              </OpenSheet>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, minmax(0, 1fr))', gap: 4 }}>
          {strip.map((s) => (
            <div key={s.d} title={`${shortDate(s.d)}: ${s.avg ? moodOf(s.avg).label : 'no entry'}`}
              style={{ aspectRatio: '1', borderRadius: 6, background: s.avg ? moodColor(s.avg) : 'rgba(156,200,242,.08)', outline: s.d === today ? '2px solid var(--ember)' : 'none', outlineOffset: 1 }} />
          ))}
        </div>
        <div className="legend-scale" aria-hidden>
          {MOODS.map((m) => (<span key={m.v} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 8 }}><i style={{ background: m.color }} />{m.label}</span>))}
        </div>
      </section>

      <div className="chips" role="group" aria-label="Range" style={{ marginBottom: 12 }}>
        {RANGES.map((r) => (
          <Link key={r.v} href={r.v === '30' ? '/journal' : `/journal?range=${r.v}`} className={`chip${range === r.v ? ' on' : ''}`}>{r.label}</Link>
        ))}
      </div>

      <LifeFeed entries={entries} workouts={workouts} today={today}
        empty={<div className="glass card empty"><strong>Nothing written yet</strong>Start with today: pick a face above, then add what you did.</div>} />
    </>
  );
}
