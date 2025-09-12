# Use Node.js 22 Alpine with Bun
FROM oven/bun:1.2-alpine

# Set working directory
WORKDIR /app

# Copy root package.json and bun.lockb
COPY package.json bun.lockb ./

# Copy workspace package.json files
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/

# Install all dependencies including workspace dependencies
RUN bun install --frozen-lockfile

# Copy shared package source and build it first
COPY packages/shared ./packages/shared
COPY tsconfig.json ./
RUN bun run --cwd packages/shared build

# Copy API package source  
COPY packages/api ./packages/api

# Build API package (with reference to built shared package)
RUN bun run --cwd packages/api build

# Expose port
EXPOSE 3000

# Start the application in development mode for hot reload
CMD ["bun", "run", "--cwd", "packages/api", "dev"]