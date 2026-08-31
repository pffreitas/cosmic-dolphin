import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Rule ten, motion half.
 *
 * foundations.md § Motion is specific about what "honoured" means, and the
 * specificity is the point:
 *
 *   > Every animation must be neutralised under `prefers-reduced-motion:
 *   > reduce` — the shimmer becomes a flat `--cd-bg-inset`, the spinner
 *   > becomes a static ring at 60% opacity.
 *
 * Three things enforce that, and they are deliberately different in kind:
 *
 *   1. `app/globals.css` carries a global `prefers-reduced-motion` block. It
 *      is the net — it stops motion nobody remembered, including motion from a
 *      dependency. It does not know what the still state should *look* like.
 *   2. `scripts/lint-a11y.mjs` fails the build on an `animate-*` that ships
 *      with no `motion-reduce:` answer. It knows an answer exists.
 *   3. This file checks the two answers the spec actually names. A skeleton
 *      that stopped shimmering by turning transparent would satisfy 1 and 2
 *      and still be wrong.
 */

vi.mock("lucide-react", () => {
  const Icon = () => <svg />;
  return new Proxy(
    {},
    {
      get: (_target, name) => {
        if (typeof name === "symbol" || name === "then") return undefined;
        if (name === "__esModule") return true;
        return Icon;
      },
      has: (_target, name) => typeof name === "string" && name !== "then",
    },
  );
});

import { Skeleton } from "@/components/ui/skeleton";
import { ProcessingSteps } from "@/components/ai/processing-steps";

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

describe("the global net", () => {
  const globals = read("../../app/globals.css");

  it("neutralises motion nobody remembered", () => {
    expect(globals).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  it("covers pseudo-elements, where the shimmer actually lives", () => {
    const block = globals.slice(globals.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toContain("*::before");
    expect(block).toContain("*::after");
  });

  it("shortens animations rather than removing them", () => {
    // `animation: none` never fires `animationend`, and anything waiting on
    // that event hangs. Running to completion inside a frame is invisible and
    // keeps the listeners honest.
    const block = globals.slice(globals.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
    expect(block).not.toMatch(/animation:\s*none/);
  });
});

describe("the shimmer flattens to --cd-bg-inset", () => {
  const html = renderToStaticMarkup(<Skeleton shape="line" />);

  it("keeps the base a flat token, so hiding the sweep leaves the right colour", () => {
    // The sweep is a pseudo-element precisely so the base stays `bg-bg-inset`.
    // If it were painted on the element itself, hiding it under reduced motion
    // would leave a transparent bar rather than the specified flat one.
    expect(html).toContain("bg-bg-inset");
    expect(html).toContain("after:animate-skeleton-sweep");
  });

  it("hides the sweep rather than merely stopping it mid-gradient", () => {
    // `motion-reduce:animate-none` alone would freeze the gradient wherever it
    // happened to be — a permanent bright band across the placeholder.
    expect(html).toContain("motion-reduce:after:hidden");
  });
});

describe("the spinner becomes a static ring at 60%", () => {
  it("keeps the ring whole and dims it", () => {
    const html = renderToStaticMarkup(
      <ProcessingSteps
        steps={[
          { phase: "fetch", state: "done" },
          { phase: "extract", state: "active" },
        ]}
      />,
    );
    // Spinning works by leaving one quarter transparent; standing still with a
    // gap in it reads as broken, so reduced motion paints the gap back in.
    expect(html).toContain("motion-reduce:animate-none");
    expect(html).toContain("motion-reduce:border-r-accent");
    expect(html).toContain("motion-reduce:opacity-60");
  });

  it("dims every other spinner in the product to the same 60%", () => {
    // Read from source rather than rendered, because these spinners are Lucide
    // icons and the icon mock this file needs drops className. The classes are
    // the whole assertion, so reading them where they are written loses
    // nothing — and `scripts/lint-a11y.mjs` is what guarantees each of these
    // has *an* answer; this is what pins the answer to 60%.
    for (const file of [
      "../../components/ui/button.tsx",
      "../../components/search/search-view.tsx",
      "../../components/global-command-dialog.tsx",
      "../../components/social/handle-claim-prompt.tsx",
    ]) {
      const source = read(file);
      expect(source, file).toMatch(
        /animate-spin[^"']*motion-reduce:animate-none[^"']*motion-reduce:opacity-60/,
      );
    }
  });
});
