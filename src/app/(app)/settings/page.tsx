import { getBase, getRecurring } from '@/lib/data';
import { SettingsView } from './SettingsView';

export default async function SettingsPage() {
  const base = await getBase();
  const recurring = await getRecurring();
  return <SettingsView categories={base.categories} recurring={recurring} timezone={base.settings.timezone} />;
}
