'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql, ensureSchema } from '@/lib/db';
import { COOKIE, MAX_AGE, createToken, passwordMatches } from '@/lib/session';

const MAX_FAILS = 5;
const WINDOW_MIN = 15;

export async function login(_prev: { error?: string } | undefined, form: FormData) {
  const password = String(form.get('password') || '');
  const h = await headers();
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';

  try {
    await ensureSchema();
  } catch (e: any) {
    console.error(e);
    return { error: 'The app cannot reach its database. Check DATABASE_URL in your Vercel settings.' };
  }

  await sql`delete from login_attempts where at < now() - interval '1 day'`;
  const [{ n }] = await sql`select count(*)::int as n from login_attempts
    where ip = ${ip} and at > now() - (${WINDOW_MIN} || ' minutes')::interval`;
  if (n >= MAX_FAILS) return { error: `Too many wrong passwords. Wait ${WINDOW_MIN} minutes and try again.` };

  let ok = false;
  try {
    ok = await passwordMatches(password);
  } catch {
    return { error: 'APP_PASSWORD is not set. Add it in your Vercel settings.' };
  }
  if (!ok) {
    await sql`insert into login_attempts (ip) values (${ip})`;
    const left = MAX_FAILS - n - 1;
    return { error: left > 0 ? `Wrong password. ${left} ${left === 1 ? 'try' : 'tries'} left.` : `Wrong password. Wait ${WINDOW_MIN} minutes and try again.` };
  }

  await sql`delete from login_attempts where ip = ${ip}`;
  const store = await cookies();
  store.set(COOKIE, await createToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && !process.env.LOCAL_HTTP,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
  redirect('/');
}
