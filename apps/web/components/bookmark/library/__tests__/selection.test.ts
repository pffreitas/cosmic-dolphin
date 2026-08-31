import { describe, expect, it } from "vitest";

import {
  EMPTY_SELECTION,
  dragPayload,
  pruneSelection,
  selectionClick,
} from "../selection";

const ids = ["a", "b", "c", "d", "e"];

describe("selectionClick", () => {
  it("toggles a single row and moves the anchor there", () => {
    const first = selectionClick(ids, EMPTY_SELECTION, 1, false);
    expect(first).toEqual({ selected: ["b"], anchor: 1 });

    const second = selectionClick(ids, first, 1, false);
    expect(second).toEqual({ selected: [], anchor: 1 });
  });

  it("shift-click selects the range from the anchor, inclusive", () => {
    const anchored = selectionClick(ids, EMPTY_SELECTION, 1, false);
    const ranged = selectionClick(ids, anchored, 3, true);
    expect(ranged.selected.sort()).toEqual(["b", "c", "d"]);
  });

  it("selects the range backwards too", () => {
    const anchored = selectionClick(ids, EMPTY_SELECTION, 3, false);
    const ranged = selectionClick(ids, anchored, 1, true);
    expect(ranged.selected.sort()).toEqual(["b", "c", "d"]);
  });

  it("keeps the anchor across a shift-click, so a second one grows the range", () => {
    const anchored = selectionClick(ids, EMPTY_SELECTION, 0, false);
    const first = selectionClick(ids, anchored, 1, true);
    const second = selectionClick(ids, first, 4, true);
    expect(second.anchor).toBe(0);
    expect(second.selected.sort()).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("treats a shift-click with no anchor as an ordinary click", () => {
    expect(selectionClick(ids, EMPTY_SELECTION, 2, true)).toEqual({
      selected: ["c"],
      anchor: 2,
    });
  });

  it("never selects the same row twice", () => {
    const anchored = selectionClick(ids, EMPTY_SELECTION, 1, false);
    const withC = selectionClick(ids, anchored, 2, false);
    const ranged = selectionClick(ids, withC, 3, true);
    expect(ranged.selected.length).toBe(new Set(ranged.selected).size);
  });
});

describe("pruneSelection", () => {
  it("forgets rows that have left the list", () => {
    const state = { selected: ["a", "b"], anchor: 1 };
    expect(pruneSelection(state, ["a"])).toEqual({ selected: ["a"], anchor: 1 });
  });

  it("returns the same object when nothing changed", () => {
    const state = { selected: ["a"], anchor: 0 };
    expect(pruneSelection(state, ids)).toBe(state);
  });
});

describe("dragPayload", () => {
  it("drags the whole selection when the row dragged is part of it", () => {
    expect(dragPayload({ selected: ["a", "c"], anchor: 0 }, "c").sort()).toEqual([
      "a",
      "c",
    ]);
  });

  it("drags only the row when it is outside the selection", () => {
    // Anything else silently moves rows the user was not looking at.
    expect(dragPayload({ selected: ["a", "c"], anchor: 0 }, "d")).toEqual(["d"]);
  });
});
