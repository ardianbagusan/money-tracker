import type { Metadata } from 'next';
import { getBase } from '@/lib/data';
import { currentUser, requireAuth } from '@/lib/db';
import { AppProvider } from '@/components/AppContext';
import { AppShell } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

// The tab title and the home-screen name follow whoever is signed in.
export async function generateMetadata(): Promise<Metadata> {
  try {
    const u = await currentUser();
    return { title: u.name, appleWebApp: { capable: true, title: u.name, statusBarStyle: 'black-translucent' } };
  } catch {
    return {};
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  const user = await currentUser();
  const { categories, wallets, now, tags, settings } = await getBase();
  return (
    <AppProvider userName={user.name} categories={categories} wallets={wallets} now={now} tags={tags} vapidPublic={settings.vapidPublic}>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
