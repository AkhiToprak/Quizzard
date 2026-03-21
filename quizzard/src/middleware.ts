import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token =
    request.cookies.get('next-auth.session-token')?.value ??
    request.cookies.get('__Secure-next-auth.session-token')?.value;

  const { pathname } = request.nextUrl;

  // Authenticated users hitting "/" → redirect to /home
  if (pathname === '/' && token) {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  // Unauthenticated users hitting protected routes → redirect to login
  if (pathname !== '/' && !token) {
    const signInUrl = new URL('/auth/login', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/notebooks/:path*',
    '/settings/:path*',
    '/settings',
    '/ai-chat/:path*',
    '/ai-chat',
    '/home/:path*',
    '/home',
  ],
};
