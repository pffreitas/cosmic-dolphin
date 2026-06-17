# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Overview

Turborepo monorepo using **Bun** as the package manager and runtime. Four apps (`api`, `web`, `worker`, `mobile`) share two backend packages (`shared`, `api-client`) and one contract package (`apispec`).

## Commands

### Root (run from repo root)

```bash
bun run dev              # All apps
bun run dev:backend      # API + Worker only
bun run dev:fullstack    # API + Worker + Web
bun run build            # All packages/apps
bun run test             # All tests
bun run test:backend     # API + Worker + Shared tests only
bun run lint             # All packages
bun run typecheck        # All packages
bun run clean            # Clear all build artifacts
```

### API Contract (TypeSpec → OpenAPI → TypeScript client)

```bash
bun run apispec          # Full pipeline: compile → generate → build
bun run apispec:compile  # .tsp → OpenAPI YAML
bun run apispec:generate # OpenAPI YAML → TypeScript client
```

Run `bun run apispec` whenever `packages/apispec/*.tsp` files change.

### Database

```bash
bun run db:migrate       # Apply migrations to linked Supabase project
bun run db:migrate:test  # Apply migrations to test Supabase project
```

### Single test (per app)

```bash
cd apps/api    && bun run test -- --testPathPattern=<pattern>
cd apps/web    && bun run test -- <pattern>     # Vitest
cd apps/worker && bun run test -- --testPathPattern=<pattern>
cd apps/mobile && bun run test -- --testPathPattern=<pattern>
```

## Architecture

### Data flow

```
Web (Next.js 14, App Router)  ─┐
Mobile (Expo 54, Expo Router) ─┤── @cosmic-dolphin/api-client (generated)
                               │              │
                               └──────────────▼
                                  apps/api (Fastify, port 3030)
                                       │
                               packages/shared (Kysely ORM, AI services)
                                       │
                             PostgreSQL (Supabase)
                               ├── pgvector  (embeddings)
                               └── pgmq      (message queue → apps/worker)
```

### Package dependency rules

- `packages/apispec` — TypeSpec source of truth; compiled to OpenAPI YAML
- `packages/api-client` — auto-generated, **never edit manually**
- `packages/shared` — used by `apps/api` and `apps/worker` only, never by clients
- Clients import from `@cosmic-dolphin/api-client`, not directly from the API

### apps/api — Fastify REST server

- Validates with **Zod**, authenticates with **JWT** (Supabase-issued tokens)
- Routes are organized by resource domain under `src/routes/`
- Port configured via `API_PORT` env var (default 3030)

### apps/worker — NestJS background processor

- Consumes jobs from pgmq queues
- Handles AI-heavy tasks: embeddings, RAG pipelines, content processing
- Uses `p-limit` for concurrency control on AI API calls

### apps/web — Next.js frontend

- App Router; state management via **Redux Toolkit**
- UI: **Radix UI** primitives + **Tailwind CSS** + **Tiptap** (rich text)

### apps/mobile — Expo (React Native)

- Uses **Expo Router** (file-based routing)
- Shares the same `@cosmic-dolphin/api-client` as the web app

## Key conventions

- **API contract first:** all endpoint changes start in `packages/apispec/*.tsp`, then regenerate the client with `bun run apispec`.
- **Background jobs via pgmq:** don't add new message brokers; queue tasks through the existing pgmq pattern in `packages/shared`.
- **AI calls live in `packages/shared`:** LLM and embedding logic belongs in shared services, not inside individual app routes/modules.
- **Environment:** root `.env` for shared backend vars; `apps/web/.env.local` for `NEXT_PUBLIC_*` vars; `apps/mobile/.env` for mobile API URL.
- **Bun, not npm/yarn:** use `bun add` / `bun remove` for dependency management.

## CI / Deployment

GitHub Actions deploy to **DigitalOcean App Platform** via Docker images pushed to DO Registry. Three independent pipelines trigger on path filters:

- `deploy-backend.yml` — `apps/api/**`, `apps/worker/**`, `packages/shared/**` → runs migrations then deploys
- `deploy-web.yml` — `apps/web/**`, `packages/api-client/**`
- `deploy-mobile.yml` — `apps/mobile/**`

Supabase migrations run as part of the backend deploy pipeline before the new containers start.
