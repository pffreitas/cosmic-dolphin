import { expect, test } from "bun:test";
import { join } from "node:path";
const root = join(import.meta.dir, "..");
test("packaged-style monitor drains piped reports before exiting", async () => {
  for (let i = 0; i < 10; i++) {
    const child = Bun.spawn([process.execPath, "--no-env-file", join(root, "monitor.ts"), "--fixture", join(import.meta.dir, "fixtures", "healthy-no-traffic.json")], { env: { PATH: process.env.PATH }, stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    expect(JSON.parse(stdout)).toMatchObject({ status: "ok", target: "fixture" });
    expect(stderr).toBe("");
    expect(code).toBe(0);
  }
}, 20000);
test("generator drains large dry-run JSON through a pipe", async () => {
  const child = Bun.spawn([process.execPath, "--no-env-file", join(root, "grafana.ts"), "--dry-run"], { env: { PATH: process.env.PATH }, stdout: "pipe", stderr: "pipe" });
  const [stdout, code] = await Promise.all([new Response(child.stdout).text(), child.exited]);
  expect(JSON.parse(stdout).rules).toHaveLength(8);
  expect(code).toBe(0);
});
