import { headers } from 'next/headers';
import { getBase, getEmailImportCount, getImportWalletId, getPushDeviceCount, getRecurring } from '@/lib/data';
import { gmailScript } from '@/lib/gmail-script';
import { GmailImport, LifeSettings } from './LifeSettings';
import { getSecretSetting } from '@/lib/db';
import { SettingsView } from './SettingsView';

export default async function SettingsPage() {
  const base = await getBase();
  const [recurring, cronKey, devices, importKey, pendingImports] = await Promise.all([
    getRecurring(), getSecretSetting('cron_key'), getPushDeviceCount(), getSecretSetting('import_key'), getEmailImportCount(),
  ]);
  const importWallet = await getImportWalletId();
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') || 'https'}://${h.get('x-forwarded-host') || h.get('host')}`;
  return (
    <>
      <SettingsView categories={base.categories} recurring={recurring} timezone={base.settings.timezone} />
      <div style={{ marginTop: 16 }}><GmailImport script={gmailScript(origin, importKey)} pending={pendingImports} importWallet={importWallet} /></div>
      <LifeSettings tags={base.tags} cronUrl={`${origin}/api/cron/reminders?key=${cronKey}`} devices={devices} />
    </>
  );
}
