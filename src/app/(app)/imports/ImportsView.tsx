'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import { addImports, dismissImports, type ImportDecision } from '@/app/actions';
import { groupDigits } from '@/lib/format';
import { dayLabel } from '@/lib/dates';
import type { EmailImport } from '@/lib/types';

const digits = (s: string) => Number(String(s).replace(/[^\d]/g, '')) || 0;

export function ImportsView({ items }: { items: EmailImport[] }) {
  const { categories, wallets, now, toast, openSheet } = useApp();
  const router = useRouter();
  const [busy, start] = useTransition();
  const activeWallets = wallets.filter((w) => !w.archived);
  const fallbackWallet = (activeWallets.find((w) => w.is_default) ?? activeWallets[0])?.id ?? null;
  const pending = items.filter((i) => i.status === 'pending');
  const unreadable = items.filter((i) => i.status === 'unreadable');
  const [edits, setEdits] = useState<Record<number, ImportDecision>>(() =>
    Object.fromEntries(pending.map((i) => [i.id, {
      id: i.id, type: i.type ?? 'expense', amount: i.amount ?? 0, title: i.title, category_id: i.category_id,
      wallet_id: i.wallet_id ?? fallbackWallet, occurred_at: i.received_at,
    }])),
  );
  const set = (id: number, patch: Partial<ImportDecision>) => setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error || 'Something went wrong', true);
      toast(msg);
      router.refresh();
    });

  const ready = pending.filter((i) => !i.maybe_dup && edits[i.id]?.wallet_id && edits[i.id]?.category_id && edits[i.id]?.amount > 0);

  if (items.length === 0) {
    return (
      <section className="glass card">
        <div className="empty"><strong>Nothing to check 🎉</strong>New transaction emails will show up here. If you haven't set it up yet, open Setup.</div>
      </section>
    );
  }

  return (
    <div className="stack">
      {pending.length > 0 && (
        <section className="glass card">
          <div className="card-head">
            <div>
              <h2 className="card-title">To check ({pending.length})</h2>
              <p className="card-sub">Amounts and categories are guesses from the email text.</p>
            </div>
            {ready.length > 1 && (
              <button className="btn btn-primary" disabled={busy} onClick={() => run(() => addImports(ready.map((i) => edits[i.id])), `${ready.length} added`)}>
                Add {ready.length}
              </button>
            )}
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {pending.map((i) => {
              const e = edits[i.id];
              const cats = categories.filter((c) => c.kind === e.type && (!c.archived || c.id === e.category_id));
              return (
                <div key={i.id} className="imp">
                  <div className="imp-top">
                    <span>{i.source_name || 'Email'} · {dayLabel(i.received_at, now)} {i.received_at.slice(11, 16)}</span>
                    <span className="faint" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{i.subject}</span>
                  </div>
                  <div className="imp-grid">
                    <input className="input imp-wide" aria-label="Title" value={e.title} onChange={(ev) => set(i.id, { title: ev.target.value })} maxLength={120} />
                    <input className="input num" aria-label="Amount" inputMode="numeric" value={groupDigits(e.amount)} onChange={(ev) => set(i.id, { amount: digits(ev.target.value) })} />
                    <select className="select" aria-label="Type" value={e.type} onChange={(ev) => set(i.id, { type: ev.target.value as 'expense' | 'income', category_id: null })}>
                      <option value="expense">💸 Expense</option>
                      <option value="income">💰 Income</option>
                    </select>
                    <select className="select" aria-label="Category" value={e.category_id ?? ''} onChange={(ev) => set(i.id, { category_id: Number(ev.target.value) || null })}>
                      <option value="">Pick a category</option>
                      {cats.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                    </select>
                    <select className="select" aria-label="Wallet" value={e.wallet_id ?? ''} onChange={(ev) => set(i.id, { wallet_id: Number(ev.target.value) || null })}>
                      {activeWallets.map((w) => <option key={w.id} value={w.id}>{w.emoji} {w.name}</option>)}
                    </select>
                    <input className="input imp-wide" type="datetime-local" aria-label="Date and time" value={e.occurred_at} onChange={(ev) => set(i.id, { occurred_at: ev.target.value })} />
                  </div>
                  {i.maybe_dup && <div className="imp-hint">⚠️ You already have a transaction for this amount around this time. Maybe you added it by hand?</div>}
                  {i.hint && <div className="imp-hint">💡 {i.hint}</div>}
                  {!i.wallet_id && i.source_name && <div className="faint" style={{ fontSize: 12.5 }}>Tip: name a wallet "{i.source_name}" and future emails from it pick that wallet by themselves.</div>}
                  <div className="imp-actions">
                    <button className="btn btn-ghost" disabled={busy} onClick={() => run(() => dismissImports([i.id]), 'Dismissed')}>Dismiss</button>
                    <button className="btn btn-primary" disabled={busy || !e.category_id || !e.wallet_id || !e.amount}
                      onClick={() => run(() => addImports([e]), 'Added')}>Add</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {unreadable.length > 0 && (
        <section className="glass card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Couldn't read ({unreadable.length})</h2>
              <p className="card-sub">From a bank or shop, but no amount was found. Add by hand or dismiss. If one bank keeps landing here, send me an example email (with personal numbers blacked out) and I can add a rule for it.</p>
            </div>
            {unreadable.length > 1 && (
              <button className="btn btn-ghost" disabled={busy} onClick={() => run(() => dismissImports(unreadable.map((u) => u.id)), 'Dismissed')}>Dismiss all</button>
            )}
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {unreadable.map((i) => (
              <div key={i.id} className="imp">
                <div className="imp-top"><span>{i.source_name || i.sender} · {dayLabel(i.received_at, now)}</span></div>
                <strong style={{ overflowWrap: 'anywhere' }}>{i.subject || '(no subject)'}</strong>
                <details><summary className="faint" style={{ fontSize: 13, cursor: 'pointer' }}>Show email text</summary><p className="imp-snip">{i.snippet}</p></details>
                <div className="imp-actions">
                  <button className="btn btn-ghost" disabled={busy} onClick={() => run(() => dismissImports([i.id]), 'Dismissed')}>Dismiss</button>
                  <button className="btn" disabled={busy} onClick={() => { openSheet({ kind: 'new', title: i.subject.slice(0, 60) }); dismissImports([i.id]).then(() => router.refresh()); }}>Add by hand</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
