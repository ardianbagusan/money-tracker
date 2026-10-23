import { requireAuth } from '@/lib/db';
import { getBase, getTransactions } from '@/lib/data';
import { filterFromParams } from '@/lib/filters';

const esc = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: Request) {
  try {
    await requireAuth();
  } catch {
    return new Response('Not signed in', { status: 401 });
  }
  const base = await getBase();
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const f = filterFromParams(params, base.today, base.settings.periodStart);
  const txs = await getTransactions({ ...f, limit: 100000 });
  const cat = new Map(base.categories.map((c) => [c.id, c.name]));
  const wal = new Map(base.wallets.map((w) => [w.id, w.name]));
  const lines = [['Date', 'Time', 'Type', 'Title', 'Category', 'Wallet', 'To wallet', 'Amount (IDR)', 'Note'].join(',')];
  for (const t of txs) {
    const signed = t.type === 'expense' ? -t.amount : t.amount;
    lines.push(
      [t.occurred_at.slice(0, 10), t.occurred_at.slice(11, 16), t.type, t.title, cat.get(t.category_id!) ?? '', wal.get(t.wallet_id) ?? '',
        t.to_wallet_id ? wal.get(t.to_wallet_id) ?? '' : '', signed, t.note].map(esc).join(','),
    );
  }
  // BOM so Excel opens the file as UTF-8 (emoji and Indonesian characters stay intact)
  return new Response('﻿' + lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="transactions-${base.today}.csv"`,
    },
  });
}
