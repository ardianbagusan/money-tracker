import { getBase, getDailySpending, getEvents, getJournal, getWorkouts } from '@/lib/data';
import { addDays, addMonths, daysInMonth, ymd } from '@/lib/dates';
import { occurrences } from '@/lib/recur';
import { CalendarView, type DayInfo } from './CalendarView';

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const base = await getBase();
  const { today } = base;
  const sel = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? '') ? sp.d : null;
  const mParam = /^\d{4}-\d{2}$/.test(sp.m ?? '') ? sp.m : (sel ?? today).slice(0, 7);
  const y = Number(mParam.slice(0, 4));
  const m = Number(mParam.slice(5, 7));

  // Grid: Monday before the 1st to Sunday after the last day
  const first = ymd(y, m, 1);
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const gridFrom = addDays(first, -lead);
  const last = ymd(y, m, daysInMonth(y, m));
  const trail = 6 - ((new Date(`${last}T00:00:00Z`).getUTCDay() + 6) % 7);
  const gridTo = addDays(last, trail + 1); // exclusive
  const upcomingTo = addDays(today, 31);

  const [events, entries, workouts, spend] = await Promise.all([
    getEvents(),
    getJournal(gridFrom, gridTo),
    getWorkouts(gridFrom, gridTo),
    getDailySpending(gridFrom, gridTo),
  ]);

  const days: Record<string, DayInfo> = {};
  for (let d = gridFrom; d < gridTo; d = addDays(d, 1)) days[d] = { events: [], moods: [], workouts: [], spend: spend[d] ?? 0 };
  for (const ev of events) {
    for (const occ of occurrences(ev, `${gridFrom}T00:00`, `${gridTo}T00:00`)) days[occ.slice(0, 10)]?.events.push({ id: ev.id, occ });
  }
  for (const e of entries) days[e.occurred_at.slice(0, 10)]?.moods.push(e.id);
  for (const w of workouts) days[w.occurred_at.slice(0, 10)]?.workouts.push(w.id);
  for (const d of Object.values(days)) d.events.sort((a, b) => (a.occ < b.occ ? -1 : 1));

  const upcoming = events
    .flatMap((ev) => occurrences(ev, `${today}T00:00`, `${upcomingTo}T00:00`, 10).map((occ) => ({ id: ev.id, occ })))
    .sort((a, b) => (a.occ < b.occ ? -1 : 1))
    .slice(0, 12);

  const prev = addMonths(y, m, -1);
  const next = addMonths(y, m, 1);
  return (
    <CalendarView
      key={`${mParam}-${sel ?? ''}`}
      year={y}
      month={m}
      today={today}
      initialSel={sel ?? (today.startsWith(mParam) ? today : first)}
      days={days}
      events={events}
      entries={entries}
      workouts={workouts}
      upcoming={upcoming}
      prevHref={`/calendar?m=${prev.y}-${String(prev.m).padStart(2, '0')}`}
      nextHref={`/calendar?m=${next.y}-${String(next.m).padStart(2, '0')}`}
      todayHref="/calendar"
    />
  );
}
