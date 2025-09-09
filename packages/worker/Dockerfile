# Use Node.js 22 Alpine
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/worker/package*.json ./packages/worker/

# Install dependencies
RUN npm ci

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/worker ./packages/worker
COPY tsconfig.json ./

# Build shared package first
RUN npm run build --workspace=packages/shared

# Build worker
RUN npm run build --workspace=packages/worker

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "run", "start:prod", "--workspace=packages/worker"]