// Signed login cookie. Shared by proxy.ts and server code; uses only Web Crypto.
export const COOKIE = 'mt_session';
export const MAX_AGE = 60 * 60 * 24 * 60; // 60 days

const enc = new TextEncoder();

async function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be set (at least 32 characters).');
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

function b64url(buf: ArrayBuffer) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(payload: string) {
  return b64url(await crypto.subtle.sign('HMAC', await key(), enc.encode(payload)));
}

/** Cookie value: "v2.<user id>.<expiry>.<signature>" */
export async function createToken(userId: number) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `v2.${userId}.${exp}`;
  return `${payload}.${await sign(payload)}`;
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Returns the signed-in user's id, or 0 when the cookie is missing, expired or forged. */
export async function verifyToken(token?: string | null): Promise<number> {
  if (!token) return 0;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v2') return 0;
  const uid = Number(parts[1]);
  const exp = Number(parts[2]);
  if (!uid || !exp || exp < Date.now() / 1000) return 0;
  try {
    return safeEqual(parts[3], await sign(`${parts[0]}.${parts[1]}.${parts[2]}`)) ? uid : 0;
  } catch {
    return 0;
  }
}

/**
 * Finds which user a password belongs to. Every password is checked (never stopping early),
 * so the time taken doesn't reveal anything. Returns 0 when none match.
 */
export async function userForPassword(input: string, users: { id: number; passwordEnv: string }[]) {
  const given = b64url(await crypto.subtle.digest('SHA-256', enc.encode(input)));
  let found = 0;
  for (const u of users) {
    const real = process.env[u.passwordEnv];
    if (!real) continue;
    const hash = b64url(await crypto.subtle.digest('SHA-256', enc.encode(real)));
    if (safeEqual(given, hash) && !found) found = u.id;
  }
  return found;
}
