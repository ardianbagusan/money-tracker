import { SectionTabs } from '@/components/AppShell';
import { getBase, getTransactions } from '@/lib/data';
import { filterFromParams } from '@/lib/filters';
import { TxList } from '@/components/TxList';
import { HistoryControls } from './HistoryControls';
import { Money } from '@/components/Money';
import { shortDate } from '@/lib/dates';

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const base = await getBase();
  const f = filterFromParams(params, base.today, base.settings.periodStart);
  const txs = await getTransactions(f);
  const out = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const inc = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const year = Number(base.today.slice(0, 4));
  const rangeText = f.from
    ? `${shortDate(f.from, year)} to ${shortDate(f.to ? new Date(Date.parse(f.to) - 86400000).toISOString().slice(0, 10) : base.today, year)}`
    : 'All time';
  const exportQs = new URLSearchParams(params).toString();

  return (
    <>
      <SectionTabs section="money" />
      <div className="page-head">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-sub">
            {rangeText}. {txs.length} {txs.length === 1 ? 'transaction' : 'transactions'}, <Money value={out} /> out, <Money value={inc} /> in.
          </p>
        </div>
        <div className="head-actions">
          <a className="btn" href={`/api/export${exportQs ? `?${exportQs}` : ''}`} download>
            Export CSV
          </a>
        </div>
      </div>
      <HistoryControls params={params} />
      <TxList txs={txs} today={base.today} selectable emptyText="Nothing matches these filters. Try a wider date range or clear the search." />
    </>
  );
}
