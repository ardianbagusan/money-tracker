// Quick-text entry without AI: "parkir 40 rb, bensin 50k" -> two drafts.
// Rules: find the amount, use the leftover words as the title, match words
// against each category's keyword list and wallet names.
import { amountFromMatch } from './format';
import type { Category, Draft, Wallet } from './types';

const AMOUNT_RE = /(?:rp\.?\s*)?(\d+(?:[.,]\d+)*)\s*(rb|ribu|rbu|k|jt|juta|mio|miliar|milyar|m|b)?\b/i;
const INCOME_WORDS = ['gaji', 'salary', 'terima', 'diterima', 'dapat', 'masuk', 'income', 'pemasukan', 'dibayar', 'refund', 'cashback'];
const FILLER = new Set(['buat', 'untuk', 'utk', 'bayar', 'beli', 'di', 'ke', 'dari', 'pakai', 'pake', 'via', 'rp', 'the', 'for', 'at', 'pay', 'paid']);

function splitSegments(text: string) {
  return text
    .split(/\n|;|,(?!\d)|\s+(?:dan|and|terus|lalu|\+)\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function words(s: string) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
}

function keywordHit(text: string, keywords: string) {
  const lower = ` ${text.toLowerCase()} `;
  let best = 0;
  for (const raw of keywords.split(',')) {
    const k = raw.trim().toLowerCase();
    if (!k) continue;
    // Whole word (or phrase) match scores higher than a partial match.
    if (lower.includes(` ${k} `)) best = Math.max(best, 10 + k.length);
    else if (k.length >= 4 && lower.includes(k)) best = Math.max(best, k.length);
  }
  return best;
}

/** Best category for some text by keywords, or null. Used by receipt scans and email imports. */
export function guessCategory(text: string, categories: Category[], kind: 'expense' | 'income'): Category | null {
  const ws = words(text).join(' ');
  let best: Category | null = null;
  let bestScore = 0;
  for (const c of categories) {
    if (c.archived || c.kind !== kind) continue;
    const s = keywordHit(ws, c.keywords) + (keywordHit(ws, c.name) ? 5 : 0);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return best;
}

export function parseQuickText(text: string, categories: Category[], wallets: Wallet[]): Draft[] {
  const active = categories.filter((c) => !c.archived);
  const activeWallets = wallets.filter((w) => !w.archived);
  const fallbackWallet = activeWallets.find((w) => w.is_default) ?? activeWallets[0];
  const drafts: Draft[] = [];

  splitSegments(text).forEach((seg, i) => {
    const m = seg.match(AMOUNT_RE);
    if (!m) return;
    const amount = amountFromMatch(m[1], m[2]?.toLowerCase());
    if (!amount) return;
    const rest = (seg.slice(0, m.index) + ' ' + seg.slice((m.index ?? 0) + m[0].length)).trim();

    // Wallet: a wallet name mentioned in the text ("bensin 50k pakai gopay")
    let wallet = fallbackWallet;
    let restNoWallet = rest;
    for (const w of activeWallets) {
      const re = new RegExp(`\\b${w.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(rest)) {
        wallet = w;
        restNoWallet = rest.replace(re, ' ');
        break;
      }
    }

    const ws = words(restNoWallet);
    const isIncomeWord = ws.some((w) => INCOME_WORDS.includes(w));

    // Category: best keyword match across both kinds; the match decides the type.
    let bestCat: Category | null = null;
    let bestScore = 0;
    for (const c of active) {
      const s = keywordHit(ws.join(' '), c.keywords) + (keywordHit(ws.join(' '), c.name) ? 5 : 0);
      if (s > bestScore) {
        bestScore = s;
        bestCat = c;
      }
    }
    let type: 'expense' | 'income' = bestCat?.kind ?? (isIncomeWord ? 'income' : 'expense');
    if (isIncomeWord && bestCat?.kind !== 'expense') type = 'income';
    if (!bestCat || bestCat.kind !== type) {
      bestCat = active.find((c) => c.kind === type && /^other/i.test(c.name)) ?? active.find((c) => c.kind === type) ?? null;
    }

    const titleWords = restNoWallet.split(/\s+/).filter((w) => w && !FILLER.has(w.toLowerCase()));
    const title = titleWords.join(' ').trim();
    drafts.push({
      key: `${Date.now()}-${i}`,
      type,
      amount,
      title: title ? title[0].toUpperCase() + title.slice(1) : bestCat?.name ?? '',
      category_id: bestCat?.id ?? null,
      wallet_id: wallet?.id ?? null,
    });
  });
  return drafts;
}
