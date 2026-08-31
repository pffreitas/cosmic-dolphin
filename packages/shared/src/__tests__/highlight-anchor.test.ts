import { describe, it, expect } from "@jest/globals";
import {
  boundedLevenshtein,
  createAnchor,
  resolveHighlight,
  resolveHighlights,
} from "../highlight-anchor";

/**
 * The whole reason highlights are anchored by quote and context rather than by
 * character offsets: the pipeline re-extracts a page on every reprocess, and
 * extraction is not stable. These tests mutate a document the way a
 * re-extraction actually does — boilerplate appears and disappears, whitespace
 * is re-wrapped, a paragraph is inserted above, punctuation is re-typeset — and
 * then re-resolve the anchors stored against the *old* text.
 *
 * The bar is not "the offsets still work". It is that every highlight lands on
 * the same words, and that a highlight whose words are genuinely gone reports
 * itself orphaned rather than landing somewhere plausible and wrong.
 */

/** A first extraction: nav bar survived the readability pass, as they do. */
const ORIGINAL = `Skip to content Subscribe Sign in

The Cost of a Cache Miss

Every distributed system eventually grows a cache, and every cache eventually
grows a correctness problem. The interesting question is not whether the cache
will be wrong, but how long it is allowed to stay wrong.

Invalidation is hard because it is a coordination problem wearing the costume
of a performance optimisation. You reach for a cache to avoid talking to
another machine; you then discover that keeping it correct requires talking to
that machine.

The honest answer is to bound the staleness and say so out loud, rather than
to pretend the cache is a mirror.

Share this article Subscribe to the newsletter`;

/**
 * The same page, re-extracted after the reader improved.
 *
 * Every offset in the document has moved: the nav went away, a paragraph was
 * inserted near the top, the body was re-wrapped onto different line lengths,
 * and the hyphen in "performance optimisation" became an em dash. Nothing a
 * reader would call a different article; everything a stored offset would call
 * a different document.
 */
const REEXTRACTED = `The Cost of a Cache Miss

Published March 2026 by the systems desk. Roughly a nine minute read.

Every distributed system eventually grows a cache, and every cache eventually grows a correctness problem. The interesting question is not whether the cache will be wrong, but how long it is allowed to stay wrong.

Invalidation is hard because it is a coordination problem wearing the costume of a performance optimisation. You reach for a cache to avoid talking to another machine; you then discover that keeping it correct requires talking to that machine.

The honest answer is to bound the staleness and say so out loud, rather than to pretend the cache is a mirror.`;

/**
 * What the reader stored, taken against a document by selecting `quote`.
 *
 * Matches across line breaks on purpose: in ORIGINAL the body is hard-wrapped,
 * so a sentence a reader drags over spans a newline. Writing every expected
 * quote with the wrap baked in would test the fixture, not the module.
 */
function anchorIn(document: string, quote: string) {
  const pattern = new RegExp(
    quote
      .trim()
      .split(/\s+/)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\s+")
  );
  const match = pattern.exec(document);
  expect(match).not.toBeNull();
  const at = match!.index;
  return createAnchor(document, at, at + match![0].length);
}

describe("createAnchor", () => {
  it("stores the quote with a short prefix and suffix, whitespace collapsed", () => {
    const anchor = anchorIn(ORIGINAL, "Invalidation is hard");

    expect(anchor.quote).toBe("Invalidation is hard");
    // The line break before the quote is collapsed, not preserved: the
    // document it will be searched in may wrap differently.
    expect(anchor.prefix).not.toMatch(/\n/);
    expect(anchor.suffix).toContain("because it is a");
  });

  it("clamps a selection that runs past the end of the document", () => {
    const anchor = createAnchor("short", 2, 900);
    expect(anchor.quote).toBe("ort");
    expect(anchor.suffix).toBe("");
  });
});

describe("re-extraction leaves every highlight anchored", () => {
  const quotes = [
    "The interesting question is not whether the cache will be wrong",
    "a coordination problem wearing the costume",
    "bound the staleness and say so out loud",
    "The Cost of a Cache Miss",
  ];

  it("re-finds each highlight on the same words after re-extraction", () => {
    for (const quote of quotes) {
      const anchor = anchorIn(ORIGINAL, quote);
      const resolved = resolveHighlight(REEXTRACTED, anchor);

      expect(resolved).not.toBeNull();
      expect(resolved!.text.replace(/\s+/g, " ")).toBe(quote);
    }
  });

  it("resolves a whole page of highlights in one pass, orphaning none", () => {
    const anchors = quotes.map((quote) => anchorIn(ORIGINAL, quote));
    const results = resolveHighlights(REEXTRACTED, anchors);

    expect(results).toHaveLength(quotes.length);
    expect(results.every((r) => r.resolved !== null)).toBe(true);
  });

  it("reports offsets into the document it was given, not the stored one", () => {
    const quote = "bound the staleness and say so out loud";
    const anchor = anchorIn(ORIGINAL, quote);

    const resolved = resolveHighlight(REEXTRACTED, anchor)!;

    // The proof that offsets are useless across an extraction and that this
    // module does not rely on them: the same words are in a different place.
    expect(resolved.start).not.toBe(ORIGINAL.indexOf(quote));
    expect(REEXTRACTED.slice(resolved.start, resolved.end)).toBe(quote);
  });

  it("survives a quote re-wrapped across a line break", () => {
    // In ORIGINAL this sentence is split by a newline; in REEXTRACTED it is
    // one line. Whitespace normalisation is what makes them the same quote.
    const anchor = anchorIn(
      ORIGINAL,
      "every cache eventually\ngrows a correctness problem"
    );

    const resolved = resolveHighlight(REEXTRACTED, anchor)!;

    expect(resolved.method).toBe("exact");
    expect(resolved.text).toBe(
      "every cache eventually grows a correctness problem"
    );
  });
});

describe("choosing between several occurrences", () => {
  const REPEATED = `It was the best of times. The centre cannot hold.
Some pages repeat themselves. It was the best of times. The falcon cannot hear.
And once more, at the end: It was the best of times. Nothing follows.`;

  it("uses the stored context to pick the right occurrence", () => {
    const second = REPEATED.indexOf(
      "It was the best of times",
      REPEATED.indexOf("Some pages")
    );
    const anchor = createAnchor(
      REPEATED,
      second,
      second + "It was the best of times.".length
    );

    const resolved = resolveHighlight(REPEATED, anchor)!;

    expect(resolved.start).toBe(second);
    expect(resolved.method).toBe("exact");
  });

  it("still resolves an anchor stored without any context", () => {
    const resolved = resolveHighlight(REPEATED, {
      quote: "It was the best of times",
    });

    expect(resolved).not.toBeNull();
    expect(resolved!.score).toBe(1);
  });
});

describe("when the quote itself changed", () => {
  it("re-finds a quote whose punctuation was re-typeset", () => {
    const anchor = anchorIn(
      ORIGINAL,
      "a coordination problem wearing the costume\nof a performance optimisation"
    );

    // The em dash and the smart apostrophe are what a re-typeset paragraph
    // does to a stored quote. The words are the same.
    const retypeset = REEXTRACTED.replace(
      "wearing the costume of a performance optimisation",
      "wearing the costume — of a performance optimization"
    );

    const resolved = resolveHighlight(retypeset, anchor);

    expect(resolved).not.toBeNull();
    expect(resolved!.text).toContain("wearing the costume");
    expect(resolved!.text).toContain("optimization");
  });

  it("falls back to the surrounding context when the quote is rewritten", () => {
    const document = [
      "Some preamble that never changes at all.",
      "The honest answer is to bound the staleness and say so out loud.",
      "A closing line that also never changes.",
    ].join("\n");

    const rewritten = document.replace(
      "bound the staleness and say so out loud",
      "state the staleness budget plainly and in public"
    );

    const at = document.indexOf("bound the staleness");
    const anchor = createAnchor(
      document,
      at,
      at + "bound the staleness and say so out loud".length
    );

    const resolved = resolveHighlight(rewritten, anchor);

    expect(resolved).not.toBeNull();
    expect(resolved!.method).not.toBe("exact");
    expect(resolved!.text).toContain("staleness");
  });
});

describe("orphaning is a correct answer", () => {
  it("returns null when the quote and its context are both gone", () => {
    const anchor = anchorIn(ORIGINAL, "The interesting question is not whether");

    const unrelated =
      "A completely different article about beekeeping, hive placement, and the temperament of the Buckfast strain in a wet spring.";

    expect(resolveHighlight(unrelated, anchor)).toBeNull();
  });

  it("does not hand back whatever follows a prefix that survived elsewhere", () => {
    // The prefix is present; the quote is not, and nothing like it is. A
    // module that trusted one-sided context would confidently return the
    // beekeeping sentence.
    const resolved = resolveHighlight(
      "The honest answer is beekeeping, hive placement, and the Buckfast strain.",
      {
        quote: "to bound the staleness and say so out loud, rather than to pretend",
        prefix: "The honest answer is",
        suffix: null,
      }
    );

    expect(resolved).toBeNull();
  });

  it("returns null for an empty quote and for an empty document", () => {
    expect(resolveHighlight(ORIGINAL, { quote: "   " })).toBeNull();
    expect(resolveHighlight("", { quote: "anything" })).toBeNull();
  });
});

describe("boundedLevenshtein", () => {
  it("is zero for identical strings and abandons past the bound", () => {
    expect(boundedLevenshtein("cache", "cache", 3)).toBe(0);
    expect(boundedLevenshtein("cache", "caches", 3)).toBe(1);
    // Further apart than we asked about: reports bound + 1, not the real
    // distance, because computing the rest would be work nobody wanted.
    expect(boundedLevenshtein("cache", "beekeeping", 2)).toBe(3);
  });
});
