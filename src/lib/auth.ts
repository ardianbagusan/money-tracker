import 'server-only';
import { cookies } from 'next/headers';
import { COOKIE, verifyToken } from './session';

/** Second line of defence: every server action checks the login cookie itself too. */
export async function requireAuth() {
  const store = await cookies();
  if (!(await verifyToken(store.get(COOKIE)?.value))) throw new Error('Not signed in');
}
