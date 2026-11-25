# Runtime log bridge

Dependency-free Bun HTTP receiver for DigitalOcean App Platform's configurable
Datadog destination. It converts an authenticated batch into Grafana OTLP logs.
Application source code and DigitalOcean credentials are not needed by the bridge.

The custom endpoint root, Datadog v2 path, and legacy v1 path accept authenticated
JSON. Gzip requests have separate wire and expanded byte caps under the same
request deadline. Unsupported encodings and malformed compressed bodies reject.

```sh
bun test scripts/log-forwarding/__tests__/bridge.test.ts
bun run scripts/log-forwarding/main.ts
# Build from the repository root after inventorying the Docker context.
docker build -f scripts/log-forwarding/Dockerfile -t cosmic-log-bridge .
```

## Configuration

Supply secrets through the deployment environment, never command-line arguments.

| Variable | Requirement/default |
| --- | --- |
| `LOG_SOURCE_KEYS_JSON` | Nonempty JSON object mapping only `api`, `worker`, `web`, `save-monitor` to unique 32–256-character printable ASCII keys. Use independent random 32-character hex keys for native Datadog compatibility. |
| `GRAFANA_OTLP_ENDPOINT` | Exact `https://otlp-gateway-*.grafana.net/otlp` base, without credentials, port, query or fragment. |
| `GRAFANA_OTLP_INSTANCE_ID` | Numeric Grafana OTLP instance ID. |
| `GRAFANA_OTLP_TOKEN` | Grafana publisher token with logs ingestion scope. |
| `PORT` | `8080`; local fixtures can use `0` for an ephemeral port. |
| `LOG_BRIDGE_ENVIRONMENT` | `production`; `local` requires loopback HTTP OTLP and `LOG_ALLOW_LOCAL_FIXTURE=true`. Local mode cannot target Grafana Cloud. |
| `LOG_MAX_REQUEST_BYTES` | 5,242,880 bytes (5 MiB), upper bound 5 MiB. |
| `LOG_MAX_RECORDS` | 1,000, upper bound 1,000. |
| `LOG_MAX_LINE_BYTES` | 65,536; upper bound 131,072. Counts the entire serialized UTF-8 event, including escaped message and context. |
| `LOG_MAX_CONCURRENT_REQUESTS` | 4; upper bound 4. Reading and upstream delivery share the slot; overload has no queue. |
| `LOG_REQUEST_TIMEOUT_MS` / `LOG_UPSTREAM_TIMEOUT_MS` | 10,000 each; upper bound 30,000 each. |
| `LOG_HEARTBEAT_INTERVAL_MS` | 60,000; allowed 1,000–3,600,000. |

`Dockerfile` pins `oven/bun:1.3.11-alpine`, copies only the four bridge runtime
modules, installs no dependencies and runs as the image's `bun` user.

## Intake and acknowledgement

`POST /`, `POST /api/v2/logs` accepts a JSON list or one JSON event. A supplied
`message` must be a string. Native events without `message`, including blank-line
events, retain their redacted structured JSON body instead of rejecting the batch.
`POST /v1/input/<key>` and `/v1/input` accept the same shapes. Keys can be supplied
via the case-insensitive `DD-API-KEY` header; legacy `api_key` and `dd-api-key`
query spellings are supported. Every supplied credential must map to the same
source; conflicting keys fail. Prefer the header when the native sender supports
it, because path/query secrets can appear in infrastructure access logs outside
the bridge's control. Keys are compared using fixed-size SHA-256 digests and
constant-time comparisons across all configured sources.

Only `application/json` with optional UTF-8 charset is accepted. Unsupported encodings,
NDJSON, non-object events, non-string supplied messages, malformed UTF-8, invalid JSON,
empty batches and any invalid event fail the whole request. Byte, event count,
serialized event size, request deadline and concurrency limits apply before OTLP
delivery. Body timeout/size errors request connection closure.

Native success is `202 {"accepted":N}` only after Grafana responds with `204`,
or a successful JSON acknowledgement with no rejected log records. Positive
`partialSuccess.rejectedLogRecords`, malformed/oversized acknowledgements,
redirects and delivery failures return fixed `502`/`503` errors. There is one
upstream attempt, no durable buffer and no internal retry. Native retry behavior
and retention are platform concerns to verify live; a retried partially accepted
batch can duplicate its accepted records. Upstream error bodies, request URLs,
payloads and keys are never printed by the bridge.

## Log shape and privacy

Only four fixed resource labels are sent: `service.name` (authenticated
`cosmic-dolphin-{source}`), `deployment.environment.name`, `cloud.provider` and
`cloud.platform`. Untrusted event service/tag fields do not become labels. A
timestamp is taken from valid event `timestamp`, `@timestamp`, `time`, or embedded
Pino JSON timestamp/time, otherwise receive time; observed receive time is always
included. Severity comes from structured fields/Pino levels or standard
Nest/plain log prefixes, with INFO as the fallback. Sanitized messages, embedded
JSON, stack traces and common queue/error context remain in the log body.

Structured credential/auth/cookie/password/token/connection fields and private
request bodies, headers, content, title, user, email and URL fields are redacted.
Common plaintext credential assignments, bearer/basic credentials, JWT/known
token forms, scheme URLs and emails are scrubbed; configured source/Grafana keys
are also removed literally. ANSI escape sequences are stripped. Structured data
is capped at six nesting levels, 64 fields per object and 32 entries per array.

Structured `bookmarkId`/`bookmark_id`, `requestId`/`request_id` and `reqId`/`req_id`
survive **only in the body** when they are UUIDs, 16–128-character hex IDs,
Fastify `req-<base36>` IDs, or safe nonnegative integers. Other values in those
fields redact. User identifiers still redact. No correlation identifier is a
resource or log attribute. Arbitrary free-form private prose or unfamiliar
credential formats cannot be guaranteed safe by this scrubber; producers should
avoid emitting private payloads in the first place.

`GET /health` reports only `{"status":"process_up"}`. It says nothing about
Grafana acceptance. Startup and periodic OTLP heartbeats use their own fixed
`service.name=cosmic-log-bridge` and body event `log_bridge_heartbeat`, with bounded
accepted/rejected/delivery-failure counters. `lastRejection` contains only fixed
reason, route, encoding, status and source categories, never raw paths, headers,
keys or payloads. Heartbeat delivery bypasses native
forwarding; do not configure the bridge as one of its own forwarded sources.

## Compatibility proof boundary

Local fixtures verify HTTP transport and OTLP acknowledgements. DigitalOcean's
configurable Datadog endpoint/API-key fields are the intended native transport;
sender batching, authentication placement, payload shape, retry/retention and
actual source coverage require live verification before calling this integration
complete. Native DigitalOcean runtime lines are reported to truncate at 2,048
bytes, but that does not prove the sender's batch shape or size. Local fixtures
must never be reported as native delivery or Grafana query proof.
