'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useApp } from './AppContext';
import { IBook, ICalendar, IChart, IGauge, IGear, IHome, IList, ILogout, IMoney, IPlus, IRun, ISmile, IWallet } from './icons';
import { TxSheet } from './TxSheet';
import { ChooserSheet, EventSheet, JournalSheet, WorkoutSheet } from './LifeSheets';
import { signOut } from '@/app/actions';

const MONEY = [
  { href: '/', label: 'Overview', icon: IHome },
  { href: '/history', label: 'Transactions', icon: IList },
  { href: '/reports', label: 'Reports', icon: IChart },
  { href: '/budgets', label: 'Budgets', icon: IGauge },
  { href: '/wallets', label: 'Wallets & goals', icon: IWallet },
];
const LIFE = [
  { href: '/journal', label: 'Journal', icon: IBook },
  { href: '/journal/insights', label: 'Mood insights', icon: ISmile },
  { href: '/sports', label: 'Sports', icon: IRun },
  { href: '/calendar', label: 'Calendar', icon: ICalendar },
];
const MONEY_PATHS = ['/history', '/reports', '/budgets', '/wallets'];
const LIFE_PATHS = ['/journal', '/sports'];

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { openSheet, sheet, userName } = useApp();
  const isActive = (href: string) =>
    href === '/' ? path === '/' : href === '/journal' ? path === '/journal' : path === href || path.startsWith(href + '/');

  const tabs = [
    { href: '/', label: 'Home', icon: IHome, on: path === '/' },
    { href: '/history', label: 'Money', icon: IMoney, on: MONEY_PATHS.some((p) => path.startsWith(p)) },
    { href: '/journal', label: 'Journal', icon: IBook, on: LIFE_PATHS.some((p) => path.startsWith(p)) },
    { href: '/calendar', label: 'Calendar', icon: ICalendar, on: path.startsWith('/calendar') },
  ];

  return (
    <div className="app">
      <aside className="sidebar glass" aria-label="Main navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          {userName}
        </div>
        <nav className="nav" style={{ overflowY: 'auto' }}>
          <div className="nav-label">Money</div>
          {MONEY.map(({ href, label, icon: I }) => (
            <Link key={href} href={href} aria-current={isActive(href) ? 'page' : undefined}><I /> {label}</Link>
          ))}
          <div className="nav-label">Life</div>
          {LIFE.map(({ href, label, icon: I }) => (
            <Link key={href} href={href} aria-current={isActive(href) ? 'page' : undefined}><I /> {label}</Link>
          ))}
          <div className="nav-label" />
          <Link href="/settings" aria-current={isActive('/settings') ? 'page' : undefined}><IGear /> Settings</Link>
        </nav>
        <div className="sidebar-foot">
          <button className="btn btn-primary btn-block" onClick={() => openSheet({ kind: 'chooser' })}>
            <IPlus /> Add
            <kbd style={{ marginLeft: 6, opacity: 0.6, fontFamily: 'inherit', fontSize: 13 }} title="Press N for a new transaction">N</kbd>
          </button>
          <form action={signOut}>
            <button className="btn btn-ghost" style={{ width: '100%', color: 'var(--muted)' }}><ILogout /> Sign out</button>
          </form>
        </div>
      </aside>

      <main className="main">{children}</main>

      <nav className="tabbar glass" aria-label="Tabs">
        {tabs.map(({ href, label, icon: I, on }) => (
          <Link key={href} href={href} aria-current={on ? 'page' : undefined}><I />{label}</Link>
        ))}
      </nav>
      <button className="fab" aria-label="Add" onClick={() => openSheet({ kind: 'chooser' })}>
        <IPlus />
      </button>

      {sheet && <SheetHost key={JSON.stringify(sheet)} />}
    </div>
  );
}

function SheetHost() {
  const { sheet } = useApp();
  if (!sheet) return null;
  switch (sheet.kind) {
    case 'chooser':
      return <ChooserSheet />;
    case 'journal':
      return <JournalSheet entry={sheet.entry} mood={sheet.mood} date={sheet.date} />;
    case 'workout':
      return <WorkoutSheet sport={sheet.sport} workout={sheet.workout} date={sheet.date} />;
    case 'event':
      return <EventSheet event={sheet.event} date={sheet.date} />;
    default:
      return <TxSheet request={sheet} />;
  }
}

/** Second-level tabs on phones, so every money or life screen is one tap away. */
export function SectionTabs({ section }: { section: 'money' | 'life' }) {
  const path = usePathname();
  const items =
    section === 'money'
      ? [{ href: '/history', label: 'History' }, { href: '/reports', label: 'Reports' }, { href: '/budgets', label: 'Budgets' }, { href: '/wallets', label: 'Wallets' }]
      : [{ href: '/journal', label: 'Journal' }, { href: '/journal/insights', label: 'Mood insights' }, { href: '/sports', label: 'Sports' }];
  return (
    <nav className="section-tabs" aria-label={section === 'money' ? 'Money sections' : 'Life sections'}>
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={path === i.href ? 'page' : undefined}>{i.label}</Link>
      ))}
    </nav>
  );
}
