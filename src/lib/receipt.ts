// Turns the raw text read from a receipt photo into line items, tax, fees,
// discounts and a total. Rules only, no AI. Written for Indonesian receipts
// ("25.000", "PPN", "Service", "Diskon", "Grand Total") but works on most.
import type { Item } from './types';

export type ReceiptResult = {
  merchant: string;
  date: string | null; // "YYYY-MM-DDTHH:mm" when found
  items: Item[];
  total: number | null;
  linesSum: number; // items + tax + fees − discounts
  matches: boolean; // linesSum equals total
};

const RX = {
  subtotal: /\b(sub\s*-?\s*total|subtotal|sub\s*ttl|jumlah\s*item)\b/i,
  total: /\b(grand\s*total|total\s*(bayar|belanja|tagihan|harga|amount|due|payment|pembayaran)?|jumlah\s*(bayar|total)?|tagihan|amount\s*due|ttl)\b/i,
  tax: /\b(ppn|pb\s*1|pbjt|pajak|tax|vat|pph)\b/i,
  fee: /\b(service|servis|svc|srv|layanan|charge|biaya|ongkir|ongkos|packaging|kemasan|admin)\b/i,
  discount: /\b(disc|diskon|discount|potongan|promo|voucher|hemat|cashback|member\s*disc)\b|^\s*-/i,
  // Lines that show how it was paid, or shop info. Never items.
  skip: /\b(tunai|cash|kembali|kembalian|change|bayar|dibayar|payment|paid|debit|kredit|credit|card|kartu|edc|qris|ovo|gopay|go-pay|dana|shopee\s*pay|linkaja|e-?wallet|npwp|telp|tel\.|phone|hp\.?|kasir|cashier|struk|receipt|invoice|no\.?\s*(trx|transaksi|nota|order|meja|table)|order\s*#|table|meja|pax|guest|tamu|terima\s*kasih|thank|www\.|\.com|instagram|wifi|password|alamat|jl\.|jalan|refund|poin|point|saldo|balance|approval|appr|trace|batch|ref\s*no|merchant\s*id|mid|tid|item\s*\d|qty\s*total|total\s*qty|total\s*item|jumlah\s*barang)\b/i,
};

// OCR often reads digits as letters inside numbers.
function fixDigits(s: string) {
  return s.replace(/(?<=[\d.,])[oO](?=[\d.,]|$)|(?<=^|\s)[oO](?=[\d.,]\d)/g, '0')
    .replace(/(?<=\d[.,]?)[lI|](?=[\d.,])/g, '1')
    .replace(/(?<=\d[.,]?)[sS](?=\d)/g, '5');
}

/** The money amount at the end of a line, or null. "2 x 12.500   25.000" -> 25000 */
export function trailingAmount(line: string): { amount: number; negative: boolean; rest: string } | null {
  const l = fixDigits(line.trim());
  const m = l.match(/(\(|-|−)?\s*(?:rp\.?\s*|idr\s*)?(\d{1,3}(?:[.,]\s?\d{3})+|\d{3,})(?:[.,]\d{2})?\s*(\))?\s*(-)?\s*$/i);
  if (!m) return null;
  const digits = m[2].replace(/[.,\s]/g, '');
  const amount = Number(digits);
  if (!Number.isFinite(amount) || amount < 100 || amount > 1_000_000_000) return null;
  // A bare 4-digit number at the end is often a year or a code, unless it has Rp in front
  if (/^\d{4}$/.test(m[2]) && !/rp|idr/i.test(m[0]) && /^(19|20)\d\d$/.test(m[2])) return null;
  const negative = !!(m[1] || m[4] || (m[1] === '(' && m[3]));
  const rest = l.slice(0, m.index).replace(/\s+(\d+\s*[xX@*]\s*)?(rp\.?\s*)?[\d.,]*\s*$/i, '').trim();
  return { amount, negative, rest };
}

function cleanName(s: string) {
  return s
    .replace(/^\s*\d+\s*[xX*]?\s+(?=\D)/, '') // leading qty "2 x " or "2 "
    .replace(/\s+\d+\s*[xX@*]\s*$/, '')
    .replace(/[|_~=:;*#]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 60);
}

function findDate(text: string): string | null {
  const t = text.replace(/\s+/g, ' ');
  const time = t.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)(?::[0-5]\d)?\b/);
  const hm = time ? `${time[1].padStart(2, '0')}:${time[2]}` : '12:00';
  // dd/mm/yyyy, dd-mm-yy, yyyy-mm-dd
  let m = t.match(/\b(20\d\d)[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/);
  if (m) return build(+m[1], +m[2], +m[3], hm);
  m = t.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d\d|\d\d)\b/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return build(y, +m[2], +m[1], hm);
  }
  // 14 Okt 2026 / 14 Oct 26
  const MON: Record<string, number> = { jan: 1, feb: 2, peb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, nop: 11, des: 12, dec: 12 };
  m = t.match(/\b(\d{1,2})\s*[- ]?\s*(jan|feb|peb|mar|apr|mei|may|jun|jul|agu|agt|aug|sep|okt|oct|nov|nop|des|dec)[a-z]*\.?\s*[- ]?\s*(20\d\d|\d\d)\b/i);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return build(y, MON[m[2].toLowerCase()], +m[1], hm);
  }
  return null;
  function build(y: number, mo: number, d: number, hhmm: string) {
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2015 || y > 2100) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T${hhmm}`;
  }
}

function findMerchant(lines: string[]) {
  for (const l of lines.slice(0, 6)) {
    const s = l.replace(/[^A-Za-z0-9&'.\- ]/g, ' ').replace(/\s{2,}/g, ' ').trim();
    const letters = (s.match(/[A-Za-z]/g) || []).length;
    if (letters < 3 || letters / Math.max(1, s.length) < 0.5) continue;
    if (RX.skip.test(s) || /\d{2}[\/\-.]\d{2}/.test(s)) continue;
    return s.slice(0, 60);
  }
  return '';
}

export function parseReceipt(text: string): ReceiptResult {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const items: Item[] = [];
  let total: number | null = null;
  let subtotal: number | null = null;
  let afterTotal = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let amt = trailingAmount(line);
    // Some receipts put the price on the next line under the item name
    if (!amt && /[A-Za-z]{3}/.test(line) && i + 1 < lines.length && /^[\s\d.,xX@*()rRpP\-]+$/.test(lines[i + 1])) {
      const next = trailingAmount(lines[i + 1]);
      if (next) {
        amt = { ...next, rest: line };
        i++;
      }
    }
    if (!amt) continue;
    const label = amt.rest || line;

    if (RX.subtotal.test(label)) {
      subtotal = amt.amount;
      continue;
    }
    if (RX.total.test(label) && !RX.tax.test(label) && !RX.skip.test(label.replace(RX.total, ''))) {
      // The biggest "total" wins (grand total comes after subtotal and tax)
      total = total === null ? amt.amount : Math.max(total, amt.amount);
      afterTotal = true;
      continue;
    }
    if (afterTotal) continue; // payment and change lines come after the total
    if (RX.skip.test(label)) continue;

    if (RX.discount.test(label) || amt.negative) {
      items.push({ name: cleanName(label) || 'Diskon', amount: amt.amount, kind: 'discount' });
    } else if (RX.tax.test(label)) {
      items.push({ name: cleanName(label) || 'Pajak', amount: amt.amount, kind: 'tax' });
    } else if (RX.fee.test(label)) {
      items.push({ name: cleanName(label) || 'Biaya layanan', amount: amt.amount, kind: 'fee' });
    } else {
      const name = cleanName(label);
      if (!/[A-Za-z]{2}/.test(name)) continue; // a number with no name is usually noise
      items.push({ name, amount: amt.amount, kind: 'item' });
    }
  }

  // If no total line was found, the subtotal plus extras is the best guess.
  const linesSum = items.reduce((s, it) => s + (it.kind === 'discount' ? -1 : 1) * it.amount, 0);
  if (total === null && subtotal !== null) {
    const extras = items.filter((i) => i.kind !== 'item').reduce((s, it) => s + (it.kind === 'discount' ? -1 : 1) * it.amount, 0);
    total = subtotal + extras;
  }
  return {
    merchant: findMerchant(lines),
    date: findDate(text),
    items,
    total,
    linesSum,
    matches: total !== null && linesSum === total,
  };
}
