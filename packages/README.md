# Cosmic Dolphin - Node.js TypeScript Architecture

## Overview

This project contains both the original Go microservice and a new Node.js TypeScript architecture in the `packages/` directory. The new architecture consists of:

- **API**: Fastify REST API server
- **Worker**: NestJS background worker with BullMQ
- **Shared**: Common types and utilities

## Architecture

```
packages/
├── shared/          # Shared TypeScript types and utilities
├── api/            # Fastify REST API (Port 3000)
└── worker/         # NestJS + BullMQ Worker (Port 3001)
```

## Tech Stack

- **API**: Fastify, TypeScript, PostgreSQL, JWT
- **Worker**: NestJS, BullMQ, Redis, TypeScript
- **Database**: PostgreSQL with pgvector (Supabase compatible)
- **Queue**: Redis + BullMQ
- **Deployment**: Docker, DigitalOcean App Platform

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Docker & Docker Compose (for local development)

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Setup environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start with Docker Compose** (Recommended):
   ```bash
   npm run docker:up
   ```
   This starts PostgreSQL, Redis, API, and Worker services.

4. **Or start manually**:
   ```bash
   # Start infrastructure
   docker-compose up postgres redis -d
   
   # Start both API and Worker
   npm run dev
   ```

### Available Scripts

```bash
# Development
npm run dev              # Start API and Worker in development mode
npm run docker:up        # Start all services with Docker
npm run docker:down      # Stop Docker services
npm run docker:logs      # View Docker logs

# Building
npm run build            # Build all packages
npm run clean            # Clean build artifacts

# Testing & Linting
npm run test             # Run tests for all packages
npm run lint             # Lint all packages
```

### API Endpoints

- **Health Check**: `GET /health`
- **API Status**: `GET /api/v1/status`

### Worker Health Check

- **Worker Status**: `GET http://localhost:3001/health`

## Deployment

### DigitalOcean App Platform

The project includes GitHub Actions workflows for automatic deployment:

1. **API**: Deployed as a web service
2. **Worker**: Deployed as a background worker

Required environment variables:
- `DATABASE_URL` (Supabase connection string)
- `REDIS_URL`
- `JWT_SECRET`

### Manual Deployment

Build and deploy using Docker:

```bash
# Build production images
docker build -f packages/api/Dockerfile -t cosmic-dolphin-api .
docker build -f packages/worker/Dockerfile -t cosmic-dolphin-worker .
```

## Development Workflow

1. **Add shared types**: Edit `packages/shared/src/types.ts`
2. **API development**: Work in `packages/api/src/`
3. **Worker development**: Work in `packages/worker/src/`
4. **Build shared package**: `npm run build --workspace=packages/shared`

## Database

The application expects PostgreSQL with pgvector extension. Schema migrations are located in the `migrations/` directory (from the original Go service).

For local development, use the provided Docker Compose setup.

## Queue System

Background jobs are handled by BullMQ with Redis:

- **Queue Name**: `tasks`
- **Example Job**: `example-task`

Add new job processors in `packages/worker/src/tasks/tasks.processor.ts`.

## Environment Configuration

See `ENV_CONFIG.md` for detailed environment setup instructions.

## Contributing

1. Follow existing code conventions
2. Add tests for new features
3. Update documentation
4. Ensure all packages build successfully

## Monitoring

- **API Health**: `GET /health`
- **Worker Health**: `GET http://localhost:3001/health`
- **Docker Logs**: `npm run docker:logs`