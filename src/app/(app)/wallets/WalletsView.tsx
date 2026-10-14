'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import { Sheet } from '@/components/Sheet';
import { Money } from '@/components/Money';
import { HideToggle } from '@/components/HideToggle';
import { IChevR, IPlus, IScale, IStar, ISwap, ITrash } from '@/components/icons';
import { addToGoal, archiveWallet, deleteGoal, saveGoal, saveWallet, setDefaultWallet } from '@/app/actions';
import { groupDigits, rp, rpShort } from '@/lib/format';
import type { Goal, Wallet } from '@/lib/types';

const KINDS: { v: Wallet['kind']; label: string; emoji: string }[] = [
  { v: 'cash', label: 'Cash', emoji: '💵' },
  { v: 'bank', label: 'Bank account', emoji: '🏦' },
  { v: 'ewallet', label: 'E-wallet', emoji: '📱' },
  { v: 'credit', label: 'Credit card', emoji: '💳' },
  { v: 'savings', label: 'Savings', emoji: '🐚' },
];
const kindLabel = (k: string) => KINDS.find((x) => x.v === k)?.label ?? k;
const digits = (s: string) => Number(String(s).replace(/[^\d]/g, '')) || 0;

function nextDue(today: string, day: number) {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const d = Number(today.slice(8, 10));
  const daysIn = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  let ny = y, nm = m;
  if (d > Math.min(day, daysIn(y, m))) { nm = m === 12 ? 1 : m + 1; ny = m === 12 ? y + 1 : y; }
  const dd = Math.min(day, daysIn(ny, nm));
  const date = `${ny}-${String(nm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const days = Math.round((Date.parse(date) - Date.parse(today)) / 86400000);
  return { date, days };
}

export function WalletsView({ wallets, goals, today }: { wallets: Wallet[]; goals: Goal[]; today: string }) {
  const { openSheet } = useApp();
  const [editing, setEditing] = useState<Wallet | 'new' | null>(null);
  const [goal, setGoal] = useState<Goal | 'new' | null>(null);
  const [adding, setAdding] = useState<Goal | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const active = wallets.filter((w) => !w.archived);
  const archived = wallets.filter((w) => w.archived);
  const total = active.reduce((s, w) => s + (w.balance ?? 0), 0);
  const owed = active.filter((w) => w.kind === 'credit' && (w.balance ?? 0) < 0).reduce((s, w) => s - (w.balance ?? 0), 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Wallets</h1>
          <p className="page-sub">Everything you hold, minus what you owe on cards</p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => openSheet({ kind: 'new', type: 'transfer' })}><ISwap /> Transfer</button>
          <button className="btn" onClick={() => openSheet({ kind: 'new', type: 'adjust' })}><IScale /> Fix a balance</button>
          <button className="btn btn-primary" onClick={() => setEditing('new')}><IPlus /> Add wallet</button>
        </div>
      </div>

      <div className="grid-2">
        <div className="stack">
          <section className="glass card">
            <div className="stat-label">Total balance</div>
            <div className="hero-amount" style={{ marginTop: 4 }}>
              <span className={`big ${total < 0 ? 'warn' : ''}`} style={{ fontSize: 40 }}><Money value={total} /></span>
              <HideToggle />
            </div>
            {owed > 0 && <p className="muted" style={{ margin: '8px 0 0', fontSize: 14 }}>Includes <Money value={owed} /> owed on credit cards.</p>}
          </section>

          <section className="glass card">
            <h2 className="card-title" style={{ marginBottom: 12 }}>Your wallets</h2>
            <div className="rows">
              {active.map((w) => {
                const due = w.kind === 'credit' && w.due_day ? nextDue(today, w.due_day) : null;
                const used = w.kind === 'credit' && w.credit_limit ? Math.max(0, -(w.balance ?? 0)) / w.credit_limit : null;
                return (
                  <button key={w.id} className="row" onClick={() => setEditing(w)} style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto auto' }}>
                    <span className="bubble" style={{ background: 'rgba(156,200,242,.16)' }} aria-hidden>{w.emoji}</span>
                    <span style={{ minWidth: 0 }}>
                      <span className="row-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {w.name} {w.is_default && <IStar width={15} style={{ color: 'var(--sun)', fill: 'var(--sun)' }} aria-label="Default wallet" />}
                      </span>
                      <span className="row-meta" style={{ flexWrap: 'wrap', whiteSpace: 'normal', rowGap: 0 }}>
                        <span>{kindLabel(w.kind)}</span>
                        {due && <span className={due.days <= 3 ? 'warn' : 'faint'}>Due {due.days === 0 ? 'today' : `in ${due.days} days`}</span>}
                        {used !== null && <span className="faint">{Math.round(used * 100)}% of limit</span>}
                      </span>
                    </span>
                    <span className={`row-amt ${(w.balance ?? 0) < 0 ? 'warn' : ''}`}><Money value={w.balance ?? 0} /></span>
                    <IChevR width={16} className="faint" />
                  </button>
                );
              })}
            </div>
            {!active.some((w) => w.kind === 'credit') && (
              <button className="row" style={{ marginTop: 10, gridTemplateColumns: 'auto 1fr auto' }} onClick={() => setEditing({ kind: 'credit' } as Wallet)}>
                <span className="bubble" style={{ background: 'rgba(245,176,122,.16)' }} aria-hidden>💳</span>
                <span>
                  <span className="row-title" style={{ display: 'block' }}>Have a credit card?</span>
                  <span className="row-meta">Add it as a wallet to track what you owe and when it is due.</span>
                </span>
                <IChevR width={16} className="faint" />
              </button>
            )}
            {archived.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <button className="link" style={{ background: 'none', border: 0, padding: 0 }} onClick={() => setShowArchived((s) => !s)}>
                  {showArchived ? 'Hide' : 'Show'} {archived.length} archived {archived.length === 1 ? 'wallet' : 'wallets'}
                </button>
                {showArchived && (
                  <div className="rows" style={{ marginTop: 10, opacity: 0.75 }}>
                    {archived.map((w) => (
                      <button key={w.id} className="row" onClick={() => setEditing(w)}>
                        <span className="bubble" style={{ background: 'rgba(156,200,242,.1)' }} aria-hidden>{w.emoji}</span>
                        <span className="row-title">{w.name}</span>
                        <span className="row-amt"><Money value={w.balance ?? 0} /></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <section className="glass card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Goals</h2>
              <p className="card-sub">Targets you are saving towards</p>
            </div>
            <button className="btn" onClick={() => setGoal('new')}><IPlus /> Add goal</button>
          </div>
          {goals.length === 0 ? (
            <div className="empty"><strong>No goals yet</strong>Create a target for a trip, a laptop or an emergency fund, then add to it as you save.</div>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {goals.map((g) => {
                const pct = Math.min(1, g.saved / g.target);
                return (
                  <div key={g.id} className="row" style={{ gridTemplateColumns: 'auto 1fr', alignItems: 'start' }}>
                    <span className="bubble" style={{ background: 'rgba(159,216,180,.16)' }} aria-hidden>{g.emoji}</span>
                    <span>
                      <span className="cat-line-top">
                        <button style={{ background: 'none', border: 0, padding: 0, fontWeight: 700, fontSize: 15 }} onClick={() => setGoal(g)}>{g.name}</button>
                        <span><Money value={g.saved} short /> <span className="faint">of {rpShort(g.target)}</span></span>
                      </span>
                      <span className="bar"><span style={{ width: `${Math.max(2, pct * 100)}%`, background: pct >= 1 ? 'var(--leaf)' : 'var(--mist)' }} /></span>
                      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <span className="row-meta">{pct >= 1 ? 'Reached' : `${rpShort(g.target - g.saved)} to go`}</span>
                        <button className="btn" style={{ minHeight: 36, padding: '0 12px', fontSize: 14 }} onClick={() => setAdding(g)}><IPlus /> Add money</button>
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {editing && <WalletSheet wallet={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {goal && <GoalSheet goal={goal === 'new' ? null : goal} onClose={() => setGoal(null)} />}
      {adding && <AddToGoalSheet goal={adding} onClose={() => setAdding(null)} />}
    </>
  );
}

function WalletSheet({ wallet, onClose }: { wallet: Wallet | null; onClose: () => void }) {
  const { toast } = useApp();
  const router = useRouter();
  const isEdit = !!wallet?.id;
  const [name, setName] = useState(wallet?.name ?? '');
  const [kind, setKind] = useState<Wallet['kind']>(wallet?.kind ?? 'cash');
  const [emoji, setEmoji] = useState(wallet?.emoji ?? '💵');
  const [initial, setInitial] = useState(wallet?.initial_balance ? groupDigits(Math.abs(wallet.initial_balance)) : '');
  const [initialNeg, setInitialNeg] = useState((wallet?.initial_balance ?? 0) < 0 || (!isEdit && wallet?.kind === 'credit'));
  const [limit, setLimit] = useState(wallet?.credit_limit ? groupDigits(wallet.credit_limit) : '');
  const [due, setDue] = useState(wallet?.due_day ? String(wallet.due_day) : '');
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

  function save() {
    run(() => saveWallet({
      id: wallet?.id, name, kind, emoji,
      initial_balance: (kind === 'credit' || initialNeg ? -1 : 1) * digits(initial),
      credit_limit: kind === 'credit' ? digits(limit) || null : null,
      due_day: kind === 'credit' ? Number(due) || null : null,
    }), isEdit ? 'Wallet updated' : 'Wallet added');
  }

  return (
    <Sheet title={isEdit ? `Edit ${wallet.name}` : 'New wallet'} onClose={onClose}
      footer={<>
        {isEdit && (
          <button className="btn btn-danger" disabled={pending} aria-label={wallet.archived ? 'Restore wallet' : 'Archive wallet'}
            onClick={() => (wallet.archived || confirm('Archive this wallet? Its transactions stay, it just disappears from pickers.')) && run(() => archiveWallet(wallet.id, !wallet.archived), wallet.archived ? 'Wallet restored' : 'Wallet archived')}>
            {wallet.archived ? 'Restore' : <ITrash />}
          </button>
        )}
        <button className="btn btn-primary btn-block" style={{ flex: 1 }} disabled={pending} onClick={save}>{pending ? 'Saving…' : 'Save wallet'}</button>
      </>}>
      <div className="stack">
        <div className="field">
          <span>Type</span>
          <div className="pick-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))' }}>
            {KINDS.map((k) => (
              <button key={k.v} className="pick" aria-pressed={kind === k.v} onClick={() => { setKind(k.v); if (!isEdit) { setEmoji(k.emoji); setInitialNeg(k.v === 'credit'); } }}>
                <span className="e" aria-hidden>{k.emoji}</span>{k.label}
              </button>
            ))}
          </div>
        </div>
        <div className="form-grid" style={{ gridTemplateColumns: '84px 1fr' }}>
          <label className="field"><span>Icon</span><input className="input" style={{ textAlign: 'center', fontSize: 22 }} value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={8} /></label>
          <label className="field"><span>Name</span><input className="input" data-autofocus placeholder="BCA, GoPay, Jenius…" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></label>
        </div>
        <label className="field">
          <span>{kind === 'credit' ? 'Amount owed when you start tracking' : 'Starting balance'}</span>
          <input className="input num" inputMode="numeric" placeholder="0" value={initial} onChange={(e) => setInitial(groupDigits(e.target.value))} />
        </label>
        {kind !== 'credit' && (
          <label className="switch-row">
            <span>Starting balance is negative (overdrawn)</span>
            <input type="checkbox" checked={initialNeg} onChange={(e) => setInitialNeg(e.target.checked)} style={{ width: 22, height: 22 }} />
          </label>
        )}
        {kind === 'credit' && (
          <div className="form-grid two">
            <label className="field"><span>Credit limit</span><input className="input num" inputMode="numeric" placeholder="Optional" value={limit} onChange={(e) => setLimit(groupDigits(e.target.value))} /></label>
            <label className="field"><span>Payment due day</span><input className="input" inputMode="numeric" placeholder="e.g. 25" value={due} onChange={(e) => setDue(e.target.value.replace(/\D/g, '').slice(0, 2))} /></label>
          </div>
        )}
        {kind === 'credit' && <p className="faint" style={{ margin: 0, fontSize: 13 }}>Spending on the card makes its balance negative. Paying the bill is a transfer from your bank to the card.</p>}
        {isEdit && !wallet.is_default && !wallet.archived && (
          <button className="btn" onClick={() => run(() => setDefaultWallet(wallet.id), 'Default wallet set')}><IStar /> Make this the default wallet</button>
        )}
        {isEdit && <p className="faint" style={{ margin: 0, fontSize: 13 }}>Current balance: {rp(wallet.balance ?? 0)}. To correct it, use “Fix a balance”.</p>}
        {error && <div className="error">{error}</div>}
      </div>
    </Sheet>
  );
}

function GoalSheet({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const { toast } = useApp();
  const router = useRouter();
  const [name, setName] = useState(goal?.name ?? '');
  const [emoji, setEmoji] = useState(goal?.emoji ?? '🌱');
  const [target, setTarget] = useState(goal ? groupDigits(goal.target) : '');
  const [saved, setSaved] = useState(goal ? groupDigits(goal.saved) : '');
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
    <Sheet title={goal ? 'Edit goal' : 'New goal'} onClose={onClose}
      footer={<>
        {goal && <button className="btn btn-danger" aria-label="Delete goal" disabled={pending} onClick={() => confirm('Delete this goal?') && run(() => deleteGoal(goal.id), 'Goal deleted')}><ITrash /></button>}
        <button className="btn btn-primary btn-block" style={{ flex: 1 }} disabled={pending}
          onClick={() => run(() => saveGoal({ id: goal?.id, name, emoji, target: digits(target), saved: digits(saved) }), goal ? 'Goal updated' : 'Goal added')}>Save goal</button>
      </>}>
      <div className="stack">
        <div className="form-grid" style={{ gridTemplateColumns: '84px 1fr' }}>
          <label className="field"><span>Icon</span><input className="input" style={{ textAlign: 'center', fontSize: 22 }} value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={8} /></label>
          <label className="field"><span>Name</span><input className="input" data-autofocus placeholder="Trip to Lombok" value={name} onChange={(e) => setName(e.target.value)} /></label>
        </div>
        <div className="form-grid two">
          <label className="field"><span>Target</span><input className="input num" inputMode="numeric" placeholder="0" value={target} onChange={(e) => setTarget(groupDigits(e.target.value))} /></label>
          <label className="field"><span>Saved so far</span><input className="input num" inputMode="numeric" placeholder="0" value={saved} onChange={(e) => setSaved(groupDigits(e.target.value))} /></label>
        </div>
        <p className="faint" style={{ margin: 0, fontSize: 13 }}>Goals are a tally you keep yourself. They do not move money between wallets.</p>
        {error && <div className="error">{error}</div>}
      </div>
    </Sheet>
  );
}

function AddToGoalSheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { toast } = useApp();
  const router = useRouter();
  const [amt, setAmt] = useState('');
  const [withdraw, setWithdraw] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <Sheet title={`${goal.emoji} ${goal.name}`} onClose={onClose}
      footer={<button className="btn btn-primary btn-block" disabled={pending} onClick={() => start(async () => {
        const r = await addToGoal(goal.id, (withdraw ? -1 : 1) * digits(amt));
        if (!r.ok) return setError(r.error);
        toast(withdraw ? 'Taken from goal' : 'Added to goal');
        onClose();
        router.refresh();
      })}>{withdraw ? 'Take out' : 'Add to goal'}</button>}>
      <div className="stack">
        <div className="seg full">
          <button aria-pressed={!withdraw} onClick={() => setWithdraw(false)}>Add</button>
          <button aria-pressed={withdraw} onClick={() => setWithdraw(true)}>Take out</button>
        </div>
        <label className="amount-input"><span>Rp</span><input data-autofocus inputMode="numeric" placeholder="0" aria-label="Amount" value={amt} onChange={(e) => setAmt(groupDigits(e.target.value))} /></label>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>Saved so far: {rp(goal.saved)} of {rp(goal.target)}.</p>
        {error && <div className="error">{error}</div>}
      </div>
    </Sheet>
  );
}
