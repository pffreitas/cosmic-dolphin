# Keep dependency resolution aligned with the repository package manager pinned in package.json.
FROM oven/bun:1.3.11-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy root workspace files
COPY package.json bun.lock ./

# Copy package.json files for every workspace represented in bun.lock
COPY apps/api/package.json ./apps/api/
COPY apps/mobile/package.json ./apps/mobile/
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/apispec/package.json ./packages/apispec/
COPY packages/shared/package.json ./packages/shared/

# Copy pre-built API client (generated in CI before Docker build)
COPY packages/api-client/ ./packages/api-client/

# Install the exact dependency graph from bun.lock without running postinstall
# (the API client is pre-generated in CI).
RUN bun install --frozen-lockfile --ignore-scripts

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy root package.json for workspace resolution
COPY package.json ./

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY apps/web ./apps/web

# Accept build arguments for configuration
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_REDIRECT_URL
ARG NEXT_PUBLIC_BASE_URL
ARG HOST
ARG NEXT_PUBLIC_API_URL

# Set environment variables from build arguments
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_REDIRECT_URL=$NEXT_PUBLIC_REDIRECT_URL
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV HOST=$HOST
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app/apps/web
RUN bun run build

# Production image, copy all the files and run next
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

RUN mkdir -p apps/web/.next
RUN chown nextjs:nodejs apps/web/.next

# Copy standalone output from builder (preserves monorepo directory structure)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
