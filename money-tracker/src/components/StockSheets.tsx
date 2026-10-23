'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet } from './Sheet';
import { useApp } from './AppContext';
import { ITrash } from './icons';
import { deleteTrade, loadTrade, saveTrade } from '@/app/life-actions';
import { CONTEXT_TAGS, EMOTIONS, SETUPS, TECH_TAGS, TIMEFRAMES, calcTrade } from '@/lib/stocks';
import { groupDigits, rp } from '@/lib/format';

type FillRow = { key: string; side: 'buy' | 'sell'; price: string; lots: string; fee: string; feeManual: boolean; filled_at: string };
const digits = (s: string) => Number(String(s).replace(/[^\d]/g, '')) || 0;
let seq = 0;

function Chips({ options, value, onToggle, multi }: { options: string[]; value: string[]; onToggle: (v: string) => void; multi?: boolean }) {
  return (
    <div className="chips" style={{ paddingBottom: 0 }} role={multi ? 'group' : 'radiogroup'}>
      {options.map((o) => (
        <button type="button" key={o} className="chip" aria-pressed={value.includes(o)} onClick={() => onToggle(o)}>{o}</button>
      ))}
    </div>
  );
}

/** New trade, edit, or close (review) a trade. */
export function TradeSheet({ tradeId, close }: { tradeId?: number; close?: boolean }) {
  const { now, closeSheet, toast } = useApp();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cfg, setCfg] = useState({ feeBuy: 0.15, feeSell: 0.25, lot: 100 });
  const [id, setId] = useState<number | undefined>(tradeId);
  const [ticker, setTicker] = useState('');
  const [setup, setSetup] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [stop, setStop] = useState('');
  const [target, setTarget] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [context, setContext] = useState<string[]>([]);
  const [emoIn, setEmoIn] = useState('');
  const [emoOut, setEmoOut] = useState('');
  const [rationale, setRationale] = useState('');
  const [review, setReview] = useState('');
  const [followed, setFollowed] = useState<boolean | null>(null);
  const [fills, setFills] = useState<FillRow[]>([]);
  const [customTag, setCustomTag] = useState('');
  const reviewRef = useRef<HTMLDivElement>(null);

  const feeFor = (side: 'buy' | 'sell', price: string, lots: string, c = cfg) =>
    String(Math.round((digits(price) * digits(lots) * c.lot * (side === 'buy' ? c.feeBuy : c.feeSell)) / 100));
  const newFill = (side: 'buy' | 'sell', c = cfg, price = '', lots = ''): FillRow => ({
    key: `f${seq++}`, side, price, lots, fee: feeFor(side, price, lots, c), feeManual: false, filled_at: now,
  });

  useEffect(() => {
    loadTrade(tradeId).then(({ trade, ...c }) => {
      setCfg(c);
      if (trade) {
        setId(trade.id);
        setTicker(trade.ticker);
        setSetup(trade.setup);
        setTimeframe(trade.timeframe);
        setStop(trade.stop ? groupDigits(trade.stop) : '');
        setTarget(trade.target ? groupDigits(trade.target) : '');
        setTags(trade.tags);
        setContext(trade.context);
        setEmoIn(trade.emotion_entry);
        setEmoOut(trade.emotion_exit);
        setRationale(trade.rationale);
        setReview(trade.review);
        setFollowed(trade.followed_plan);
        const rows: FillRow[] = trade.fills.map((f) => ({
          key: `f${seq++}`, side: f.side, price: groupDigits(f.price), lots: String(f.lots), fee: String(f.fee), feeManual: true, filled_at: f.filled_at,
        }));
        if (close) {
          const left = calcTrade(trade, c.lot).openShares / c.lot;
          if (left > 0) rows.push(newFill('sell', c, '', String(left)));
        }
        setFills(rows);
      } else setFills([newFill('buy', c)]);
      setLoading(false);
      if (close) setTimeout(() => reviewRef.current?.scrollIntoView({ block: 'start' }), 100);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeId]);

  const setFill = (key: string, patch: Partial<FillRow>) =>
    setFills((fs) => fs.map((f) => {
      if (f.key !== key) return f;
      const n = { ...f, ...patch };
      if (!n.feeManual && ('price' in patch || 'lots' in patch || 'side' in patch)) n.fee = feeFor(n.side, n.price, n.lots);
      return n;
    }));

  const calc = calcTrade(
    { stop: digits(stop) || null, target: digits(target) || null, fills: fills.map((f, i) => ({ id: i, side: f.side, price: digits(f.price), lots: digits(f.lots), fee: digits(f.fee), filled_at: f.filled_at })) },
    cfg.lot,
  );
  const isClosed = calc.sharesBought > 0 && calc.openShares === 0;
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  function submit() {
    setError('');
    start(async () => {
      const r = await saveTrade({
        id, ticker, setup, timeframe, stop: digits(stop) || null, target: digits(target) || null, tags, context,
        emotion_entry: emoIn, emotion_exit: emoOut, rationale, review, followed_plan: followed,
        fills: fills.map((f) => ({ side: f.side, price: digits(f.price), lots: digits(f.lots), fee: digits(f.fee), filled_at: f.filled_at })),
      });
      if (!r.ok) return setError(r.error || 'Could not save.');
      toast(isClosed ? 'Trade closed' : id ? 'Trade updated' : 'Trade saved');
      closeSheet();
      router.refresh();
    });
  }
  function remove() {
    if (!id || !confirm('Delete this trade and all its fills?')) return;
    start(async () => {
      const r = await deleteTrade(id);
      if (!r.ok) return setError(r.error || 'Could not delete.');
      toast('Trade deleted');
      closeSheet();
      router.refresh();
    });
  }

  return (
    <Sheet
      title={loading ? 'Loading…' : close ? `Close ${ticker}` : id ? `Edit ${ticker}` : 'New trade'}
      onClose={closeSheet}
      footer={!loading && (
        <>
          {id && <button className="btn btn-danger" onClick={remove} disabled={pending} aria-label="Delete trade"><ITrash /></button>}
          <button className="btn btn-primary btn-block" style={{ flex: 1 }} onClick={submit} disabled={pending}>
            {pending ? 'Saving…' : isClosed ? `Save · P&L ${calc.pnl >= 0 ? '+' : ''}${rp(calc.pnl)}` : 'Save trade'}
          </button>
        </>
      )}
    >
      {loading ? <p className="muted">Loading…</p> : (
        <div className="stack">
          <div className="form-grid two">
            <label className="field"><span>Ticker</span>
              <input className="input" data-autofocus value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="BBRI" maxLength={12} autoCapitalize="characters" />
            </label>
            <div className="field"><span>Planned reward : risk</span>
              <div className="input num" style={{ display: 'flex', alignItems: 'center' }} aria-live="polite">
                {calc.rr ? `${calc.rr.toFixed(2)} : 1` : '–'}
              </div>
            </div>
            <label className="field"><span>Stop loss (Rp)</span>
              <input className="input num" inputMode="numeric" value={stop} onChange={(e) => setStop(groupDigits(e.target.value))} placeholder="0" />
            </label>
            <label className="field"><span>Target (Rp)</span>
              <input className="input num" inputMode="numeric" value={target} onChange={(e) => setTarget(groupDigits(e.target.value))} placeholder="0" />
            </label>
          </div>

          <div className="field"><span>Setup</span><Chips options={SETUPS} value={[setup]} onToggle={(v) => setSetup(setup === v ? '' : v)} /></div>
          <div className="field"><span>Timeframe</span><Chips options={TIMEFRAMES} value={[timeframe]} onToggle={(v) => setTimeframe(timeframe === v ? '' : v)} /></div>

          <div className="field">
            <span>Buys and sells ({cfg.lot} shares per lot)</span>
            <div className="stack" style={{ gap: 8 }}>
              <div className="fill-head" aria-hidden><span>Side</span><span>Price (Rp)</span><span>Lots</span><span>Fee (Rp)</span><span /></div>
              {fills.map((f) => (
                <div key={f.key} className="fill-row">
                  <select className="select" aria-label="Buy or sell" value={f.side} onChange={(e) => setFill(f.key, { side: e.target.value as 'buy' | 'sell' })}>
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                  </select>
                  <input className="input num" inputMode="numeric" aria-label="Price per share" placeholder="Price" value={f.price} onChange={(e) => setFill(f.key, { price: groupDigits(e.target.value) })} />
                  <input className="input num" inputMode="numeric" aria-label="Lots" placeholder="Lots" value={f.lots} onChange={(e) => setFill(f.key, { lots: e.target.value.replace(/[^\d]/g, '') })} />
                  <input className="input num" inputMode="numeric" aria-label="Fee (Rp)" placeholder="Fee" value={groupDigits(f.fee)} onChange={(e) => setFill(f.key, { fee: String(digits(e.target.value)), feeManual: true })} />
                  <input className="input fill-date" type="datetime-local" aria-label="Date and time" value={f.filled_at} onChange={(e) => setFill(f.key, { filled_at: e.target.value })} />
                  <button type="button" className="icon-btn" aria-label="Remove fill" onClick={() => setFills((fs) => fs.filter((x) => x.key !== f.key))}>✕</button>
                </div>
              ))}
              <div className="chips" style={{ paddingBottom: 0 }}>
                <button type="button" className="chip" onClick={() => setFills((fs) => [...fs, newFill('buy')])}>＋ Buy</button>
                <button type="button" className="chip" onClick={() => setFills((fs) => [...fs, newFill('sell', cfg, '', calc.openShares > 0 ? String(calc.openShares / cfg.lot) : '')])}>＋ Sell</button>
              </div>
              <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>
                Fees fill in from your rates (buy {cfg.feeBuy}%, sell {cfg.feeSell}%); change any fee to match your broker note.
                {calc.openShares < 0 && ' You are selling more lots than you bought.'}
                {calc.sharesBought > 0 && calc.openShares >= 0 && ` Average buy ${rp(Math.round(calc.avgBuy))}, ${calc.openShares / cfg.lot} lots still open.`}
                {calc.sharesSold > 0 && calc.openShares >= 0 && ` Realised P&L ${calc.pnl >= 0 ? '+' : ''}${rp(calc.pnl)}${calc.r !== null ? ` (${calc.r.toFixed(2)} R)` : ''}.`}
              </p>
            </div>
          </div>

          <div className="field"><span>Technical signals</span><Chips multi options={[...new Set([...TECH_TAGS, ...tags.filter((t) => !CONTEXT_TAGS.includes(t))])]} value={tags} onToggle={(v) => toggle(tags, setTags, v)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input className="input" style={{ minHeight: 40 }} value={customTag} onChange={(e) => setCustomTag(e.target.value)} placeholder="Add your own signal" maxLength={40} />
              <button type="button" className="btn" style={{ minHeight: 40 }} disabled={!customTag.trim()} onClick={() => { toggle(tags, setTags, customTag.trim()); setCustomTag(''); }}>Add</button>
            </div>
          </div>
          <div className="field"><span>Market context</span><Chips multi options={CONTEXT_TAGS} value={context} onToggle={(v) => toggle(context, setContext, v)} /></div>
          <div className="field"><span>How you felt at entry</span><Chips options={EMOTIONS} value={[emoIn]} onToggle={(v) => setEmoIn(emoIn === v ? '' : v)} /></div>
          <label className="field"><span>Why this trade?</span>
            <textarea className="textarea" value={rationale} onChange={(e) => setRationale(e.target.value)} maxLength={3000} placeholder="Break of a 4-week base on volume…" />
          </label>

          <div ref={reviewRef} className="glass" style={{ padding: 14, borderRadius: 20 }}>
            <h3 className="card-title" style={{ fontSize: 16, marginBottom: 10 }}>Review {isClosed ? '' : '(when you close)'}</h3>
            <div className="stack" style={{ gap: 12 }}>
              <div className="field"><span>How you felt at exit</span><Chips options={EMOTIONS} value={[emoOut]} onToggle={(v) => setEmoOut(emoOut === v ? '' : v)} /></div>
              <div className="field"><span>Followed your plan?</span>
                <div className="seg" role="group" aria-label="Followed plan">
                  <button type="button" aria-pressed={followed === true} onClick={() => setFollowed(followed === true ? null : true)}>Yes</button>
                  <button type="button" aria-pressed={followed === false} onClick={() => setFollowed(followed === false ? null : false)}>No</button>
                </div>
              </div>
              <label className="field"><span>What went right or wrong?</span>
                <textarea className="textarea" value={review} onChange={(e) => setReview(e.target.value)} maxLength={3000} />
              </label>
            </div>
          </div>
          {error && <div className="error" role="alert">{error}</div>}
        </div>
      )}
    </Sheet>
  );
}
