'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet } from './Sheet';
import { useApp, type SheetRequest } from './AppContext';
import { ICamera, IPlus, IReceipt, ITrash, IX } from './icons';
import { deleteTransactions, loadTransaction, saveTransaction, type TxPayload } from '@/app/actions';
import { groupDigits, rp } from '@/lib/format';
import { compressImage } from '@/lib/image';
import type { Item, ItemKind, TxType } from '@/lib/types';

const TYPES: { v: TxType; label: string }[] = [
  { v: 'expense', label: 'Expense' },
  { v: 'income', label: 'Income' },
  { v: 'transfer', label: 'Transfer' },
  { v: 'adjust', label: 'Adjust' },
];
const KIND_LABEL: Record<ItemKind, string> = { item: 'Item', tax: 'Tax', fee: 'Service fee', discount: 'Discount' };

const digits = (s: string) => Number(String(s).replace(/[^\d]/g, '')) || 0;

export function itemsTotal(items: Item[]) {
  return items.reduce((s, i) => s + (i.kind === 'discount' ? -1 : 1) * (Number(i.amount) || 0), 0);
}

export function TxSheet({ request }: { request: SheetRequest }) {
  const { categories, wallets, walletById, now, closeSheet, toast } = useApp();
  const router = useRouter();
  const [pending, start] = useTransition();
  const activeWallets = wallets.filter((w) => !w.archived);
  const defaultWallet = activeWallets.find((w) => w.is_default) ?? activeWallets[0];

  const isEdit = request.kind === 'edit';
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState('');
  const [id, setId] = useState<number | undefined>(undefined);
  const [type, setType] = useState<TxType>(request.kind === 'new' ? request.type ?? 'expense' : 'expense');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState(request.kind === 'new' ? request.title ?? '' : '');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [walletId, setWalletId] = useState<number>(
    (request.kind === 'new' && request.walletId) || defaultWallet?.id || 0,
  );
  const [toWalletId, setToWalletId] = useState<number>(activeWallets.find((w) => w.id !== walletId)?.id ?? 0);
  const [at, setAt] = useState(now);
  const [repeat, setRepeat] = useState<TxPayload['repeat']>('none');
  const [items, setItems] = useState<Item[]>([]);
  const [showReceipt, setShowReceipt] = useState(false);
  const [photo, setPhoto] = useState<{ action: 'keep' | 'remove' | 'set'; preview?: string; dataUrl?: string }>({ action: 'keep' });
  const [hadPhoto, setHadPhoto] = useState(false);
  const [recurringNote, setRecurringNote] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (request.kind !== 'edit') return;
    loadTransaction(request.id).then((r) => {
      if (!r) {
        setError('This transaction no longer exists.');
        setLoading(false);
        return;
      }
      const { tx, items: its } = r;
      setId(tx.id);
      setType(tx.type);
      setAmount(groupDigits(tx.type === 'adjust' ? Math.abs(tx.amount) : tx.amount));
      setTitle(tx.title);
      setNote(tx.note);
      setCategoryId(tx.category_id);
      setWalletId(tx.wallet_id);
      if (tx.to_wallet_id) setToWalletId(tx.to_wallet_id);
      setAt(tx.occurred_at);
      setItems(its);
      setHadPhoto(!!tx.has_receipt);
      setShowReceipt(its.length > 0 || !!tx.has_receipt);
      setRecurringNote(!!tx.recurring_id);
      if (tx.type === 'adjust') {
        // Adjustments are edited by entering the new balance again.
        const w = walletById.get(tx.wallet_id);
        setAmount(groupDigits(Math.max(0, w?.balance ?? 0)));
      }
      setLoading(false);
    });
  }, [request, walletById]);

  const kindCats = useMemo(
    () => categories.filter((c) => c.kind === (type === 'income' ? 'income' : 'expense') && (!c.archived || c.id === categoryId)),
    [categories, type, categoryId],
  );
  useEffect(() => {
    if ((type === 'expense' || type === 'income') && !kindCats.some((c) => c.id === categoryId)) setCategoryId(null);
  }, [type, kindCats, categoryId]);

  const total = itemsTotal(items);
  const subtotal = items.filter((i) => i.kind === 'item').reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const wallet = walletById.get(walletId);

  function setItem(i: number, patch: Partial<Item>) {
    setItems((xs) => xs.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  }

  async function onPhoto(f?: File) {
    if (!f) return;
    try {
      const dataUrl = await compressImage(f);
      setPhoto({ action: 'set', dataUrl, preview: dataUrl });
    } catch (e: any) {
      setError(e.message);
    }
  }

  function submit() {
    setError('');
    const amt = digits(amount);
    if (type !== 'adjust' && amt <= 0) return setError('Enter an amount above zero.');
    if ((type === 'expense' || type === 'income') && !categoryId) return setError('Pick a category.');
    const payload: TxPayload = {
      id,
      type,
      amount: amt,
      title,
      note,
      category_id: categoryId,
      wallet_id: walletId,
      to_wallet_id: type === 'transfer' ? toWalletId : null,
      occurred_at: at,
      repeat: isEdit ? 'none' : repeat,
      items: type === 'expense' || type === 'income' ? items : [],
      receipt:
        photo.action === 'set' ? { action: 'set', dataUrl: photo.dataUrl! } : photo.action === 'remove' ? { action: 'remove' } : { action: 'keep' },
    };
    start(async () => {
      const r = await saveTransaction(payload);
      if (!r.ok) return setError(r.error);
      toast(isEdit ? 'Transaction updated' : 'Transaction saved');
      closeSheet();
      router.refresh();
    });
  }

  function remove() {
    if (!id || !confirm('Delete this transaction? This cannot be undone.')) return;
    start(async () => {
      const r = await deleteTransactions([id]);
      if (!r.ok) return setError(r.error);
      toast('Transaction deleted');
      closeSheet();
      router.refresh();
    });
  }

  const titles: Record<TxType, string> = {
    expense: isEdit ? 'Edit expense' : 'New expense',
    income: isEdit ? 'Edit income' : 'New income',
    transfer: isEdit ? 'Edit transfer' : 'Transfer between wallets',
    adjust: 'Adjust balance',
  };

  return (
    <Sheet
      title={loading ? 'Loading…' : titles[type]}
      onClose={closeSheet}
      footer={
        !loading && (
          <>
            {isEdit && (
              <button className="btn btn-danger" onClick={remove} disabled={pending} aria-label="Delete transaction">
                <ITrash />
              </button>
            )}
            <button className="btn btn-primary btn-block" onClick={submit} disabled={pending} style={{ flex: 1 }}>
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Save transaction'}
            </button>
          </>
        )
      }
    >
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="stack">
          <div className="seg full" role="group" aria-label="Type">
            {TYPES.map((t) => (
              <button key={t.v} type="button" aria-pressed={type === t.v} onClick={() => setType(t.v)}>
                {t.label}
              </button>
            ))}
          </div>

          {type === 'adjust' && (
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              Type what {wallet?.name ?? 'this wallet'} really holds now. The difference is recorded as an adjustment, not as spending.
              {wallet && !isEdit && (
                <>
                  {' '}
                  Current balance in the app: <strong className="num">{rp(wallet.balance ?? 0)}</strong>.
                </>
              )}
            </p>
          )}

          <label className="amount-input">
            <span>Rp</span>
            <input
              data-autofocus
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              aria-label={type === 'adjust' ? 'New balance' : 'Amount'}
              value={amount}
              onChange={(e) => setAmount(groupDigits(e.target.value))}
            />
          </label>

          {type !== 'adjust' && (
            <label className="field">
              <span>{type === 'transfer' ? 'Note title (optional)' : 'What was it?'}</span>
              <input
                className="input"
                placeholder={type === 'income' ? 'Gaji Oktober' : type === 'transfer' ? 'Top up GoPay' : 'Parkir, kopi, bensin…'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
              />
            </label>
          )}

          {(type === 'expense' || type === 'income') && (
            <div className="field">
              <span>Category</span>
              <div className="pick-grid">
                {kindCats.map((c) => (
                  <button type="button" key={c.id} className="pick" aria-pressed={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
                    <span className="e" aria-hidden>{c.emoji}</span>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-grid two">
            <label className="field">
              <span>{type === 'transfer' ? 'From wallet' : 'Wallet'}</span>
              <select className="select" value={walletId} onChange={(e) => setWalletId(Number(e.target.value))}>
                {wallets.filter((w) => !w.archived || w.id === walletId).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.emoji} {w.name}
                  </option>
                ))}
              </select>
            </label>
            {type === 'transfer' ? (
              <label className="field">
                <span>To wallet</span>
                <select className="select" value={toWalletId} onChange={(e) => setToWalletId(Number(e.target.value))}>
                  {wallets.filter((w) => (!w.archived || w.id === toWalletId) && w.id !== walletId).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.emoji} {w.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="field">
                <span>Date and time</span>
                <input className="input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
              </label>
            )}
          </div>
          {type === 'transfer' && (
            <label className="field">
              <span>Date and time</span>
              <input className="input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
            </label>
          )}

          {!isEdit && type !== 'adjust' && (
            <label className="field">
              <span>Repeat</span>
              <select className="select" value={repeat} onChange={(e) => setRepeat(e.target.value as TxPayload['repeat'])}>
                <option value="none">Does not repeat</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
                <option value="monthly">Every month</option>
                <option value="yearly">Every year</option>
              </select>
            </label>
          )}
          {recurringNote && (
            <p className="faint" style={{ margin: 0, fontSize: 13 }}>
              This came from a repeating transaction. Changes here affect only this one. Manage repeats in Settings.
            </p>
          )}

          {type !== 'adjust' && (
            <label className="field">
              <span>Note</span>
              <textarea className="textarea" placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
            </label>
          )}

          {(type === 'expense' || type === 'income') && (
            <div className="stack" style={{ gap: 12 }}>
              {!showReceipt ? (
                <button type="button" className="btn" onClick={() => setShowReceipt(true)}>
                  <IReceipt /> Add receipt or item breakdown
                </button>
              ) : (
                <div className="glass" style={{ padding: 16, borderRadius: 22 }}>
                  <div className="card-head" style={{ marginBottom: 10 }}>
                    <div>
                      <h3 className="card-title" style={{ fontSize: 16 }}>Receipt</h3>
                      <p className="card-sub">Photo and line items are both optional.</p>
                    </div>
                  </div>

                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
                  {photo.action === 'set' && photo.preview ? (
                    <ReceiptThumb src={photo.preview} onRemove={() => setPhoto({ action: hadPhoto ? 'remove' : 'keep' })} />
                  ) : hadPhoto && photo.action === 'keep' && id ? (
                    <ReceiptThumb src={`/api/receipt/${id}`} onRemove={() => setPhoto({ action: 'remove' })} />
                  ) : (
                    <button type="button" className="btn" onClick={() => fileRef.current?.click()} style={{ width: '100%' }}>
                      <ICamera /> {photo.action === 'remove' ? 'Photo will be removed. Add another' : 'Add photo'}
                    </button>
                  )}

                  <div className="stack" style={{ gap: 8, marginTop: 14 }}>
                    {items.map((it, i) => (
                      <div key={i} className="item-row">
                        <input className="input item-name" style={{ minHeight: 44, padding: '0 12px', fontSize: 15 }} placeholder={KIND_LABEL[it.kind]}
                          aria-label="Item name" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} />
                        <select className="select" style={{ minHeight: 44, fontSize: 14, paddingLeft: 10, paddingRight: 28, backgroundPosition: 'right 6px center' }}
                          aria-label="Line type" value={it.kind} onChange={(e) => setItem(i, { kind: e.target.value as ItemKind })}>
                          {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                        <input className="input num" style={{ minHeight: 44, padding: '0 12px', fontSize: 15 }} inputMode="numeric" placeholder="0"
                          aria-label="Line amount" value={groupDigits(it.amount)} onChange={(e) => setItem(i, { amount: digits(e.target.value) })} />
                        <button type="button" className="icon-btn" aria-label="Remove line" onClick={() => setItems((xs) => xs.filter((_, k) => k !== i))}>
                          <IX />
                        </button>
                      </div>
                    ))}
                    <div className="chips" style={{ paddingBottom: 0 }}>
                      <button type="button" className="chip" onClick={() => setItems((xs) => [...xs, { name: '', amount: 0, kind: 'item' }])}>
                        <IPlus /> Item
                      </button>
                      <button type="button" className="chip" disabled={!subtotal}
                        onClick={() => setItems((xs) => [...xs, { name: 'PPN 11%', amount: Math.round(subtotal * 0.11), kind: 'tax' }])}>
                        <IPlus /> Tax 11%
                      </button>
                      <button type="button" className="chip" onClick={() => setItems((xs) => [...xs, { name: 'Biaya layanan', amount: 0, kind: 'fee' }])}>
                        <IPlus /> Service fee
                      </button>
                      <button type="button" className="chip" onClick={() => setItems((xs) => [...xs, { name: 'Diskon', amount: 0, kind: 'discount' }])}>
                        <IPlus /> Discount
                      </button>
                    </div>
                    {items.length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
                        <span style={{ fontWeight: 700 }}>
                          Total <span className="num">{rp(total)}</span>
                        </span>
                        {total > 0 && total !== digits(amount) && (
                          <button type="button" className="btn" style={{ minHeight: 38 }} onClick={() => setAmount(groupDigits(total))}>
                            Use as amount
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <div className="error" role="alert">{error}</div>}
        </div>
      )}
    </Sheet>
  );
}

function ReceiptThumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <a href={src} target="_blank" rel="noreferrer" style={{ flex: 'none' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Receipt photo" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 14, border: '1px solid var(--stroke)' }} />
      </a>
      <div style={{ flex: 1, fontSize: 14 }} className="muted">Tap the photo to open it full size.</div>
      <button type="button" className="btn btn-danger" onClick={onRemove}>Remove</button>
    </div>
  );
}
