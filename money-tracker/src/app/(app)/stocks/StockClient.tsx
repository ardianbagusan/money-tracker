'use client';

import { useState, useTransition } from 'react';
import { groupDigits, rp, rpShort } from '@/lib/format';
import { shortDate } from '@/lib/dates';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import { saveLifeSetting } from '@/app/life-actions';

/** Account value after each closed trade. A line with a dot per trade; hover or tap for details. */
export function EquityCurve({ points, capital }: { points: { at: string; eq: number; ticker: string; pnl: number }[]; capital: number }) {
  const [hi, setHi] = useState<number | null>(null);
  if (points.length < 2) return null;
  const W = 400, H = 200, pad = { l: 58, r: 12, t: 14, b: 26 };
  const vals = points.map((p) => p.eq);
  let lo = Math.min(...vals, capital), hiV = Math.max(...vals, capital);
  if (lo === hiV) { lo -= 1; hiV += 1; }
  const span = hiV - lo;
  lo -= span * 0.08; hiV += span * 0.08;
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hiV - lo)) * (H - pad.t - pad.b);
  const ticks = [lo + (hiV - lo) * 0.1, (lo + hiV) / 2, hiV - (hiV - lo) * 0.1];
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.eq).toFixed(1)}`).join(' ');
  const p = hi !== null ? points[hi] : null;
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Equity from ${rp(points[0].eq)} to ${rp(points.at(-1)!.eq)} over ${points.length - 1} closed trades`}
        onPointerLeave={() => setHi(null)} style={{ display: 'block', touchAction: 'pan-y' }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgba(190,212,255,.10)" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--faint)" fontWeight="600">{rpShort(Math.round(t))}</text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(capital)} y2={y(capital)} stroke="rgba(190,212,255,.35)" strokeDasharray="4 4" />
        <path d={d} fill="none" stroke="var(--ember)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((pt, i) => i > 0 && (
          <circle key={i} cx={x(i)} cy={y(pt.eq)} r={points.length > 60 ? 2.5 : 4} fill={pt.pnl >= 0 ? '#199e70' : '#e66767'} stroke="#14284f" strokeWidth="1.5" />
        ))}
        {points.map((_, i) => (
          <rect key={`h${i}`} x={x(i) - (W - pad.l - pad.r) / (points.length - 1) / 2} y={0} width={(W - pad.l - pad.r) / (points.length - 1)} height={H} fill="transparent"
            onPointerEnter={() => setHi(i)} onPointerDown={() => setHi(i)} />
        ))}
        {hi !== null && <line x1={x(hi)} x2={x(hi)} y1={pad.t} y2={H - pad.b} stroke="rgba(238,243,255,.4)" strokeDasharray="3 3" pointerEvents="none" />}
        <text x={pad.l} y={H - 6} fontSize="12" fill="var(--faint)" fontWeight="600">Start</text>
        <text x={W - pad.r} y={H - 6} fontSize="12" fill="var(--faint)" fontWeight="600" textAnchor="end">{points.at(-1)!.at ? shortDate(points.at(-1)!.at) : ''}</text>
      </svg>
      {p && hi! > 0 && (
        <div className="glass chart-tip" style={{ position: 'absolute', top: 6, left: `clamp(0px, calc(${(x(hi!) / W) * 100}% - 80px), calc(100% - 160px))`, width: 160, padding: '8px 12px', borderRadius: 14, pointerEvents: 'none' }}>
          <div className="muted" style={{ fontSize: 12 }}>{p.ticker} · {shortDate(p.at)}</div>
          <div className={p.pnl >= 0 ? 'pos' : 'warn'} style={{ fontWeight: 700 }}>{p.pnl >= 0 ? '+' : '−'}{rp(Math.abs(p.pnl))}</div>
          <div className="muted" style={{ fontSize: 12 }}>Account {rp(p.eq)}</div>
        </div>
      )}
      <p className="faint" style={{ fontSize: 12.5, margin: '6px 0 0' }}>Dashed line: starting capital{capital ? ` (${rp(capital)})` : ' (not set)'}. Green dot = winning trade, red = losing.</p>
    </div>
  );
}

export function StockSettings({ capital, feeBuy, feeSell, lot }: { capital: number; feeBuy: number; feeSell: number; lot: number }) {
  const { toast } = useApp();
  const router = useRouter();
  const [v, setV] = useState({ capital: groupDigits(capital), feeBuy: String(feeBuy), feeSell: String(feeSell), lot: String(lot) });
  const [pending, start] = useTransition();
  function save() {
    start(async () => {
      for (const [k, val] of [
        ['stock_capital', v.capital.replace(/[^\d]/g, '') || '0'],
        ['stock_fee_buy', v.feeBuy],
        ['stock_fee_sell', v.feeSell],
        ['stock_lot', v.lot],
      ] as const) {
        const r = await saveLifeSetting(k, val);
        if (!r.ok) return toast(`${r.error}`, true);
      }
      toast('Saved');
      router.refresh();
    });
  }
  return (
    <section className="glass card" style={{ marginTop: 16 }}>
      <h2 className="card-title">Stock settings</h2>
      <p className="card-sub" style={{ margin: '4px 0 12px' }}>Fee rates vary by broker. Check your broker's fee page or a trade confirmation and enter yours; new fills use them.</p>
      <div className="form-grid two">
        <label className="field"><span>Starting capital (Rp)</span><input className="input num" inputMode="numeric" value={v.capital} onChange={(e) => setV({ ...v, capital: groupDigits(e.target.value) })} /></label>
        <label className="field"><span>Shares per lot</span><input className="input num" inputMode="numeric" value={v.lot} onChange={(e) => setV({ ...v, lot: e.target.value.replace(/[^\d]/g, '') })} /></label>
        <label className="field"><span>Buy fee (%)</span><input className="input num" inputMode="decimal" value={v.feeBuy} onChange={(e) => setV({ ...v, feeBuy: e.target.value })} /></label>
        <label className="field"><span>Sell fee incl. tax (%)</span><input className="input num" inputMode="decimal" value={v.feeSell} onChange={(e) => setV({ ...v, feeSell: e.target.value })} /></label>
      </div>
      <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={save} disabled={pending}>{pending ? 'Saving…' : 'Save settings'}</button>
    </section>
  );
}
