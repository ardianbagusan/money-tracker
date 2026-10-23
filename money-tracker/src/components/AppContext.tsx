'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CalEvent, FoodMoment, Category, JournalEntry, JournalTag, Sport, TxType, Wallet, Workout } from '@/lib/types';

export type SheetRequest =
  | { kind: 'new'; type?: TxType; walletId?: number; title?: string }
  | { kind: 'edit'; id: number }
  | { kind: 'chooser' }
  | { kind: 'journal'; entry?: JournalEntry; mood?: number; date?: string }
  | { kind: 'workout'; sport: Sport; workout?: Workout; date?: string }
  | { kind: 'event'; event?: CalEvent; date?: string }
  | { kind: 'meal'; moment?: FoodMoment; date?: string }
  | { kind: 'trade'; tradeId?: number; close?: boolean };

type Ctx = {
  userName: string;
  tags: JournalTag[];
  tagById: Map<number, JournalTag>;
  vapidPublic: string;
  categories: Category[];
  wallets: Wallet[];
  now: string;
  catById: Map<number, Category>;
  walletById: Map<number, Wallet>;
  hidden: boolean;
  toggleHidden: () => void;
  sheet: SheetRequest | null;
  openSheet: (r: SheetRequest) => void;
  closeSheet: () => void;
  toast: (msg: string, bad?: boolean) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside provider');
  return c;
}

export function AppProvider({ userName, categories, wallets, now, tags, vapidPublic, children }: { userName: string; categories: Category[]; wallets: Wallet[]; now: string; tags: JournalTag[]; vapidPublic: string; children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const [sheet, setSheet] = useState<SheetRequest | null>(null);
  const [toastMsg, setToastMsg] = useState<{ msg: string; bad?: boolean; id: number } | null>(null);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem('hide-amounts') === '1');
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('hide-amounts', hidden);
  }, [hidden]);

  const toggleHidden = useCallback(() => {
    setHidden((h) => {
      try {
        localStorage.setItem('hide-amounts', h ? '0' : '1');
      } catch {}
      return !h;
    });
  }, []);

  const toast = useCallback((msg: string, bad?: boolean) => {
    const id = Date.now();
    setToastMsg({ msg, bad, id });
    setTimeout(() => setToastMsg((t) => (t?.id === id ? null : t)), 2800);
  }, []);

  // "N" opens a new transaction, like a keyboard shortcut on desktop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        setSheet({ kind: 'new' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Register the service worker that shows reminder alerts (works once installed to the home screen).
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      userName,
      tags,
      tagById: new Map(tags.map((t) => [t.id, t])),
      vapidPublic,
      categories,
      wallets,
      now,
      catById: new Map(categories.map((c) => [c.id, c])),
      walletById: new Map(wallets.map((w) => [w.id, w])),
      hidden,
      toggleHidden,
      sheet,
      openSheet: setSheet,
      closeSheet: () => setSheet(null),
      toast,
    }),
    [userName, tags, vapidPublic, categories, wallets, now, hidden, toggleHidden, sheet, toast],
  );

  return (
    <AppCtx.Provider value={value}>
      {children}
      {toastMsg && (
        <div className={`toast${toastMsg.bad ? ' bad' : ''}`} role="status" aria-live="polite">
          {toastMsg.msg}
        </div>
      )}
    </AppCtx.Provider>
  );
}
