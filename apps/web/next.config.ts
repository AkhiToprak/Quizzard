import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // The native bridge contract lives in @notemage/shared as raw .ts so
  // both Next (web) and Metro (mobile) consume the same source. Without
  // this hint Next would refuse to compile a non-bundled workspace pkg.
  transpilePackages: ['@notemage/shared'],
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', '@napi-rs/canvas'],
  // Monorepo: trace from the workspace root so pnpm-hoisted packages in
  // ../../node_modules/.pnpm are reachable by include globs below.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  outputFileTracingIncludes: {
    // pdf-parse v2 uses pdfjs-dist at runtime and dynamically imports
    // the worker module; without explicit include globs the worker file
    // is not bundled into the serverless output (Vercel lambda) and
    // the first parse call fails with "Cannot find pdf.worker.mjs".
    '/api/**': [
      './apps/web/node_modules/pdf-parse/**/*',
      './apps/web/node_modules/pdfjs-dist/**/*',
      './node_modules/.pnpm/pdf-parse@*/**/*',
      './node_modules/.pnpm/pdfjs-dist@*/**/*',
    ],
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
