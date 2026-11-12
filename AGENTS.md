# AGENTS.md

This is the shared repository guidance for coding agents. `CLAUDE.md` points here so the two entry points do not drift.

## Overview

Turborepo monorepo using **Bun** as the package manager and runtime. Four apps (`api`, `web`, `worker`, `mobile`) share two backend packages (`shared`, `api-client`) and one contract package (`apispec`).

## Start here

- Read the task's approved spec, prototype and task record before changing behavior. Confirm assertions about the starting code against the checkout; a delegate brief is not proof that a field or endpoint exists.
- Preserve existing uncommitted work, environment files and agent hooks. Record the branch, base SHA and starting state before edits. Read the current remote state when resuming delivery.
- Follow the user's latest scope and standing authorization. Do not ask again for an already-authorized implementation, merge or release step. A task-specific beta exception stays with that task; it is not a permanent waiver for future releases.
- Keep the current outcome, next gate, owner and blocker near the top of the task record. Preserve the detailed history separately. A handoff should not require reading thousands of lines or recovering `/tmp` files to learn the release state.
- For backend deployment or TestFlight, read [the release runbook](docs/runbooks/backend-and-testflight-release.md). The [Save + Today's 5 retrospective](docs/retrospectives/2026-11-12-save-and-todays-5.md) explains the failures behind this guidance.

## Commands

### Root (run from repo root)

```bash
bun run dev              # All apps
bun run dev:backend      # API + Worker only
bun run dev:fullstack    # API + Worker + Web
bun run build            # All packages/apps
bun run test             # All tests
bun run test:backend -- --env-mode=loose --concurrency=1  # Serial backend gate
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

Fresh backend tests also need `bun run apispec:compile`: contract tests read compiled OpenAPI even when TypeSpec did not change. Root `postinstall` can skip a failed client build; successful dependency installation alone does not prove generation or compilation succeeded.

### Database

```bash
bun run db:migrate       # Apply migrations to linked production Supabase project
bun run db:test:up       # Start the local test Postgres container on port 5433
bun run db:test:reset    # Reapply all migrations to the disposable test DB
bun run db:test:down     # Stop and discard the test database
bun run test:db          # Convenience wrapper; see serial/environment caveat below
```

Tests do **not** require a hosted Supabase project. The local container uses
`supabase/postgres:15.19.0.004` (one Postgres service, not `supabase start`) so
pgvector, pgroonga, and the `auth` schema are available to the unmodified
migrations. The test harness defaults to `127.0.0.1:5433` and TRUNCATEs all
`public` tables between tests; never point it at a database with data to keep.

The `test:db` convenience wrapper does not supply the explicit environment/serialization used by the release gate. Prefer the runbook commands for verified backend runs.

Run shared, API and worker database suites **serially**. They share one truncating database; do not run them alongside native/API fixtures or device proofs that use it. For the complete backend gate, use the explicit local environment and Turbo settings in the release runbook. A local `DATABASE_URL` does not redirect Supabase SDK/pgmq RPC traffic: isolate that transport as well before running a worker fixture.

Before Docker image proofs, inventory the current Docker context, VM capacity and running containers. Use a dedicated build VM/context when the default hosts other work. Never resize, stop or reset shared infrastructure as a build optimization. Clean up only resources created by the task; readiness after a restart does not prove interrupted transactions were preserved.

### Single test (per app)

```bash
cd apps/api    && bun test <test-file>          # Bun test runner
cd apps/web    && bun run test -- <pattern>     # Vitest
cd apps/worker && bun test <test-file>          # Bun test runner
cd apps/mobile && bun run test -- --testPathPattern=<pattern>
cd packages/shared && bun run test -- --testPathPatterns=<pattern>  # Jest 30
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

## UI and product specification

Read [the design system](docs/design-system/README.md) and [functional spec](docs/functional-spec/README.md), then the current feature spec. For mobile, [Save + Today's 5](docs/specs/mobile-reading-app/2026-11-09-save-and-todays-5.md) supersedes older exploratory prototypes for its shipped scope. The wider AI Library and cited-answer ideas remain in its [backlog](docs/specs/mobile-reading-app/BACKLOG.md).

- Use semantic tokens, with no hard-coded color, radius or font stack in components. Edit `docs/design-system/tokens.json`, run `bun run tokens`, then `bun run tokens:check`. Never hand-edit generated themes. Mobile's Plum palette is represented by `color.mobile` overrides; preserve web tokens unless the task explicitly changes web design.
- Serif is for bookmark/feed titles and saved-content headings; sans is for controls. Follow the platform's approved primitives and loading, empty, error and processing states.
- Committed native projects are maintained in place. Do not run `expo prebuild --clean`: it can replace the custom iOS extension, entitlements, fonts and test targets. `app.json` alone does not prove the signed native configuration changed.
- In T3, use its device tools and the bound device command for UI interaction. Never reuse or close another agent's device claim. Simulator, fixture, signed-capability and physical/session/accessibility evidence are distinct; label each accurately.

## Regression proof

- For account-sensitive UI, test A→B while a form, sheet, request or confirmation is active. Reset private local fields synchronously by owner; provider/cache fences alone do not hide old component state. Fence stale completions and route prefill too.
- For durable capture, retain the latest local intent through create **and confirmation PATCH acknowledgement**. Exercise held acknowledgements, replay, Remove, concurrent arrivals and account changes through the real provider/navigation/transport boundary.
- Keep already-enqueued owner-bound reading writes and Undo feedback correct across navigation. Ordinary reading actions still roll back on offline failure; do not infer a durable offline queue for them.
- Open public cards through the public-slug contract. Never fall back to an owner's private cache or detail endpoint.
- Measure limits on the full serialized HTTP response, including UTF-8, escaping and envelope fields. Word count alone did not enforce the 500,000-byte content ceiling; use long-word and Unicode cases when verifying that contract.
- Reproduce timing failures before changing timeouts. Await the actual auth/root bootstrap and React updates; preserve the original behavioral assertions. Keep failed runs and test-first deviations in the evidence. Rerun relevant checks after changes, then complete the required gate; repeat broader checks only for a new change, failure or unresolved concern.

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

PR quality checks and production deployment are different gates. Before releasing, prove fresh-checkout contract generation and actual Linux API/worker image builds. API TypeScript compiles contract tests that import `api-client`; do not remove those tests to make the image compile. Skipping install scripts requires explicit workspace builds and checking required dependency artifacts.

Use the migration workflow's tested Supabase CLI pin (`2.122.1` currently). `latest` changed both config compatibility and the default `db push` target. The root `db:migrate` command is unpinned and acts on the linked project; prefer the authorized release workflow until a coordinated CLI upgrade is verified.

For an approved bounded review loop, preserve one ledger across product and release fixes; never reset or exceed its cap silently. Plan capacity for deployment fixes before starting. An exhausted review budget is a distinct blocker, not a reason to ask again for release permission.

When T3 owns PR delivery, link after creating/taking over/pushing, use its PR watcher for waits, and verify the exact live head/base/checks/reviews before an authorized merge. Stop the watch before a handback. Follow a running delegate's next action; do not poll it. Reserve delegation for user- or skill-authorized work.

Report release states separately: merged → backend deployed → production build finished → submission finished → Apple processed → assigned to the intended TestFlight group. A green scheduling job or internal preview is not TestFlight availability.
