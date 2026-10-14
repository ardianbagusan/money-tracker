'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import { Sheet } from '@/components/Sheet';
import { PushSetup } from '@/components/PushSetup';
import { IPlus } from '@/components/icons';
import { archiveTag, saveTag } from '@/app/life-actions';
import type { JournalTag } from '@/lib/types';

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
