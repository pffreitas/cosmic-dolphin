/**
 * Doors into the header's two capture surfaces from anywhere in the app.
 *
 * The bottom tab bar and the omnibox's *Behind a login* both need to reach
 * things that live elsewhere in the tree — the Save a link dialog and the
 * omnibox itself. They used to do it by clicking a header button found by id.
 * The header no longer has that button, and a click on an element that may not
 * exist is a door that fails silently, so the contract is named here instead.
 */

/** The id of the omnibox's `<input>`. One omnibox in the product, so one id. */
export const OMNIBOX_INPUT_ID = "header-omnibox";

/** The event the Save a link dialog listens for. */
export const OPEN_SAVE_DIALOG_EVENT = "cd:open-save-dialog";

export interface OpenSaveDialogDetail {
  /** Prefills the dialog's URL field. */
  url?: string;
  /** Goes straight to the *Behind a login* private-link dialog. */
  privateLink?: boolean;
}

/** Opens the Save a link dialog, optionally with a URL already in it. */
export function openSaveDialog(detail: OpenSaveDialogDetail = {}): void {
  window.dispatchEvent(
    new CustomEvent<OpenSaveDialogDetail>(OPEN_SAVE_DIALOG_EVENT, { detail })
  );
}

/**
 * Focuses the header omnibox. Returns `false` when there is none on the page —
 * signed out, or a route that swaps it for a CTA — so the caller can fall back.
 */
export function focusOmnibox(): boolean {
  const input = document.getElementById(OMNIBOX_INPUT_ID);
  if (!(input instanceof HTMLInputElement)) return false;
  input.focus();
  input.select();
  return true;
}
