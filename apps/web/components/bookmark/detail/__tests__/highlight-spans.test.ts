import { describe, expect, it } from "vitest";

import {
  documentOffset,
  mergeDisjoint,
  sliceSpan,
} from "../highlight-spans";

/**
 * The index arithmetic between a highlight's document offsets and the text
 * nodes it has to be painted into. Getting this wrong stripes the wrong
 * sentence — the exact failure the anchoring module exists to prevent — and
 * it is only reproducible by hand in a browser, so it is tested here instead.
 */
describe("sliceSpan", () => {
  // "The quick" | " brown " | "fox"  →  0-9, 9-16, 16-19
  const runs = [9, 7, 3];

  it("cuts a span that straddles three nodes into three slices", () => {
    expect(sliceSpan(runs, { start: 4, end: 18 })).toEqual([
      { runIndex: 0, start: 4, end: 9 },
      { runIndex: 1, start: 0, end: 7 },
      { runIndex: 2, start: 0, end: 2 },
    ]);
  });

  it("keeps a span inside one node as one slice", () => {
    expect(sliceSpan(runs, { start: 10, end: 15 })).toEqual([
      { runIndex: 1, start: 1, end: 6 },
    ]);
  });

  it("returns nothing for an empty span or one past the end", () => {
    expect(sliceSpan(runs, { start: 5, end: 5 })).toEqual([]);
    expect(sliceSpan(runs, { start: 40, end: 50 })).toEqual([]);
  });

  it("skips empty text nodes rather than emitting zero-width slices", () => {
    expect(sliceSpan([3, 0, 3], { start: 1, end: 5 })).toEqual([
      { runIndex: 0, start: 1, end: 3 },
      { runIndex: 2, start: 0, end: 2 },
    ]);
  });
});

describe("documentOffset", () => {
  const runs = [9, 7, 3];

  it("adds up the runs before the one the position is in", () => {
    expect(documentOffset(runs, 0, 4)).toBe(4);
    expect(documentOffset(runs, 1, 3)).toBe(12);
    expect(documentOffset(runs, 2, 3)).toBe(19);
  });

  it("refuses a run it does not know — a selection that started elsewhere", () => {
    expect(documentOffset(runs, -1, 0)).toBeNull();
    expect(documentOffset(runs, 3, 0)).toBeNull();
  });
});

describe("mergeDisjoint", () => {
  it("trims a later span rather than nesting two marks over one word", () => {
    expect(
      mergeDisjoint([
        { start: 0, end: 10 },
        { start: 5, end: 20 },
      ]),
    ).toEqual([
      { start: 0, end: 10 },
      { start: 10, end: 20 },
    ]);
  });

  it("drops a span wholly contained in an earlier one", () => {
    expect(
      mergeDisjoint([
        { start: 0, end: 20 },
        { start: 5, end: 9 },
      ]),
    ).toEqual([{ start: 0, end: 20 }]);
  });

  it("leaves genuinely separate spans alone, in document order", () => {
    expect(
      mergeDisjoint([
        { start: 30, end: 40 },
        { start: 0, end: 10 },
      ]),
    ).toEqual([
      { start: 0, end: 10 },
      { start: 30, end: 40 },
    ]);
  });
});
