'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet } from '@/components/Sheet';
import { useApp } from '@/components/AppContext';
import { ICalendar, IEdit } from '@/components/icons';
import { saveBudgets, saveSetting } from '@/app/actions';
import { groupDigits, rpShort } from '@/lib/format';
import type { Category } from '@/lib/types';

export function BudgetActions({ categories, budgets, periodStart, spentBy }: {
  categories: Category[]; budgets: Record<number, number>; periodStart: number; spentBy: Record<number, number>;
}) {
  const [open, setOpen] = useState<'edit' | 'period' | null>(null);
  return (
    <div className="head-actions">
      <button className="btn" onClick={() => setOpen('period')}><ICalendar /> Starts on day {periodStart}</button>
      <button className="btn btn-primary" onClick={() => setOpen('edit')}><IEdit /> Edit budgets</button>
      {open === 'edit' && <EditSheet categories={categories} budgets={budgets} spentBy={spentBy} onClose={() => setOpen(null)} />}
      {open === 'period' && <PeriodSheet value={periodStart} onClose={() => setOpen(null)} />}
    </div>
  );
}

function EditSheet({ categories, budgets, spentBy, onClose }: { categories: Category[]; budgets: Record<number, number>; spentBy: Record<number, number>; onClose: () => void }) {
  const { toast } = useApp();
  const router = useRouter();
  const [vals, setVals] = useState<Record<number, string>>(Object.fromEntries(categories.map((c) => [c.id, budgets[c.id] ? groupDigits(budgets[c.id]) : ''])));
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const total = Object.values(vals).reduce((s, v) => s + (Number(v.replace(/\D/g, '')) || 0), 0);

  function save() {
    start(async () => {
      const r = await saveBudgets(categories.map((c) => ({ category_id: c.id, amount: Number((vals[c.id] || '').replace(/\D/g, '')) || 0 })));
      if (!r.ok) return setError(r.error);
      toast('Budgets saved');
      onClose();
      router.refresh();
    });
  }

  return (
    <Sheet title="Monthly budgets" onClose={onClose}
      footer={<button className="btn btn-primary btn-block" onClick={save} disabled={pending}>{pending ? 'Saving…' : 'Save budgets'}</button>}>
      <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>Leave a category empty to have no budget for it. Total: <strong className="num" style={{ color: 'var(--text)' }}>{rpShort(total)}</strong> a month.</p>
      <div className="stack" style={{ gap: 8 }}>
        {categories.map((c) => (
          <label key={c.id} className="row" style={{ gridTemplateColumns: 'auto 1fr minmax(120px, 160px)', cursor: 'text' }}>
            <span className="bubble" style={{ background: `${c.color}2e`, width: 38, height: 38, fontSize: 18 }} aria-hidden>{c.emoji}</span>
            <span style={{ minWidth: 0 }}>
              <span className="row-title" style={{ display: 'block' }}>{c.name}</span>
              <span className="row-meta">Spent {rpShort(spentBy[c.id] ?? 0)} this period</span>
            </span>
            <input className="input num" inputMode="numeric" placeholder="No budget" aria-label={`Budget for ${c.name}`} style={{ minHeight: 44, textAlign: 'right' }}
              value={vals[c.id]} onChange={(e) => setVals((v) => ({ ...v, [c.id]: groupDigits(e.target.value) }))} />
          </label>
        ))}
      </div>
      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
    </Sheet>
  );
}

function PeriodSheet({ value, onClose }: { value: number; onClose: () => void }) {
  const { toast } = useApp();
  const router = useRouter();
  const [day, setDay] = useState(value);
  const [pending, start] = useTransition();
  return (
    <Sheet title="When does your month start?" onClose={onClose}
      footer={<button className="btn btn-primary btn-block" disabled={pending} onClick={() => start(async () => {
        const r = await saveSetting('period_start', String(day));
        if (!r.ok) return toast(r.error, true);
        toast('Period start saved');
        onClose();
        router.refresh();
      })}>Save</button>}>
      <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
        If your salary arrives on the 25th, start your month on the 25th. Budgets and the overview follow this period. Reports keep using calendar months.
      </p>
      <div className="pick-grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
          <button key={d} className="pick" aria-pressed={day === d} onClick={() => setDay(d)} style={{ fontSize: 15, padding: '12px 0' }}>{d}</button>
        ))}
      </div>
    </Sheet>
  );
}
