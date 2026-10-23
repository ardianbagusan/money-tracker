'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import { Sheet } from '@/components/Sheet';
import { IRepeat, ISearch, IX } from '@/components/icons';
import { RANGES } from '@/lib/filters';

const TYPES = [
  { v: 'expense', label: 'Expense' },
  { v: 'income', label: 'Income' },
  { v: 'transfer', label: 'Transfer' },
  { v: 'adjust', label: 'Adjustment' },
];

export function HistoryControls({ params }: { params: Record<string, string> }) {
  const router = useRouter();
  const path = usePathname();
  const { categories, wallets } = useApp();
  const [q, setQ] = useState(params.q ?? '');
  const [picker, setPicker] = useState<'cat' | 'wallet' | null>(null);

  function update(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '') next.delete(k);
      else next.set(k, v);
    }
    const s = next.toString();
    router.replace(s ? `${path}?${s}` : path, { scroll: false });
  }

  useEffect(() => {
    if ((params.q ?? '') === q) return;
    const t = setTimeout(() => update({ q }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const range = params.from || params.to ? 'custom' : params.range || 'period';
  const type = params.type ?? '';
  const catIds = (params.cat ?? '').split(',').filter(Boolean).map(Number);
  const walletIds = (params.wallet ?? '').split(',').filter(Boolean).map(Number);
  const anyFilter = Object.keys(params).length > 0;

  return (
    <div className="stack" style={{ gap: 10, marginBottom: 18 }}>
      <div style={{ position: 'relative' }}>
        <ISearch width={20} style={{ position: 'absolute', left: 16, top: 16, color: 'var(--faint)' }} />
        <input className="input" type="search" placeholder="Search title, note, category, wallet or amount" value={q}
          onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 46, borderRadius: 999 }} aria-label="Search transactions" />
      </div>
      <div className="chips" role="group" aria-label="Date range">
        {range === 'custom' && (
          <button className="chip on" onClick={() => update({ from: undefined, to: undefined })}>
            {params.from === params.to ? params.from : `${params.from ?? '…'} to ${params.to ?? '…'}`} <IX />
          </button>
        )}
        {RANGES.map((r) => (
          <button key={r.v} className="chip" aria-pressed={range === r.v} onClick={() => update({ range: r.v === 'period' ? undefined : r.v, from: undefined, to: undefined })}>
            {r.label}
          </button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Filters">
        <button className="chip" aria-pressed={!type} onClick={() => update({ type: undefined })}>All</button>
        {TYPES.map((t) => (
          <button key={t.v} className="chip" aria-pressed={type === t.v} onClick={() => update({ type: type === t.v ? undefined : t.v })}>
            {t.label}
          </button>
        ))}
        <button className="chip" aria-pressed={catIds.length > 0} onClick={() => setPicker('cat')}>
          Categories{catIds.length ? ` (${catIds.length})` : ''}
        </button>
        <button className="chip" aria-pressed={walletIds.length > 0} onClick={() => setPicker('wallet')}>
          Wallets{walletIds.length ? ` (${walletIds.length})` : ''}
        </button>
        <button className="chip" aria-pressed={params.rec === '1'} onClick={() => update({ rec: params.rec === '1' ? undefined : '1' })}>
          <IRepeat /> Repeating
        </button>
        <select className="chip" aria-label="Sort order" value={params.sort ?? 'newest'} onChange={(e) => update({ sort: e.target.value === 'newest' ? undefined : e.target.value })}
          style={{ appearance: 'none', paddingRight: 14 }}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="highest">Highest amount</option>
          <option value="lowest">Lowest amount</option>
        </select>
        {anyFilter && (
          <button className="chip" onClick={() => { setQ(''); router.replace(path, { scroll: false }); }}>
            <IX /> Clear
          </button>
        )}
      </div>

      {picker && (
        <PickSheet
          title={picker === 'cat' ? 'Filter by category' : 'Filter by wallet'}
          options={
            picker === 'cat'
              ? categories.map((c) => ({ id: c.id, label: `${c.emoji} ${c.name}`, group: c.kind === 'income' ? 'Income' : 'Expense' }))
              : wallets.map((w) => ({ id: w.id, label: `${w.emoji} ${w.name}`, group: w.archived ? 'Archived' : 'Wallets' }))
          }
          selected={picker === 'cat' ? catIds : walletIds}
          onClose={() => setPicker(null)}
          onApply={(sel) => {
            update({ [picker]: sel.length ? sel.join(',') : undefined });
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}

function PickSheet({ title, options, selected, onClose, onApply }: {
  title: string; options: { id: number; label: string; group: string }[]; selected: number[]; onClose: () => void; onApply: (ids: number[]) => void;
}) {
  const [sel, setSel] = useState(new Set(selected));
  const groups = [...new Set(options.map((o) => o.group))];
  return (
    <Sheet title={title} onClose={onClose}
      footer={<>
        <button className="btn" onClick={() => onApply([])}>Clear</button>
        <button className="btn btn-primary btn-block" style={{ flex: 1 }} onClick={() => onApply([...sel])}>Show results</button>
      </>}>
      {groups.map((g) => (
        <div key={g} style={{ marginBottom: 14 }}>
          <div className="nav-label" style={{ paddingLeft: 4 }}>{g}</div>
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {options.filter((o) => o.group === g).map((o) => (
              <button key={o.id} className="chip" aria-pressed={sel.has(o.id)}
                onClick={() => setSel((s) => { const n = new Set(s); n.has(o.id) ? n.delete(o.id) : n.add(o.id); return n; })}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </Sheet>
  );
}
