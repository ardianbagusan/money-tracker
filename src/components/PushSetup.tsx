'use client';

import { useEffect, useState, useTransition } from 'react';
import { useApp } from './AppContext';
import { IBell } from './icons';
import { removePushSubscription, savePushSubscription, sendTestPush } from '@/app/life-actions';

type State = 'checking' | 'unsupported' | 'needs-install' | 'off' | 'on' | 'denied';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function deviceLabel() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Device';
}

/** Turns push alerts on or off for the device you are holding. */
export function PushSetup({ compact }: { compact?: boolean }) {
  const { vapidPublic, toast } = useApp();
  const [state, setState] = useState<State>('checking');
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      if (!supported) return setState(ios && !standalone ? 'needs-install' : 'unsupported');
      if (Notification.permission === 'denied') return setState('denied');
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? 'on' : 'off');
    })().catch(() => setState('unsupported'));
  }, []);

  function enable() {
    start(async () => {
      try {
        // Must run straight from the tap, or iPhone ignores the request.
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          setState(perm === 'denied' ? 'denied' : 'off');
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublic) });
        const r = await savePushSubscription(JSON.parse(JSON.stringify(sub)), deviceLabel());
        if (!r.ok) throw new Error(r.error);
        setState('on');
        toast('Alerts are on for this device');
      } catch (e: any) {
        toast(e?.message || 'Could not turn on alerts.', true);
      }
    });
  }

  function disable() {
    start(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState('off');
      toast('Alerts are off for this device');
    });
  }

  function test() {
    start(async () => {
      const r = await sendTestPush();
      toast(r.ok ? r.info ?? 'Sent' : r.error, !r.ok);
    });
  }

  const text: Record<State, string> = {
    checking: 'Checking this device…',
    'needs-install': 'On iPhone, alerts only work in the home-screen app. In Safari tap Share → Add to Home Screen, open Telaga from your home screen, then come back here.',
    unsupported: 'This browser cannot receive alerts. On iPhone use the home-screen app (iOS 16.4 or newer).',
    off: 'Get an alert on this device when a reminder is due.',
    on: 'Alerts are on for this device.',
    denied: 'Alerts are blocked. On iPhone: Settings → Notifications → Telaga → Allow Notifications. Then reopen the app.',
  };

  return (
    <div className={compact ? '' : 'glass card'} style={compact ? undefined : { padding: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span className="bubble" style={{ background: state === 'on' ? 'rgba(25,158,112,.22)' : 'rgba(245,176,122,.18)', color: state === 'on' ? '#8fe0c0' : 'var(--ember)', width: 40, height: 40 }} aria-hidden>
          <IBell width={20} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: 'block' }}>Alerts on this device</strong>
          <p className="muted" style={{ margin: '2px 0 10px', fontSize: 14 }}>{text[state]}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {state === 'off' && <button className="btn btn-primary" disabled={pending || !vapidPublic} onClick={enable}>Turn on alerts</button>}
            {state === 'on' && (
              <>
                <button className="btn" disabled={pending} onClick={test}>Send a test alert</button>
                <button className="btn btn-ghost" disabled={pending} onClick={disable}>Turn off</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
