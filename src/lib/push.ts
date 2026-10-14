import 'server-only';
import webpush from 'web-push';
import { getSecretSetting, type Sql } from './db';

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

/** Sends a notification to every device that turned alerts on. Removes devices that unsubscribed. */
export async function sendToAll(sql: Sql, payload: PushPayload, origin: string) {
  const [pub, priv] = await Promise.all([getSecretSetting('vapid_public', sql), getSecretSetting('vapid_private', sql)]);
  if (!pub || !priv) throw new Error('Push keys are missing.');
  // Keys go with each send (not set globally), so two people's alerts can never be signed with the wrong keys.
  // Apple requires the contact to be a real https URL or mailto; the app's own address works.
  const vapidDetails = { subject: origin.startsWith('https://') ? origin : 'mailto:alerts@telaga.invalid', publicKey: pub, privateKey: priv };
  const subs = await sql`select endpoint, p256dh, auth from push_subscriptions`;
  let sent = 0;
  const failures: string[] = [];
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60, urgency: 'high', vapidDetails },
      );
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await sql`delete from push_subscriptions where endpoint = ${s.endpoint}`;
      } else {
        failures.push(`${e?.statusCode ?? ''} ${e?.body ?? e?.message ?? e}`.trim());
      }
    }
  }
  return { devices: subs.length, sent, failures };
}
