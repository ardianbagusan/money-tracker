'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet } from './Sheet';
import { useApp } from './AppContext';
import { ITrash } from './icons';
import { deleteMoment, loadFoodData, saveMoment, type EntryPayload } from '@/app/life-actions';
import type { CutoutResult, Pt, TapPoint } from '@/lib/cutout';
import type { FoodItem, FoodKind, FoodMoment } from '@/lib/types';

const KIND_EMOJI: Record<FoodKind, string> = { food: '🍽️', drink: '🥤', other: '🍫' };
const PORTIONS = [0.5, 1, 1.5, 2];
const round1 = (n: number) => Math.round(n * 10) / 10;

type Row = {
  key: string;
  id?: number;
  food_item_id: number | null;
  name: string;
  kind: FoodKind;
  grams: string;
  kcal: string;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  manual: boolean; // calories typed by hand: stop recalculating from grams
  tags: string;
  cutout: { action: 'keep'; preview: string } | { action: 'none' } | { action: 'remove' } | ({ action: 'set'; preview: string } & CutoutResult);
};

let keySeq = 0;
const newKey = () => `r${Date.now()}-${keySeq++}`;
const blankRow = (): Row => ({
  key: newKey(), food_item_id: null, name: '', kind: 'food', grams: '', kcal: '', protein_g: 0, carbs_g: 0, fat_g: 0, manual: false, tags: '', cutout: { action: 'none' },
});

function fromItem(row: Row, it: FoodItem, grams = it.portion_g): Row {
  const k = grams / 100;
  return {
    ...row, food_item_id: it.id, name: it.name, kind: it.kind, grams: String(grams), manual: false,
    kcal: String(Math.round(it.kcal_100g * k)), protein_g: round1(it.protein_100g * k), carbs_g: round1(it.carbs_100g * k), fat_g: round1(it.fat_100g * k),
  };
}

function matchScore(it: FoodItem, q: string) {
  const n = it.name.toLowerCase();
  if (n === q) return 1000 + it.uses;
  if (n.startsWith(q)) return 500 + it.uses;
  if (n.includes(q)) return 300 + it.uses;
  if (it.aliases.toLowerCase().split(',').some((a) => a.trim().startsWith(q))) return 200 + it.uses;
  if (it.aliases.toLowerCase().includes(q)) return 100 + it.uses;
  return -1;
}

/* ---------------- Log or edit a meal ---------------- */
export function MealSheet({ moment, date }: { moment?: FoodMoment; date?: string }) {
  const { now, closeSheet, toast } = useApp();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [data, setData] = useState<{ items: FoodItem[]; places: string[]; people: string[] } | null>(null);
  const [at, setAt] = useState(moment?.occurred_at ?? (date ? `${date}${now.slice(10)}` : now));
  const [place, setPlace] = useState(moment?.place ?? '');
  const [people, setPeople] = useState((moment?.people ?? []).join(', '));
  const [rating, setRating] = useState<number | null>(moment?.rating ?? null);
  const [favorite, setFavorite] = useState(moment?.favorite ?? false);
  const [note, setNote] = useState(moment?.note ?? '');
  const [rows, setRows] = useState<Row[]>(() =>
    moment
      ? moment.entries.map((e) => ({
          key: newKey(), id: e.id, food_item_id: e.food_item_id, name: e.name, kind: e.kind, grams: e.grams ? String(e.grams) : '', kcal: String(e.kcal),
          protein_g: e.protein_g, carbs_g: e.carbs_g, fat_g: e.fat_g, manual: true, tags: e.tags.join(', '),
          cutout: e.cutout ? { action: 'keep', preview: `/api/image/cutout/${e.cutout.id}` } : { action: 'none' },
        }))
      : [],
  );
  const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [cutFor, setCutFor] = useState<string | 'new' | null>(null); // which row the cutout editor fills
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFoodData().then(setData).catch(() => setData({ items: [], places: [], people: [] }));
  }, []);

  async function onPhoto(f?: File) {
    if (!f) return;
    try {
      const { photoCanvas } = await import('@/lib/cutout');
      const c = await photoCanvas(f);
      setPhoto(c);
      setPhotoUrl(c.toDataURL('image/jpeg', 0.8));
      setCutFor('new');
    } catch (e: any) {
      setError(e.message);
    }
  }

  const setRow = (key: string, patch: Partial<Row> | ((r: Row) => Row)) =>
    setRows((rs) => rs.map((r) => (r.key === key ? (typeof patch === 'function' ? patch(r) : { ...r, ...patch }) : r)));

  function setGrams(r: Row, g: string) {
    const it = data?.items.find((i) => i.id === r.food_item_id);
    const grams = Number(g) || 0;
    if (it && !r.manual && grams > 0) setRow(r.key, fromItem(r, it, grams));
    else setRow(r.key, { grams: g.replace(/[^\d]/g, '') });
  }

  function onCutDone(res: CutoutResult) {
    const cut = { action: 'set' as const, preview: res.image, ...res };
    if (cutFor === 'new') {
      const row = { ...blankRow(), cutout: cut };
      setRows((rs) => [...rs, row]);
      setFocusKey(row.key);
    } else if (cutFor) setRow(cutFor, { cutout: cut });
    setCutFor(null);
  }

  const total = rows.reduce((s, r) => s + (Number(r.kcal) || 0), 0);

  function submit() {
    setError('');
    if (!rows.length) return setError('Add at least one item: cut one out of a photo, or add it without a photo.');
    const missing = rows.find((r) => !r.name.trim());
    if (missing) return setError('Every item needs a name.');
    const entries: EntryPayload[] = rows.map((r) => ({
      id: r.id, food_item_id: r.food_item_id, name: r.name, kind: r.kind, grams: Number(r.grams) || null, kcal: Number(r.kcal) || 0,
      protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g, tags: r.tags.split(',').map((t) => t.trim()).filter(Boolean),
      cutout:
        r.cutout.action === 'set'
          ? { action: 'set', image: r.cutout.image, width: r.cutout.width, height: r.cutout.height, method: r.cutout.method, outline: r.cutout.outline }
          : r.cutout.action === 'remove' ? { action: 'remove' } : { action: 'keep' },
    }));
    start(async () => {
      const res = await saveMoment({
        id: moment?.id, occurred_at: at, place, people: people.split(',').map((p) => p.trim()).filter(Boolean), rating, favorite, note, entries,
      });
      if (!res.ok) return setError(res.error || 'Could not save.');
      toast(moment ? 'Meal updated' : 'Meal saved');
      closeSheet();
      router.refresh();
    });
  }

  function remove() {
    if (!moment || !confirm('Delete this meal and its stickers?')) return;
    start(async () => {
      const r = await deleteMoment(moment.id);
      if (!r.ok) return setError(r.error || 'Could not delete.');
      toast('Meal deleted');
      closeSheet();
      router.refresh();
    });
  }

  if (cutFor && photo) {
    return (
      <Sheet title="Cut out a dish" onClose={() => setCutFor(null)}>
        <CutoutEditor photo={photo} onDone={onCutDone} onCancel={() => setCutFor(null)} />
      </Sheet>
    );
  }

  return (
    <Sheet
      title={moment ? 'Edit meal' : 'Log a meal'}
      onClose={closeSheet}
      footer={
        <>
          {moment && <button className="btn btn-danger" onClick={remove} disabled={pending} aria-label="Delete meal"><ITrash /></button>}
          <button className="btn btn-primary btn-block" style={{ flex: 1 }} onClick={submit} disabled={pending}>
            {pending ? 'Saving…' : `Save meal${total ? ` · ${total.toLocaleString('id-ID')} kcal` : ''}`}
          </button>
        </>
      }
    >
      <div className="stack">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
        {photo ? (
          <div className="meal-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="Meal photo" />
            <div className="meal-photo-actions">
              <button type="button" className="btn btn-primary" onClick={() => setCutFor('new')}>✂️ Cut out a dish</button>
              <button type="button" className="btn" onClick={() => fileRef.current?.click()}>📷 Other photo</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn scan-btn" style={{ minHeight: 64 }} onClick={() => fileRef.current?.click()}>
            📷 Take or pick a photo of your meal
          </button>
        )}
        {!photo && <p className="faint" style={{ margin: '-6px 0 0', fontSize: 12.5 }}>The photo stays on your phone. Only the cut-out stickers are saved.</p>}

        {rows.map((r) => (
          <FoodRow key={r.key} row={r} items={data?.items ?? []} autoFocus={focusKey === r.key} hasPhoto={!!photo}
            onChange={(patch) => setRow(r.key, patch)} onGrams={(g) => setGrams(r, g)} onCut={() => setCutFor(r.key)}
            onRemove={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} />
        ))}

        <button type="button" className="btn" onClick={() => { const row = blankRow(); setRows((rs) => [...rs, row]); setFocusKey(row.key); }}>
          ＋ Add an item without a photo
        </button>

        <div className="form-grid two">
          <label className="field"><span>When</span><input className="input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></label>
          <label className="field"><span>Where</span>
            <input className="input" list="food-places" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Home, Warung Bu Sri…" maxLength={80} />
            <datalist id="food-places">{data?.places.map((p) => <option key={p} value={p} />)}</datalist>
          </label>
        </div>
        <label className="field"><span>Who was with you?</span>
          <input className="input" list="food-people" value={people} onChange={(e) => setPeople(e.target.value)} placeholder="Names, separated by commas" />
          <datalist id="food-people">{data?.people.map((p) => <option key={p} value={p} />)}</datalist>
        </label>
        <div className="field">
          <span>How was it?</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" className="star-btn" aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={!!rating && rating >= n}
                onClick={() => setRating(rating === n ? null : n)}>{rating && rating >= n ? '⭐' : '☆'}</button>
            ))}
            <button type="button" className="chip" aria-pressed={favorite} onClick={() => setFavorite(!favorite)} style={{ marginLeft: 8 }}>
              {favorite ? '❤️ Favourite' : '🤍 Favourite'}
            </button>
          </div>
        </div>
        <label className="field"><span>Note</span>
          <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} maxLength={3000} placeholder="Type, or tap the 🎤 on your keyboard to talk" />
        </label>
        {error && <div className="error" role="alert">{error}</div>}
      </div>
    </Sheet>
  );
}

function FoodRow({ row: r, items, autoFocus, hasPhoto, onChange, onGrams, onCut, onRemove }: {
  row: Row; items: FoodItem[]; autoFocus: boolean; hasPhoto: boolean;
  onChange: (p: Partial<Row> | ((r: Row) => Row)) => void; onGrams: (g: string) => void; onCut: () => void; onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);
  const q = r.name.trim().toLowerCase();
  const hits = useMemo(
    () => (q ? items.map((it) => ({ it, s: matchScore(it, q) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s).slice(0, 6).map((x) => x.it) : items.slice(0, 6)),
    [items, q],
  );
  const it = items.find((i) => i.id === r.food_item_id);
  const preview = r.cutout.action === 'keep' || r.cutout.action === 'set' ? r.cutout.preview : '';

  return (
    <div className="food-row">
      <div className="food-row-top">
        <button type="button" className="food-thumb" onClick={hasPhoto ? onCut : undefined} aria-label={hasPhoto ? 'Cut out a sticker for this item' : 'Item'}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt="" /> : <span aria-hidden>{KIND_EMOJI[r.kind]}</span>}
        </button>
        <div style={{ position: 'relative', minWidth: 0, flex: 1 }}>
          <input ref={inputRef} className="input" aria-label="What is it?" placeholder="What is it? e.g. nasi goreng" value={r.name}
            onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
            onChange={(e) => { onChange({ name: e.target.value, food_item_id: null }); setOpen(true); }} maxLength={80} />
          {open && hits.length > 0 && (
            <div className="food-suggest" role="listbox">
              {hits.map((h) => (
                <button type="button" key={h.id} role="option" aria-selected={h.id === r.food_item_id} onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onChange((row) => fromItem(row, h)); setOpen(false); }}>
                  <span aria-hidden>{KIND_EMOJI[h.kind]}</span>
                  <span className="n">{h.name}</span>
                  <span className="k num">{Math.round((h.kcal_100g * h.portion_g) / 100)} kcal</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="icon-btn" aria-label="Remove item" onClick={onRemove}>✕</button>
      </div>
      <div className="chips" style={{ paddingBottom: 0 }}>
        {(['food', 'drink', 'other'] as FoodKind[]).map((k) => (
          <button type="button" key={k} className="chip" aria-pressed={r.kind === k} onClick={() => onChange({ kind: k })}>
            {KIND_EMOJI[k]} {k === 'food' ? 'Food' : k === 'drink' ? 'Drink' : 'Other'}
          </button>
        ))}
      </div>
      {it && (
        <div className="chips" style={{ paddingBottom: 0 }}>
          {PORTIONS.map((p) => {
            const g = Math.round(it.portion_g * p);
            return (
              <button type="button" key={p} className="chip" aria-pressed={Number(r.grams) === g} onClick={() => onChange((row) => fromItem(row, it, g))}>
                {p === 0.5 ? '½' : p === 1.5 ? '1½' : p} portion
              </button>
            );
          })}
        </div>
      )}
      <div className="food-nums">
        <label className="field"><span>{r.kind === 'drink' ? 'ml' : 'grams'}</span>
          <input className="input num" inputMode="numeric" value={r.grams} onChange={(e) => onGrams(e.target.value.replace(/[^\d]/g, ''))} placeholder="0" />
        </label>
        <label className="field"><span>kcal</span>
          <input className="input num" inputMode="numeric" value={r.kcal} placeholder="0"
            onChange={(e) => onChange({ kcal: e.target.value.replace(/[^\d]/g, ''), manual: true })} />
        </label>
        <label className="field"><span>Tags</span>
          <input className="input" value={r.tags} onChange={(e) => onChange({ tags: e.target.value })} placeholder="egg, soup" />
        </label>
      </div>
      <div className="faint" style={{ fontSize: 12.5 }}>
        Protein {r.protein_g} g · carbs {r.carbs_g} g · fat {r.fat_g} g
        {it?.source === 'starter' && ' · starter values, approximate'}
        {(r.cutout.action === 'keep' || r.cutout.action === 'set') && (
          <> · <button type="button" className="link link-btn" style={{ fontSize: 12.5 }} onClick={() => onChange({ cutout: r.id ? { action: 'remove' } : { action: 'none' } })}>remove sticker</button></>
        )}
      </div>
    </div>
  );
}

/* ---------------- Cutout editor ---------------- */
function CutoutEditor({ photo, onDone, onCancel }: { photo: HTMLCanvasElement; onDone: (r: CutoutResult) => void; onCancel: () => void }) {
  const [mode, setMode] = useState<'tap' | 'trace'>('tap');
  const [removing, setRemoving] = useState(false);
  const [model, setModel] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [busy, setBusy] = useState(false);
  const [taps, setTaps] = useState<TapPoint[]>([]);
  const [trace, setTrace] = useState<Pt[]>([]);
  const [mask, setMask] = useState<Float32Array | null>(null);
  const [msg, setMsg] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const overlay = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let alive = true;
    import('@/lib/cutout').then(({ loadSegmenter }) =>
      loadSegmenter().then(
        () => alive && setModel('ready'),
        (e) => {
          console.error(e);
          if (!alive) return;
          setModel('failed');
          setMode('trace');
        },
      ),
    );
    return () => { alive = false; };
  }, []);

  // Redraw photo, selection, taps and the trace in progress
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = photo.width;
    c.height = photo.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(photo, 0, 0);
    if (mask && overlay.current) ctx.drawImage(overlay.current, 0, 0);
    const r = Math.max(6, photo.width / 70);
    for (const t of taps) {
      ctx.beginPath();
      ctx.arc(t.x * c.width, t.y * c.height, r, 0, Math.PI * 2);
      ctx.fillStyle = t.mode === 'add' ? '#199e70' : '#e66767';
      ctx.fill();
      ctx.lineWidth = r / 3;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }
    if (trace.length > 1) {
      ctx.beginPath();
      trace.forEach((p, i) => (i ? ctx.lineTo(p.x * c.width, p.y * c.height) : ctx.moveTo(p.x * c.width, p.y * c.height)));
      if (!drawing.current) ctx.closePath();
      ctx.lineWidth = Math.max(3, photo.width / 200);
      ctx.strokeStyle = '#f5b07a';
      ctx.setLineDash([ctx.lineWidth * 3, ctx.lineWidth * 2]);
      ctx.stroke();
    }
  }, [photo, mask, taps, trace]);

  const norm = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const b = e.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) };
  };

  async function applyMask(m: Float32Array) {
    const { maskOverlay, maskCoverage } = await import('@/lib/cutout');
    const cov = maskCoverage(m);
    overlay.current = maskOverlay(photo, m);
    setMask(cov > 0 ? m : null);
    setMsg(cov === 0 ? 'Nothing selected there. Try tapping the middle of the dish.' : cov > 0.8 ? 'That covers almost the whole photo. Add a ➖ tap on the background, or trace instead.' : '');
  }

  async function runTaps(next: TapPoint[]) {
    setTaps(next);
    if (!next.some((t) => t.mode === 'add')) {
      setMask(null);
      return;
    }
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30)); // let the spinner paint before the heavy step
    try {
      const { maskFromTaps } = await import('@/lib/cutout');
      await applyMask(await maskFromTaps(photo, next));
    } catch (e: any) {
      console.error(e);
      setMsg('Tap-to-cut failed on this phone. Trace the dish with your finger instead.');
      setModel('failed');
      setMode('trace');
    } finally {
      setBusy(false);
    }
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode !== 'trace' || busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    setMask(null);
    setTrace([norm(e)]);
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode !== 'trace' || !drawing.current) return;
    const p = norm(e);
    setTrace((t) => {
      const last = t.at(-1);
      return last && Math.hypot(p.x - last.x, p.y - last.y) < 0.006 ? t : [...t, p];
    });
  }
  async function onUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode === 'tap') {
      if (busy || model !== 'ready') return;
      const p = norm(e);
      runTaps([...taps, { ...p, mode: removing ? 'remove' : 'add' }]);
      return;
    }
    if (!drawing.current) return;
    drawing.current = false;
    if (trace.length < 6) {
      setTrace([]);
      setMsg('Draw all the way around the dish.');
      return;
    }
    const { maskFromLasso } = await import('@/lib/cutout');
    await applyMask(maskFromLasso(photo, trace));
  }

  function undo() {
    if (mode === 'tap') runTaps(taps.slice(0, -1));
    else {
      setTrace([]);
      setMask(null);
    }
  }

  async function finish() {
    if (!mask) return;
    try {
      const { makeSticker } = await import('@/lib/cutout');
      const outline = mode === 'tap' ? taps.map((t) => ({ x: round3(t.x), y: round3(t.y), mode: t.mode })) : trace.filter((_, i) => i % 2 === 0).map((p) => ({ x: round3(p.x), y: round3(p.y) }));
      onDone(makeSticker(photo, mask, mode === 'tap' ? 'tap' : 'lasso', outline));
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  const hint =
    mode === 'trace'
      ? 'Draw around the dish with your finger, then lift.'
      : model === 'loading'
        ? 'Loading the tap-to-cut tool… The first time downloads about 25 MB; after that it is kept.'
        : removing ? 'Tap a part to remove it from the selection.' : 'Tap the middle of a dish. Tap again to add a part it missed.';

  return (
    <div className="stack">
      <div className="seg full" role="group" aria-label="Cut mode">
        <button type="button" aria-pressed={mode === 'tap'} disabled={model === 'failed'} onClick={() => { setMode('tap'); setTrace([]); setMask(null); setTaps([]); }}>👆 Tap to cut</button>
        <button type="button" aria-pressed={mode === 'trace'} onClick={() => { setMode('trace'); setTaps([]); setMask(null); }}>✍️ Trace</button>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        {model === 'failed' && mode === 'trace' && !msg ? 'Tap-to-cut couldn’t load here (offline, blocked or an older phone). Tracing works the same. ' : ''}
        {hint}
      </p>
      <div className="cut-stage">
        <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} style={{ touchAction: 'none' }} aria-label="Meal photo. Tap or draw to select a dish." />
        {(busy || (mode === 'tap' && model === 'loading')) && <div className="cut-busy">✂️ {busy ? 'Cutting…' : 'Loading…'}</div>}
      </div>
      {msg && <div className="imp-hint">{msg}</div>}
      <div className="chips" style={{ paddingBottom: 0 }}>
        {mode === 'tap' && (
          <button type="button" className="chip" aria-pressed={removing} onClick={() => setRemoving(!removing)} disabled={model !== 'ready'}>➖ Remove a part</button>
        )}
        <button type="button" className="chip" onClick={undo} disabled={busy || (mode === 'tap' ? !taps.length : !trace.length)}>↩️ Undo</button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={!mask || busy} onClick={finish}>Use this cutout</button>
      </div>
    </div>
  );
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
