import { describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bridgeUrl, SOURCE_COMPONENTS, withLogForwarding, type LogSource } from "../app-spec";

const env = { GRAFANA_LOG_BRIDGE_URL: "https://cosmic-log-bridge-proof.ondigitalocean.app", LOG_FORWARDING_KEY: "a".repeat(43) };
const files = { api: "api-app.yml", worker: "worker-app.yml", web: "web-app.yml", "save-monitor": "monitoring-app.yml" };
const specFor = (source: LogSource) => Bun.YAML.parse(readFileSync(new URL(`../../../.do/${files[source]}`, import.meta.url), "utf8")) as Record<string, any>;

describe("owned source log forwarding", () => {
  for (const source of Object.keys(SOURCE_COMPONENTS) as LogSource[]) {
    test(`${source}: adds only the owned destination and preserves every other setting`, () => {
      const original = specFor(source);
      const before = structuredClone(original);
      const { spec, configured } = withLogForwarding(original, source, env);
      expect(configured).toBe(true);
      const group = SOURCE_COMPONENTS[source].group;
      const component = (spec[group] as any[])[0];
      expect(component.log_destinations).toEqual([{ name: "cosmic-grafana-logs", datadog: { endpoint: env.GRAFANA_LOG_BRIDGE_URL, api_key: env.LOG_FORWARDING_KEY } }]);
      delete component.log_destinations;
      expect(spec).toEqual(before);
      expect(original).toEqual(before);
    });
  }

  test("preserves encrypted environment values and other providers on repeated updates", () => {
    const original = specFor("api");
    original.envs.push({ key: "PRIVATE", type: "SECRET", value: "EV[sealed:unchanged]" });
    original.services[0].log_destinations = [{ name: "existing-provider", logtail: { token: "sealed-other" } }];
    const once = withLogForwarding(original, "api", env).spec;
    const twice = withLogForwarding(once, "api", env).spec;
    expect(twice).toEqual(once);
    expect((twice.envs as any[]).at(-1).value).toBe("EV[sealed:unchanged]");
    expect((twice.services as any[])[0].log_destinations[0]).toEqual(original.services[0].log_destinations[0]);
  });

  test("unconfigured deployments preserve the exact source spec", () => {
    const original = specFor("worker");
    expect(withLogForwarding(original, "worker", {})).toEqual({ spec: original, configured: false });
  });

  test("partial config, wrong apps, missing components, and foreign ownership fail closed", () => {
    expect(() => withLogForwarding(specFor("api"), "api", { GRAFANA_LOG_BRIDGE_URL: env.GRAFANA_LOG_BRIDGE_URL })).toThrow("logs_config_missing_or_invalid");
    expect(() => withLogForwarding(specFor("worker"), "api", env)).toThrow("logs_app_conflict");
    const missing = specFor("api"); missing.services = [];
    expect(() => withLogForwarding(missing, "api", env)).toThrow("logs_component_conflict");
    const foreign = specFor("api"); foreign.services[0].log_destinations = [{ name: "cosmic-grafana-logs", datadog: { endpoint: "https://other.example" } }];
    expect(() => withLogForwarding(foreign, "api", env)).toThrow("logs_destination_conflict");
  });

  test("rejects endpoint credential leakage, query/fragment, paths, insecure hosts, and lookalikes", () => {
    for (const invalid of ["http://cosmic-log-bridge-proof.ondigitalocean.app", "https://cosmic-log-bridge-proof.ondigitalocean.app.evil.test", env.GRAFANA_LOG_BRIDGE_URL + "/api/v2/logs", env.GRAFANA_LOG_BRIDGE_URL + "?key=secret", env.GRAFANA_LOG_BRIDGE_URL + "#fragment", "https://user:pass@cosmic-log-bridge-proof.ondigitalocean.app", "https://cosmic-log-bridge-proof.ondigitalocean.app:8443"])
      expect(() => bridgeUrl(invalid)).toThrow("logs_bridge_url_invalid");
  });

  test("CLI makes an existing template private before writing a forwarding key and refuses symlinks", () => {
    const directory = mkdtempSync(join(tmpdir(), "log-spec-private-"));
    const file = join(directory, "api.yml");
    const script = new URL("../app-spec.ts", import.meta.url).pathname;
    const execute = (path: string) => Bun.spawnSync([process.execPath, "--no-env-file", script, "--file", path, "--source", "api"], {
      env: { ...process.env, ...env }, stdout: "pipe", stderr: "pipe",
    });
    try {
      writeFileSync(file, JSON.stringify(specFor("api")));
      chmodSync(file, 0o644);
      const written = execute(file);
      expect(written.exitCode).toBe(0);
      expect(statSync(file).mode & 0o777).toBe(0o600);
      expect(JSON.parse(readFileSync(file, "utf8")).services[0].log_destinations[0].datadog.api_key).toBe(env.LOG_FORWARDING_KEY);
      expect(written.stdout.toString()).not.toContain(env.LOG_FORWARDING_KEY);
      const link = join(directory, "linked.yml");
      const before = readFileSync(file, "utf8");
      symlinkSync(file, link);
      const refused = execute(link);
      expect(refused.exitCode).toBe(2);
      expect(readFileSync(file, "utf8")).toBe(before);
      expect(refused.stderr.toString()).not.toContain(env.LOG_FORWARDING_KEY);
    } finally { rmSync(directory, { recursive: true }); }
  });
});
