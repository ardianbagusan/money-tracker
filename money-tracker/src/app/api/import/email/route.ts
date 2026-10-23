// Receives bank / e-wallet notification emails from the Google Apps Script that
// runs inside your own Gmail (see Settings → Import from Gmail). Each person has
// their own key, and the key decides whose database the drafts go into.
// Nothing is saved as a transaction here: everything waits in "From email" for you to confirm.
import { timingSafeEqual } from 'crypto';
import { activeUsers, clientFor, ensureSchema, getSecretSetting, getSettings } from '@/lib/db';
import { nowLocal } from '@/lib/dates';
import { parseEmail, type EmailIn } from '@/lib/email-parse';
import { guessCategory } from '@/lib/parse';
import type { Category, Wallet } from '@/lib/types';

export const dynamic = 'force-dynamic';

function keyOk(given: string, real: string) {
  if (!given || !real || given.length !== real.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(real));
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v : '').slice(0, max);

export async function POST(req: Request) {
  const given = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  let userId = 0;
  for (const u of activeUsers()) {
    await ensureSchema(u.id);
    if (keyOk(given, await getSecretSetting('import_key', clientFor(u.id)))) userId = u.id;
  }
  if (!userId) return new Response('Forbidden', { status: 403 });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'Body must be JSON' }, { status: 400 });
  }
  const list: EmailIn[] = (Array.isArray(payload?.messages) ? payload.messages : []).slice(0, 50).map((m: any) => ({
    id: str(m?.id, 200),
    from: str(m?.from, 300),
    subject: str(m?.subject, 300),
    date: str(m?.date, 40),
    body: str(m?.body, 8000),
  }));

  const sql = clientFor(userId);
  const { timezone } = await getSettings(sql);
  const categories = await sql<Category[]>`select * from categories where not archived`;
  const wallets = await sql<Wallet[]>`select * from wallets where not archived order by is_default desc, id`;
  // Where email transactions go when the sender doesn't name a wallet: the one picked in
  // Settings, else your first bank account, else your default wallet.
  const [pref] = await sql`select value from settings where key = 'import_wallet'`;
  const emailWallet = wallets.find((w) => w.id === Number(pref?.value)) ?? wallets.find((w) => w.kind === 'bank') ?? wallets[0] ?? null;
  const res = { ok: true, received: list.length, drafts: 0, unreadable: 0, skipped: 0, duplicates: 0 };

  for (const e of list) {
    if (!e.id) continue;
    const d = new Date(e.date);
    const receivedAt = nowLocal(timezone, Number.isNaN(d.getTime()) ? new Date() : d);
    const snippet = e.body.replace(/\s+/g, ' ').trim().slice(0, 500);
    const g = parseEmail(e);
    if (g.kind === 'skip') {
      res.skipped++;
      continue;
    }
    let row;
    if (g.kind === 'unreadable') {
      row = await sql`insert into email_imports (message_id, sender, subject, snippet, received_at, source_name, status)
        values (${e.id}, ${e.from}, ${e.subject}, ${snippet}, ${receivedAt}::text::timestamp, ${g.source}, 'unreadable')
        on conflict (message_id) do nothing returning id`;
      if (row.length) res.unreadable++;
    } else {
      const src = g.source.toLowerCase();
      const wallet = (src && wallets.find((w) => w.name.toLowerCase().includes(src) || src.includes(w.name.toLowerCase()))) || emailWallet;
      // The merchant name says most; the subject and sender only if the merchant gives nothing.
      const cat = ((g.merchant && guessCategory(g.merchant, categories, g.type)) || guessCategory(`${e.subject} ${g.source}`, categories, g.type))
        ?? categories.find((c) => c.kind === g.type && /^other/i.test(c.name)) ?? null;
      const title = g.merchant || e.subject.replace(/^(fwd?|re):\s*/i, '').slice(0, 60);
      row = await sql`insert into email_imports (message_id, sender, subject, snippet, received_at, type, amount, title, category_id, wallet_id, source_name, hint)
        values (${e.id}, ${e.from}, ${e.subject}, ${snippet}, ${receivedAt}::text::timestamp, ${g.type}, ${g.amount}, ${title},
          ${cat?.id ?? null}, ${wallet?.id ?? null}, ${g.source}, ${g.hint})
        on conflict (message_id) do nothing returning id`;
      if (row.length) res.drafts++;
    }
    if (!row.length) res.duplicates++;
  }
  return Response.json(res);
}
