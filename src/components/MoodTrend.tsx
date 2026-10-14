'use client';

import { useEffect, useRef, useState } from 'react';
import { MOODS, moodOf } from '@/lib/mood';
import { shortDate } from '@/lib/dates';

/** Daily average mood over time. Days without an entry leave a gap in the line. */
export function MoodTrend({ days }: { days: { d: string; avg: number | null }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);
  const [hi, setHi] = useState<number | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const H = 210;
  const pad = { l: 34, r: 10, t: 12, b: 24 };
  const n = days.length;
  const x = (i: number) => pad.l + (i / Math.max(1, n - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + ((5 - v) / 4) * (H - pad.t - pad.b);

  // Split the line where days are missing
  const segs: string[] = [];
  let cur = '';
  days.forEach((p, i) => {
    if (p.avg === null) {
      if (cur) segs.push(cur);
      cur = '';
      return;
    }
    cur += `${cur ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(p.avg).toFixed(1)} `;
  });
  if (cur) segs.push(cur);

  // 7-day rolling average over logged days only
  const rolling = days.map((_, i) => {
    const win = days.slice(Math.max(0, i - 6), i + 1).map((p) => p.avg).filter((v): v is number => v !== null);
    return win.length >= 3 ? win.reduce((a, b) => a + b, 0) / win.length : null;
  });
  let rpath = '';
  rolling.forEach((v, i) => {
    if (v === null) return;
    rpath += `${rpath && rolling[i - 1] !== null ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
  });

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (n - 1));
    setHi(Math.max(0, Math.min(n - 1, i)));
  }
  const p = hi !== null ? days[hi] : null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} onPointerMove={onMove} onPointerLeave={() => setHi(null)} style={{ display: 'block', touchAction: 'pan-y' }}
        role="img" aria-label="Average mood per day">
        {MOODS.map((m) => (
          <g key={m.v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(m.v)} y2={y(m.v)} stroke="rgba(190,212,255,.08)" />
            <text x={pad.l - 8} y={y(m.v) + 6} textAnchor="end" fontSize="16">{m.emoji}</text>
          </g>
        ))}
        {segs.map((d, i) => <path key={i} d={d} fill="none" stroke="rgba(156,200,242,.45)" strokeWidth={1.4} strokeLinejoin="round" />)}
        <path d={rpath} fill="none" stroke="var(--ember)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {days.map((p, i) => p.avg !== null && (
          <circle key={p.d} cx={x(i)} cy={y(p.avg)} r={n > 60 ? 2.5 : 4} fill={moodOf(p.avg).color} stroke="#14284f" strokeWidth={1.5} />
        ))}
        <text x={pad.l} y={H - 6} fill="var(--faint)" fontSize="12" fontWeight="600">{shortDate(days[0].d)}</text>
        <text x={W - pad.r} y={H - 6} fill="var(--faint)" fontSize="12" fontWeight="600" textAnchor="end">{shortDate(days[n - 1].d)}</text>
        {hi !== null && <line x1={x(hi)} x2={x(hi)} y1={pad.t} y2={H - pad.b} stroke="rgba(238,243,255,.4)" strokeDasharray="3 3" pointerEvents="none" />}
      </svg>
      {p && (
        <div className="glass chart-tip" style={{ position: 'absolute', top: 8, left: Math.min(Math.max(0, x(hi!) - 75), W - 150), width: 150, padding: '8px 12px', borderRadius: 14, pointerEvents: 'none' }}>
          <div className="muted" style={{ fontSize: 12 }}>{shortDate(p.d)}</div>
          <div>{p.avg === null ? 'No entry' : `${moodOf(p.avg).emoji} ${moodOf(p.avg).label} (${p.avg.toFixed(1)})`}</div>
          {rolling[hi!] !== null && <div className="muted" style={{ fontSize: 12 }}>7-day average {rolling[hi!]!.toFixed(1)}</div>}
        </div>
      )}
    </div>
  );
}
