# Use Node.js 22 Alpine with Bun
FROM oven/bun:1.2-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/worker/package.json ./packages/worker/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/worker ./packages/worker
COPY tsconfig.json ./

# Build shared package first
RUN bun run --cwd packages/shared build

# Build worker
RUN bun run --cwd packages/worker build

# Expose port
EXPOSE 3001

# Start the application
CMD ["bun", "run", "--cwd", "packages/worker", "start:prod"]