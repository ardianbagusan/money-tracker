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

export async function createToken() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `v1.${exp}`;
  return `${payload}.${await sign(payload)}`;
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function verifyToken(token?: string | null) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const exp = Number(parts[1]);
  if (!exp || exp < Date.now() / 1000) return false;
  try {
    return safeEqual(parts[2], await sign(`${parts[0]}.${parts[1]}`));
  } catch {
    return false;
  }
}

export async function passwordMatches(input: string) {
  const real = process.env.APP_PASSWORD;
  if (!real) throw new Error('APP_PASSWORD is not set.');
  // Compare hashes so the check takes the same time whatever the input is.
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(input)),
    crypto.subtle.digest('SHA-256', enc.encode(real)),
  ]);
  return safeEqual(b64url(a), b64url(b));
}
