// Reads a bank / e-wallet / shop notification email and guesses the transaction.
// Rules only, no AI. Everything it finds lands as a draft you confirm, so a
// wrong guess costs one tap. Rules are general Indonesian and English phrasings;
// per-sender rules go in SENDER_RULES once real emails show their exact layout.

export type EmailIn = { id: string; from: string; subject: string; date: string; body: string };
export type EmailGuess =
  | { kind: 'skip'; reason: string }
  | { kind: 'unreadable'; source: string }
  | { kind: 'tx'; type: 'expense' | 'income'; amount: number; merchant: string; source: string; hint: string };

// Sender address fragment -> the name shown in the app (also used to match a wallet)
const SOURCES: [RegExp, string][] = [
  [/klikbca|bca\.co\.id|\bbca\b/i, 'BCA'],
  [/bankmandiri|livin|mandiri/i, 'Mandiri'],
  [/bri\.co\.id|\bbri\b|brimo/i, 'BRI'],
  [/bni\.co\.id|\bbni\b/i, 'BNI'],
  [/jago\.com|\bjago\b/i, 'Jago'],
  [/jenius|btpn/i, 'Jenius'],
  [/seabank/i, 'SeaBank'],
  [/cimb|octo/i, 'CIMB'],
  [/permata/i, 'Permata'],
  [/blu\b|bcadigital/i, 'blu'],
  [/gopay|gojek/i, 'GoPay'],
  [/\bovo\b|ovo\.id/i, 'OVO'],
  [/\bdana\.id|@dana\b/i, 'DANA'],
  [/shopeepay|shopee/i, 'Shopee'],
  [/linkaja/i, 'LinkAja'],
  [/grab/i, 'Grab'],
  [/tokopedia/i, 'Tokopedia'],
  [/traveloka/i, 'Traveloka'],
  [/tiket\.com/i, 'tiket.com'],
  [/blibli/i, 'Blibli'],
  [/lazada/i, 'Lazada'],
  [/flip\.id/i, 'Flip'],
];

const SKIP = /\b(otp|kode\s*(verifikasi|otp|keamanan)|verification\s*code|one[-\s]?time\s*pass|kata\s*sandi|reset\s*password|login\s*(baru|terdeteksi)|new\s*(login|sign[-\s]?in|device)|perangkat\s*baru|newsletter|unsubscribe\s*from\s*promo|e-?statement|rekening\s*koran|laporan\s*bulanan|monthly\s*statement|syarat\s*dan\s*ketentuan\s*berubah)\b/i;
const PROMO = /\b(promo|diskon\s*(s\.?d\.?|hingga|up\s*to)|cashback\s*(s\.?d\.?|hingga|up\s*to)|voucher\s*(spesial|khusus)|flash\s*sale|jangan\s*lewatkan|don'?t\s*miss)\b/i;
const INCOME = /\b(dana\s*masuk|uang\s*masuk|transfer\s*masuk|saldo\s*masuk|(telah|sudah|kamu|anda)\s*menerima|you('ve|\s*have)?\s*received|incoming\s*(transfer|payment)|credited\s*to|dikreditkan|refund(ed)?\s*(berhasil|successful|telah)?|pengembalian\s*dana|gaji)\b/i;
const EXPENSE = /\b(pembayaran|payment|purchase|pembelian|transaksi|transfer\s*(keluar|berhasil|ke)|debit|didebet|telah\s*melakukan|berhasil\s*(dibayar|bayar|membayar)|you\s*paid|paid|terima\s*kasih\s*(telah|sudah|atas)|receipt|e-?receipt|struk|invoice|tagihan|order|pesanan|perjalanan|trip|ride|booking|pemesanan|top\s*-?\s*up)\b/i;
const TOPUP = /\btop\s*-?\s*up\b|isi\s*saldo/i;

/** "45.000" "45,000.00" "1.250.000,00" "45000" -> number */
export function moneyNum(raw: string): number {
  const s = raw.trim().replace(/\s/g, '');
  let m = s.match(/^(\d{1,3}(?:[.,]\d{3})+)(?:[.,](\d{1,2}))?$/);
  if (m) return Number(m[1].replace(/[.,]/g, ''));
  m = s.match(/^(\d+)[.,](\d{1,2})$/);
  if (m) return Number(m[1]);
  return Number(s.replace(/[^\d]/g, '')) || 0;
}

const AMT = String.raw`(?:rp\.?|idr)\s*([\d][\d.,\s]{0,16}\d|\d)`;
const LABELLED: [RegExp, number][] = [
  [new RegExp(String.raw`grand\s*total\s*[:\-]?\s*` + AMT, 'gi'), 5],
  [new RegExp(String.raw`total\s*(?:pembayaran|bayar|dibayar|tagihan|paid|payment|belanja|harga|transaksi)\s*[:\-]?\s*` + AMT, 'gi'), 4],
  [new RegExp(String.raw`(?:you\s*paid|dibayar|kamu\s*bayar|anda\s*bayar)\s*[:\-]?\s*` + AMT, 'gi'), 4],
  [new RegExp(String.raw`\btotal\s*[:\-]?\s*` + AMT, 'gi'), 3],
  [new RegExp(String.raw`(?:nominal|jumlah|amount|sebesar|senilai)(?:\s*(?:transaksi|pembayaran|transfer|dana|top\s*-?up))?\s*[:\-]?\s*` + AMT, 'gi'), 2],
];

function findAmount(text: string): { amount: number; sure: boolean } | null {
  let best: { amount: number; score: number } | null = null;
  for (const [re, score] of LABELLED) {
    for (const m of text.matchAll(re)) {
      const n = moneyNum(m[1]);
      if (n >= 100 && (!best || score > best.score)) best = { amount: n, score };
    }
    if (best) break; // highest-priority label that matched wins
  }
  if (best) return { amount: best.amount, sure: true };
  const all = [...text.matchAll(new RegExp(AMT, 'gi'))].map((m) => moneyNum(m[1])).filter((n) => n >= 100);
  const distinct = [...new Set(all)];
  if (distinct.length === 0) return null;
  if (distinct.length === 1) return { amount: distinct[0], sure: true };
  return { amount: Math.max(...distinct), sure: false };
}

function clean(s: string) {
  return s.replace(/\s{2,}/g, ' ').replace(/[*_|<>]+/g, '').replace(/[.,:;\-]+$/, '').trim().slice(0, 60);
}

function findMerchant(text: string): string {
  const labelled = text.match(/(?:^|\n)\s*(?:nama\s*)?(?:merchant|toko|penerima|recipient|tujuan|outlet|restoran|restaurant|store|beneficiary|payee)(?:\s*name)?\s*[:\-]\s*([^\n]{2,60})/i);
  if (labelled) return clean(labelled[1]);
  // Keywords match any case; the name after them must start with a capital or digit.
  const kw = (ws: string[]) => ws.map((w) => `[${w[0].toUpperCase()}${w[0]}]${w.slice(1)}`).join('|');
  const inline = text.match(new RegExp(String.raw`(?:${kw(['pembayaran', 'payment', 'transaksi', 'purchase', 'belanja', 'paid', 'bayar', 'transfer', 'menerima', 'received'])})\b[^\n]{0,30}?\b(?:${kw(['di', 'at', 'ke', 'to', 'kepada', 'dari', 'from'])})[ \t]+([A-Z0-9][\w&'.\-]*(?:[ \t]+[A-Z0-9][\w&'.\-]*){0,4})`));
  if (inline) return clean(inline[1]);
  return '';
}

function knownSource(from: string) {
  return SOURCES.some(([re]) => re.test(from.toLowerCase()));
}

export function sourceOf(from: string): string {
  const addr = from.toLowerCase();
  for (const [re, name] of SOURCES) if (re.test(addr)) return name;
  const m = from.match(/^\s*"?([^"<@]+?)"?\s*</);
  return m ? clean(m[1]) : '';
}

export function parseEmail(e: EmailIn): EmailGuess {
  const text = `${e.subject}\n${e.body}`.slice(0, 8000);
  if (SKIP.test(text)) return { kind: 'skip', reason: 'security or account email' };
  const source = sourceOf(e.from);
  const isIncome = INCOME.test(text);
  const isExpense = EXPENSE.test(text);
  if (PROMO.test(e.subject) && !/\b(berhasil|successful|receipt|struk|e-?receipt|invoice)\b/i.test(text)) return { kind: 'skip', reason: 'promotion' };
  // Emails from unknown senders that don't look like a transaction are ignored and never stored.
  const unreadable = (): EmailGuess => (knownSource(e.from) ? { kind: 'unreadable', source } : { kind: 'skip', reason: 'not a transaction' });
  if (!isIncome && !isExpense) return unreadable();
  const amt = findAmount(text);
  if (!amt) return unreadable();
  const type: 'expense' | 'income' = isIncome && !/\b(pembayaran|payment|purchase|pembelian)\s+(berhasil|successful)/i.test(text) ? 'income' : 'expense';
  const hints: string[] = [];
  if (!amt.sure) hints.push('Several amounts in this email; the largest was used. Check it.');
  if (TOPUP.test(text)) hints.push('Looks like a top-up between your own wallets. If so, dismiss this and record a transfer instead.');
  return { kind: 'tx', type, amount: amt.amount, merchant: findMerchant(text), source, hint: hints.join(' ') };
}
