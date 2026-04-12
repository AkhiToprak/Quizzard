# Multi-stage build for the Notemage Next.js app (apps/web).
# The build context is the monorepo root so the Dockerfile can see the
# pnpm workspace lockfile + the apps/web subdirectory.

ARG PNPM_VERSION=9.12.0

# Stage 1: Dependencies (workspace install)
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION:-9.12.0} --activate
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile

# Stage 2: Builder (production build)
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION:-9.12.0} --activate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules 2>/dev/null || true
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm --filter web build

# Stage 3: Development (used by docker-compose)
FROM node:20-alpine AS dev
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION:-9.12.0} --activate
COPY apps/web/package.json ./package.json
RUN pnpm install
COPY apps/web/ ./
RUN pnpm exec prisma generate
EXPOSE 3000
CMD ["pnpm", "dev"]

# Stage 4: Production runtime
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION:-9.12.0} --activate
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/package.json ./package.json
COPY --from=builder /app/apps/web/next.config.ts ./next.config.ts
COPY --from=builder /app/apps/web/prisma ./prisma
RUN pnpm install --prod
EXPOSE 3000
CMD ["pnpm", "start"]
