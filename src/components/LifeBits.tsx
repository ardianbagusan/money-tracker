'use client';

import type { ReactNode } from 'react';
import { useApp, type SheetRequest } from './AppContext';
import { IBell, IRepeat, IRun, ITennis } from './icons';
import { dayLabel } from '@/lib/dates';
import { ENERGY, moodOf } from '@/lib/mood';
import { EFFORT, fmtDuration, fmtHours, fmtPace, km, pace } from '@/lib/sport';
import type { CalEvent, JournalEntry, Workout } from '@/lib/types';

/** A button that opens one of the app's sheets. Lets server pages open forms. */
export function OpenSheet({ req, className = 'btn', children, label }: { req: SheetRequest; className?: string; children: ReactNode; label?: string }) {
  const { openSheet } = useApp();
  return (
    <button className={className} onClick={() => openSheet(req)} aria-label={label}>
      {children}
    </button>
  );
}

export function MoodFace({ mood, size = 44 }: { mood: number; size?: number }) {
  const m = moodOf(mood);
  return (
    <span className="mood-face" style={{ width: size, height: size, fontSize: size * 0.55, background: `${m.color}33`, boxShadow: `inset 0 0 0 2px ${m.color}` }}
      role="img" aria-label={`Mood: ${m.label}`}>
      {m.emoji}
    </span>
  );
}

export function JournalCard({ e }: { e: JournalEntry }) {
  const { openSheet, tagById } = useApp();
  const m = moodOf(e.mood);
  return (
    <button className="row" style={{ gridTemplateColumns: 'auto minmax(0,1fr)', alignItems: 'start', textAlign: 'left' }} onClick={() => openSheet({ kind: 'journal', entry: e })}>
      <MoodFace mood={e.mood} />
      <span style={{ minWidth: 0 }}>
        <span className="row-title" style={{ display: 'flex', gap: 8, alignItems: 'baseline', whiteSpace: 'normal' }}>
          {m.label}
          <span className="faint" style={{ fontWeight: 600, fontSize: 13 }}>{e.occurred_at.slice(11, 16)}</span>
          {e.energy && <span className="faint" style={{ fontWeight: 600, fontSize: 13 }}>{ENERGY.find((x) => x.v === e.energy)?.label}</span>}
        </span>
        {e.tag_ids.length > 0 && (
          <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
            {e.tag_ids.map((id) => tagById.get(id)).filter(Boolean).map((t) => (
              <span key={t.id} className="tag-chip"><span aria-hidden>{t.emoji}</span>{t.name}</span>
            ))}
          </span>
        )}
        {e.note && <p className="note-text">{e.note}</p>}
      </span>
    </button>
  );
}

export function WorkoutRow({ w, showDate }: { w: Workout; showDate?: boolean }) {
  const { openSheet } = useApp();
  const running = w.sport === 'running';
  return (
    <button className="row" style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto' }} onClick={() => openSheet({ kind: 'workout', sport: w.sport, workout: w })}>
      <span className="bubble" style={{ background: running ? 'rgba(57,135,229,.2)' : 'rgba(25,158,112,.2)', color: running ? '#9cc8f2' : '#8fe0c0' }} aria-hidden>
        {running ? <IRun width={22} /> : <ITennis width={22} />}
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="row-title" style={{ display: 'block' }}>
          {running ? `Run, ${km(w.distance_m)} km` : `Tennis ${w.tennis_format ?? ''}`}
          {w.result ? <span className={w.result === 'won' ? 'pos' : 'faint'} style={{ fontWeight: 700 }}> {w.result === 'won' ? 'won' : w.result === 'lost' ? 'lost' : 'draw'}</span> : null}
        </span>
        <span className="row-meta">
          <span>{showDate ? `${w.occurred_at.slice(8, 10)}/${w.occurred_at.slice(5, 7)} ` : ''}{w.occurred_at.slice(11, 16)}</span>
          {running && <span>{fmtPace(pace(w.duration_sec, w.distance_m))} /km</span>}
          {w.effort ? <span className="faint">effort {w.effort}, {EFFORT[w.effort].toLowerCase()}</span> : null}
          {w.score ? <span className="faint">{w.score}</span> : null}
        </span>
      </span>
      <span className="row-amt num">{running ? fmtDuration(w.duration_sec) : fmtHours(w.duration_sec)}</span>
    </button>
  );
}

export function EventRow({ ev, occ }: { ev: CalEvent; occ: string }) {
  const { openSheet } = useApp();
  return (
    <button className="row" style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto' }} onClick={() => openSheet({ kind: 'event', event: ev })}>
      <span className="bubble" style={{ background: 'rgba(245,176,122,.18)', fontSize: 13, fontWeight: 800, color: '#ffd9bb', flexDirection: 'column', lineHeight: 1.1 }}>
        {ev.all_day ? 'All day' : occ.slice(11, 16)}
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="row-title" style={{ display: 'block' }}>{ev.title}</span>
        <span className="row-meta">
          {ev.repeat !== 'none' && <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><IRepeat /> {ev.repeat}</span>}
          {ev.alert_minutes !== null && <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><IBell /> alert</span>}
          {ev.note && <span className="faint">{ev.note}</span>}
        </span>
      </span>
      <span />
    </button>
  );
}

/** Journal entries and workouts, newest first, grouped by day. */
export function LifeFeed({ entries, workouts, today, empty }: { entries: JournalEntry[]; workouts: Workout[]; today: string; empty?: ReactNode }) {
  const days = new Map<string, { e: JournalEntry[]; w: Workout[] }>();
  for (const e of entries) {
    const d = e.occurred_at.slice(0, 10);
    if (!days.has(d)) days.set(d, { e: [], w: [] });
    days.get(d)!.e.push(e);
  }
  for (const w of workouts) {
    const d = w.occurred_at.slice(0, 10);
    if (!days.has(d)) days.set(d, { e: [], w: [] });
    days.get(d)!.w.push(w);
  }
  const sorted = [...days.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  if (!sorted.length) return <>{empty}</>;
  return (
    <div>
      {sorted.map(([d, { e, w }]) => {
        const avg = e.length ? e.reduce((s, x) => s + x.mood, 0) / e.length : 0;
        return (
          <section key={d} className="day-group">
            <div className="day-head">
              <span>{dayLabel(d, today)}</span>
              {avg ? <span>{moodOf(avg).emoji} {moodOf(avg).label}</span> : null}
            </div>
            <div className="rows">
              {e.map((x) => <JournalCard key={`e${x.id}`} e={x} />)}
              {w.map((x) => <WorkoutRow key={`w${x.id}`} w={x} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
