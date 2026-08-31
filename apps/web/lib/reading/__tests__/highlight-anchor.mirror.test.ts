import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { createAnchor, resolveHighlight } from "../highlight-anchor";

/**
 * The mirror cannot be allowed to drift.
 *
 * `lib/reading/highlight-anchor.ts` is a copy of
 * `packages/shared/src/highlight-anchor.ts`, because the anchoring has to run
 * on both sides of the wire and `packages/shared` is backend-only. A copy is a
 * liability exactly as long as nothing checks it, so this does: if the shared
 * original changes and nobody runs `bun run sync:highlight-anchor`, the web
 * test suite goes red before a reader ever paints a highlight in the wrong
 * place.
 */
const SHARED = resolve(
  __dirname,
  "../../../../../packages/shared/src/highlight-anchor.ts",
);
const MIRROR = resolve(__dirname, "../highlight-anchor.ts");
const MARKER =
  " * ---- generated below this line; do not edit ----------------------------\n */\n\n";

describe("highlight-anchor mirror", () => {
  it("is byte-identical to the shared original below the preamble", () => {
    const mirror = readFileSync(MIRROR, "utf8");
    const at = mirror.indexOf(MARKER);

    expect(at, "the mirror has lost its generated-below marker").toBeGreaterThan(-1);
    expect(mirror.slice(at + MARKER.length)).toBe(readFileSync(SHARED, "utf8"));
  });

  it("round-trips a selection through the copy the browser actually loads", () => {
    const document = "The cheapest write is the one never sent. Everything else is tuning.";
    const start = document.indexOf("The cheapest");
    const end = document.indexOf(" Everything");

    const anchor = createAnchor(document, start, end);
    const resolved = resolveHighlight(document, anchor);

    expect(resolved).not.toBeNull();
    expect(resolved!.text).toBe("The cheapest write is the one never sent.");
  });
});
