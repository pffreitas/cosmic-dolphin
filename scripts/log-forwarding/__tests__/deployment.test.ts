import { describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APP_NAME, deploySpec, renderSpec, type HttpFetch } from "../deployment";

const template = readFileSync(".do/log-forwarding-app.yml", "utf8");
const appId = "11111111-1111-4111-8111-111111111111";
const env = {
  GRAFANA_OTLP_ENDPOINT: "https://otlp-gateway-fictional.grafana.net/otlp",
  GRAFANA_OTLP_INSTANCE_ID: "123456", GRAFANA_OTLP_TOKEN: 'fictional_"quote\\slash$()${x}`punctuation',
  LOG_SOURCE_KEYS_JSON: JSON.stringify({ api: "a".repeat(32), worker: "b".repeat(32), web: "c".repeat(32), "save-monitor": "d".repeat(32) }, null, 2),
  LOG_BRIDGE_BRANCH: "main", DIGITALOCEAN_ACCESS_TOKEN: "FICTIONAL_DO_TOKEN",
};
const spec = () => renderSpec(template, env);
const service = (value: any) => value.services[0];
const reply = (value: any = spec()) => Response.json({ app: { id: appId, spec: value } });

describe("isolated Git-source bridge spec", () => {
  test("has one public service, fixed source/size, and exactly six runtime env values", () => {
    const rendered: any = spec();
    expect(rendered.name).toBe(APP_NAME);
    expect(rendered.region).toBe("nyc");
    expect(rendered.services).toHaveLength(1);
    expect(service(rendered)).toMatchObject({ name: "log-bridge", http_port: 8080, instance_count: 1, instance_size_slug: "apps-s-1vcpu-0.5gb", dockerfile_path: "scripts/log-forwarding/Dockerfile", source_dir: "/", git: { repo_clone_url: "https://github.com/pffreitas/cosmic-dolphin.git", branch: "main" } });
    expect(service(rendered).git.deploy_on_push).toBeUndefined();
    expect(service(rendered).envs.map((e: any) => e.key)).toEqual(["PORT", "LOG_BRIDGE_ENVIRONMENT", "GRAFANA_OTLP_ENDPOINT", "GRAFANA_OTLP_INSTANCE_ID", "GRAFANA_OTLP_TOKEN", "LOG_SOURCE_KEYS_JSON"]);
    expect(service(rendered).envs.every((e: any) => e.scope === "RUN_TIME")).toBe(true);
    expect(service(rendered).envs.filter((e: any) => e.type === "SECRET").map((e: any) => e.key)).toEqual(["GRAFANA_OTLP_TOKEN", "LOG_SOURCE_KEYS_JSON"]);
    expect(JSON.stringify(rendered)).not.toContain(env.DIGITALOCEAN_ACCESS_TOKEN);
  });
  test("JSON rendering preserves multiline JSON and literal punctuation without envsubst", () => {
    const roundtrip: any = Bun.YAML.parse(JSON.stringify(spec()));
    for (const key of ["GRAFANA_OTLP_TOKEN", "LOG_SOURCE_KEYS_JSON"] as const) expect(service(roundtrip).envs.find((e: any) => e.key === key).value).toBe(env[key]);
    expect(service(renderSpec(template, { ...env, LOG_BRIDGE_BRANCH: undefined })).git.branch).toBe("main");
    expect(service(renderSpec(template, { ...env, LOG_BRIDGE_BRANCH: "logs/bridge-v2" })).git.branch).toBe("logs/bridge-v2");
  });
  test("config, branch, app, source and additional components fail closed", () => {
    for (const override of [{ GRAFANA_OTLP_ENDPOINT: "https://private.example/otlp" }, { LOG_SOURCE_KEYS_JSON: '{"api":"short"}' }, { LOG_SOURCE_KEYS_JSON: JSON.stringify({ api: "a".repeat(32), worker: "a".repeat(32) }) }, { GRAFANA_OTLP_TOKEN: "secret\ninvalid" }, { PORT: "9090" }, { LOG_BRIDGE_ENVIRONMENT: "local" }]) expect(() => renderSpec(template, { ...env, ...override })).toThrow("deployment_");
    for (const branch of ["--main", "../main", "main..hidden", "main\nsecret", "main;echo", "main@{x}", "main.lock", "main/", "main//x", "main/.x", "${PRIVATE}"]) expect(() => renderSpec(template, { ...env, LOG_BRIDGE_BRANCH: branch })).toThrow("deployment_branch_invalid");
    for (const edit of [(s: any) => { s.name = "foreign"; }, (s: any) => { s.databases = [{ name: "foreign" }]; }, (s: any) => { s.services.push({ name: "foreign" }); }, (s: any) => { service(s).git.repo_clone_url = "https://private.example/repo.git"; }, (s: any) => { service(s).git.deploy_on_push = true; }, (s: any) => { service(s).source_dir = "/apps/api"; }, (s: any) => { service(s).envs.push({ key: "DIGITALOCEAN_ACCESS_TOKEN", value: "private" }); }]) {
      const candidate = Bun.YAML.parse(template); edit(candidate);
      expect(() => renderSpec(JSON.stringify(candidate), env)).toThrow("deployment_template_invalid");
    }
  });
  test("CLI checks offline and renders an existing output file with private permissions", async () => {
    const directory = mkdtempSync(join(tmpdir(), "log-bridge-render-"));
    const output = join(directory, "private.json");
    try {
      writeFileSync(output, "existing"); chmodSync(output, 0o644);
      const child = Bun.spawn([process.execPath, "--no-env-file", "scripts/log-forwarding/deployment.ts", "--render", output], { env, stdout: "pipe", stderr: "pipe" });
      expect(await child.exited).toBe(0);
      expect(await new Response(child.stdout).text()).toBe("");
      expect(await new Response(child.stderr).text()).toBe("");
      expect(statSync(output).mode & 0o777).toBe(0o600);
      expect(JSON.parse(readFileSync(output, "utf8"))).toEqual(spec());
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});

describe("guarded deployment requests", () => {
  test("configuration and create/update selection are checked before any network", async () => {
    let calls = 0;
    const transport: HttpFetch = async () => { calls++; return reply(); };
    for (const override of [{}, { LOG_BRIDGE_DO_APP_ID: "../private" }, { LOG_BRIDGE_DO_CREATE: "false" }, { LOG_BRIDGE_DO_CREATE: "true", LOG_BRIDGE_DO_APP_ID: appId }, { LOG_BRIDGE_DO_CREATE: "true", GRAFANA_OTLP_TOKEN: "" }, { LOG_BRIDGE_DO_CREATE: "true", DIGITALOCEAN_ACCESS_TOKEN: "" }]) await expect(deploySpec(spec(), { ...env, ...override }, transport)).rejects.toThrow("deployment_");
    const wrong: any = spec(); service(wrong).git.repo_clone_url = "https://other.example/repo.git";
    await expect(deploySpec(wrong, { ...env, LOG_BRIDGE_DO_CREATE: "true" }, transport)).rejects.toThrow("deployment_template_invalid");
    expect(calls).toBe(0);
  });
  test("create posts only the structured spec and reports requested, never ACTIVE", async () => {
    const calls: any[] = [];
    const receipt = await deploySpec(spec(), { ...env, LOG_BRIDGE_DO_CREATE: "true" }, async (url, init) => {
      calls.push({ url, init }); return reply();
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.digitalocean.com/v2/apps");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.redirect).toBe("error");
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(calls[0].init.body)).toEqual({ spec: spec() });
    expect(receipt).toMatchObject({ deployment: "requested", appId, branch: "main" });
    expect(JSON.stringify(receipt)).not.toContain("ACTIVE");
    expect(JSON.stringify(receipt)).not.toContain(env.GRAFANA_OTLP_TOKEN);
  });
  test("update reads ownership and source before sending any write", async () => {
    for (const edit of [(s: any) => { s.name = "cosmic-dolphin-api-nodejs"; }, (s: any) => { service(s).name = "foreign"; }, (s: any) => { s.workers = [{ name: "foreign" }]; }, (s: any) => { s.domains = [{ domain: "existing.example" }]; }, (s: any) => { s.databases = {}; }, (s: any) => { service(s).git.repo_clone_url = "https://foreign.example/repo.git"; }, (s: any) => { service(s).dockerfile_path = "apps/api/Dockerfile"; }, (s: any) => { service(s).image = { repository: "foreign" }; }]) {
      const current = spec(); edit(current);
      const methods: string[] = [];
      await expect(deploySpec(spec(), { ...env, LOG_BRIDGE_DO_APP_ID: appId }, async (_url, init) => { methods.push(init!.method!); return reply(current); })).rejects.toThrow("deployment_app_conflict");
      expect(methods).toEqual(["GET"]);
    }
    const methods: string[] = [];
    const receipt = await deploySpec(spec(), { ...env, LOG_BRIDGE_DO_APP_ID: appId }, async (url, init) => {
      expect(url).toBe(`https://api.digitalocean.com/v2/apps/${appId}`); methods.push(init!.method!);
      if (init!.method === "PUT") expect(JSON.parse(String(init!.body))).toEqual({ spec: spec(), update_all_source_versions: true });
      return reply();
    });
    expect(methods).toEqual(["GET", "PUT"]);
    expect(receipt.deployment).toBe("requested");
  });
  test("HTTP, JSON, response size and transport failures expose fixed codes only", async () => {
    const responses = [new Response("PRIVATE_REMOTE_VALUES", { status: 403 }), new Response("PRIVATE_REMOTE_VALUES"), Response.json({ app: { id: "private-invalid-id" } }), Response.json({ padding: "x".repeat(1_000_001) }), Response.json({ app: { id: appId } })];
    const expected = ["deployment_http_403", "deployment_response_invalid", "deployment_response_invalid", "deployment_response_too_large", null];
    for (let i = 0; i < responses.length; i++) {
      const promise = deploySpec(spec(), { ...env, LOG_BRIDGE_DO_CREATE: "true" }, async () => responses[i]);
      if (expected[i]) await expect(promise).rejects.toThrow(expected[i]!); else expect((await promise).deployment).toBe("requested");
    }
    await expect(deploySpec(spec(), { ...env, LOG_BRIDGE_DO_CREATE: "true" }, async () => { throw new Error("PRIVATE_REMOTE_VALUES"); })).rejects.toThrow("deployment_unreachable");
    await expect(deploySpec(spec(), { ...env, LOG_BRIDGE_DO_CREATE: "true" }, async () => { throw new Error("deployment_private_remote_values"); })).rejects.toThrow("deployment_unreachable");
  });
  test("deadline covers stalled response body and cancels it", async () => {
    let canceled = false;
    const hanging = new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("{")); }, cancel() { canceled = true; } }));
    await expect(deploySpec(spec(), { ...env, LOG_BRIDGE_DO_CREATE: "true" }, async () => hanging, 25)).rejects.toThrow("deployment_unreachable");
    expect(canceled).toBe(true);
  });
});
