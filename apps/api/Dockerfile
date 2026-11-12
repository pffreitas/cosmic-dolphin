# Use Bun Alpine image
FROM oven/bun:1.2-alpine

# Set working directory
WORKDIR /app

# Copy root package.json and bun.lock
COPY package.json bun.lock ./

# Copy workspace package.json files
COPY packages/shared/package.json ./packages/shared/
COPY packages/api-client/package.json ./packages/api-client/
COPY apps/api/package.json ./apps/api/

# Install dependencies; workspace builds run explicitly after their source is copied.
RUN bun install --ignore-scripts

# Copy shared package source and build it first
COPY packages/shared ./packages/shared
COPY tsconfig.json ./
RUN bun run --cwd packages/shared build

# Build the generated client imported by the API's compiled contract tests.
COPY packages/api-client ./packages/api-client
RUN bun run --cwd packages/api-client build

# Copy API package source  
COPY apps/api ./apps/api

# Build API package (with reference to built shared package)
RUN bun run --cwd apps/api build

# Expose port
EXPOSE 3000

# Start the application
CMD ["bun", "run", "--cwd", "apps/api", "start"]
