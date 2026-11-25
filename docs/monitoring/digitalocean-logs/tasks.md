# DigitalOcean logs in Grafana

| Current state | Value |
| --- | --- |
| Outcome | The receiver, deployment assets, source-release hooks, and log dashboard are built. `doctl` 2.6.0 browser OAuth succeeded in the dedicated context. The existing Grafana publisher accepts logs; a setup log is readable through Loki. The dashboard is provisioned with its heartbeat rule staged. |
| Next gate | Complete review, deploy the receiver, and verify native forwarding from every source before enabling the heartbeat rule. |
| Owner | This thread owns configuration, delivery, and live verification. |
| Blocker | No access blocker. Production log forwarding is not enabled yet. |
| Starting state | Branch `activate-save-monitoring`, base and live `origin/main` `08bef9224c8cbdedf4f14ca75c866eb04c62b94a`. Existing monitoring activation/incident documentation changes are preserved. |
| Delivery branch | `integrate-digitalocean-logs`, updated without conflicts to live main `f312e01dc0a871221e7d99b27ad0f80267cdad57` before review. |

## Scope and completion gate

Forward production API, worker, web, and save-monitor runtime logs to the existing Grafana Cloud stack. Keep labels bounded by source and environment. Preserve useful error and queue context while redacting credentials and private payload fields. Provide searches and a dashboard that connect the save-journey alerts with runtime logs. No bookmark repair or worker code change belongs to this task.

Completion requires a real forwarded runtime log readable through Grafana Loki for each configured source, verified authentication and failure handling, and recorded source configuration that survives later app deployments. Confirm that an upstream ingestion failure is not acknowledged as successful delivery. Record limits of platform retention, runtime-only forwarding, and redaction.

## Transport decision to verify

DigitalOcean's native App Platform log destinations support Datadog HTTP intake with a configurable endpoint, but no direct Loki destination. A small compatible receiver translates native pushes to Grafana OTLP logs. This avoids deploying a DigitalOcean account credential in the receiver or polling recent log snapshots. DigitalOcean accepted a read-only proposal with the custom destination; actual native delivery remains the activation gate.

The data shape is `authenticated source → bounded Datadog batch → normalized/redacted log records → OTLP logs acknowledgement`. Source keys map to the fixed names `api`, `worker`, `web`, and `save-monitor`. The receiver acknowledges only after Grafana accepts the batch. Authentication and transport errors have fixed codes; raw response bodies and keys stay out of its logs.

## Work sequence

1. Complete scoped DigitalOcean sign-in and inventory the production apps without exposing environment values.
2. Verify the forwarding contract and build a bounded receiver with offline transport, redaction, and delivery tests.
3. Prepare reproducible receiver deployment and guarded source configuration, preserving all other live app settings.
4. Configure Grafana log searches/dashboard and bridge health visibility.
5. Activate and verify live delivery, source coverage, and failure/recovery behavior. Record exact deployed versions and remaining gaps.

## Current evidence

- The four production apps are `ACTIVE`. Their existing image versions were recorded before configuration changes. API, worker, and web use `0a0784e1cbb5c81c287eaa69442f23d43d59f568`; save-monitor uses `08bef9224c8cbdedf4f14ca75c866eb04c62b94a`.
- The existing worker's retained logs show both queues starting with concurrency 5 and order `default`, then `bookmarks`, without a recorded queue-read error. This supports the separate dispatcher diagnosis; logging rollout does not repair it.
- The bridge passed 23 tests and 224 assertions inside its exact pinned Bun 1.3.11 Linux image. The actual Dockerfile CMD and `/health` smoke passed with external network disabled. Deployment/source-overlay tests passed on pinned Bun separately.
- Grafana accepted a labeled setup log and returned it through `grafanacloud-logs`. Resource labels normalize to `service_name` and `deployment_environment_name`.
- Grafana has the new 12-panel dashboard. Its heartbeat rule remains staged until a real receiver heartbeat arrives.
- The new `log-observability-production` environment holds the publisher and source-key map. Four matching source-key repository secrets are configured. No keys are recorded here.
- Primary `godo` source confirms the bridge update field is `update_all_source_versions`. It refreshes only the owned receiver's source. Live source-app log overlays preserve their image versions.
- The DigitalOcean API accepted the new receiver proposal and reports a $5 monthly app cost. This is separate from the existing Grafana stack. No receiver has been created yet.
- All 71 host tests pass with 884 assertions. The Grafana suite also passes on pinned Linux Bun 1.3.11. All eleven generated dashboard queries execute against Cloud Loki; source results are currently empty because native forwarding is not enabled.

## Review ledger

The standalone Sol review cap is three rounds across implementation and activation fixes. Comment cleanup precedes review. Existing monitoring implementation reviews belong to the earlier merged feature; they are not approval of this extension.

| Round | Model | Scope | Outcome |
| --- | --- | --- | --- |
| 1 | GPT-6.1 Sol | Full log integration on base `f312e01d`, including uncommitted files | CHANGES. S1 monitoring tests ran after template mutation; S2 existing secret-bearing templates retained 0644 permissions. Both fixed; recheck pending |
| 2 | GPT-6.1 Sol | Changed monitoring gate order and private spec writer | APPROVE. S1 and S2 independently resolved. Candidate approved for controlled activation; native delivery remains open |

Comment review removed 16 narrative blocks without changing runtime behavior. Its two accepted design findings are encoded by one named request ceiling shared with the native parser, and an explicit `stageAssets` factory. The staging factory keeps canonical enabled/staged assets distinct without adding mutable mode state or a bypass option to the provisioner.

S1 proof replays the actual three non-network monitoring workflow steps in an owned temporary checkout with fictional production-shaped configuration. All 144 offline tests pass before the overlay, the overlay succeeds, and the combined spec/config checks pass afterwards. No deployment or business-network step runs. S2 has a CLI regression test that overwrites an existing 0644 template, proves 0600 permissions and unchanged key bytes, and refuses a symlink without leaking its key.

## Sources

- [DigitalOcean log forwarding](https://docs.digitalocean.com/products/app-platform/how-to/forward-logs/)
- [DigitalOcean app specification](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)
- [doctl browser OAuth](https://docs.digitalocean.com/reference/doctl/reference/auth/login/)
- [Grafana OTLP ingestion](https://grafana.com/docs/grafana-cloud/send-data/otlp/send-data-otlp/)
