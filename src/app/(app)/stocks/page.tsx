import { SectionTabs } from '@/components/AppShell';
import { OpenSheet } from '@/components/LifeBits';
import { Money } from '@/components/Money';
import { getTrades } from '@/lib/data';
import { getLifeSettings } from '@/lib/db';
import { calcTrade, groupBy, summarize } from '@/lib/stocks';
import { shortDate } from '@/lib/dates';
import { rp } from '@/lib/format';
import { EquityCurve, StockSettings } from './StockClient';

const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`);
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${rp(Math.abs(n))}`;

export default async function StocksPage() {
  const [trades, s] = await Promise.all([getTrades(), getLifeSettings()]);
  const rows = trades.map((t) => ({ trade: t, calc: calcTrade(t, s.lot) }));
  const open = rows.filter((r) => r.trade.status === 'open');
  const closed = rows.filter((r) => r.trade.status === 'closed');
  const sum = summarize(closed, s.stockCapital);
  const bySetup = groupBy(closed, (t) => [t.setup || 'No setup']);
  const byEmotion = groupBy(closed, (t) => [t.emotion_entry || 'Not noted']);
  const plan = groupBy(closed, (t) => [t.followed_plan === true ? 'Followed plan' : t.followed_plan === false ? 'Broke plan' : '']);

  return (
    <>
      <SectionTabs section="money" />
      <div className="page-head">
        <div>
          <h1 className="page-title">Stock journal</h1>
          <p className="page-sub">{closed.length} closed, {open.length} open. Prices you type from your broker; nothing is fetched from the market.</p>
        </div>
        <div className="head-actions"><OpenSheet req={{ kind: 'trade' }} className="btn btn-primary">📈 New trade</OpenSheet></div>
      </div>

      <section className="glass card">
        <div className="card-head"><div><h2 className="card-title">Performance</h2><p className="card-sub">Closed trades, after fees</p></div></div>
        {closed.length === 0 ? (
          <div className="empty"><strong>No closed trades yet</strong>Log a buy, then add the sell when you exit. Win rate, profit factor and drawdown appear here.</div>
        ) : (
          <>
            <div className="stock-stats">
              <div className="stat"><div className="stat-label">Total P&amp;L</div><div className={`stat-value num ${sum.totalPnl >= 0 ? 'pos' : 'warn'}`}>{signed(sum.totalPnl)}</div></div>
              <div className="stat"><div className="stat-label">Win rate</div><div className="stat-value num">{pct(sum.winRate)}</div><div className="stat-foot">{sum.wins} won, {sum.losses} lost</div></div>
              <div className="stat"><div className="stat-label">Profit factor</div><div className="stat-value num">{sum.profitFactor === null ? (sum.grossProfit > 0 ? 'no losses' : '–') : sum.profitFactor.toFixed(2)}</div></div>
              <div className="stat"><div className="stat-label">Avg win : loss</div><div className="stat-value num">{sum.winLossRatio === null ? '–' : `${sum.winLossRatio.toFixed(2)} : 1`}</div></div>
              <div className="stat"><div className="stat-label">Expectancy / trade</div><div className="stat-value num">{sum.expectancy === null ? '–' : signed(Math.round(sum.expectancy))}</div></div>
              <div className="stat"><div className="stat-label">Max drawdown</div><div className="stat-value num">{sum.maxDrawdown ? `−${rp(Math.round(sum.maxDrawdown))}` : 'Rp 0'}</div><div className="stat-foot">{sum.maxDrawdownPct !== null && sum.maxDrawdown ? `${(sum.maxDrawdownPct * 100).toFixed(1)}% from peak` : s.stockCapital ? '' : 'Set starting capital for %'}</div></div>
            </div>
            <h3 className="card-sub" style={{ margin: '16px 0 6px' }}>Equity curve</h3>
            <EquityCurve points={sum.equity} capital={s.stockCapital} />
            {sum.avgR !== null && <p className="faint" style={{ fontSize: 12.5, margin: '8px 0 0' }}>Average result {sum.avgR.toFixed(2)} R (trades with a stop loss set).</p>}
          </>
        )}
      </section>

      {closed.length > 0 && (
        <div className="grid-2" style={{ marginTop: 16 }}>
          {[{ title: 'By setup', g: bySetup }, { title: 'By emotion at entry', g: byEmotion }, { title: 'Plan discipline', g: plan }].map(({ title, g }) => g.length > 0 && (
            <section key={title} className="glass card">
              <h2 className="card-title" style={{ marginBottom: 10 }}>{title}</h2>
              <table className="mini-table">
                <thead><tr><th scope="col">Group</th><th scope="col">Trades</th><th scope="col">Win rate</th><th scope="col">P&amp;L</th></tr></thead>
                <tbody>{g.map((r) => (
                  <tr key={r.key}><td>{r.key}</td><td className="num">{r.n}</td><td className="num">{pct(r.winRate)}</td><td className={`num ${r.pnl >= 0 ? 'pos' : 'warn'}`}>{signed(r.pnl)}</td></tr>
                ))}</tbody>
              </table>
            </section>
          ))}
        </div>
      )}

      <section className="glass card" style={{ marginTop: 16 }}>
        <h2 className="card-title" style={{ marginBottom: 10 }}>Open positions</h2>
        {open.length === 0 ? <p className="muted" style={{ margin: 0 }}>None.</p> : (
          <div className="rows">
            {open.map(({ trade: t, calc: c }) => (
              <div key={t.id} className="row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto' }}>
                <OpenSheet req={{ kind: 'trade', tradeId: t.id }} className="row-btn">
                  <span className="row-title" style={{ display: 'block' }}>{t.ticker} <span className="faint" style={{ fontWeight: 600, fontSize: 13 }}>{t.setup}</span></span>
                  <span className="row-meta">
                    <span>{c.openShares / s.lot} lots @ {rp(Math.round(c.avgBuy))}</span>
                    {t.stop && <span>stop {rp(t.stop)}</span>}
                    {t.target && <span>target {rp(t.target)}</span>}
                    <span>since {shortDate(t.opened_at)}</span>
                  </span>
                </OpenSheet>
                <span className="row-amt num"><Money value={Math.round(c.avgBuy * c.openShares)} short /></span>
                <OpenSheet req={{ kind: 'trade', tradeId: t.id, close: true }} className="btn" label={`Close ${t.ticker}`}>Close</OpenSheet>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass card" style={{ marginTop: 16 }}>
        <h2 className="card-title" style={{ marginBottom: 10 }}>Closed trades</h2>
        {closed.length === 0 ? <p className="muted" style={{ margin: 0 }}>None yet.</p> : (
          <div className="rows">
            {closed.map(({ trade: t, calc: c }) => (
              <OpenSheet key={t.id} req={{ kind: 'trade', tradeId: t.id }} className="row" >
                <span style={{ minWidth: 0, textAlign: 'left' }}>
                  <span className="row-title" style={{ display: 'block' }}>{t.ticker} <span className="faint" style={{ fontWeight: 600, fontSize: 13 }}>{t.setup}</span></span>
                  <span className="row-meta">
                    <span>{shortDate(t.opened_at)} to {shortDate(t.closed_at!)}</span>
                    {t.emotion_entry && <span>{t.emotion_entry}</span>}
                    {t.followed_plan === false && <span className="warn">broke plan</span>}
                  </span>
                </span>
                <span className="row-amt num" style={{ textAlign: 'right' }}>
                  <span className={c.pnl >= 0 ? 'pos' : 'warn'}>{signed(c.pnl)}</span>
                  {c.r !== null && <span className="faint" style={{ display: 'block', fontSize: 12.5 }}>{c.r.toFixed(2)} R</span>}
                </span>
              </OpenSheet>
            ))}
          </div>
        )}
      </section>

      <StockSettings capital={s.stockCapital} feeBuy={s.feeBuy} feeSell={s.feeSell} lot={s.lot} />
    </>
  );
}
