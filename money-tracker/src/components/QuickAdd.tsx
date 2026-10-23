'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from './AppContext';
import { Sheet } from './Sheet';
import { IArrowUp, ITrash } from './icons';
import { parseQuickText } from '@/lib/parse';
import { saveDrafts } from '@/app/actions';
import { groupDigits } from '@/lib/format';
import type { Draft } from '@/lib/types';

export function QuickAdd() {
  const { categories, wallets, now, toast } = useApp();
  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [source, setSource] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    const d = parseQuickText(t, categories, wallets);
    if (!d.length) {
      toast('No amount found. Try something like "parkir 40rb".', true);
      return;
    }
    setSource(t);
    setDrafts(d);
  }

  return (
    <>
      <form className="quick" onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="parkir 40rb, gaji 5jt…"
          aria-label="Quick add: type what you spent or received"
          enterKeyHint="send"
          autoComplete="off"
        />
        <button aria-label="Read and review">
          <IArrowUp />
        </button>
      </form>
      <p className="quick-hint">Separate several with commas. You review everything before it is saved.</p>
      {drafts && (
        <DraftSheet
          source={source}
          initial={drafts}
          now={now}
          onClose={() => setDrafts(null)}
          onSaved={() => {
            setDrafts(null);
            setText('');
          }}
        />
      )}
    </>
  );
}

function DraftSheet({ source, initial, now, onClose, onSaved }: { source: string; initial: Draft[]; now: string; onClose: () => void; onSaved: () => void }) {
  const { categories, wallets, toast } = useApp();
  const router = useRouter();
  const [drafts, setDrafts] = useState(initial);
  const [at, setAt] = useState(now);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const set = (k: string, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d) => (d.key === k ? { ...d, ...patch } : d)));

  function save() {
    setError('');
    start(async () => {
      const r = await saveDrafts(drafts, at);
      if (!r.ok) return setError(r.error);
      toast(drafts.length === 1 ? 'Transaction saved' : `${drafts.length} transactions saved`);
      onSaved();
      router.refresh();
    });
  }

  return (
    <Sheet
      title="Review before saving"
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" onClick={save} disabled={pending || drafts.length === 0}>
          {pending ? 'Saving…' : drafts.length === 1 ? 'Save 1 transaction' : `Save ${drafts.length} transactions`}
        </button>
      }
    >
      <div className="stack">
        <p className="muted" style={{ margin: 0 }}>
          You typed <strong style={{ color: 'var(--text)' }}>“{source}”</strong>. Check each one, then save them together.
        </p>
        {drafts.map((d, i) => {
          const cats = categories.filter((c) => c.kind === d.type && !c.archived);
          return (
            <div key={d.key} className="glass" style={{ padding: 14, borderRadius: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <strong className="muted">Transaction {i + 1}</strong>
                <button className="icon-btn" aria-label={`Remove transaction ${i + 1}`} onClick={() => setDrafts((ds) => ds.filter((x) => x.key !== d.key))}>
                  <ITrash />
                </button>
              </div>
              <div className="stack" style={{ gap: 10 }}>
                <div className="seg full" role="group" aria-label="Type">
                  {(['expense', 'income'] as const).map((t) => (
                    <button key={t} type="button" aria-pressed={d.type === t}
                      onClick={() => {
                        const fallback = categories.find((c) => c.kind === t && !c.archived && /^other/i.test(c.name)) ?? categories.find((c) => c.kind === t && !c.archived);
                        set(d.key, { type: t, category_id: categories.find((c) => c.id === d.category_id)?.kind === t ? d.category_id : fallback?.id ?? null });
                      }}>
                      {t === 'expense' ? 'Expense' : 'Income'}
                    </button>
                  ))}
                </div>
                <label className="amount-input" style={{ padding: '2px 16px' }}>
                  <span>Rp</span>
                  <input inputMode="numeric" aria-label="Amount" style={{ fontSize: 26, height: 52 }} value={groupDigits(d.amount)}
                    onChange={(e) => set(d.key, { amount: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })} />
                </label>
                <input className="input" aria-label="Title" value={d.title} onChange={(e) => set(d.key, { title: e.target.value })} />
                <div className="form-grid two">
                  <select className="select" aria-label="Category" value={d.category_id ?? ''} onChange={(e) => set(d.key, { category_id: Number(e.target.value) })}>
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                  </select>
                  <select className="select" aria-label="Wallet" value={d.wallet_id ?? ''} onChange={(e) => set(d.key, { wallet_id: Number(e.target.value) })}>
                    {wallets.filter((w) => !w.archived).map((w) => <option key={w.id} value={w.id}>{w.emoji} {w.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
        {drafts.length === 0 && <p className="muted">Nothing left to save.</p>}
        <label className="field">
          <span>When</span>
          <input className="input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        </label>
        {error && <div className="error" role="alert">{error}</div>}
      </div>
    </Sheet>
  );
}
