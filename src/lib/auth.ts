import 'server-only';
import { currentUserId } from './db';

/** Second line of defence: every server action checks the login cookie itself too. Returns the user id. */
export async function requireAuth() {
  return currentUserId();
}
