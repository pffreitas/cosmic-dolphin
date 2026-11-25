# Save-bookmark checker selection

The parent and independent cross-judge selected the stateless Opus checker. It returns exact counts beyond each threshold. One threshold object controls both SQL and reports. Its tests exercise the full migration set, and its runtime needs no persistent state.

The Sol checker contributes strict URL validation, bounded health reads, and fixed failure reports. Its persistent orphan observation file is omitted. A scheduled job starts without that prior file, and a visible orphan backlog already produces a queue alert.

The parent reran the selected candidate's 59 tests against all 36 unchanged migrations and its 45 offline tests in Linux Bun 1.3.11. The exact Sol query also passed full-schema proof after its fixture needed an identity override and a Bun error-number assertion correction. Those fixture defects remain part of the evidence.

Sol finished the integration after Opus reached its usage limit, as the user selected. The final integrated checker passes its own 144 offline tests and 14 full-schema SQL tests. Actual local Grafana and Mimir verification covers the complete generated assets and alert recovery. Parent review made the queue journey clock and SQL sample-size parameter explicit and removed redundant comments.

Candidate and local integration proofs do not establish live production availability. The new Grafana Free stack, production credentials, TLS/pooler/grants, recipient routing, and received notification remain activation checks. See [verification.md](verification.md) and the [activation runbook](../../runbooks/save-bookmark-monitoring.md).
