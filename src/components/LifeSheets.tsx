'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet } from './Sheet';
import { useApp } from './AppContext';
import { IBell, IBook, IRun, ISwap, ITennis, ITrash } from './icons';
import { deleteEvent, deleteJournal, deleteWorkout, saveEvent, saveJournal, saveWorkout } from '@/app/life-actions';
import { ENERGY, MOODS } from '@/lib/mood';
import { EFFORT, fmtPace, pace } from '@/lib/sport';
import type { CalEvent, Energy, JournalEntry, Repeat, Sport, Workout } from '@/lib/types';

type Res = { ok: boolean; error?: string };

function useSaver(onDone: () => void) {
  const { toast } = useApp();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const run = (fn: () => Promise<Res>, msg: string) =>
    start(async () => {
      setError('');
      const r = await fn();
      if (!r.ok) return setError(r.error);
      toast(msg);
      onDone();
      router.refresh();
    });
  return { pending, error, setError, run };
}

const withTime = (date: string | undefined, now: string) => (date ? `${date}${now.slice(10)}` : now);

/* ---------------- What do you want to add? ---------------- */
export function ChooserSheet() {
  const { openSheet, closeSheet } = useApp();
  const items = [
    { label: 'Expense', sub: 'Money out', emoji: '💸', go: () => openSheet({ kind: 'new', type: 'expense' }) },
    { label: 'Income', sub: 'Money in', emoji: '💰', go: () => openSheet({ kind: 'new', type: 'income' }) },
    { label: 'Transfer', sub: 'Between wallets', icon: <ISwap />, go: () => openSheet({ kind: 'new', type: 'transfer' }) },
    { label: 'Journal', sub: 'Mood and your day', icon: <IBook />, go: () => openSheet({ kind: 'journal' }) },
    { label: 'Run', sub: 'Time, distance, effort', icon: <IRun />, go: () => openSheet({ kind: 'workout', sport: 'running' }) },
    { label: 'Tennis', sub: 'Singles or doubles', icon: <ITennis />, go: () => openSheet({ kind: 'workout', sport: 'tennis' }) },
    { label: 'Reminder', sub: 'Event with an alert', icon: <IBell />, go: () => openSheet({ kind: 'event' }) },
  ];
  return (
    <Sheet title="Add" onClose={closeSheet}>
      <div className="choose-grid">
        {items.map((it) => (
          <button key={it.label} className="choose" onClick={it.go}>
            <span className="choose-ic" aria-hidden>{it.icon ?? it.emoji}</span>
            <span>
              <strong>{it.label}</strong>
              <small>{it.sub}</small>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/* ---------------- Journal entry ---------------- */
export function JournalSheet({ entry, mood: initialMood, date }: { entry?: JournalEntry; mood?: number; date?: string }) {
  const { tags, now, closeSheet } = useApp();
  const [mood, setMood] = useState<number>(entry?.mood ?? initialMood ?? 0);
  const [energy, setEnergy] = useState<Energy | null>(entry?.energy ?? null);
  const [tagIds, setTagIds] = useState<number[]>(entry?.tag_ids ?? []);
  const [note, setNote] = useState(entry?.note ?? '');
  const [at, setAt] = useState(entry?.occurred_at ?? withTime(date, now));
  const { pending, error, setError, run } = useSaver(closeSheet);
  const visibleTags = tags.filter((t) => !t.archived || tagIds.includes(t.id));

  return (
    <Sheet title={entry ? 'Edit journal entry' : 'How are you today?'} onClose={closeSheet}
      footer={<>
        {entry && <button className="btn btn-danger" aria-label="Delete entry" disabled={pending}
          onClick={() => confirm('Delete this journal entry?') && run(() => deleteJournal(entry.id), 'Entry deleted')}><ITrash /></button>}
        <button className="btn btn-primary btn-block" style={{ flex: 1 }} disabled={pending}
          onClick={() => (mood ? run(() => saveJournal({ id: entry?.id, occurred_at: at, mood, energy, tag_ids: tagIds, note }), entry ? 'Entry updated' : 'Entry saved') : setError('Pick how you feel first.'))}>
          {pending ? 'Saving…' : 'Save entry'}
        </button>
      </>}>
      <div className="stack">
        <div className="field">
          <span>Mood today</span>
          <div className="mood-pick" role="radiogroup" aria-label="Mood">
            {MOODS.map((m, i) => (
              <button key={m.v} role="radio" aria-checked={mood === m.v} aria-label={m.label} onClick={() => setMood(m.v)}
                style={{ fontSize: 26 + i * 4, ['--ring' as any]: m.color }}>
                <span aria-hidden>{m.emoji}</span>
                <small>{m.label}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Energy (optional)</span>
          <div className="seg full" role="group" aria-label="Energy">
            {ENERGY.map((e) => (
              <button key={e.v} aria-pressed={energy === e.v} onClick={() => setEnergy(energy === e.v ? null : e.v)}>{e.short}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>What filled your day?</span>
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {visibleTags.map((t) => (
              <button key={t.id} className="chip" aria-pressed={tagIds.includes(t.id)}
                onClick={() => setTagIds((xs) => (xs.includes(t.id) ? xs.filter((x) => x !== t.id) : [...xs, t.id]))}>
                <span aria-hidden>{t.emoji}</span> {t.name}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>What you did</span>
          <textarea className="textarea" style={{ minHeight: 140 }} placeholder="Write as much or as little as you like…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={5000} />
        </label>

        <label className="field">
          <span>When</span>
          <input className="input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        </label>
        {error && <div className="error" role="alert">{error}</div>}
      </div>
    </Sheet>
  );
}

/* ---------------- Workout ---------------- */
function splitDuration(sec: number) {
  return { h: Math.floor(sec / 3600), m: Math.floor((sec % 3600) / 60), s: sec % 60 };
}

export function WorkoutSheet({ sport: initialSport, workout, date }: { sport: Sport; workout?: Workout; date?: string }) {
  const { now, closeSheet } = useApp();
  const [sport, setSport] = useState<Sport>(workout?.sport ?? initialSport);
  const d0 = splitDuration(workout?.duration_sec ?? 0);
  const [h, setH] = useState(workout ? String(d0.h) : '');
  const [m, setM] = useState(workout ? String(d0.m) : '');
  const [s, setS] = useState(workout ? String(d0.s) : '');
  const [dist, setDist] = useState(workout?.distance_m ? String(workout.distance_m / 1000) : '');
  const [effort, setEffort] = useState<number>(workout?.effort ?? 5);
  const [hr, setHr] = useState(workout?.avg_hr ? String(workout.avg_hr) : '');
  const [format, setFormat] = useState<'singles' | 'doubles' | null>(workout?.tennis_format ?? null);
  const [result, setResult] = useState<'won' | 'lost' | 'draw' | null>(workout?.result ?? null);
  const [score, setScore] = useState(workout?.score ?? '');
  const [note, setNote] = useState(workout?.note ?? '');
  const [at, setAt] = useState(workout?.occurred_at ?? withTime(date, now));
  const { pending, error, run } = useSaver(closeSheet);

  const durationSec = (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
  const distM = Math.round((Number(dist.replace(',', '.')) || 0) * 1000);
  const livePace = useMemo(() => (sport === 'running' && durationSec && distM ? fmtPace(pace(durationSec, distM)) : null), [sport, durationSec, distM]);
  const num = (v: string, max: number) => v.replace(/\D/g, '').slice(0, String(max).length);

  function save() {
    run(() => saveWorkout({
      id: workout?.id, sport, occurred_at: at, duration_sec: durationSec, distance_m: sport === 'running' ? distM : null,
      effort, avg_hr: sport === 'running' && hr ? Number(hr) : null, tennis_format: format, result, score, note,
    }), workout ? 'Workout updated' : sport === 'running' ? 'Run saved' : 'Tennis saved');
  }

  return (
    <Sheet title={workout ? 'Edit workout' : sport === 'running' ? 'Log a run' : 'Log tennis'} onClose={closeSheet}
      footer={<>
        {workout && <button className="btn btn-danger" aria-label="Delete workout" disabled={pending}
          onClick={() => confirm('Delete this workout?') && run(() => deleteWorkout(workout.id), 'Workout deleted')}><ITrash /></button>}
        <button className="btn btn-primary btn-block" style={{ flex: 1 }} disabled={pending} onClick={save}>{pending ? 'Saving…' : 'Save workout'}</button>
      </>}>
      <div className="stack">
        <div className="seg full" role="group" aria-label="Sport">
          <button aria-pressed={sport === 'running'} onClick={() => setSport('running')}><IRun width={18} /> Running</button>
          <button aria-pressed={sport === 'tennis'} onClick={() => setSport('tennis')}><ITennis width={18} /> Tennis</button>
        </div>

        {sport === 'tennis' && (
          <div className="field">
            <span>Format</span>
            <div className="seg full" role="group" aria-label="Format">
              <button aria-pressed={format === 'singles'} onClick={() => setFormat('singles')}>Singles</button>
              <button aria-pressed={format === 'doubles'} onClick={() => setFormat('doubles')}>Doubles</button>
            </div>
          </div>
        )}

        <div className="field">
          <span>{sport === 'running' ? 'Time' : 'Time on court'}</span>
          <div className="dur">
            <label><input className="input num" inputMode="numeric" placeholder="0" value={h} onChange={(e) => setH(num(e.target.value, 23))} aria-label="Hours" /><small>h</small></label>
            <label><input className="input num" inputMode="numeric" placeholder="0" value={m} onChange={(e) => setM(num(e.target.value, 59))} aria-label="Minutes" data-autofocus /><small>min</small></label>
            {sport === 'running' && <label><input className="input num" inputMode="numeric" placeholder="0" value={s} onChange={(e) => setS(num(e.target.value, 59))} aria-label="Seconds" /><small>sec</small></label>}
          </div>
        </div>

        {sport === 'running' && (
          <div className="form-grid two">
            <label className="field">
              <span>Distance (km)</span>
              <input className="input num" inputMode="decimal" placeholder="5.0" value={dist} onChange={(e) => setDist(e.target.value.replace(/[^\d.,]/g, ''))} />
            </label>
            <div className="field">
              <span>Pace</span>
              <div className="input num" style={{ display: 'flex', alignItems: 'center', color: livePace ? 'var(--text)' : 'var(--faint)' }}>
                {livePace ? `${livePace} /km` : 'Fills in by itself'}
              </div>
            </div>
          </div>
        )}

        <div className="field">
          <span>Effort: {effort}/10, {EFFORT[effort].toLowerCase()}</span>
          <input type="range" min={1} max={10} value={effort} onChange={(e) => setEffort(Number(e.target.value))} className="range" aria-label="Effort from 1 to 10" />
        </div>

        {sport === 'running' ? (
          <label className="field">
            <span>Average heart rate (optional)</span>
            <input className="input num" inputMode="numeric" placeholder="bpm" value={hr} onChange={(e) => setHr(e.target.value.replace(/\D/g, '').slice(0, 3))} />
          </label>
        ) : (
          <>
            <div className="field">
              <span>Result (optional)</span>
              <div className="seg full" role="group" aria-label="Result">
                {(['won', 'lost', 'draw'] as const).map((r) => (
                  <button key={r} aria-pressed={result === r} onClick={() => setResult(result === r ? null : r)}>{r === 'won' ? 'Won' : r === 'lost' ? 'Lost' : 'Draw'}</button>
                ))}
              </div>
            </div>
            <label className="field">
              <span>Score (optional)</span>
              <input className="input" placeholder="6-4, 3-6, 7-5" value={score} onChange={(e) => setScore(e.target.value)} maxLength={60} />
            </label>
          </>
        )}

        <label className="field">
          <span>Note</span>
          <textarea className="textarea" placeholder={sport === 'running' ? 'Route, weather, how it felt…' : 'Who you played with, what worked…'} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <label className="field">
          <span>When</span>
          <input className="input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        </label>
        {error && <div className="error" role="alert">{error}</div>}
      </div>
    </Sheet>
  );
}

/* ---------------- Event / reminder ---------------- */
const ALERTS: { v: number | null; label: string; allDay?: string }[] = [
  { v: null, label: 'No alert' },
  { v: 0, label: 'At the time', allDay: 'On the day, 09:00' },
  { v: 5, label: '5 minutes before' },
  { v: 15, label: '15 minutes before' },
  { v: 30, label: '30 minutes before' },
  { v: 60, label: '1 hour before' },
  { v: 120, label: '2 hours before' },
  { v: 1440, label: '1 day before', allDay: '1 day before, 09:00' },
  { v: 2880, label: '2 days before', allDay: '2 days before, 09:00' },
  { v: 10080, label: '1 week before', allDay: '1 week before, 09:00' },
];

export function EventSheet({ event, date }: { event?: CalEvent; date?: string }) {
  const { now, closeSheet } = useApp();
  const start0 = event?.start_at ?? `${date ?? now.slice(0, 10)}T${String(Math.min(23, Number(now.slice(11, 13)) + 1)).padStart(2, '0')}:00`;
  const [title, setTitle] = useState(event?.title ?? '');
  const [day, setDay] = useState(start0.slice(0, 10));
  const [time, setTime] = useState(start0.slice(11, 16));
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [repeat, setRepeat] = useState<Repeat>(event?.repeat ?? 'none');
  const [alert, setAlert] = useState<number | null>(event ? event.alert_minutes : 15);
  const [note, setNote] = useState(event?.note ?? '');
  const { pending, error, run } = useSaver(closeSheet);

  return (
    <Sheet title={event ? 'Edit event' : 'New reminder or event'} onClose={closeSheet}
      footer={<>
        {event && <button className="btn btn-danger" aria-label="Delete event" disabled={pending}
          onClick={() => confirm(event.repeat !== 'none' ? 'Delete this event and all its repeats?' : 'Delete this event?') && run(() => deleteEvent(event.id), 'Event deleted')}><ITrash /></button>}
        <button className="btn btn-primary btn-block" style={{ flex: 1 }} disabled={pending}
          onClick={() => run(() => saveEvent({ id: event?.id, title, note, start_at: `${day}T${allDay ? '00:00' : time || '09:00'}`, all_day: allDay, repeat, alert_minutes: alert }), event ? 'Event updated' : 'Event saved')}>
          {pending ? 'Saving…' : 'Save event'}
        </button>
      </>}>
      <div className="stack">
        <label className="field">
          <span>Title</span>
          <input className="input" data-autofocus placeholder="Pay rent, Dentist, Call Mum…" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </label>
        <label className="switch-row">
          <span>All day</span>
          <input type="checkbox" checked={allDay} onChange={(e) => { setAllDay(e.target.checked); if (e.target.checked && alert !== null && alert > 0 && alert < 1440) setAlert(0); }} style={{ width: 22, height: 22 }} />
        </label>
        <div className={`form-grid ${allDay ? '' : 'two'}`}>
          <label className="field"><span>Date</span><input className="input" type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
          {!allDay && <label className="field"><span>Time</span><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>}
        </div>
        <div className="form-grid two">
          <label className="field">
            <span>Repeat</span>
            <select className="select" value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
              <option value="none">Does not repeat</option>
              <option value="daily">Every day</option>
              <option value="weekly">Every week</option>
              <option value="monthly">Every month</option>
              <option value="yearly">Every year</option>
            </select>
          </label>
          <label className="field">
            <span>Alert</span>
            <select className="select" value={alert === null ? 'none' : String(alert)} onChange={(e) => setAlert(e.target.value === 'none' ? null : Number(e.target.value))}>
              {ALERTS.filter((a) => !allDay || a.v === null || a.v === 0 || a.v >= 1440).map((a) => (
                <option key={String(a.v)} value={a.v === null ? 'none' : String(a.v)}>{allDay && a.allDay ? a.allDay : a.label}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Note</span>
          <textarea className="textarea" placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {alert !== null && (
          <p className="faint" style={{ margin: 0, fontSize: 13, display: 'flex', gap: 6 }}>
            <IBell width={16} style={{ flex: 'none', marginTop: 1 }} /> Alerts arrive on devices where you turned them on (Calendar page, “Alerts on this device”).
          </p>
        )}
        {error && <div className="error" role="alert">{error}</div>}
      </div>
    </Sheet>
  );
}

