/**
 * Regenerate `lib/reading/highlight-anchor.ts` from its shared original.
 *
 * The anchoring module has to run on both sides of the wire and
 * `packages/shared` is backend-only, so the client gets a copy. A copy is only
 * safe if it cannot drift: this script writes it, and
 * `lib/reading/__tests__/highlight-anchor.mirror.test.ts` fails when it is
 * stale.
 *
 *   bun run sync:highlight-anchor
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const SOURCE = resolve(here, "../../../packages/shared/src/highlight-anchor.ts");
export const MIRROR = resolve(here, "../lib/reading/highlight-anchor.ts");

/** Everything up to and including this line is the mirror's own preamble. */
export const MARKER = " * ---- generated below this line; do not edit ----------------------------\n */\n\n";

export function mirrorBody(mirrorSource) {
  const at = mirrorSource.indexOf(MARKER);
  if (at === -1) return null;
  return mirrorSource.slice(at + MARKER.length);
}

function main() {
  const preamble = readFileSync(MIRROR, "utf8");
  const at = preamble.indexOf(MARKER);
  if (at === -1) {
    throw new Error("The mirror has lost its preamble marker; restore it by hand.");
  }
  writeFileSync(
    MIRROR,
    preamble.slice(0, at + MARKER.length) + readFileSync(SOURCE, "utf8"),
  );
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
