'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useApp } from './AppContext';
import { dayLabel } from '@/lib/dates';
import type { CutoutCanvas, FoodMoment } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { moveCutout, saveLifeSetting } from '@/app/life-actions';

const KIND_EMOJI = { food: '🍽️', drink: '🥤', other: '🍫' } as const;
export const momentKcal = (m: FoodMoment) => m.entries.reduce((s, e) => s + e.kcal, 0);

export function DayCanvas({ moments }: { moments: FoodMoment[] }) {
  const { openSheet } = useApp();
  return <FoodCanvas moments={moments} onOpen={(m) => openSheet({ kind: 'meal', moment: m })} />;
}

export function MomentCard({ m, showDate }: { m: FoodMoment; showDate?: boolean }) {
  const { openSheet, now } = useApp();
  return (
    <button className="moment-card" onClick={() => openSheet({ kind: 'meal', moment: m })}>
      <span className="moment-stickers" aria-hidden>
        {m.entries.slice(0, 4).map((e) =>
          e.cutout ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={e.id} src={`/api/image/cutout/${e.cutout.id}`} alt="" />
          ) : (
            <span key={e.id} className="moment-emoji">{KIND_EMOJI[e.kind]}</span>
          ),
        )}
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="row-title" style={{ display: 'block' }}>{m.entries.map((e) => e.name).join(', ')}</span>
        <span className="row-meta">
          <span>{showDate ? `${dayLabel(m.occurred_at, now)} ` : ''}{m.occurred_at.slice(11, 16)}</span>
          {m.place && <span>📍 {m.place}</span>}
          {m.people.length > 0 && <span>👥 {m.people.join(', ')}</span>}
          {m.rating && <span>{'⭐'.repeat(m.rating)}</span>}
          {m.favorite && <span>❤️</span>}
        </span>
      </span>
      <span className="row-amt num">{momentKcal(m).toLocaleString('id-ID')} kcal</span>
    </button>
  );
}

export function FoodList({ moments }: { moments: FoodMoment[] }) {
  const { openSheet, now } = useApp();
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const all = moments.flatMap((m) => m.entries.map((e) => ({ e, m })));
    const s = q.trim().toLowerCase();
    return s ? all.filter(({ e, m }) => [e.name, e.tags.join(' '), m.place, m.people.join(' ')].join(' ').toLowerCase().includes(s)) : all;
  }, [moments, q]);
  return (
    <div className="stack" style={{ gap: 10 }}>
      <input className="input" placeholder="Search dish, tag, place or person" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
      <div className="rows">
        {rows.length === 0 && <p className="muted" style={{ margin: 0 }}>Nothing found.</p>}
        {rows.slice(0, 300).map(({ e, m }) => (
          <button key={e.id} className="row" style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto' }} onClick={() => openSheet({ kind: 'meal', moment: m })}>
            <span className="food-thumb" style={{ width: 40, height: 40, fontSize: 20, borderStyle: 'solid' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {e.cutout ? <img src={`/api/image/cutout/${e.cutout.id}`} alt="" /> : <span aria-hidden>{KIND_EMOJI[e.kind]}</span>}
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="row-title" style={{ display: 'block' }}>{e.name}</span>
              <span className="row-meta">
                <span>{dayLabel(m.occurred_at, now)}</span>
                {m.place && <span>📍 {m.place}</span>}
                {e.tags.length > 0 && <span>#{e.tags.join(' #')}</span>}
              </span>
            </span>
            <span className="row-amt num">{e.kcal} kcal</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** "Goal 2.000 kcal ✏️": tap to change the daily calorie goal. */
export function FoodGoal({ goal }: { goal: number }) {
  const { toast } = useApp();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(goal));
  const [pending, start] = useTransition();
  if (!editing)
    return (
      <button type="button" className="link link-btn" style={{ fontSize: 'inherit' }} onClick={() => setEditing(true)}>
        Daily goal {goal.toLocaleString('id-ID')} kcal ✏️
      </button>
    );
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input className="input num" style={{ width: 110, minHeight: 36 }} inputMode="numeric" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d]/g, ''))} aria-label="Daily calorie goal" />
      <button type="button" className="btn" style={{ minHeight: 36 }} disabled={pending}
        onClick={() => start(async () => {
          const r = await saveLifeSetting('food_goal_kcal', v);
          if (!r.ok) return toast(r.error || 'Failed', true);
          setEditing(false);
          router.refresh();
        })}>Save</button>
    </span>
  );
}

type Sticker = { id: number; name: string; w: number; h: number; c: CutoutCanvas; momentId: number };

/** The "table top": today's dish stickers. Drag to move; tap one to turn or resize it. */
export function FoodCanvas({ moments, onOpen }: { moments: FoodMoment[]; onOpen?: (m: FoodMoment) => void }) {
  const initial: Sticker[] = moments.flatMap((m) =>
    m.entries.filter((e) => e.cutout).map((e) => ({ id: e.cutout!.id, name: e.name, w: e.cutout!.width, h: e.cutout!.height, c: e.cutout!.canvas, momentId: m.id })),
  );
  const [items, setItems] = useState<Sticker[]>(initial);
  const [sel, setSel] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; dx: number; dy: number; moved: boolean; mode: 'move' | 'turn'; cx: number; cy: number } | null>(null);
  const key = initial.map((s) => `${s.id}:${s.c.x},${s.c.y},${s.c.rot},${s.c.scale},${s.c.z}`).join('|');

  useEffect(() => {
    setItems(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const save = (s: Sticker) => moveCutout(s.id, s.c);
  const update = (id: number, patch: Partial<CutoutCanvas>) =>
    setItems((xs) => xs.map((s) => (s.id === id ? { ...s, c: { ...s.c, ...patch } } : s)));
  const topZ = () => Math.max(0, ...items.map((s) => s.c.z)) + 1;

  function down(e: React.PointerEvent, s: Sticker, mode: 'move' | 'turn') {
    e.stopPropagation();
    const b = box.current!.getBoundingClientRect();
    (e.target as Element).setPointerCapture(e.pointerId);
    const cx = b.left + s.c.x * b.width, cy = b.top + s.c.y * b.height;
    drag.current = { id: s.id, dx: e.clientX - cx, dy: e.clientY - cy, moved: false, mode, cx, cy };
    if (s.c.z < topZ() - 1) update(s.id, { z: topZ() });
  }
  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const b = box.current!.getBoundingClientRect();
    if (d.mode === 'move') {
      const x = Math.min(0.95, Math.max(0.05, (e.clientX - d.dx - b.left) / b.width));
      const y = Math.min(0.95, Math.max(0.05, (e.clientY - d.dy - b.top) / b.height));
      if (Math.abs(e.clientX - d.dx - d.cx) + Math.abs(e.clientY - d.dy - d.cy) > 4) d.moved = true;
      update(d.id, { x, y });
    } else {
      d.moved = true;
      const deg = (Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180) / Math.PI - 90;
      update(d.id, { rot: Math.round(((deg + 540) % 360) - 180) });
    }
  }
  function up() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const s = items.find((x) => x.id === d.id);
    if (!s) return;
    if (d.moved) save(s);
    else setSel(sel === d.id ? null : d.id);
  }
  function resize(s: Sticker, f: number) {
    const scale = Math.min(2.5, Math.max(0.4, Math.round(s.c.scale * f * 100) / 100));
    const next = { ...s, c: { ...s.c, scale } };
    update(s.id, { scale });
    save(next);
  }

  const selected = items.find((s) => s.id === sel);
  return (
    <div className="table-top" ref={box} onPointerMove={move} onPointerUp={up} onPointerDown={() => setSel(null)}>
      {items.length === 0 && (
        <div className="table-empty">
          <span aria-hidden>🍽️</span>
          <span>Cut dishes out of your meal photos and they land here as stickers.</span>
        </div>
      )}
      {items.map((s) => {
        const base = 30 * s.c.scale; // % of the table's width
        return (
          <div key={s.id} className={`sticker${sel === s.id ? ' on' : ''}`} onPointerDown={(e) => down(e, s, 'move')}
            style={{ left: `${s.c.x * 100}%`, top: `${s.c.y * 100}%`, width: `${base}%`, aspectRatio: `${s.w} / ${s.h}`, zIndex: s.c.z, transform: `translate(-50%, -50%) rotate(${s.c.rot}deg)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/image/cutout/${s.id}`} alt={s.name} draggable={false} />
            {sel === s.id && <span className="sticker-turn" aria-label="Turn" onPointerDown={(e) => down(e, s, 'turn')}>↻</span>}
          </div>
        );
      })}
      {selected && (
        <div className="sticker-tools" onPointerDown={(e) => e.stopPropagation()}>
          <span className="n">{selected.name}</span>
          <button type="button" onClick={() => resize(selected, 0.85)} aria-label="Smaller">−</button>
          <button type="button" onClick={() => resize(selected, 1.15)} aria-label="Bigger">＋</button>
          {onOpen && (
            <button type="button" onClick={() => { const m = moments.find((x) => x.id === selected.momentId); if (m) onOpen(m); }}>Open meal</button>
          )}
        </div>
      )}
    </div>
  );
}
