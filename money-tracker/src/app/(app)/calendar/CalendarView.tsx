'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useApp } from '@/components/AppContext';
import { EventRow, JournalCard, WorkoutRow } from '@/components/LifeBits';
import { PushSetup } from '@/components/PushSetup';
import { Money } from '@/components/Money';
import { IBell, IBook, IChevL, IChevR, IPlus, IRun } from '@/components/icons';
import { dayLabel, monthName, shortDate } from '@/lib/dates';
import { moodColor, moodOf } from '@/lib/life';
import type { CalEvent, JournalEntry, Workout } from '@/lib/types';

export type DayInfo = { events: { id: number; occ: string }[]; moods: number[]; workouts: number[]; spend: number };

export function CalendarView(props: {
  year: number; month: number; today: string; initialSel: string; days: Record<string, DayInfo>;
  events: CalEvent[]; entries: JournalEntry[]; workouts: Workout[]; upcoming: { id: number; occ: string }[];
  prevHref: string; nextHref: string; todayHref: string;
}) {
  const { year, month, today, days, events, entries, workouts, upcoming } = props;
  const { openSheet } = useApp();
  const [sel, setSel] = useState(props.initialSel);
  const evById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const entryById = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const workoutById = useMemo(() => new Map(workouts.map((w) => [w.id, w])), [workouts]);
  const grid = Object.keys(days).sort();
  const mm = String(month).padStart(2, '0');
  const info = days[sel];
  const selEntries = (info?.moods ?? []).map((id) => entryById.get(id)!).filter(Boolean);
  const selWorkouts = (info?.workouts ?? []).map((id) => workoutById.get(id)!).filter(Boolean);
  const moodAvg = (d: DayInfo) => {
    const ms = d.moods.map((id) => entryById.get(id)?.mood ?? 0).filter(Boolean);
    return ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : 0;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="page-sub">Reminders, events, and how each day went</p>
        </div>
        <div className="head-actions" style={{ alignItems: 'center' }}>
          <div className="stepper">
            <Link href={props.prevHref} aria-label="Previous month"><IChevL /></Link>
            <strong>{monthName(month)} {year}</strong>
            <Link href={props.nextHref} aria-label="Next month"><IChevR /></Link>
          </div>
          {!today.startsWith(`${year}-${mm}`) && <Link className="btn" href={props.todayHref}>Today</Link>}
          <button className="btn btn-primary" onClick={() => openSheet({ kind: 'event', date: sel })}><IPlus /> Reminder</button>
        </div>
      </div>

      <div className="grid-2">
        <div className="stack">
          <section className="glass card" style={{ padding: 14 }}>
            <div className="cal" role="grid" aria-label={`${monthName(month, true)} ${year}`}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="dow">{d}</div>)}
              {grid.map((d) => {
                const di = days[d];
                const avg = moodAvg(di);
                const inMonth = d.slice(5, 7) === mm;
                const label = `${shortDate(d)}${di.events.length ? `, ${di.events.length} events` : ''}${avg ? `, mood ${moodOf(avg).label}` : ''}`;
                return (
                  <button key={d} onClick={() => setSel(d)} aria-label={label} aria-pressed={sel === d}
                    className={`${inMonth ? '' : 'out'} ${d === today ? 'today' : ''} ${sel === d ? 'sel' : ''}`}>
                    <span className="dnum">{Number(d.slice(8, 10))}</span>
                    <span className="marks">
                      {avg ? <i className="mdot" style={{ background: moodColor(avg) }} title={moodOf(avg).label} /> : null}
                      {di.workouts.length ? <span aria-hidden>{di.workouts.map((id) => (workoutById.get(id)?.sport === 'running' ? '🏃' : '🎾')).slice(0, 2).join('')}</span> : null}
                      {di.events.length ? <i className="evt-dot" /> : null}
                    </span>
                    {di.events.slice(0, 2).map((o) => <span key={o.occ + o.id} className="evt">{evById.get(o.id)?.title}</span>)}
                    {di.events.length > 2 && <span className="faint" style={{ fontSize: 11, fontWeight: 700 }}>+{di.events.length - 2}</span>}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="glass card">
            <div className="card-head">
              <div>
                <h2 className="card-title">{dayLabel(sel, today)}</h2>
                <p className="card-sub">
                  {info?.spend ? <>Spent <Money value={info.spend} /></> : 'Nothing spent'}
                  {selEntries.length ? `, mood ${moodOf(selEntries.reduce((s, e) => s + e.mood, 0) / selEntries.length).label.toLowerCase()}` : ''}
                </p>
              </div>
            </div>
            <div className="chips" style={{ marginBottom: 12 }}>
              <button className="chip" onClick={() => openSheet({ kind: 'event', date: sel })}><IBell /> Reminder</button>
              <button className="chip" onClick={() => openSheet({ kind: 'journal', date: sel })}><IBook /> Journal</button>
              <button className="chip" onClick={() => openSheet({ kind: 'workout', sport: 'running', date: sel })}><IRun /> Workout</button>
            </div>
            <div className="rows">
              {(info?.events ?? []).map((o) => evById.get(o.id) && <EventRow key={o.occ + o.id} ev={evById.get(o.id)!} occ={o.occ} />)}
              {selEntries.map((e) => <JournalCard key={`e${e.id}`} e={e} />)}
              {selWorkouts.map((w) => <WorkoutRow key={`w${w.id}`} w={w} />)}
            </div>
            {!info?.events.length && !selEntries.length && !selWorkouts.length && <p className="muted" style={{ fontSize: 14, margin: 0 }}>Nothing on this day yet.</p>}
          </section>
        </div>

        <div className="stack">
          <PushSetup />
          <section className="glass card">
            <h2 className="card-title" style={{ marginBottom: 12 }}>Coming up</h2>
            {upcoming.length === 0 ? (
              <p className="muted" style={{ fontSize: 14, margin: 0 }}>No events in the next month. Add a reminder for bills, birthdays or appointments.</p>
            ) : (
              <div className="rows">
                {upcoming.map((o) => {
                  const ev = evById.get(o.id);
                  if (!ev) return null;
                  return (
                    <button key={o.occ + o.id} className="row" style={{ gridTemplateColumns: 'auto minmax(0,1fr)' }} onClick={() => openSheet({ kind: 'event', event: ev })}>
                      <span className="bubble" style={{ background: 'rgba(245,176,122,.16)', flexDirection: 'column', lineHeight: 1.05, fontWeight: 800 }}>
                        <span style={{ fontSize: 16 }}>{Number(o.occ.slice(8, 10))}</span>
                        <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>{monthName(Number(o.occ.slice(5, 7)))}</span>
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span className="row-title" style={{ display: 'block' }}>{ev.title}</span>
                        <span className="row-meta">
                          <span>{dayLabel(o.occ, today)}</span>
                          <span className="faint">{ev.all_day ? 'all day' : o.occ.slice(11, 16)}</span>
                          {ev.alert_minutes !== null && <IBell aria-label="Has alert" />}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
