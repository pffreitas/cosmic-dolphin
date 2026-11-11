/** Workflow contract: offline trigger/failure proof, not an observed GitHub run. */
import { expect, it } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { resolve } from "node:path";

const root = resolve(__dirname, "../../../..");
function workflow() {
  return Bun.YAML.parse(readFileSync(resolve(root, ".github/workflows/mobile-pr.yml"), "utf8")) as any;
}
it("gates the exact mobile deployment paths and its own workflow on pull requests", () => {
  const deploy = Bun.YAML.parse(readFileSync(resolve(root, ".github/workflows/deploy-mobile.yml"), "utf8")) as any;
  const gate = workflow();
  expect(Object.keys(gate.on)).toEqual(["pull_request"]);
  expect(gate.on.pull_request.paths).toEqual([...deploy.on.push.paths, ".github/workflows/mobile-pr.yml"]);
  const paths: string[] = gate.on.pull_request.paths;
  const triggers = (path: string) => paths.some(pattern => pattern.endsWith("/**") ? path.startsWith(pattern.slice(0, -2)) : path === pattern);
  for (const path of ["apps/mobile/app/save.tsx", "packages/api-client/src/src/models/Bookmark.ts", "packages/apispec/bookmarks.tsp", "package.json", "bun.lock", ".github/workflows/deploy-mobile.yml", ".github/workflows/mobile-pr.yml"]) expect(triggers(path)).toBe(true);
  for (const path of ["apps/api/src/index.ts", "apps/web/app/page.tsx", "README.md"]) expect(triggers(path)).toBe(false);
});

it("installs pinned Bun and Java, generates before types, and never deploys or skips quality", () => {
  const gate = workflow();
  expect(gate.env).toEqual({ BUN_VERSION: "1.3.11", JAVA_VERSION: "17" });
  expect(gate.permissions).toEqual({ contents: "read" });
  expect(Object.keys(gate.jobs)).toEqual(["quality"]);
  const steps = gate.jobs.quality.steps;
  expect(steps.find((s: any) => s.uses === "oven-sh/setup-bun@v2").with["bun-version"]).toBe("${{ env.BUN_VERSION }}");
  expect(steps.find((s: any) => s.uses === "actions/setup-java@v4").with).toEqual({ distribution: "temurin", "java-version": "${{ env.JAVA_VERSION }}" });
  expect(steps.filter((s: any) => s.run).map((s: any) => s.run)).toEqual([
    "bun install --frozen-lockfile", "bun run apispec", "bun run --cwd apps/mobile lint",
    "bunx tsc --noEmit -p apps/mobile/tsconfig.json", "bun run --cwd apps/mobile test -- --ci --runInBand",
  ]);
  expect(JSON.stringify(gate)).not.toMatch(/secrets\.|EXPO_TOKEN|DATABASE_URL|db:migrate|supabase db|eas build|eas submit|auto-submit|continue-on-error|always\(/);
  expect(gate.jobs.quality.if).toBeUndefined();
  for (const step of steps) expect(step.if).toBeUndefined();
});

for (const failedCommand of ["bun run --cwd apps/mobile lint", "bunx tsc --noEmit -p apps/mobile/tsconfig.json", "bun run --cwd apps/mobile test -- --ci --runInBand"]) {
  it(`fails the PR gate when ${failedCommand} fails`, () => {
    const directory = mkdtempSync(join(tmpdir(), "mobile-pr-failure-"));
    try {
      // Execute the actual run steps under GitHub's fail-fast shell policy. Tool stubs
      // replace install/generation/quality; no real dependency or source mutation occurs.
      const commands: string[] = workflow().jobs.quality.steps.filter((s: any) => s.run).map((s: any) => s.run);
      const stub = '#!/bin/bash\nprintf "%s\\n" "$(basename "$0") $*" >> "$TRACE"\n[[ "$(basename "$0") $*" != "$FAIL_COMMAND" ]]\n';
      for (const executable of ["bun", "bunx"]) {
        writeFileSync(join(directory, executable), stub); chmodSync(join(directory, executable), 0o755);
      }
      const trace = join(directory, "trace");
      const result = spawnSync("/bin/bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", commands.join("\n")], {
        env: { PATH: `${directory}:/usr/bin:/bin`, TRACE: trace, FAIL_COMMAND: failedCommand },
      });
      expect(result.status).toBe(1);
      expect(readFileSync(trace, "utf8").trim().split("\n")).toEqual(commands.slice(0, commands.indexOf(failedCommand) + 1));
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
}
