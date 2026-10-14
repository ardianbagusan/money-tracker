import { SectionTabs } from '@/components/AppShell';
import { getBase, getGoals } from '@/lib/data';
import { WalletsView } from './WalletsView';

export default async function WalletsPage() {
  const base = await getBase();
  const goals = await getGoals();
  return (
    <>
      <SectionTabs section="money" />
      <WalletsView wallets={base.wallets} goals={goals} today={base.today} />
    </>
  );
}
