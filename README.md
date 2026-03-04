# 🐬 Cosmic Dolphin

A full-stack TypeScript monorepo featuring a Next.js webapp, React Native mobile app, Fastify REST API, and NestJS background worker with AI integration capabilities.

## 🏗️ Monorepo Structure

```
cosmic-dolphin/
├── apps/
│   ├── api/                 # Fastify REST API (Port 3000)
│   ├── web/                 # Next.js Webapp (Port 3001)
│   ├── worker/              # NestJS Background Worker
│   └── mobile/              # React Native Mobile App (Expo)
├── packages/
│   ├── api-client/          # Generated OpenAPI TypeScript client
│   ├── apispec/             # TypeSpec API definitions
│   └── shared/              # Shared backend utilities
├── supabase/                # Database migrations
├── .do/                     # DigitalOcean deployment configs
├── .github/workflows/       # CI/CD pipelines
├── turbo.json               # Turborepo configuration
└── package.json             # Root workspace configuration
```

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│    ┌──────────────┐              ┌──────────────┐                       │
│    │   apps/web   │              │ apps/mobile  │                       │
│    │   (Next.js)  │              │ (React Native)│                      │
│    └──────┬───────┘              └──────┬───────┘                       │
│           │                             │                                │
│           └──────────┬──────────────────┘                               │
│                      │                                                   │
│                      ▼                                                   │
│           ┌──────────────────┐                                          │
│           │ packages/        │                                          │
│           │ api-client       │  ← Generated from packages/apispec       │
│           └────────┬─────────┘                                          │
│                    │                                                     │
└────────────────────┼─────────────────────────────────────────────────────┘
                     │
┌────────────────────┼─────────────────────────────────────────────────────┐
│                    ▼              BACKEND                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│    ┌──────────────┐         ┌──────────────┐                            │
│    │  apps/api    │         │ apps/worker  │                            │
│    │  (Fastify)   │         │  (NestJS)    │                            │
│    └──────┬───────┘         └──────┬───────┘                            │
│           │                        │                                     │
│           └────────┬───────────────┘                                    │
│                    │                                                     │
│                    ▼                                                     │
│           ┌──────────────────┐                                          │
│           │ packages/shared  │                                          │
│           └────────┬─────────┘                                          │
│                    │                                                     │
│                    ▼                                                     │
│    ┌───────────────────────────────────────┐                            │
│    │  PostgreSQL + pgvector + pgmq         │                            │
│    │  (Supabase)                           │                            │
│    └───────────────────────────────────────┘                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

```bash
# Required
bun >= 1.0.0
node >= 22.0.0
docker & docker-compose

# For API client generation
java >= 17  # Required for OpenAPI Generator
```

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd cosmic-dolphin

# Install all dependencies (also generates API client)
bun install

# Start local database
bun run db:up

# Start development (see scenarios below)
bun run dev:fullstack
```

---

## 🔧 Development Workflow

### Development Scenarios

Turborepo allows running any combination of apps in parallel using filters.

#### Scenario 1: Webapp Development

Run **API + Worker + Web** for full-stack web development:

```bash
# Option A: Single command
bun run dev:fullstack

# Option B: Separate terminals for more control
# Terminal 1: Backend
bun run dev:backend

# Terminal 2: Web
bun run dev:web
```

#### Scenario 2: Mobile App Development

Run **API + Worker + Mobile** for full-stack mobile development:

```bash
# Start backend + mobile
bun run dev:fullstack:mobile

# Or with Expo in a separate terminal
bun run dev:backend
cd apps/mobile && bun run start
```

#### Scenario 3: Backend-Only Development

Run **API + Worker** for API development and testing:

```bash
bun run dev:backend
```

#### Scenario 4: Frontend-Only Development

Run against a remote/staging API (no local backend):

```bash
# Configure apps/web/.env.local to point to staging API
# NEXT_PUBLIC_API_URL=https://api.staging.cosmic-dolphin.com

bun run dev:web
```

### What Happens During Development

When you run `bun run dev:fullstack`, Turborepo:

1. Builds dependencies in correct order (`packages/apispec` → `packages/api-client` → apps)
2. Starts all services in parallel
3. Shows prefixed output so you know which service logged what

```
@cosmic-dolphin/api:dev: Fastify listening on http://localhost:3000
@cosmic-dolphin/worker:dev: NestJS worker started
@cosmic-dolphin/web:dev: Next.js ready on http://localhost:3001
```

### Updating the API Contract

When you modify the API specification:

```bash
# 1. Edit TypeSpec definitions
code packages/apispec/bookmarks.tsp

# 2. Regenerate the client
bun run apispec

# 3. TypeScript will show errors in web/mobile if types changed
#    Fix the errors and continue development
```

---

## 📜 Available Scripts

### Root Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start all apps in development mode |
| `bun run dev:backend` | Start API + Worker only |
| `bun run dev:web` | Start Web app only |
| `bun run dev:mobile` | Start Mobile app only |
| `bun run dev:fullstack` | Start API + Worker + Web |
| `bun run dev:fullstack:mobile` | Start API + Worker + Mobile |
| `bun run build` | Build all packages and apps |
| `bun run test` | Run all tests |
| `bun run lint` | Lint all packages |
| `bun run typecheck` | Type-check all packages |
| `bun run apispec` | Regenerate API client from TypeSpec |

### Database Commands

| Command | Description |
|---------|-------------|
| `bun run db:migrate` | Push migrations to the linked Supabase project |
| `bun run db:migrate:test` | Push migrations to the test Supabase project |

### Build Commands

| Command | Description |
|---------|-------------|
| `bun run build` | Build everything |
| `bun run build:web` | Build web app only |
| `bun run build:api` | Build API only |
| `bun run build:worker` | Build worker only |

---

## 📦 Package Dependencies

### Dependency Graph

```
packages/apispec (TypeSpec definitions)
       │
       │ generates
       ▼
packages/api-client (@cosmic-dolphin/api-client)
       │
       ├────────────────┬────────────────┐
       ▼                ▼                ▼
   apps/web        apps/mobile      (future clients)


packages/shared (@cosmic-dolphin/shared)
       │
       ├────────────────┐
       ▼                ▼
   apps/api        apps/worker
```

### Package Descriptions

| Package | Name | Description |
|---------|------|-------------|
| `packages/apispec` | `@cosmic-dolphin/apispec` | TypeSpec API definitions (source of truth) |
| `packages/api-client` | `@cosmic-dolphin/api-client` | Generated TypeScript client for API |
| `packages/shared` | `@cosmic-dolphin/shared` | Shared backend utilities, types, services |
| `apps/api` | `@cosmic-dolphin/api` | Fastify REST API server |
| `apps/worker` | `@cosmic-dolphin/worker` | NestJS background job processor |
| `apps/web` | `@cosmic-dolphin/web` | Next.js web application |
| `apps/mobile` | `@cosmic-dolphin/mobile` | React Native mobile app |

---

## 🌍 Environment Variables

Each app has its own environment file:

```
cosmic-dolphin/
├── .env                      # Shared (DATABASE_URL, etc.)
├── apps/
│   ├── api/.env              # API_PORT, JWT_SECRET
│   ├── web/.env.local        # NEXT_PUBLIC_* variables
│   ├── worker/.env           # Queue config, AI keys
│   └── mobile/.env           # API_URL for mobile
```

### Example Configurations

**Shared `.env`:**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**`apps/api/.env`:**
```env
PORT=3000
JWT_SECRET=your-jwt-secret
```

**`apps/web/.env.local`:**
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**`apps/worker/.env`:**
```env
OPENROUTER_API_KEY=your-openrouter-key
OPENAI_API_KEY=your-openai-key
```

### Using Staging/Production APIs

For frontend-only development against remote APIs:

```env
# apps/web/.env.local
NEXT_PUBLIC_API_URL=https://api.cosmic-dolphin.com

# apps/mobile/.env
API_URL=https://api.cosmic-dolphin.com
```

---

## 🛠️ Tech Stack

### Apps

| App | Framework | Port | Description |
|-----|-----------|------|-------------|
| `apps/api` | Fastify 4.x | 3000 | REST API with JWT auth |
| `apps/web` | Next.js 14+ | 3001 | React webapp with App Router |
| `apps/worker` | NestJS 10.x | - | Background job processor |
| `apps/mobile` | React Native + Expo | - | iOS/Android mobile app |

### Packages

| Package | Technology | Description |
|---------|------------|-------------|
| `packages/apispec` | TypeSpec | API contract definitions |
| `packages/api-client` | OpenAPI Generator | Generated fetch client |
| `packages/shared` | TypeScript | Shared backend code |

### Infrastructure

- **Database**: PostgreSQL 15+ with pgvector, pgmq
- **Auth**: Supabase Auth + JWT
- **Queue**: pgmq (PostgreSQL Message Queue)
- **Deployment**: DigitalOcean App Platform
- **CI/CD**: GitHub Actions

---

## 🗄️ Database

### Local Development

```bash
# Start Supabase locally
bun run db:up

# Run migrations
cd supabase && supabase db push

# Reset database
bun run db:reset
```

### Migrations

Migrations are in `supabase/migrations/` and managed via Supabase CLI:

```bash
# Create new migration
supabase migration new my_migration_name

# Apply migrations locally
supabase db push

# Deploy to production (via CI/CD)
supabase db push --linked
```

---

## 🔄 Background Jobs

The worker service uses **pgmq** for reliable message processing:

```typescript
// Send a job from API
await queueService.sendMessage('bookmarks', {
  type: 'process_bookmark',
  bookmarkId: '123'
});

// Worker processes it automatically via handlers
```

### Adding New Job Types

1. Define type in `packages/shared/src/types.ts`
2. Create handler in `apps/worker/src/queue/handlers/`
3. Register in `apps/worker/src/queue/queue.module.ts`

---

## 🚢 Deployment

### CI/CD Pipeline

GitHub Actions handles deployment with path-based filtering:

| Workflow | Trigger Paths | Deploys |
|----------|---------------|---------|
| `deploy-api.yml` | `apps/api/**`, `packages/shared/**` | API service |
| `deploy-worker.yml` | `apps/worker/**`, `packages/shared/**` | Worker service |
| `deploy-web.yml` | `apps/web/**`, `packages/api-client/**` | Web app |

### Manual Docker Build

```bash
# Build individual services
docker build -f apps/api/Dockerfile -t cosmic-dolphin-api .
docker build -f apps/web/Dockerfile -t cosmic-dolphin-web .
docker build -f apps/worker/Dockerfile -t cosmic-dolphin-worker .
```

---

## 🧪 Testing

```bash
# Run all tests (requires DATABASE_URL in .env.test or environment)
bun run test

# Run tests for specific app/package
bun run test --filter=@cosmic-dolphin/api
bun run test --filter=@cosmic-dolphin/shared
```

---

## 📋 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Port already in use | Check for running processes: `lsof -i :3000` |
| API client outdated | Regenerate: `bun run apispec` |
| Database connection failed | Ensure database is running: `bun run db:up` |
| Build fails | Clean and rebuild: `bun run clean && bun run build` |
| Type errors after API change | Regenerate client and fix imports |

### Debug Mode

```bash
# Verbose Turborepo output
bun run dev --verbosity=2

# Debug specific app
cd apps/api && bun --inspect run dev
```

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/amazing-feature`
2. Make your changes
3. Run tests: `bun run test`
4. Run linting: `bun run lint`
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Create a Pull Request

### Guidelines

- Follow existing TypeScript patterns
- Add tests for new features
- Update TypeSpec when changing API contracts
- Ensure all packages build successfully

---

## 📚 Additional Documentation

- **API Specification**: `packages/apispec/*.tsp`
- **Shared Package**: `packages/shared/README.md`
- **Deployment Configs**: `.do/*.yml`

---

**License**: ISC  
**Version**: 2.0.0  
**Maintained by**: Cosmic Dolphin Team
