# Receiver implementation evidence

- Owner: receiver delegate; parent owns native DigitalOcean/Grafana configuration,
  app-spec overlays, workflows, docs/dashboard and live checks.
- Starting branch: `activate-save-monitoring`.
- Starting SHA: `08bef9224c8cbdedf4f14ca75c866eb04c62b94a`.
- Starting dirty files: existing save-monitor tasks/verification/runbook changes,
  DigitalOcean monitoring docs and a production-incident document. Preserved.
- Receiver changes are confined to `scripts/log-forwarding/`; no production
  requests, credentials, commits, pushes or deployments were performed here.

## Runs and corrections

1. Initial HTTP suite: **16 pass / 1 fail** on Bun **1.3.13**. Failure: a stalled
   incoming upload correctly timed out, but the following pooled client request
   received an empty native 400 response.
2. Added `Connection: close` on body timeout/size errors. Repeat: **17 pass / 1
   fail** (including new 204 ACK proof). The dangling Bun chunked upload still
   affected its client's pooled connection.
3. Targeted recovery runs retained the original timeout and recovery assertions.
   Stopping the unfinished upload alone did not fix the pooled-client artifact.
   Disabling reuse for that stalled-upload fixture (`keepalive:false`) plus
   aborting its upload proved a fresh HTTP request recovers immediately. Targeted
   result: **1 pass / 0 fail**. The application deadline was not increased.
4. Added process-entrypoint checks for fixed configuration errors, direct startup
   and periodic heartbeat delivery, and graceful termination: **21 pass / 0 fail**.
5. Aligned Datadog bounds with the parent's decision (5 MiB, 1,000 events, four
   inflight) and proved an actual 1,000-event HTTP batch exceeding 1 MiB:
   **22 pass / 0 fail**.
6. Preserved narrowly validated opaque bookmark/request IDs in log bodies, with
   private user/content/auth fields still redacted and no identifier labels:
   **23 pass / 0 fail**, **224 assertions**, Bun **1.3.13**.

Command: `bun test scripts/log-forwarding/__tests__/bridge.test.ts`.

This proves local real HTTP authentication and source mapping, wire/event/UTF-8/
batch/concurrency/deadline bounds, v2/v1 shapes, timestamp/severity handling,
redaction and stack preservation, body-only correlation IDs, blocked redirects,
network and partial rejection, held/204/JSON acknowledgements, process-only health
and direct periodic heartbeat. The Dockerfile pins Bun **1.3.11-alpine**; an image
build/runtime proof is a separate gate. Native DigitalOcean payload delivery and
all-source Loki readback remain the parent's next live gates.
