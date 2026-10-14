import { getBase } from '@/lib/data';
import { requireAuth } from '@/lib/auth';
import { AppProvider } from '@/components/AppContext';
import { AppShell } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  const { categories, wallets, now } = await getBase();
  return (
    <AppProvider categories={categories} wallets={wallets} now={now}>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
