import { describe, it, expect } from "bun:test";
import {
  continueReadingQuerySchema,
  createHighlightSchema,
  saveProgressSchema,
  updateHighlightSchema,
  replyForReadingError,
} from "../routes/reading";
import { ReadingValidationError } from "@cosmic-dolphin/shared";
import { RATE_LIMITS } from "../plugins/rate-limit";

/**
 * The routes' own contribution: what is accepted onto the wire, and what a
 * broken rule is answered with. The two guarantees the deliverable turns on —
 * monotonic progress and reader-private highlights — are in SQL and tested in
 * `packages/shared`, deliberately: there is nothing here that could enforce
 * them and nothing here that could accidentally undo them.
 */

describe("PUT /bookmarks/:id/progress — what is accepted", () => {
  it("accepts a percent with no scroll offset", () => {
    const parsed = saveProgressSchema.safeParse({ percent: 42 });
    expect(parsed.success).toBe(true);
  });

  it("accepts a null scroll offset, which is not the same as zero", () => {
    const parsed = saveProgressSchema.safeParse({
      percent: 42,
      scrollOffset: null,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.scrollOffset).toBe(null);
  });

  it("lets a percent slightly out of range through, for the service to clamp", () => {
    // Derived on the client from a layout that is still settling. A 100.4 is a
    // rounding artefact, not a claim, and a 400 would be noise nobody can act
    // on.
    expect(saveProgressSchema.safeParse({ percent: 100.4 }).success).toBe(true);
    expect(saveProgressSchema.safeParse({ percent: -0.2 }).success).toBe(true);
  });

  it("refuses a percent that is not a number at all", () => {
    expect(saveProgressSchema.safeParse({ percent: "half" }).success).toBe(false);
    expect(saveProgressSchema.safeParse({}).success).toBe(false);
    expect(saveProgressSchema.safeParse({ percent: NaN }).success).toBe(false);
  });

  it("is rate limited, so a broken client cannot become an incident", () => {
    // The product limit is the client's 5-second throttle. This is the ceiling
    // under it.
    expect(RATE_LIMITS.progress.max).toBeGreaterThan(0);
    expect(RATE_LIMITS.progress.name).toBe("progress");
  });
});

describe("POST /bookmarks/:id/highlights — what is accepted", () => {
  it("accepts a quote with its context and an optional note", () => {
    const parsed = createHighlightSchema.safeParse({
      quote: "Invalidation is a coordination problem",
      prefix: "the costume of",
      suffix: "wearing the",
      note: "the whole argument, in one line",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a quote with no context — anchoring degrades, it does not fail", () => {
    expect(
      createHighlightSchema.safeParse({ quote: "a bare quote" }).success
    ).toBe(true);
  });

  it("refuses an empty quote", () => {
    expect(createHighlightSchema.safeParse({ quote: "" }).success).toBe(false);
    expect(createHighlightSchema.safeParse({}).success).toBe(false);
  });

  it("refuses a quote past the cap that the column also enforces", () => {
    const parsed = createHighlightSchema.safeParse({
      quote: "x".repeat(2001),
    });
    expect(parsed.success).toBe(false);
  });

  it("refuses a note past its cap", () => {
    const parsed = createHighlightSchema.safeParse({
      quote: "ok",
      note: "x".repeat(2001),
    });
    expect(parsed.success).toBe(false);
  });

  it("has no field for an offset, because there is no offset to send", () => {
    // The anchor is quote plus context. A client that tries to pin a highlight
    // by position has nowhere to put it, which is the point.
    const parsed = createHighlightSchema.safeParse({
      quote: "ok",
      startOffset: 120,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && "startOffset" in parsed.data).toBe(false);
  });
});

describe("PATCH /highlights/:id — the note, and only the note", () => {
  it("accepts a note and accepts null to clear it", () => {
    expect(updateHighlightSchema.safeParse({ note: "later" }).success).toBe(true);
    expect(updateHighlightSchema.safeParse({ note: null }).success).toBe(true);
  });

  it("refuses a body with no note, which would be ambiguous", () => {
    expect(updateHighlightSchema.safeParse({}).success).toBe(false);
  });

  it("ignores an attempt to rewrite the anchor", () => {
    const parsed = updateHighlightSchema.safeParse({
      note: "fine",
      quote: "something else entirely",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && "quote" in parsed.data).toBe(false);
  });
});

describe("GET /bookmarks/continue-reading", () => {
  it("defaults the limit and caps it", () => {
    const empty = continueReadingQuerySchema.safeParse({});
    expect(empty.success && empty.data.limit).toBe(12);

    expect(continueReadingQuerySchema.safeParse({ limit: "8" }).success).toBe(
      true
    );
    expect(continueReadingQuerySchema.safeParse({ limit: 500 }).success).toBe(
      false
    );
  });
});

describe("error mapping", () => {
  it("answers a broken reading rule with 400, and leaves anything else alone", () => {
    const captured: { status?: number; body?: unknown } = {};
    const reply = {
      status(code: number) {
        captured.status = code;
        return this;
      },
      send(body: unknown) {
        captured.body = body;
        return this;
      },
    } as never;

    expect(
      replyForReadingError(reply, new ReadingValidationError("quote is required"))
    ).not.toBeNull();
    expect(captured.status).toBe(400);
    expect(captured.body).toEqual({ error: "quote is required" });

    // An unexpected error is not the caller's fault and must not be reported
    // as if it were.
    expect(replyForReadingError(reply, new Error("connection reset"))).toBeNull();
  });
});
