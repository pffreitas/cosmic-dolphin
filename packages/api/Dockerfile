# Use Node.js 18 Alpine
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/api/package*.json ./packages/api/

# Install dependencies
RUN npm ci

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api
COPY tsconfig.json ./

# Build shared package first
RUN npm run build --workspace=packages/shared

# Build API
RUN npm run build --workspace=packages/api

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start", "--workspace=packages/api"]