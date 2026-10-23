// Stock journal arithmetic. Plain functions so they can be checked against a spreadsheet.
// Money is in rupiah; a "lot" is `lot` shares (IDX: 100).
import type { Trade } from './types';

export const SETUPS = ['Breakout', 'Pullback', 'Reversal', 'Trend follow', 'Bandarmologi', 'News', 'Dividend'];
export const TIMEFRAMES = ['Scalp', 'Intraday', 'Swing', 'Position'];
export const TECH_TAGS = ['MA20', 'MA50', 'MA200', 'Stoch RSI', 'RSI', 'MACD', 'Fibonacci', 'Volume spike', 'Volume profile', 'Support', 'Resistance', 'Gap'];
export const CONTEXT_TAGS = ['Broker flow / bandarmologi', 'Earnings', 'Macro', 'News', 'Sector rotation', 'Foreign flow', 'Dividend'];
export const EMOTIONS = ['Disciplined', 'Confident', 'Hesitant', 'FOMO', 'Revenge', 'Greedy', 'Fearful', 'Bored'];

export type TradeCalc = {
  sharesBought: number;
  sharesSold: number;
  openShares: number;
  avgBuy: number; // average buy price per share
  avgSell: number;
  fees: number;
  pnl: number; // realised, after fees (average-cost method for partial sells)
  risk: number | null; // planned risk at entry, Rp: (avg buy − stop) × shares bought
  r: number | null; // pnl / risk
  rr: number | null; // planned reward : risk from avg buy, stop and target
  firstBuy: string | null;
  lastSell: string | null;
};

export function calcTrade(t: Pick<Trade, 'fills' | 'stop' | 'target'>, lot: number): TradeCalc {
  let sb = 0, ss = 0, cost = 0, proceeds = 0, buyFees = 0, sellFees = 0;
  let firstBuy: string | null = null, lastSell: string | null = null;
  for (const f of t.fills) {
    const sh = f.lots * lot;
    if (f.side === 'buy') {
      sb += sh; cost += f.price * sh; buyFees += f.fee;
      if (!firstBuy || f.filled_at < firstBuy) firstBuy = f.filled_at;
    } else {
      ss += sh; proceeds += f.price * sh; sellFees += f.fee;
      if (!lastSell || f.filled_at > lastSell) lastSell = f.filled_at;
    }
  }
  const avgBuy = sb ? cost / sb : 0;
  const avgSell = ss ? proceeds / ss : 0;
  const sold = Math.min(ss, sb);
  // Realised P&L on the shares sold so far; buy fees counted in proportion to shares sold.
  const pnl = sold ? proceeds - avgBuy * ss - sellFees - (sb ? buyFees * (sold / sb) : 0) : 0;
  const risk = t.stop && avgBuy > t.stop && sb ? (avgBuy - t.stop) * sb : null;
  const rr = t.stop && t.target && avgBuy > t.stop && t.target > avgBuy ? (t.target - avgBuy) / (avgBuy - t.stop) : null;
  return {
    sharesBought: sb, sharesSold: ss, openShares: sb - ss, avgBuy, avgSell, fees: buyFees + sellFees,
    pnl: Math.round(pnl), risk: risk ? Math.round(risk) : null, r: risk ? pnl / risk : null, rr, firstBuy, lastSell,
  };
}

export type Summary = {
  n: number; wins: number; losses: number; winRate: number | null;
  grossProfit: number; grossLoss: number; profitFactor: number | null;
  avgWin: number | null; avgLoss: number | null; winLossRatio: number | null; expectancy: number | null;
  totalPnl: number; avgR: number | null;
  equity: { at: string; eq: number; ticker: string; pnl: number }[];
  maxDrawdown: number; maxDrawdownPct: number | null;
};

/** Win rate, profit factor, expectancy, equity curve and max drawdown over closed trades. */
export function summarize(closed: { trade: Trade; calc: TradeCalc }[], capital: number): Summary {
  const sorted = [...closed].sort((a, b) => ((a.trade.closed_at ?? '') < (b.trade.closed_at ?? '') ? -1 : 1));
  const pnls = sorted.map((x) => x.calc.pnl);
  const wins = pnls.filter((p) => p > 0), losses = pnls.filter((p) => p < 0);
  const gp = wins.reduce((a, b) => a + b, 0), gl = Math.abs(losses.reduce((a, b) => a + b, 0));
  const n = pnls.length;
  const winRate = n ? wins.length / n : null;
  const avgWin = wins.length ? gp / wins.length : null, avgLoss = losses.length ? gl / losses.length : null;
  const rs = sorted.map((x) => x.calc.r).filter((r): r is number => r !== null);

  let eq = capital, peak = capital, mdd = 0, mddPct: number | null = null;
  const equity = [{ at: sorted[0]?.trade.opened_at ?? '', eq: capital, ticker: 'Start', pnl: 0 }];
  for (const x of sorted) {
    eq += x.calc.pnl;
    equity.push({ at: x.trade.closed_at ?? '', eq, ticker: x.trade.ticker, pnl: x.calc.pnl });
    if (eq > peak) peak = eq;
    const dd = peak - eq;
    if (dd > mdd) {
      mdd = dd;
      mddPct = peak > 0 ? dd / peak : null;
    }
  }
  return {
    n, wins: wins.length, losses: losses.length, winRate,
    grossProfit: gp, grossLoss: gl, profitFactor: gl ? gp / gl : null,
    avgWin, avgLoss, winLossRatio: avgWin !== null && avgLoss ? avgWin / avgLoss : null,
    expectancy: winRate !== null ? winRate * (avgWin ?? 0) - (1 - winRate) * (avgLoss ?? 0) : null,
    totalPnl: gp - gl, avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    equity: sorted.length ? equity : [], maxDrawdown: mdd, maxDrawdownPct: mddPct,
  };
}

/** Results grouped by setup, emotion or tag: count, win rate and P&L per group. */
export function groupBy(closed: { trade: Trade; calc: TradeCalc }[], keyOf: (t: Trade) => string[]) {
  const m = new Map<string, { n: number; wins: number; pnl: number }>();
  for (const x of closed) for (const k of keyOf(x.trade)) {
    if (!k) continue;
    const g = m.get(k) ?? { n: 0, wins: 0, pnl: 0 };
    g.n++;
    if (x.calc.pnl > 0) g.wins++;
    g.pnl += x.calc.pnl;
    m.set(k, g);
  }
  return [...m.entries()].map(([k, g]) => ({ key: k, ...g, winRate: g.wins / g.n })).sort((a, b) => b.pnl - a.pnl);
}
