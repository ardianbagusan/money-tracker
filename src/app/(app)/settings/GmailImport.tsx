'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import { newImportKey } from '@/app/actions';

export function GmailImport({ script, pending }: { script: string; pending: number }) {
  const { toast } = useApp();
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
