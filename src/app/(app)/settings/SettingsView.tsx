'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import { Sheet } from '@/components/Sheet';
import { IChevR, ILogout, IPlus, IRepeat, ITrash } from '@/components/icons';
import { archiveCategory, deleteRecurring, saveCategory, saveSetting, setRecurringActive, signOut } from '@/app/actions';
import { rp } from '@/lib/format';
import { shortDate } from '@/lib/dates';
import { ALL_COLORS } from '@/lib/palette';
import type { Category, Recurring } from '@/lib/types';

const ZONES = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Bangkok', 'Europe/Brussels', 'Europe/Amsterdam', 'Europe/London', 'UTC'];
const FREQ: Record<string, string> = { daily: 'Every day', weekly: 'Every week', monthly: 'Every month', yearly: 'Every year' };

export function SettingsView({ categories, recurring, timezone }: { categories: Category[]; recurring: Recurring[]; timezone: string }) {
  const { toast, catById, walletById } = useApp();
  const router = useRouter();
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [pending, start] = useTransition();
  const list = categories.filter((c) => c.kind === kind);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error, true);
      toast(msg);
      router.refresh();
    });

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Categories, activities, repeats, alerts and time zone</p>
        </div>
      </div>

      <div className="grid-2">
        <section className="glass card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Categories</h2>
              <p className="card-sub">Keywords decide which category quick entries like “parkir 40rb” land in.</p>
            </div>
            <button className="btn" onClick={() => setEditing('new')}><IPlus /> Add</button>
          </div>
          <div className="seg" style={{ marginBottom: 12 }}>
            <button aria-pressed={kind === 'expense'} onClick={() => setKind('expense')}>Expense</button>
            <button aria-pressed={kind === 'income'} onClick={() => setKind('income')}>Income</button>
          </div>
          <div className="rows">
            {list.map((c) => (
              <button key={c.id} className="row" onClick={() => setEditing(c)} style={{ opacity: c.archived ? 0.55 : 1, gridTemplateColumns: 'auto minmax(0,1fr) auto' }}>
                <span className="bubble" style={{ background: `${c.color}2e`, boxShadow: `inset 0 0 0 2px ${c.color}` }} aria-hidden>{c.emoji}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="row-title" style={{ display: 'block' }}>{c.name}{c.archived ? ' (archived)' : ''}</span>
                  <span className="row-meta">{c.keywords ? c.keywords.split(',').slice(0, 6).join(', ') + (c.keywords.split(',').length > 6 ? '…' : '') : 'No keywords'}</span>
                </span>
                <IChevR width={16} className="faint" />
              </button>
            ))}
          </div>
        </section>

        <div className="stack">
          <section className="glass card">
            <h2 className="card-title">Repeating transactions</h2>
            <p className="card-sub" style={{ marginBottom: 12 }}>Created when you pick “Repeat” on a new transaction. Each one is added automatically when it comes due.</p>
            {recurring.length === 0 ? (
              <p className="muted" style={{ fontSize: 14 }}>None yet.</p>
            ) : (
              <div className="rows">
                {recurring.map((r) => {
                  const c = r.category_id ? catById.get(r.category_id) : null;
                  return (
                    <div key={r.id} className="row" style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto', opacity: r.active ? 1 : 0.6 }}>
                      <span className="bubble" style={{ background: 'rgba(156,200,242,.16)' }} aria-hidden>{r.type === 'transfer' ? '🔁' : c?.emoji ?? <IRepeat width={20} />}</span>
                      <span style={{ minWidth: 0 }}>
                        <span className="row-title" style={{ display: 'block' }}>{r.title || c?.name || 'Transfer'} <span className="num muted" style={{ fontWeight: 600 }}>{rp(r.amount)}</span></span>
                        <span className="row-meta">
                          <span>{FREQ[r.frequency]}</span>
                          <span className="faint">{r.active ? `next on ${shortDate(r.next_at)}` : 'paused'}</span>
                          <span className="faint">{walletById.get(r.wallet_id)?.name}</span>
                        </span>
                      </span>
                      <span style={{ display: 'flex', gap: 6 }}>
                        <button className="btn" style={{ minHeight: 38, padding: '0 12px', fontSize: 14 }} disabled={pending}
                          onClick={() => run(() => setRecurringActive(r.id, !r.active), r.active ? 'Paused' : 'Resumed')}>{r.active ? 'Pause' : 'Resume'}</button>
                        <button className="icon-btn" aria-label="Delete repeat" disabled={pending}
                          onClick={() => confirm('Stop repeating this? Transactions already added stay.') && run(() => deleteRecurring(r.id), 'Repeat removed')}><ITrash /></button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="glass card">
            <h2 className="card-title">Time zone</h2>
            <p className="card-sub" style={{ marginBottom: 12 }}>Decides what “today” means, and the default time on new transactions.</p>
            <select className="select" value={timezone} disabled={pending} onChange={(e) => run(() => saveSetting('timezone', e.target.value), 'Time zone saved')}>
              {(ZONES.includes(timezone) ? ZONES : [timezone, ...ZONES]).map((z) => <option key={z} value={z}>{z.replace('_', ' ')}</option>)}
            </select>
          </section>

          <section className="glass card">
            <h2 className="card-title">Privacy</h2>
            <p className="card-sub" style={{ margin: '4px 0 14px' }}>
              Only someone with your password can open this app. Search engines are told not to list it. To change the password, update APP_PASSWORD in Vercel and redeploy.
            </p>
            <form action={signOut}><button className="btn"><ILogout /> Sign out on this device</button></form>
          </section>
        </div>
      </div>

      {editing && <CategorySheet category={editing === 'new' ? null : editing} kind={kind} onClose={() => setEditing(null)} />}
    </>
  );
}

function CategorySheet({ category, kind, onClose }: { category: Category | null; kind: 'expense' | 'income'; onClose: () => void }) {
  const { toast } = useApp();
  const router = useRouter();
  const [name, setName] = useState(category?.name ?? '');
  const [emoji, setEmoji] = useState(category?.emoji ?? '✨');
  const [color, setColor] = useState(category?.color ?? ALL_COLORS[0]);
  const [keywords, setKeywords] = useState((category?.keywords ?? '').split(',').filter(Boolean).join(', '));
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error);
      toast(msg);
      onClose();
      router.refresh();
    });
  return (
    <Sheet title={category ? `Edit ${category.name}` : `New ${kind} category`} onClose={onClose}
      footer={<>
        {category && (
          <button className="btn btn-danger" disabled={pending} onClick={() => run(() => archiveCategory(category.id, !category.archived), category.archived ? 'Category restored' : 'Category archived')}>
            {category.archived ? 'Restore' : 'Archive'}
          </button>
        )}
        <button className="btn btn-primary btn-block" style={{ flex: 1 }} disabled={pending}
          onClick={() => run(() => saveCategory({ id: category?.id, name, emoji, color, kind, keywords }), category ? 'Category updated' : 'Category added')}>Save category</button>
      </>}>
      <div className="stack">
        <div className="form-grid" style={{ gridTemplateColumns: '84px 1fr' }}>
          <label className="field"><span>Icon</span><input className="input" style={{ textAlign: 'center', fontSize: 22 }} value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={8} /></label>
          <label className="field"><span>Name</span><input className="input" data-autofocus value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></label>
        </div>
        <div className="field">
          <span>Chart colour</span>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {ALL_COLORS.map((c) => (
              <button key={c} aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)}
                style={{ width: 40, height: 40, borderRadius: 999, background: c, border: color === c ? '3px solid var(--text)' : '3px solid transparent', boxShadow: '0 0 0 1px rgba(255,255,255,.15)' }} />
            ))}
          </div>
        </div>
        <label className="field">
          <span>Keywords for quick entry</span>
          <textarea className="textarea" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="parkir, bensin, grab" />
        </label>
        <p className="faint" style={{ margin: 0, fontSize: 13 }}>Separate with commas. If you type “bensin 50rb” and “bensin” is listed here, the entry goes to this category.</p>
        {category && <p className="faint" style={{ margin: 0, fontSize: 13 }}>Archiving hides the category from pickers. Past transactions keep it.</p>}
        {error && <div className="error">{error}</div>}
      </div>
    </Sheet>
  );
}
