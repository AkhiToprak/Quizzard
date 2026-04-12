import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', '@napi-rs/canvas'],
  outputFileTracingIncludes: {
    '/api/**': ['./node_modules/pdf-parse/**/*', './node_modules/pdf-parse/node_modules/**/*'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      // Google profile pictures (Continue with Google)
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      // Apple Sign In profile assets (when present)
      {
        protocol: 'https',
        hostname: 'appleid.cdn-apple.com',
      },
    ],
  },
};

let config: NextConfig = nextConfig;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { withSentryConfig } = require('@sentry/nextjs');
  config = withSentryConfig(nextConfig, {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
  });
} catch {
  // @sentry/nextjs not available — skip Sentry integration
}

export default config;
