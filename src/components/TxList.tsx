'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from './AppContext';
import { Money } from './Money';
import { ICheck, IReceipt, IRepeat, ISelect, ITrash, IX } from './icons';
import { dayLabel } from '@/lib/dates';
import { deleteTransactions } from '@/app/actions';
import type { Tx } from '@/lib/types';

export function signedAmount(t: Tx) {
  if (t.type === 'expense') return -t.amount;
  if (t.type === 'income') return t.amount;
  if (t.type === 'adjust') return t.amount;
  return 0;
}

export function TxRow({ t, selected, onClick, showDate }: { t: Tx; selected?: boolean | null; onClick: () => void; showDate?: boolean }) {
  const { catById, walletById } = useApp();
  const cat = t.category_id ? catById.get(t.category_id) : undefined;
  const w = walletById.get(t.wallet_id);
  const tw = t.to_wallet_id ? walletById.get(t.to_wallet_id) : undefined;
  const emoji = t.type === 'transfer' ? '🔁' : t.type === 'adjust' ? '⚖️' : cat?.emoji ?? '✨';
  const tint = t.type === 'transfer' || t.type === 'adjust' ? '#9CC8F2' : cat?.color ?? '#9CC8F2';
  const title = t.title || (t.type === 'transfer' ? 'Transfer' : t.type === 'adjust' ? 'Balance adjustment' : cat?.name ?? 'Untitled');
  const where = t.type === 'transfer' ? `${w?.name ?? '?'} → ${tw?.name ?? '?'}` : w?.name ?? '';
  const what = t.type === 'transfer' ? 'Transfer' : t.type === 'adjust' ? 'Adjustment' : cat?.name ?? '';

  return (
    <button type="button" className={`row${selected ? ' selected' : ''}`} onClick={onClick}>
      {selected !== null && selected !== undefined ? (
        <span className={`check${selected ? ' on' : ''}`} aria-hidden>{selected && <ICheck />}</span>
      ) : (
        <span className="bubble" style={{ background: `${tint}2e` }} aria-hidden>{emoji}</span>
      )}
      <span style={{ minWidth: 0 }}>
        <span className="row-title" style={{ display: 'block' }}>{title}</span>
        <span className="row-meta">
          <span>{showDate ? t.occurred_at.slice(8, 10) + '/' + t.occurred_at.slice(5, 7) + ' ' : ''}{t.occurred_at.slice(11, 16)}</span>
          <span>{what}</span>
          <span className="faint">{where}</span>
          {t.has_receipt || (t.item_count ?? 0) > 0 ? <IReceipt aria-label="Has receipt" /> : null}
          {t.recurring_id ? <IRepeat aria-label="Repeats" /> : null}
        </span>
      </span>
      <span className={`row-amt ${t.type === 'income' ? 'pos' : ''}`}>
        {t.type === 'transfer' ? <Money value={t.amount} /> : <Money value={signedAmount(t)} sign />}
      </span>
    </button>
  );
}

export function TxList({ txs, today, selectable, emptyText }: { txs: Tx[]; today: string; selectable?: boolean; emptyText?: string }) {
  const { openSheet, toast } = useApp();
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();

  const groups = useMemo(() => {
    const m = new Map<string, Tx[]>();
    for (const t of txs) {
      const d = t.occurred_at.slice(0, 10);
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(t);
    }
    return [...m.entries()];
  }, [txs]);

  if (!txs.length)
    return (
      <div className="empty">
        <strong>No transactions here</strong>
        {emptyText ?? 'Add one with the + button, or type “kopi 25rb” on the overview.'}
      </div>
    );

  function toggle(id: number) {
    setPicked((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function removePicked() {
    if (!picked.size || !confirm(`Delete ${picked.size} transaction${picked.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
    start(async () => {
      const r = await deleteTransactions([...picked]);
      if (!r.ok) return toast(r.error, true);
      toast(`${picked.size} deleted`);
      setPicked(new Set());
      setSelecting(false);
      router.refresh();
    });
  }

  return (
    <div>
      {selectable && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
          {selecting ? (
            <>
              <button className="btn" onClick={() => setPicked(picked.size === txs.length ? new Set() : new Set(txs.map((t) => t.id)))}>
                {picked.size === txs.length ? 'Clear all' : 'Select all'}
              </button>
              <button className="btn btn-danger" disabled={!picked.size || pending} onClick={removePicked}>
                <ITrash /> Delete {picked.size || ''}
              </button>
              <button className="btn" onClick={() => { setSelecting(false); setPicked(new Set()); }}>
                <IX /> Done
              </button>
            </>
          ) : (
            <button className="btn" onClick={() => setSelecting(true)}>
              <ISelect /> Select
            </button>
          )}
        </div>
      )}
      {groups.map(([day, list]) => {
        const net = list.reduce((s, t) => s + (t.type === 'expense' ? -t.amount : t.type === 'income' ? t.amount : 0), 0);
        return (
          <section key={day} className="day-group">
            <div className="day-head">
              <span>{dayLabel(day, today)}</span>
              {net !== 0 && <Money value={net} sign />}
            </div>
            <div className="rows">
              {list.map((t) => (
                <TxRow key={t.id} t={t} selected={selecting ? picked.has(t.id) : null}
                  onClick={() => (selecting ? toggle(t.id) : openSheet({ kind: 'edit', id: t.id }))} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
