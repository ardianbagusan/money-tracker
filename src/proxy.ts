import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, verifyToken } from './lib/session';

// Every page, every data request and every server action passes through here.
// Without a valid login cookie, pages redirect to /login and anything else gets 401.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/login' || pathname === '/robots.txt') return NextResponse.next();

  const ok = await verifyToken(req.cookies.get(COOKIE)?.value);
  if (ok) return NextResponse.next();

  const isPageView = req.method === 'GET' && !pathname.startsWith('/api/');
  if (isPageView) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return new NextResponse('Not signed in', { status: 401 });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|art/|fonts/|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest).*)'],
};
