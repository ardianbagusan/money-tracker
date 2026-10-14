import { getBase, getGoals } from '@/lib/data';
import { WalletsView } from './WalletsView';

export default async function WalletsPage() {
  const base = await getBase();
  const goals = await getGoals();
  return <WalletsView wallets={base.wallets} goals={goals} today={base.today} />;
}
