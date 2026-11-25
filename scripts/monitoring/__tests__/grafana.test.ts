import { expect, test } from "bun:test";
import { assetConfig, applyAssets, encodeAssets, generateAssets, OWNED, provisioningTarget, type Assets } from "../grafana";
import { RULES, type HttpFetch } from "../save-bookmarks";
import { proofUrls } from "./proof-database";
const config = assetConfig({ GRAFANA_DATASOURCE_UID: "proof-prom", GRAFANA_RECEIVER: "empty", MONITOR_METRICS_ENVIRONMENT: "local" });
const assets = generateAssets(config);
const target = { origin: "http://127.0.0.1:32768", authorization: "Bearer FICTIONAL" };

function receiver(existing: Record<string, unknown> = {}) {
  const calls: { method: string; path: string; body: any }[] = [];
  const fetchImpl = (async (url: any, init: any) => {
    const path = new URL(url).pathname;
    calls.push({ method: init.method, path, body: init.body ? JSON.parse(init.body) : null });
    expect(init.redirect).toBe("error");
    if (init.method !== "GET") return Response.json({ ok: true });
    if (path.endsWith("receivers")) return Response.json({ items: [{ spec: { title: "empty" } }] });
    if (path.includes("datasources")) return Response.json({ type: "prometheus" });
    if (Object.hasOwn(existing, path)) return Response.json(existing[path]);
    return Response.json({}, { status: 404 });
  }) as HttpFetch;
  return { calls, fetchImpl };
}

test("generation is deterministic and derives all seven codes with safe alert defaults", () => {
  expect(encodeAssets(assets)).toBe(encodeAssets(generateAssets(config)));
  expect(assets.dashboard.panels[1].targets).toHaveLength(2);
  expect(assets.rules.map((r) => r.spec.labels.code)).toEqual([...RULES.map((r) => r.code), "missing_observer"]);
  for (const r of assets.rules) {
    expect(r.spec.noDataState).toBe("Alerting");
    expect(r.spec.execErrState).toBe("Error");
    expect(r.spec.for).toBe("1m");
    expect(r.spec.notificationSettings.receiver).toBe("empty");
    expect(r.spec.notificationSettings.repeatInterval).toBe("4h");
    expect(r.spec.expressions.A.model.expr).toContain("[45m]");
    expect(r.spec.annotations.runbook_url).toContain("save-bookmark-monitoring.md#");
  }
});
test("apply preflights every owned UID and never writes receivers or policies", async () => {
  const r = receiver();
  expect(await applyAssets(assets, target, r.fetchImpl)).toMatchObject({ rules: 8 });
  const writes = r.calls.filter((c) => c.method !== "GET");
  expect(writes).toHaveLength(10);
  expect(writes.some((c) => /receivers|routingtrees/.test(c.path))).toBe(false);
  expect(r.calls.slice(0,12).every((c) => c.method === "GET")).toBe(true);
});
test("rerun uses each rule resourceVersion and dashboard version", async () => {
  const existing: Record<string, unknown> = { [`/api/folders/${OWNED.folder}`]: assets.folder, [`/api/dashboards/uid/${OWNED.dashboard}`]: { meta: { folderUid: OWNED.folder }, dashboard: { ...assets.dashboard, id: 4, version: 3 } } };
  for (const rule of assets.rules) existing[`/apis/rules.alerting.grafana.app/v1beta1/namespaces/default/alertrules/${rule.metadata.name}`] = { ...rule, metadata: { ...rule.metadata, resourceVersion: "5" } };
  const r = receiver(existing);
  await applyAssets(assets, target, r.fetchImpl);
  const updates = r.calls.filter((c) => c.method === "PUT");
  expect(updates).toHaveLength(8);
  expect(updates.every((c) => c.body.metadata.resourceVersion === "5")).toBe(true);
  expect(r.calls.find((c) => c.method === "POST")?.body.dashboard.version).toBe(3);
});
for (const kind of ["folder", "dashboard", "rule"]) test(`foreign ${kind} UID prevents every write`, async () => {
  const path = kind === "folder" ? `/api/folders/${OWNED.folder}` : kind === "dashboard" ? `/api/dashboards/uid/${OWNED.dashboard}` : `/apis/rules.alerting.grafana.app/v1beta1/namespaces/default/alertrules/${assets.rules[0].metadata.name}`;
  const r = receiver({ [path]: {} });
  await expect(applyAssets(assets, target, r.fetchImpl)).rejects.toThrow("conflict");
  expect(r.calls.every((c) => c.method === "GET")).toBe(true);
});
test("HTTP failures discard remote secret text", async () => {
  await expect(applyAssets(assets, target, (async () => new Response("SECRET", { status: 401 })) as HttpFetch)).rejects.toThrow("grafana_http_401");
});
test("Cloud apply rejects placeholders, wrong namespace, local environment and redirect URLs", () => {
  const cloud = { GRAFANA_URL: "https://fictional.grafana.net", GRAFANA_SERVICE_ACCOUNT_TOKEN: "FICTIONAL" };
  expect(() => provisioningTarget(cloud, config)).toThrow("namespace");
  expect(() => provisioningTarget(cloud, { ...config, namespace: "stacks-123" })).toThrow("namespace");
  expect(() => provisioningTarget({ ...cloud, GRAFANA_URL: "https://fictional.grafana.net/?token=x" }, config)).toThrow("url");
  expect(() => provisioningTarget({ ...cloud, GRAFANA_URL: target.origin }, { ...config, environment: "production" })).toThrow("environment");
  expect(() => provisioningTarget({ ...cloud, GRAFANA_URL: target.origin }, config)).not.toThrow();
});
test("proof URL requires exact owned target and refuses shared DB or tunneled paths", () => {
  const env = { MONITOR_IT_ADMIN_URL: "postgres://admin:fictional@127.0.0.1:49960/postgres", MONITOR_IT_DATABASE_URL: "postgres://checker:fictional@127.0.0.1:49960/postgres" };
  expect(() => proofUrls(env)).toThrow("non-owned");
  expect(proofUrls({ ...env, MONITOR_IT_OWNED_TARGET: "127.0.0.1:49960" })).not.toBeNull();
  for (const url of ["postgres://checker@127.0.0.1:5433/postgres", "postgres://checker@127.0.0.1:49961/postgres", "postgres://checker@127.0.0.1:49960/production", "postgres://checker@127.0.0.1:49960/postgres?host=other"]) expect(() => proofUrls({ ...env, MONITOR_IT_OWNED_TARGET: "127.0.0.1:49960", MONITOR_IT_DATABASE_URL: url })).toThrow();
});
