'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import { Sheet } from '@/components/Sheet';
import { PushSetup } from '@/components/PushSetup';
import { IPlus } from '@/components/icons';
import { archiveTag, saveTag } from '@/app/life-actions';
import type { JournalTag } from '@/lib/types';
import Link from 'next/link';
import { newImportKey, saveSetting } from '@/app/actions';

export function LifeSettings({ tags, cronUrl, devices }: { tags: JournalTag[]; cronUrl: string; devices: number }) {
  const { toast } = useApp();
  const [editing, setEditing] = useState<JournalTag | 'new' | null>(null);
  const [show, setShow] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(cronUrl);
      toast('Link copied');
    } catch {
      setShow(true);
    }
  }

  return (
    <div className="grid-2" style={{ marginTop: 16 }}>
      <section className="glass card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Journal activities</h2>
            <p className="card-sub">The tags you pick in journal entries. Mood insights compare days with and without each one.</p>
          </div>
          <button className="btn" onClick={() => setEditing('new')}><IPlus /> Add</button>
        </div>
        <div className="chips" style={{ flexWrap: 'wrap' }}>
          {tags.map((t) => (
            <button key={t.id} className="chip" style={{ opacity: t.archived ? 0.5 : 1 }} onClick={() => setEditing(t)}>
              <span aria-hidden>{t.emoji}</span> {t.name}{t.archived ? ' (hidden)' : ''}
            </button>
          ))}
        </div>
      </section>

      <div className="stack">
        <PushSetup />
        <section className="glass card">
          <h2 className="card-title">Reminder sender</h2>
          <p className="card-sub" style={{ margin: '4px 0 12px' }}>
            Vercel’s free plan can only run scheduled jobs once a day, so a free service (cron-job.org) calls this private link every minute to send due alerts.
            {devices ? ` ${devices} ${devices === 1 ? 'device has' : 'devices have'} alerts on.` : ' No device has alerts on yet.'}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={copy}>Copy the private link</button>
            <button className="btn btn-ghost" onClick={() => setShow((s) => !s)}>{show ? 'Hide link' : 'Show link'}</button>
          </div>
          {show && <p className="num" style={{ wordBreak: 'break-all', fontSize: 13, background: 'rgba(8,18,38,.5)', padding: 10, borderRadius: 12, marginBottom: 0 }}>{cronUrl}</p>}
          <p className="faint" style={{ fontSize: 12.5, margin: '10px 0 0' }}>Keep this link private. It can only trigger alerts that are already due; it cannot read your data.</p>
        </section>
      </div>

      {editing && <TagSheet tag={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TagSheet({ tag, onClose }: { tag: JournalTag | null; onClose: () => void }) {
  const { toast } = useApp();
  const router = useRouter();
  const [name, setName] = useState(tag?.name ?? '');
  const [emoji, setEmoji] = useState(tag?.emoji ?? '✨');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error);
      toast(msg);
      onClose();
      router.refresh();
    });
  return (
    <Sheet title={tag ? `Edit ${tag.name}` : 'New activity'} onClose={onClose}
      footer={<>
        {tag && <button className="btn btn-danger" disabled={pending} onClick={() => run(() => archiveTag(tag.id, !tag.archived), tag.archived ? 'Activity shown again' : 'Activity hidden')}>{tag.archived ? 'Show' : 'Hide'}</button>}
        <button className="btn btn-primary btn-block" style={{ flex: 1 }} disabled={pending} onClick={() => run(() => saveTag({ id: tag?.id, name, emoji }), tag ? 'Activity updated' : 'Activity added')}>Save</button>
      </>}>
      <div className="form-grid" style={{ gridTemplateColumns: '84px 1fr' }}>
        <label className="field"><span>Icon</span><input className="input" style={{ textAlign: 'center', fontSize: 22 }} value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={8} /></label>
        <label className="field"><span>Name</span><input className="input" data-autofocus value={name} onChange={(e) => setName(e.target.value)} maxLength={30} /></label>
      </div>
      {tag && <p className="faint" style={{ fontSize: 13 }}>Hiding keeps it on past entries but removes it from the picker.</p>}
      {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
    </Sheet>
  );
}

export function GmailImport({ script, pending, importWallet }: { script: string; pending: number; importWallet: number | null }) {
  const { toast, wallets } = useApp();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [busy, start] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(script);
      toast('Script copied');
    } catch {
      setShow(true);
    }
  }

  function rotate() {
    if (!confirm('Make a new key? The script in your Gmail stops working until you paste the new version.')) return;
    start(async () => {
      const r = await newImportKey();
      if (!r.ok) return toast(r.error || 'Failed', true);
      toast('New key made. Copy the script again.');
      router.refresh();
    });
  }

  return (
    <section className="glass card" id="gmail">
      <div className="card-head">
        <div>
          <h2 className="card-title">📬 Import from Gmail</h2>
          <p className="card-sub">
            Bank, e-wallet and shop emails become drafts you confirm. A small script runs inside your own Gmail; the app never logs in to Google.
          </p>
        </div>
        <Link className="link" href="/imports">{pending ? `${pending} to check` : 'Open'}</Link>
      </div>
      <label className="field" style={{ marginBottom: 14 }}>
        <span>Email transactions come out of</span>
        <select className="select" value={importWallet ?? ''} disabled={busy}
          onChange={(e) => start(async () => {
            const r = await saveSetting('import_wallet', e.target.value);
            if (!r.ok) return toast(r.error || 'Failed', true);
            toast('Saved');
            router.refresh();
          })}>
          {wallets.filter((w) => !w.archived).map((w) => <option key={w.id} value={w.id}>{w.emoji} {w.name}</option>)}
        </select>
        <span className="faint" style={{ fontSize: 12.5, fontWeight: 500 }}>Unless the email is from a wallet you've named after the sender (e.g. a wallet called "GoPay" gets GoPay emails).</span>
      </label>
      <ol className="steps">
        <li>Tap <strong>Copy the script</strong> below.</li>
        <li>On a computer, open <strong>script.google.com</strong> (signed in to the Gmail that gets your bank emails) → <strong>New project</strong>.</li>
        <li>Delete what's there, paste the script, and save (💾).</li>
        <li>In the menu at the top choose <strong>setup</strong> and press <strong>Run</strong>. Google asks for permission; allow it. (It may say the app isn't verified: choose <em>Advanced → Go to project</em>. It's your own script.)</li>
        <li>Done. It checks every 15 minutes. New items show up under <strong>From email</strong> on the overview.</li>
      </ol>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={copy}>Copy the script</button>
        <button className="btn btn-ghost" onClick={() => setShow((s) => !s)}>{show ? 'Hide script' : 'Show script'}</button>
        <button className="btn btn-ghost" onClick={rotate} disabled={busy}>New key</button>
      </div>
      {show && <pre className="code-box">{script}</pre>}
      <p className="faint" style={{ fontSize: 12.5, margin: '10px 0 0' }}>
        The script contains your private key: don't share it. Only emails that match bank and shop senders or words like "transaksi" are sent, and only
        their first 8,000 characters. Emails from unknown senders that don't look like a payment are ignored and not stored.
      </p>
    </section>
  );
}
