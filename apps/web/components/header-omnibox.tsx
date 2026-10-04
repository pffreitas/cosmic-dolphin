"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Link2, Lock, Plus, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { focusRing } from "@/components/ui/focus-ring";
import { useCaptureToast } from "@/components/bookmark/capture-toast";
import { searchHref } from "@/components/search/search-data";
import { parseCaptureUrl } from "@/lib/capture";
import { OMNIBOX_INPUT_ID, openSaveDialog } from "@/lib/chrome-actions";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { clearErrors, saveCapture } from "@/lib/store/slices/bookmarksSlice";

/**
 * The header omnibox — docs/design-system/patterns.md § Header capsule.
 *
 * One field that both saves and searches, replacing the capsule's search chip
 * and its **Save a link** button. **A URL saves; words search.** The field
 * decides which on every keystroke and says so before Enter is pressed — the
 * leading glyph, the trailing control and the hint under the field all change
 * together, so there is never a moment where the reader has to guess what the
 * key will do.
 *
 * Saving goes through the same `saveCapture` as every other door
 * (docs/functional-spec/02-capture.md): optimistic, never blocking, and the row
 * appears under Home's *Saving now* — or above the page anywhere else — before
 * the POST is answered. The field clears at once. The one failure that comes
 * back here is a 429, because the reader still has the URL and the only useful
 * thing to say is how long to wait.
 *
 * Searching goes to `/search`, the full route. The palette is one ⌘K further
 * (`global-keyboard-shortcuts.tsx`) and takes the typed text with it.
 */

const PLACEHOLDER = "Paste a link to save · or search your library";
const PLACEHOLDER_NARROW = "Paste a link or search";
const HINT_IDLE =
  "Paste a link and press Enter to save it. Type anything else to search.";

export function HeaderOmnibox({ className }: { className?: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const announce = useCaptureToast();
  const rateLimit = useAppSelector((state) => state.bookmarks.createRateLimit);

  const [value, setValue] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  /** A 429 for the URL now in the field. Cleared as soon as it is edited. */
  const [limited, setLimited] = React.useState(false);

  // The short placeholder is a client-only refinement: rendering it from a
  // media query during the server pass would be a hydration mismatch.
  const [narrow, setNarrow] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    const sync = () => setNarrow(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const query = value.trim();
  // A URL never contains whitespace; "how to use https://…" is a search.
  const capture = query && !/\s/.test(query) ? parseCaptureUrl(query) : null;
  const hintId = `${OMNIBOX_INPUT_ID}-hint`;

  const hint = limited && rateLimit
    ? `${rateLimit.message} Your link is still here — try again in ${rateLimit.retryIn}.`
    : capture
      ? `Press Enter to save ${capture.domain}. It appears under Saving now while Cosmic reads it.`
      : query
        ? `Press Enter to search your library for “${query}”. ⌘K again for everything else.`
        : HINT_IDLE;

  async function save(url: string) {
    dispatch(clearErrors());
    setLimited(false);
    // Cleared optimistically: the row is already on screen.
    setValue("");

    const result = await dispatch(saveCapture({ url }));
    if (saveCapture.fulfilled.match(result)) {
      announce(result.payload);
      return;
    }
    if (result.payload?.retryIn) {
      setValue(url);
      setLimited(true);
    }
    // Every other failure is an inline error with Retry on the row itself.
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!query) return;

    if (capture) {
      void save(capture.url);
      return;
    }

    router.push(searchHref({ q: query, readStatus: "all", dateRange: "any" }));
    setValue("");
    (document.getElementById(OMNIBOX_INPUT_ID) as HTMLInputElement | null)?.blur();
  }

  return (
    <form
      role="search"
      onSubmit={submit}
      className={cn("relative min-w-0", className)}
      // Focus-within, tracked in state so the hint can be a real element with a
      // real id for `aria-describedby`, not a CSS-only reveal. A move between
      // the input and the hint's own button is not a blur.
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocused(false);
        }
      }}
    >
      <label
        htmlFor={OMNIBOX_INPUT_ID}
        className={cn(
          "flex h-9 w-full cursor-text items-center gap-2.5 rounded-md",
          "border border-line bg-bg-subtle pl-3 pr-1",
          "transition-colors duration-cd-fast ease-cd hover:border-line-strong",
          // The focus ring lives on the field, not on the bare input inside
          // it. Same 2px `--cd-focus` ring and 2px offset as `focusRing`.
          "focus-within:border-[color:var(--cd-accent)] focus-within:bg-bg-panel",
          "focus-within:ring-2 focus-within:ring-[color:var(--cd-focus)] focus-within:ring-offset-2 focus-within:ring-offset-[color:var(--cd-bg)]",
        )}
      >
        {capture ? (
          <Link2 aria-hidden="true" className="size-4 shrink-0 text-accent [stroke-width:1.8]" />
        ) : (
          <Search aria-hidden="true" className="size-4 shrink-0 text-fg-tertiary [stroke-width:1.8]" />
        )}
        <span className="sr-only">Paste a link to save it, or search your library</span>
        {/* cd-a11y-allow: the 2px focus ring is drawn on the enclosing field via focus-within */}
        <input
          id={OMNIBOX_INPUT_ID}
          type="text"
          inputMode="search"
          enterKeyHint={capture ? "go" : "search"}
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={narrow ? PLACEHOLDER_NARROW : PLACEHOLDER}
          aria-describedby={focused ? hintId : undefined}
          aria-keyshortcuts="Meta+K Control+K"
          onChange={(event) => {
            setValue(event.target.value);
            if (limited) setLimited(false);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            // First Escape clears, the second lets go of the field.
            if (value) setValue("");
            else event.currentTarget.blur();
          }}
          className={cn(
            "h-full min-w-0 flex-1 border-0 bg-transparent p-0 outline-none",
            "font-sans text-[13.5px] text-fg placeholder:text-fg-tertiary",
          )}
        />
        {capture ? (
          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="h-7 rounded-sm pl-2.5 pr-3"
            icon={<Plus aria-hidden="true" />}
          >
            Save
          </Button>
        ) : (
          <Kbd className="mr-1.5 max-[640px]:hidden" aria-hidden="true">
            ⌘K
          </Kbd>
        )}
      </label>

      {focused ? (
        <div
          className={cn(
            "absolute inset-x-0 top-[calc(100%+6px)] z-20 flex flex-col gap-2 rounded-md",
            "border border-line bg-bg-panel px-3 py-2.5 shadow-[var(--cd-shadow-popover)]",
          )}
        >
          <p
            id={hintId}
            className={cn(
              "m-0 font-sans text-[12.5px] leading-[1.5]",
              limited && rateLimit
                ? "text-[color:var(--cd-warning)]"
                : "text-fg-secondary",
            )}
          >
            {hint}
          </p>
          {capture ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const url = capture.url;
                setValue("");
                openSaveDialog({ url, privateLink: true });
              }}
              className={cn(
                "inline-flex items-center gap-1.5 self-start rounded-xs",
                "font-sans text-[12.5px] font-medium text-accent hover:underline hover:underline-offset-[3px]",
                focusRing,
              )}
            >
              <Lock aria-hidden="true" className="size-3.5 [stroke-width:1.8]" />
              Behind a login? Save it with a note
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
