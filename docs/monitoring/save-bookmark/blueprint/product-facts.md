# Architecture blueprint source facts

This artifact explains implementation `14ade67810e155dfbea33d2b0f5ffa02d94beee9` in PR #260. It does not redesign the system or read production telemetry.

- The API creates a bookmark and queues processing in one transaction through the shared bookmark service; budget-deferred saves stay idle. Source: `apps/api/src/routes/bookmarks.ts` and `packages/shared/src/services/bookmark.service.ts`.
- The worker consumes pgmq and writes processing results. The observer queries `public.bookmarks` and `pgmq.q_bookmarks` in a bounded read-only transaction. Source: `scripts/monitoring/save-bookmarks.ts`.
- Alert thresholds, summaries, severities, metric definitions, and asset counts were exported directly from the monitoring modules. Illustrative failure scenarios carry no live counts or production data.
- DigitalOcean scheduled jobs support cron with a minimum 15-minute cadence. Official source checked 2026-11-25: https://docs.digitalocean.com/products/app-platform/how-to/manage-jobs/
- Grafana Cloud accepts OpenTelemetry data through its OTLP endpoint. Official source checked 2026-11-25: https://grafana.com/docs/grafana-cloud/send-data/otlp/send-data-otlp/
- The checked-in workflow activates manually on main; provisioning reads the existing receiver/data source and manages fixed owned UIDs. Live production TLS/pooler/grants and notification delivery remain unverified.

## Asset provenance

The self-contained HTML embeds real organization avatars, fetched from the brands' GitHub organization URLs on 2026-11-25. They identify diagram components. It depicts no vendor product UI or marketing mockup.

- Supabase: https://github.com/supabase.png (PNG). Official brand reference: https://supabase.com/brand
- Grafana: https://github.com/grafana.png (JPEG).
- DigitalOcean: https://github.com/digitalocean.png (PNG).

The technical diagram uses the host's theme variables, system sans/mono fonts, solid application paths, dashed observation paths, and a distinct telemetry path. It uses no live data, external script, font service, API call, or account signup. Open `architecture.html` directly; no server is required.
