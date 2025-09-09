# Use Node.js 22 Alpine
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy root package.json and package-lock.json
COPY package*.json ./

# Copy workspace package.json files
COPY packages/shared/package*.json ./packages/shared/
COPY packages/api/package*.json ./packages/api/

# Install all dependencies including workspace dependencies
RUN npm ci

# Copy shared package source and build it first
COPY packages/shared ./packages/shared
COPY tsconfig.json ./
RUN npm run build --workspace=packages/shared

# Copy API package source
COPY packages/api ./packages/api

# Build API package
RUN npm run build --workspace=packages/api

# Expose port
EXPOSE 3000

# Start the application in development mode for hot reload
CMD ["npm", "run", "dev", "--workspace=packages/api"]