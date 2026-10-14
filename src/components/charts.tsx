'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { rp, rpShort } from '@/lib/format';
import type { Slice } from '@/lib/slices';
export type { Slice } from '@/lib/slices';

const SURFACE = '#14284f';

function useWidth<T extends HTMLElement>(fallback = 600) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/* ---------------- Donut ---------------- */
export function Donut({ slices, centerTop, size = 210 }: { slices: Slice[]; centerTop: string; size?: number }) {
  const [hover, setHover] = useState<Slice | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = size / 2 - 14;
  const c = size / 2;
  const sw = 26;
  let acc = 0;
  const arcs = slices.map((s) => {
    const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += s.value;
    const a1 = (acc / total) * Math.PI * 2 - Math.PI / 2;
    return { s, a0, a1 };
  });
  const arcPath = (a0: number, a1: number) => {
    if (a1 - a0 >= Math.PI * 2 - 1e-6) a1 = a0 + Math.PI * 2 - 1e-4;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${c + r * Math.cos(a0)} ${c + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${c + r * Math.cos(a1)} ${c + r * Math.sin(a1)}`;
  };
  const shown = hover ?? null;
  return (
    <div style={{ position: 'relative', width: size, maxWidth: '100%', margin: '0 auto' }}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" role="img" aria-label={`Spending by category, ${rp(total)} total`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(156,200,242,.1)" strokeWidth={sw} />
        {total > 0 &&
          arcs.map(({ s, a0, a1 }) => (
            <path key={s.id} d={arcPath(a0, a1)} fill="none" stroke={s.color} strokeWidth={hover?.id === s.id ? sw + 6 : sw}
              style={{ transition: 'stroke-width .15s' }} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(null)}>
              <title>{`${s.label}: ${rp(s.value)} (${Math.round((s.value / total) * 100)}%)`}</title>
            </path>
          ))}
        {/* 2px surface gaps between slices */}
        {total > 0 && arcs.length > 1 &&
          arcs.map(({ s, a0 }) => (
            <line key={`g${s.id}`} x1={c + (r - sw) * Math.cos(a0)} y1={c + (r - sw) * Math.sin(a0)} x2={c + (r + sw) * Math.cos(a0)} y2={c + (r + sw) * Math.sin(a0)}
              stroke={SURFACE} strokeWidth={2.5} pointerEvents="none" />
          ))}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'none', padding: 44 }}>
        <div>
          <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{shown ? shown.label : centerTop}</div>
          <div className="money num" style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>{rpShort(shown ? shown.value : total)}</div>
          {shown && total > 0 && <div className="faint" style={{ fontSize: 12, fontWeight: 700 }}>{Math.round((shown.value / total) * 100)}%</div>}
        </div>
      </div>
    </div>
  );
}

export function SliceLegend({ slices }: { slices: Slice[]; perDay?: number }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="rows">
      {slices.map((s) => {
        const inner = (
          <>
            <span className="bubble" style={{ background: `${s.color}33`, width: 40, height: 40, fontSize: 18, boxShadow: `inset 0 0 0 2px ${s.color}` }} aria-hidden>
              {s.emoji ?? ''}
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="row-title" style={{ display: 'block' }}>{s.label}</span>
              <span className="row-meta">
                {Math.round((s.value / total) * 100)}% of spending
              </span>
            </span>
            <span className="row-amt money num">{rp(s.value)}</span>
          </>
        );
        return s.href ? <Link key={s.id} href={s.href} className="row">{inner}</Link> : <div key={s.id} className="row">{inner}</div>;
      })}
    </div>
  );
}

/* ---------------- Calendar heatmap ---------------- */
export function Heatmap({ year, month, totals, today, startDow = 1 }: { year: number; month: number; totals: Record<string, number>; today: string; startDow?: number }) {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const lead = (first - startDow + 7) % 7;
  const vals = Object.values(totals).filter((v) => v > 0).sort((a, b) => a - b);
  const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] ?? 0;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const level = (v: number) => (v <= 0 ? 0 : v <= cuts[0] ? 1 : v <= cuts[1] ? 2 : v <= cuts[2] ? 3 : 4);
  const FILL = ['rgba(156,200,242,0.08)', '#4a4c6a', '#7d6871', '#c08a73', '#f5b07a'];
  const dows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return (
    <div>
      <div className="heat">
        {dows.map((d) => <div key={d} className="dow">{d}</div>)}
        {Array.from({ length: lead }).map((_, i) => <div key={`b${i}`} className="blank" />)}
        {Array.from({ length: days }).map((_, i) => {
          const d = `${year}-${pad2(month)}-${pad2(i + 1)}`;
          const v = totals[d] ?? 0;
          const lv = level(v);
          return (
            <Link key={d} href={`/history?from=${d}&to=${d}`} className={`${d === today ? 'today' : ''} ${d > today ? 'future' : ''}`}
              style={{ background: FILL[lv], color: lv >= 3 ? '#2b1607' : 'var(--text)' }}
              title={`${i + 1} ${new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en', { month: 'short', timeZone: 'UTC' })}: ${v ? rp(v) : 'nothing spent'}`}>
              <span>{i + 1}</span>
              {v > 0 && <small className="money num">{rpShort(v).replace('Rp ', '')}</small>}
            </Link>
          );
        })}
      </div>
      <div className="legend-scale" aria-hidden>
        less {FILL.map((f, i) => <i key={i} style={{ background: f }} />)} more
      </div>
    </div>
  );
}

/* ---------------- Cumulative trend: this month vs last month ---------------- */
export function TrendLine({ current, previous, labelCur, labelPrev, todayIndex }: {
  current: number[]; previous: number[]; labelCur: string; labelPrev: string; todayIndex: number;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = 220;
  const pad = { l: 8, r: 8, t: 16, b: 26 };
  const n = Math.max(current.length, previous.length);
  const cum = (xs: number[]) => xs.reduce<number[]>((a, v, i) => (a.push((a[i - 1] ?? 0) + v), a), []);
  const cur = cum(current).slice(0, todayIndex);
  const prev = cum(previous);
  const max = Math.max(1, ...cur, ...prev);
  const x = (i: number) => pad.l + (i / Math.max(1, n - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const path = (xs: number[]) => xs.map((v, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const [hi, setHi] = useState<number | null>(null);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (n - 1));
    setHi(Math.max(0, Math.min(n - 1, i)));
  }

  const tipX = hi !== null ? x(hi) : 0;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 16, fontSize: 13, fontWeight: 700, marginBottom: 8 }} className="muted">
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><i style={{ width: 16, height: 3, borderRadius: 2, background: 'var(--ember)', display: 'inline-block' }} />{labelCur}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><i style={{ width: 16, height: 0, borderTop: '2px dashed var(--faint)', display: 'inline-block' }} />{labelPrev}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} onPointerMove={onMove} onPointerLeave={() => setHi(null)} style={{ touchAction: 'pan-y', display: 'block' }}
        role="img" aria-label={`Cumulative spending, ${labelCur} versus ${labelPrev}`}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} stroke="rgba(190,212,255,.08)" />
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="rgba(190,212,255,.2)" />
        <path d={path(prev)} fill="none" stroke="var(--faint)" strokeWidth={2} strokeDasharray="5 5" />
        {cur.length > 0 && <path d={`${path(cur)} L ${x(cur.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`} fill="rgba(245,176,122,0.12)" />}
        <path d={path(cur)} fill="none" stroke="var(--ember)" strokeWidth={2.5} strokeLinejoin="round" />
        {cur.length > 0 && <circle cx={x(cur.length - 1)} cy={y(cur[cur.length - 1])} r={5} fill="var(--ember)" stroke={SURFACE} strokeWidth={2} />}
        <text x={pad.l} y={H - 6} fill="var(--faint)" fontSize="12" fontWeight="600">Day 1</text>
        <text x={W - pad.r} y={H - 6} fill="var(--faint)" fontSize="12" fontWeight="600" textAnchor="end">Day {n}</text>
        {hi !== null && (
          <g pointerEvents="none">
            <line x1={tipX} x2={tipX} y1={pad.t} y2={H - pad.b} stroke="rgba(238,243,255,.45)" strokeDasharray="3 3" />
            {hi < cur.length && <circle cx={tipX} cy={y(cur[hi])} r={5} fill="var(--ember)" stroke={SURFACE} strokeWidth={2} />}
            {hi < prev.length && <circle cx={tipX} cy={y(prev[hi])} r={4.5} fill="var(--faint)" stroke={SURFACE} strokeWidth={2} />}
          </g>
        )}
      </svg>
      {hi !== null && (
        <div className="glass chart-tip" style={{
          position: 'absolute', top: 30, left: Math.min(Math.max(0, tipX - 80), W - 170), width: 170, padding: '8px 12px', borderRadius: 14, pointerEvents: 'none',
        }}>
          <div className="muted" style={{ fontSize: 12 }}>By day {hi + 1}</div>
          <div><span style={{ color: 'var(--ember)' }}>●</span> {labelCur}: <span className="money num">{hi < cur.length ? rpShort(cur[hi]) : 'not yet'}</span></div>
          <div><span className="faint">●</span> {labelPrev}: <span className="money num">{hi < prev.length ? rpShort(prev[hi]) : 'none'}</span></div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Month bars (yearly view) ---------------- */
export function MonthBars({ out, inc, year, currentMonth }: { out: number[]; inc: number[]; year: number; currentMonth?: number }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = 220;
  const pad = { l: 4, r: 4, t: 12, b: 24 };
  const max = Math.max(1, ...out, ...inc);
  const slot = (W - pad.l - pad.r) / 12;
  const bw = Math.max(4, Math.min(16, slot / 2 - 4));
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const [hi, setHi] = useState<number | null>(null);
  const M = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const ML = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const bar = (x: number, v: number, fill: string) => {
    const top = y(v);
    const h = H - pad.b - top;
    if (h <= 0) return null;
    const r = Math.min(4, h, bw / 2);
    return <path d={`M ${x} ${H - pad.b} V ${top + r} Q ${x} ${top} ${x + r} ${top} H ${x + bw - r} Q ${x + bw} ${top} ${x + bw} ${top + r} V ${H - pad.b} Z`} fill={fill} />;
  };
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 16, fontSize: 13, fontWeight: 700, marginBottom: 8 }} className="muted">
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><i style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--ember)', display: 'inline-block' }} />Money out</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><i style={{ width: 12, height: 12, borderRadius: 3, background: '#199e70', display: 'inline-block' }} />Money in</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`Money in and out per month in ${year}`} style={{ display: 'block' }}>
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="rgba(190,212,255,.2)" />
        {out.map((v, i) => {
          const cx = pad.l + slot * i + slot / 2;
          return (
            <g key={i} onPointerEnter={() => setHi(i)} onPointerLeave={() => setHi(null)}>
              <rect x={cx - slot / 2} y={0} width={slot} height={H} fill={hi === i ? 'rgba(156,200,242,.07)' : 'transparent'} />
              {bar(cx - bw - 1, v, 'var(--ember)')}
              {bar(cx + 1, inc[i], '#199e70')}
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill={currentMonth === i + 1 ? 'var(--text)' : 'var(--faint)'}>{M[i]}</text>
            </g>
          );
        })}
      </svg>
      {hi !== null && (
        <div className="glass chart-tip" style={{ position: 'absolute', top: 30, left: Math.min(Math.max(0, pad.l + slot * hi + slot / 2 - 80), W - 160), width: 160, padding: '8px 12px', borderRadius: 14, pointerEvents: 'none' }}>
          <div className="muted" style={{ fontSize: 12 }}>{ML[hi]} {year}</div>
          <div>Out: <span className="money num">{rpShort(out[hi])}</span></div>
          <div>In: <span className="money num">{rpShort(inc[hi])}</span></div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Sankey: money in → categories → places ---------------- */
export type SankeyInput = {
  income: number;
  categories: { id: number | string; label: string; color: string; value: number; places: { label: string; value: number }[] }[];
};

export function Sankey({ data }: { data: SankeyInput }) {
  const [ref, W] = useWidth<HTMLDivElement>(700);
  const spent = data.categories.reduce((s, c) => s + c.value, 0);
  const leftover = Math.max(0, data.income - spent);
  const deficit = Math.max(0, spent - data.income);

  const layout = useMemo(() => {
    const total = Math.max(data.income, spent);
    if (total <= 0) return null;
    const narrow = W < 560;
    const nodeW = 10;
    const colX = narrow ? [0, W * 0.4, W * 0.7] : [0, W * 0.36, W * 0.66];
    const gap = 8;
    const mid = [
      ...data.categories.map((c) => ({ key: `c${c.id}`, label: c.label, value: c.value, color: c.color, places: c.places })),
      ...(leftover > 0 ? [{ key: 'left', label: 'Left over', value: leftover, color: '#199e70', places: [] as { label: string; value: number }[] }] : []),
    ];
    const minSlot = narrow ? 32 : 36; // room for a two-line label
    const k = (narrow ? 300 : 380) / total;
    // Left column: money in (and "from savings" when spending beat income)
    const left = [
      { key: 'in', label: 'Money in', value: data.income, color: '#9cc8f2', y: 10 },
      ...(deficit > 0 ? [{ key: 'def', label: 'From savings', value: deficit, color: '#e66767', y: 10 + Math.max(data.income * k, minSlot) + gap }] : []),
    ];
    let y = 10;
    const midN = mid.map((m) => {
      const n = { ...m, y, h: Math.max(2, m.value * k) };
      y += Math.max(n.h, minSlot) + gap;
      return n;
    });
    // right nodes start level with their parent category, never above the previous one
    let ry = 10;
    const right: { key: string; label: string; value: number; color: string; y: number; h: number; parent: string }[] = [];
    for (const m of midN) {
      ry = Math.max(ry, m.y);
      for (const p of m.places) {
        const h = Math.max(2, p.value * k);
        right.push({ key: `${m.key}-${p.label}`, label: p.label, value: p.value, color: m.color, y: ry, h, parent: m.key });
        ry += Math.max(h, minSlot) + gap;
      }
    }
    const H = Math.max(y, ry, 10 + total * k + (deficit > 0 ? gap + minSlot : 0)) + 10;
    // links left -> mid: fill each mid node from income first, then deficit
    const links: { d: string; color: string; title: string; w: number }[] = [];
    const ribbon = (x0: number, y0: number, x1: number, y1: number, h: number) => {
      const cx = (x0 + x1) / 2;
      return `M ${x0} ${y0} C ${cx} ${y0} ${cx} ${y1} ${x1} ${y1} L ${x1} ${y1 + h} C ${cx} ${y1 + h} ${cx} ${y0 + h} ${x0} ${y0 + h} Z`;
    };
    let inCursor = left[0].y;
    let defCursor = left[1]?.y ?? 0;
    let inLeft = data.income;
    for (const m of midN) {
      let need = m.value;
      let my = m.y;
      const fromIn = Math.min(need, inLeft);
      if (fromIn > 0) {
        const h = fromIn * k;
        links.push({ d: ribbon(colX[0] + nodeW, inCursor, colX[1], my, h), color: m.color, title: `Money in → ${m.label}: ${rp(fromIn)}`, w: h });
        inCursor += h;
        my += h;
        inLeft -= fromIn;
        need -= fromIn;
      }
      if (need > 0 && left[1]) {
        const h = need * k;
        links.push({ d: ribbon(colX[0] + nodeW, defCursor, colX[1], my, h), color: m.color, title: `From savings → ${m.label}: ${rp(need)}`, w: h });
        defCursor += h;
      }
    }
    for (const m of midN) {
      let my = m.y;
      for (const r of right.filter((r) => r.parent === m.key)) {
        const h = r.value * k;
        links.push({ d: ribbon(colX[1] + nodeW, my, colX[2], r.y, h), color: m.color, title: `${m.label} → ${r.label}: ${rp(r.value)}`, w: h });
        my += h;
      }
    }
    return { H, left: left.map((l) => ({ ...l, h: Math.max(2, l.value * k) })), midN, right, links, colX, nodeW, narrow };
  }, [data, W, spent, leftover, deficit]);

  if (!layout) return <div className="empty"><strong>Nothing to show yet</strong>Add income and expenses to see how money flows.</div>;
  const { H, left, midN, right, links, colX, nodeW, narrow } = layout;
  const fs = narrow ? 11.5 : 13;
  const label = (key: string, x: number, y: number, h: number, top: string, bottom: string, anchor: 'start' | 'end' = 'start') => (
    <g key={key} pointerEvents="none">
      <text x={x} y={y + h / 2 - 2} fontSize={fs} fontWeight="700" fill="var(--text)" textAnchor={anchor}>{top}</text>
      <text x={x} y={y + h / 2 + fs} fontSize={fs - 1} fontWeight="600" fill="var(--muted)" textAnchor={anchor} className="money">{bottom}</text>
    </g>
  );
  const trim = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Where money in went: categories, then the places within them" style={{ display: 'block' }}>
        {links.map((l, i) => (
          <path key={i} d={l.d} fill={l.color} opacity={0.32}>
            <title>{l.title}</title>
          </path>
        ))}
        {left.map((n) => <rect key={n.key} x={colX[0]} y={n.y} width={nodeW} height={n.h} rx={3} fill={n.color} />)}
        {midN.map((n) => <rect key={n.key} x={colX[1]} y={n.y} width={nodeW} height={n.h} rx={3} fill={n.color} />)}
        {right.map((n) => <rect key={n.key} x={colX[2]} y={n.y} width={nodeW} height={n.h} rx={3} fill={n.color} />)}
        {left.map((n) => label(`l${n.key}`, colX[0] + nodeW + 8, n.y, Math.min(n.h, 60), n.label, rpShort(n.value)))}
        {midN.map((n) => label(`m${n.key}`, colX[1] + nodeW + 6, n.y, n.h, trim(n.label, narrow ? 11 : 18), rpShort(n.value)))}
        {right.map((n) => label(`r${n.key}`, colX[2] + nodeW + 6, n.y, n.h, trim(n.label, narrow ? 12 : 22), rpShort(n.value)))}
      </svg>
    </div>
  );
}
