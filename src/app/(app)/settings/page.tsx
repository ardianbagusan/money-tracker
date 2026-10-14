import { headers } from 'next/headers';
import { getBase, getPushDeviceCount, getRecurring } from '@/lib/data';
import { getSecretSetting } from '@/lib/db';
import { SettingsView } from './SettingsView';
import { LifeSettings } from './LifeSettings';

export default async function SettingsPage() {
  const base = await getBase();
  const [recurring, cronKey, devices] = await Promise.all([getRecurring(), getSecretSetting('cron_key'), getPushDeviceCount()]);
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') || 'https'}://${h.get('x-forwarded-host') || h.get('host')}`;
  return (
    <>
      <SettingsView categories={base.categories} recurring={recurring} timezone={base.settings.timezone} />
      <LifeSettings tags={base.tags} cronUrl={`${origin}/api/cron/reminders?key=${cronKey}`} devices={devices} />
    </>
  );
}
