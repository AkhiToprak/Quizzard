export { default } from 'next-auth/middleware';

export const config = {
  matcher: ['/dashboard/:path*', '/notebooks/:path*', '/settings/:path*', '/settings', '/ai-chat/:path*', '/ai-chat'],
};
