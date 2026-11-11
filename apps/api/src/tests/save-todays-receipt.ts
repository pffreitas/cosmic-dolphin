import { expect } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

/** Optional proof output: the CLI takes the Git snapshot before the test VM starts.
 * Every listed source byte is checked again here; this supplies no application auth. */
export async function sourceReceipt() {
  const file = process.env.T10_SOURCE_MANIFEST;
  expect(file, "Source receipt requires the same-candidate CLI snapshot").toBeTruthy();
  const snapshot = JSON.parse(await readFile(file!, "utf8")) as {
    candidateHead: string; sourceManifestSha256: string; sourceManifest: { path: string; sha256: string }[];
  };
  const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
  expect(snapshot.candidateHead).toMatch(/^[0-9a-f]{40}$/);
  expect(snapshot.sourceManifest.length).toBeGreaterThan(0);
  expect(hash(JSON.stringify(snapshot.sourceManifest))).toBe(snapshot.sourceManifestSha256);
  const root = resolve(__dirname, "../../../..");
  await Promise.all(snapshot.sourceManifest.map(async row => {
    const path = resolve(root, row.path);
    expect(path.startsWith(root + "/"), "Source snapshot path must stay in this checkout").toBe(true);
    expect(hash(await readFile(path)), row.path).toBe(row.sha256);
  }));
  return snapshot;
}
