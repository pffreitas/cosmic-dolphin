/**
 * Range selection for the library list.
 *
 * Kept as a pure function rather than living inside the component because the
 * shift-click rule is the part that is easy to get subtly wrong — the anchor
 * has to survive a shift-click (so a second one extends the same range rather
 * than starting a new one) and has to move on every plain click.
 */
export interface SelectionState {
  /** Selected ids, in no particular order. */
  selected: string[];
  /** Index the next shift-click measures from. */
  anchor: number | null;
}

export const EMPTY_SELECTION: SelectionState = { selected: [], anchor: null };

export function selectionClick(
  ids: string[],
  state: SelectionState,
  index: number,
  shiftKey: boolean
): SelectionState {
  const id = ids[index];
  if (id === undefined) return state;

  if (shiftKey && state.anchor !== null && state.anchor < ids.length) {
    const from = Math.min(state.anchor, index);
    const to = Math.max(state.anchor, index);
    const range = ids.slice(from, to + 1);
    const selected = new Set(state.selected);
    for (const rangeId of range) selected.add(rangeId);

    // The anchor stays put: shift-clicking a third row should grow the same
    // range, not start a new one from the row just touched.
    return { selected: Array.from(selected), anchor: state.anchor };
  }

  const selected = new Set(state.selected);
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);

  return { selected: Array.from(selected), anchor: index };
}

/** Drop ids that are no longer in the list — after a delete, or a filter move. */
export function pruneSelection(
  state: SelectionState,
  ids: string[]
): SelectionState {
  const present = new Set(ids);
  const selected = state.selected.filter((id) => present.has(id));
  if (selected.length === state.selected.length) return state;
  return { selected, anchor: selected.length ? state.anchor : null };
}

/**
 * What the drag carries.
 *
 * Dragging a row that is part of the selection drags the whole selection;
 * dragging one that is not drags only itself and leaves the selection alone —
 * anything else silently moves rows the user was not looking at.
 */
export function dragPayload(state: SelectionState, id: string): string[] {
  return state.selected.includes(id) ? state.selected : [id];
}
