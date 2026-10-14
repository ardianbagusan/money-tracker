'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { clientFor, ensureSchema, activeUsers } from '@/lib/db';
import { COOKIE, MAX_AGE, createToken, userForPassword } from '@/lib/session';

const MAX_FAILS = 5;
const WINDOW_MIN = 15;

export async function login(_prev: { error?: string } | undefined, form: FormData) {
  const password = String(form.get('password') || '');
  const h = await headers();
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';

  const users = activeUsers();
  if (!users.length) return { error: 'APP_PASSWORD is not set. Add it in your Vercel settings.' };
  // Two people must not share a password, or the app couldn't tell whose data to open.
  const pw = users.map((u) => process.env[u.passwordEnv]);
  if (new Set(pw).size !== pw.length) return { error: 'APP_PASSWORD and APP_PASSWORD_2 are the same. Give each person a different password in Vercel.' };

  // Failed attempts are counted in the first user's database (it only stores network addresses).
  const main = clientFor(1);
  try {
    await ensureSchema(1);
  } catch (e: any) {
    console.error(e);
    return { error: 'The app cannot reach its database. Check DATABASE_URL in your Vercel settings.' };
  }

  await main`delete from login_attempts where at < now() - interval '1 day'`;
  const [{ n }] = await main`select count(*)::int as n from login_attempts
    where ip = ${ip} and at > now() - (${WINDOW_MIN} || ' minutes')::interval`;
  if (n >= MAX_FAILS) return { error: `Too many wrong passwords. Wait ${WINDOW_MIN} minutes and try again.` };

  const uid = await userForPassword(password, users);
  if (!uid) {
    await main`insert into login_attempts (ip) values (${ip})`;
    const left = MAX_FAILS - n - 1;
    return { error: left > 0 ? `Wrong password. ${left} ${left === 1 ? 'try' : 'tries'} left.` : `Wrong password. Wait ${WINDOW_MIN} minutes and try again.` };
  }

  // Make sure this person's own database is ready before opening the app.
  try {
    await ensureSchema(uid);
  } catch (e: any) {
    console.error(e);
    return { error: e?.message || 'Could not prepare your data.' };
  }

  await main`delete from login_attempts where ip = ${ip}`;
  const store = await cookies();
  store.set(COOKIE, await createToken(uid), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && !process.env.LOCAL_HTTP,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
  redirect('/');
}
