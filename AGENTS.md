# Cosmic Dolphin Development Guide

## Build/Test Commands
- **Go**: `make build`, `make test`, `go test ./cosmicdolphin -v` (single package)
- **Node.js**: `npm run build`, `npm run test`, `npm run lint`
- **API**: `npm run dev --workspace=packages/api`, `npm run test --workspace=packages/api`
- **Worker**: `npm run start:dev --workspace=packages/worker`, `npm run test --workspace=packages/worker`

## Project Structure
- Hybrid monorepo: Go microservice + Node.js packages (API/Worker)
- Go uses Gorilla Mux for HTTP, PostgreSQL + River for background jobs
- TypeScript uses Fastify (API) and NestJS (Worker)

## Code Style
- **Go**: Standard Go conventions, package-scoped imports, receiver methods for models
- **TypeScript**: ESLint + Prettier, explicit typing, async/await patterns
- **Naming**: Go uses PascalCase exports, camelCase locals; TS uses camelCase
- **Error Handling**: Go uses explicit error returns; TS uses try/catch with proper logging

## Development Rules
- Before major changes, create a development plan in `docs/plan` (.cursor/rules requirement)
- Use PostgreSQL for data persistence and River for background job processing
- Follow existing patterns in each language/framework for consistency