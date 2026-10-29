# Pin the browser and verify release checksums before it reaches production.
FROM debian:bookworm-slim AS browser
COPY scripts/install-lightpanda.sh /tmp/install-lightpanda.sh
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    && sh /tmp/install-lightpanda.sh /usr/local/bin/lightpanda

# Lightpanda requires glibc; Alpine uses musl.
FROM oven/bun:1.3.11
COPY --from=browser /usr/local/bin/lightpanda /usr/local/bin/lightpanda
COPY --from=browser /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
RUN lightpanda version

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/

# Install dependencies
RUN bun install 

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker
COPY tsconfig.json ./

# Build shared package first
RUN bun run --cwd packages/shared build

# Build worker
RUN bun run --cwd apps/worker build

# Expose port
EXPOSE 3001

# Start the application
CMD ["bun", "run", "--cwd", "apps/worker", "start:prod"]
