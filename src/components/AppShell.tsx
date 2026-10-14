'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useApp } from './AppContext';
import { IChart, IGauge, IGear, IHome, IList, ILogout, IPlus, IWallet } from './icons';
import { TxSheet } from './TxSheet';
import { signOut } from '@/app/actions';

const NAV = [
  { href: '/', label: 'Overview', short: 'Home', icon: IHome },
  { href: '/history', label: 'Transactions', short: 'History', icon: IList },
  { href: '/reports', label: 'Reports', short: 'Reports', icon: IChart },
  { href: '/budgets', label: 'Budgets', short: 'Budgets', icon: IGauge },
  { href: '/wallets', label: 'Wallets & goals', short: 'Wallets', icon: IWallet },
];
const TABS = ['/', '/history', '/reports', '/wallets'];

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { openSheet, sheet } = useApp();
  const isActive = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <div className="app">
      <aside className="sidebar glass" aria-label="Main navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          Telaga
        </div>
        <nav className="nav">
          {NAV.map(({ href, label, icon: I }) => (
            <Link key={href} href={href} aria-current={isActive(href) ? 'page' : undefined}>
              <I /> {label}
            </Link>
          ))}
          <Link href="/settings" aria-current={isActive('/settings') ? 'page' : undefined}>
            <IGear /> Settings
          </Link>
        </nav>
        <div className="sidebar-foot">
          <button className="btn btn-primary btn-block" onClick={() => openSheet({ kind: 'new' })}>
            <IPlus /> Add transaction
            <kbd style={{ marginLeft: 6, opacity: 0.6, fontFamily: 'inherit', fontSize: 13 }}>N</kbd>
          </button>
          <form action={signOut}>
            <button className="btn btn-ghost" style={{ width: '100%', color: 'var(--muted)' }}>
              <ILogout /> Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="main">{children}</main>

      <nav className="tabbar glass" aria-label="Tabs">
        {NAV.filter((n) => TABS.includes(n.href)).map(({ href, short, icon: I }) => (
          <Link key={href} href={href} aria-current={isActive(href) ? 'page' : undefined}>
            <I />
            {short}
          </Link>
        ))}
      </nav>
      <button className="fab" aria-label="Add transaction" onClick={() => openSheet({ kind: 'new' })}>
        <IPlus />
      </button>

      {sheet && <TxSheet key={JSON.stringify(sheet)} request={sheet} />}
    </div>
  );
}
