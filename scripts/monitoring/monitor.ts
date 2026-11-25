#!/usr/bin/env bun
/**
 *   bun --no-env-file scripts/monitoring/monitor.ts [--fixture snapshot.json] [--report out.json] [--summary out.md] [--publish [--publish-log]]
 *   bun --no-env-file scripts/monitoring/monitor.ts --check-config [--publish]
 *
 * Exit 0 ok, 1 alerting, 2 monitoring_failed, 3 delivery_failed. The JSON
 * report goes to stdout; metric and optional log delivery results go to stderr.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  evaluate,
  observeApi,
  observeDatabase,
  parseFixture,
  renderSummary,
  resolveTarget,
  type Env,
  type HttpFetch,
  type FailureReason,
  type Report,
  type Snapshot,
  type TargetKind,
} from "./save-bookmarks";
import { deliver, resolveOtlpTarget, samplesFor, type Delivery } from "./telemetry";
import { publishLog } from "./logs";

export const EXIT = { ok: 0, alerting: 1, monitoring_failed: 2, delivery_failed: 3 } as const;

export interface Deps {
  env: Env;
  readFile: (path: string) => string;
  writeFile: (path: string, text: string) => void;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  observeApi: typeof observeApi;
  observeDatabase: typeof observeDatabase;
  fetch: HttpFetch;
  now: () => number;
}

interface Args {
  fixture?: string;
  report?: string;
  summary?: string;
  publish: boolean;
  publishLog: boolean;
  checkConfig: boolean;
}

const VALUE_FLAGS = new Map<string, "fixture" | "report" | "summary">([
  ["--fixture", "fixture"],
  ["--report", "report"],
  ["--summary", "summary"],
] as const);

export function parseArgs(argv: readonly string[]): Args | null {
  const args: Args = { publish: false, publishLog: false, checkConfig: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--publish" || flag === "--publish-log" || flag === "--check-config") {
      const key = flag === "--publish" ? "publish" : flag === "--publish-log" ? "publishLog" : "checkConfig";
      if (args[key]) return null;
      args[key] = true;
      continue;
    }
    const key = VALUE_FLAGS.get(flag);
    const value = argv[i + 1];
    if (!key || args[key] !== undefined || value === undefined || value.startsWith("--")) return null;
    args[key] = value;
    i++;
  }
  if (args.checkConfig && (args.fixture || args.report || args.summary)) return null;
  if (args.publishLog && !args.publish) return null;
  return args;
}

const failedSnapshot = (failure: FailureReason, target: TargetKind, nowMs: number): Snapshot => ({
  observedAt: new Date(nowMs).toISOString(),
  target,
  api: { state: "not_observed" },
  database: { state: "failed", failure },
});

async function snapshotFor(args: Args, deps: Deps): Promise<Snapshot> {
  if (args.fixture !== undefined) {
    let text: string;
    try {
      text = deps.readFile(args.fixture);
    } catch {
      return failedSnapshot("fixture_invalid", "fixture", deps.now());
    }
    return parseFixture(text) ?? failedSnapshot("fixture_invalid", "fixture", deps.now());
  }
  const resolved = resolveTarget(deps.env);
  if (!resolved.ok) return failedSnapshot(`target_${resolved.reason}`, "unresolved", deps.now());
  const { target } = resolved;
  const [api, db] = await Promise.all([deps.observeApi(target.apiHealthUrl), deps.observeDatabase(target)]);
  return { observedAt: db.observedAt, target: target.kind, api, database: db.database };
}

async function publish(report: Report, deps: Deps): Promise<Delivery> {
  const otlp = resolveOtlpTarget(deps.env, report.target);
  if (!otlp.ok) return { ok: false, failure: `config_${otlp.reason}` };
  const now = deps.now();
  try {
    return await deliver(samplesFor(report, now), otlp.target, deps.fetch, now);
  } catch {
    return { ok: false, failure: "unreachable" };
  }
}

function checkConfig(args: Args, deps: Deps): number {
  const target = resolveTarget(deps.env);
  const problems: string[] = target.ok ? [] : [`target_${target.reason}`];
  const kind = target.ok ? target.target.kind : "unresolved";
  if (args.publish) {
    const otlp = resolveOtlpTarget(deps.env, kind);
    if (!otlp.ok) problems.push(`delivery_${otlp.reason}`);
  }
  deps.stdout(`${JSON.stringify(problems.length > 0 ? { config: "invalid", problems } : { config: "ok", target: kind, publish: args.publish })}\n`);
  return problems.length > 0 ? EXIT.monitoring_failed : EXIT.ok;
}

const json = (report: Report) => `${JSON.stringify(report, null, 2)}\n`;

export async function main(argv: readonly string[], deps: Deps): Promise<number> {
  const args = parseArgs(argv);
  if (args?.checkConfig) return checkConfig(args, deps);

  let report: Report;
  try {
    report = evaluate(args ? await snapshotFor(args, deps) : failedSnapshot("usage_invalid", "unresolved", deps.now()));
  } catch {
    report = evaluate(failedSnapshot("checker_failed", "unresolved", deps.now()));
  }
  const delivery = args?.publish ? await publish(report, deps) : null;
  const logDelivery = args?.publishLog ? await publishLog(report, deps.env, deps.fetch, deps.now()) : null;

  const write = (r: Report) => {
    if (args?.report) deps.writeFile(args.report, json(r));
    if (args?.summary) deps.writeFile(args.summary, renderSummary(r));
  };
  try {
    write(report);
  } catch {
    report = evaluate(failedSnapshot("output_failed", report.target, deps.now()));
    try {
      write(report);
    } catch {
    }
  }
  deps.stdout(json(report));
  if (delivery) deps.stderr(`${JSON.stringify(delivery.ok ? { delivery: "ok", series: delivery.series } : { delivery: "failed", reason: delivery.failure })}\n`);
  if (logDelivery) deps.stderr(`${JSON.stringify(logDelivery.ok ? { logDelivery: "ok", records: logDelivery.records } : { logDelivery: "failed", reason: logDelivery.failure })}\n`);
  return (delivery && !delivery.ok) || (logDelivery && !logDelivery.ok) ? EXIT.delivery_failed : EXIT[report.status];
}

if (import.meta.main) {
  let code: number = EXIT.monitoring_failed;
  try {
    code = await main(process.argv.slice(2), {
      env: process.env,
      readFile: (path) => readFileSync(path, "utf8"),
      writeFile: (path, text) => writeFileSync(path, text, { mode: 0o600 }),
      stdout: (text) => process.stdout.write(text),
      stderr: (text) => process.stderr.write(text),
      observeApi,
      observeDatabase,
      fetch,
      now: Date.now,
    });
  } catch {
    try {
      process.stdout.write('{"schemaVersion":1,"status":"monitoring_failed","observations":{"database":"checker_failed"}}\n');
    } catch {
    }
  }
  process.exitCode = code;
}
