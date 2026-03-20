import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token =
    request.cookies.get('next-auth.session-token')?.value ??
    request.cookies.get('__Secure-next-auth.session-token')?.value;

  if (!token) {
    const signInUrl = new URL('/auth/login', request.url);
    signInUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
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
