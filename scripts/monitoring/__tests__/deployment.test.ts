import { type HttpFetch } from "../save-bookmarks";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { APP_NAME, deploySpec, renderSpec } from "../deployment";
import { assertTestMarker } from "./proof-database";
import { SQL } from "bun";

const template = readFileSync(".do/monitoring-app.yml", "utf8");
const env = {
  DATABASE_URL: "postgres://postgres:fictional@db.qsqbcqkpqmkuywunxbut.supabase.co:5432/postgres?sslmode=require",
  SUPABASE_PROJECT_REF: "qsqbcqkpqmkuywunxbut", SUPABASE_URL: "https://qsqbcqkpqmkuywunxbut.supabase.co",
  MONITOR_DB_CA_PEM: "-----BEGIN CERTIFICATE-----\nZmFrZQ==\n-----END CERTIFICATE-----\n",
  GRAFANA_OTLP_ENDPOINT: "https://otlp-gateway-fictional.grafana.net/otlp", GRAFANA_OTLP_INSTANCE_ID: "123", GRAFANA_OTLP_TOKEN: 'fictional_"quote\\slash$()${x}',
  DIGITALOCEAN_REGISTRY_NAME: "fictional-registry", IMAGE_TAG: "a".repeat(40), DIGITALOCEAN_ACCESS_TOKEN: "FICTIONAL",
};
const spec = renderSpec(template, env);
const appId = "11111111-1111-4111-8111-111111111111";

test("resolved cron spec preserves literal secret bytes through JSON serialization", () => {
  const copy = JSON.parse(JSON.stringify(spec));
  expect(copy.name).toBe(APP_NAME);
  expect(copy.services).toBeUndefined();
  expect(copy.jobs).toHaveLength(1);
  expect(copy.jobs[0].schedule).toEqual({ cron: "*/15 * * * *", time_zone: "Etc/UTC" });
  expect(copy.jobs[0].image.tag).toBe(env.IMAGE_TAG);
  expect(copy.jobs[0].image.registry).toBeUndefined();
  expect(copy.jobs[0].envs.find((e: any) => e.key === "GRAFANA_OTLP_TOKEN").value).toBe(env.GRAFANA_OTLP_TOKEN);
  expect(copy.jobs[0].envs.find((e: any) => e.key === "MONITOR_DB_CA_PEM").value).toBe(env.MONITOR_DB_CA_PEM);
  expect(copy.jobs[0].envs.filter((e: any) => e.type === "SECRET").map((e: any) => e.key)).toEqual(["DATABASE_URL", "MONITOR_DB_CA_PEM", "GRAFANA_OTLP_TOKEN"]);
});
for (const edit of [{ IMAGE_TAG: "latest" }, { MONITOR_DB_CA_PEM: "" }, { SUPABASE_PROJECT_REF: "wrong" }, { GRAFANA_OTLP_ENDPOINT: "http://127.0.0.1:9009/otlp" }]) test(`invalid deployment configuration is rejected ${Object.keys(edit)[0]}`, () => {
  expect(() => renderSpec(template, { ...env, ...edit })).toThrow("deployment_");
});
test("template with an app service is rejected", () => {
  expect(() => renderSpec(`${template}\nservices:\n  - name: foreign\n`, env)).toThrow("template");
});
test("update refuses the API app without making a write", async () => {
  const methods: string[] = [];
  const fetchImpl = (async (_url: any, init: any) => { methods.push(init.method); return Response.json({ app: { id: appId, spec: { name: "cosmic-dolphin-api" } } }); }) as HttpFetch;
  await expect(deploySpec(spec, { ...env, MONITOR_DO_APP_ID: appId }, fetchImpl)).rejects.toThrow("conflict");
  expect(methods).toEqual(["GET"]);
});
test("update sends the structured spec only after confirming ownership", async () => {
  const methods: string[] = [];
  const fetchImpl = (async (url: any, init: any) => {
    expect(new URL(url).origin).toBe("https://api.digitalocean.com");
    expect(init.redirect).toBe("error");
    methods.push(init.method);
    if (init.method === "PUT") expect(JSON.parse(init.body).spec).toEqual(spec);
    return Response.json({ app: { id: appId, spec } });
  }) as HttpFetch;
  expect(await deploySpec(spec, { ...env, MONITOR_DO_APP_ID: appId }, fetchImpl)).toMatchObject({ deployment: "requested", imageTag: env.IMAGE_TAG });
  expect(methods).toEqual(["GET", "PUT"]);
});
test("create requires the explicit create selection", async () => {
  let writes = 0;
  const fetchImpl = (async () => { writes++; return Response.json({ app: { id: appId } }); }) as HttpFetch;
  await expect(deploySpec(spec, env, fetchImpl)).rejects.toThrow("not_selected");
  expect(writes).toBe(0);
  await deploySpec(spec, { ...env, MONITOR_DO_CREATE: "true" }, fetchImpl);
  expect(writes).toBe(1);
});
test("remote deployment errors expose only status", async () => {
  await expect(deploySpec(spec, { ...env, MONITOR_DO_CREATE: "true" }, (async () => new Response("SECRET VALUES", { status: 403 })) as HttpFetch)).rejects.toThrow("deployment_http_403");
});
test("fixture reset marker checks reject missing or empty markers before any mutation", async () => {
  for (const rows of [[{ present: false }], [{ present: true }, { count: 0 }], [{ present: true }, { count: 2 }]]) {
    const statements: string[] = [];
    let i = 0;
    const sql = { unsafe: async (query: string) => { statements.push(query); return [rows[i++]]; } } as unknown as SQL;
    await expect(assertTestMarker(sql)).rejects.toThrow("refusing");
    expect(statements.every((q) => q.startsWith("select"))).toBe(true);
  }
});
