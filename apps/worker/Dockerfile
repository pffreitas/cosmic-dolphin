# Use Bun Alpine image
FROM oven/bun:1.2-alpine

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
