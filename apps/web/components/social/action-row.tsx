"use client";

import * as React from "react";
import { Bookmark, Heart, MessageCircle, Share } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useOptionalToast } from "@/components/ui/toast";

/**
 * Social action row — see docs/design-system/patterns.md#social-action-row.
 *
 *   like · comment · save · share
 *
 * Left-aligned ghost buttons at 12.5px/500 in `--cd-fg-secondary` with 15px
 * icons and a 32px effective target, 2px apart. The order never changes
 * between contexts — muscle memory is the point.
 *
 * Never on a Library row: that surface is private and carries no social counts.
 */

/**
 * Counts are abbreviated so no count ever renders more than four characters:
 * 999, then 1.2k, then 2.1k, then 15k, then 1.4m.
 */
export function formatSocialCount(count: number): string {
  if (count < 1000) return String(count);

  const scale = (value: number, suffix: string) => {
    const rounded = value >= 100 ? String(Math.round(value)) : value.toFixed(1);
    return `${rounded.replace(/\.0$/, "")}${suffix}`;
  };

  if (count < 1_000_000) return scale(count / 1000, "k");
  return scale(count / 1_000_000, "m");
}

export interface ActionRowProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** Server truth. A zero count renders no number at all. */
  likeCount?: number;
  liked?: boolean;
  /**
   * Called with the value the user just asked for. The row updates
   * optimistically and re-syncs whenever `liked` / `likeCount` change, so the
   * caller reconciles against `bookmark_likes` at its own pace.
   */
  onLikeChange?: (liked: boolean) => void;

  commentCount?: number;
  /** Opens the thread — inline on the detail page, a drawer in the feed. */
  onComment?: () => void;

  /** Whether this is already in the current user's library. */
  saved?: boolean;
  /** Reshares into the current user's library. */
  onSaveChange?: (saved: boolean) => void;
  /**
   * The save has no undo — the feed's Save is a reshare, and un-resharing is
   * deleting a bookmark, which happens in the Library where the consequences
   * are visible (docs/functional-spec/06-social.md § Reshare).
   *
   * Once saved, the control announces itself as done and stops toggling.
   * Without this the row would flip back to "Save" on a second press while
   * the bookmark stayed in the library, and say something untrue.
   */
  saveOnce?: boolean;
  /** "Save" by default; a digest says "Save digest". */
  saveLabel?: string;
  /** Always "Saved" unless a surface has a reason to say otherwise. */
  savedLabel?: string;

  /** Absolute URL built from `share_slug`. Copied on click, then toasted. */
  shareUrl?: string;
  /** Takes over sharing completely — no copy, no toast. */
  onShare?: () => void;

  /** Disambiguates the controls when several rows share one page. */
  itemTitle?: string;
  disabled?: boolean;
}

const ACTION_BUTTON = cn(
  "gap-1.5 px-2 font-medium",
  "[&_svg]:size-[15px]",
);

const ActionRow = React.forwardRef<HTMLDivElement, ActionRowProps>(
  (
    {
      className,
      likeCount = 0,
      liked = false,
      onLikeChange,
      commentCount = 0,
      onComment,
      saved = false,
      onSaveChange,
      saveOnce = false,
      saveLabel = "Save",
      savedLabel = "Saved",
      shareUrl,
      onShare,
      itemTitle,
      disabled = false,
      ...props
    },
    ref,
  ) => {
    const toast = useOptionalToast();

    // Optimistic like. Server truth wins the moment it arrives.
    const [likedNow, setLikedNow] = React.useState(liked);
    const [countNow, setCountNow] = React.useState(likeCount);
    React.useEffect(() => {
      setLikedNow(liked);
      setCountNow(likeCount);
    }, [liked, likeCount]);

    const [savedNow, setSavedNow] = React.useState(saved);
    React.useEffect(() => setSavedNow(saved), [saved]);

    const suffix = itemTitle ? ` on ${itemTitle}` : "";

    const toggleLike = () => {
      const next = !likedNow;
      setLikedNow(next);
      setCountNow((current) => Math.max(0, current + (next ? 1 : -1)));
      onLikeChange?.(next);
    };

    const saveIsDone = saveOnce && savedNow;

    const toggleSave = () => {
      if (saveIsDone) return;
      const next = !savedNow;
      setSavedNow(next);
      onSaveChange?.(next);
    };

    const share = async () => {
      if (onShare) {
        onShare();
        return;
      }
      if (!shareUrl) return;
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast?.toast({ title: "Link copied", description: shareUrl });
      } catch {
        toast?.toast({
          title: "Couldn't copy the link",
          description: shareUrl,
          variant: "danger",
        });
      }
    };

    return (
      <div
        ref={ref}
        className={cn("-ml-2 flex flex-wrap items-center gap-0.5", className)}
        {...props}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          aria-pressed={likedNow}
          aria-label={`Like${suffix}`}
          onClick={toggleLike}
          className={cn(
            ACTION_BUTTON,
            likedNow &&
              "text-like hover:text-like [&_svg]:fill-current",
          )}
          icon={<Heart aria-hidden="true" />}
        >
          {countNow > 0 ? formatSocialCount(countNow) : null}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          aria-label={`Comments${suffix}`}
          onClick={onComment}
          className={ACTION_BUTTON}
          icon={<MessageCircle aria-hidden="true" />}
        >
          {commentCount > 0 ? formatSocialCount(commentCount) : null}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          // Focusable but inert, rather than `disabled`: a saved item's state
          // is worth reaching and reading, it just has nothing left to do.
          aria-disabled={saveIsDone || undefined}
          aria-pressed={savedNow}
          onClick={toggleSave}
          className={cn(
            ACTION_BUTTON,
            savedNow && "text-accent hover:text-accent",
          )}
          icon={<Bookmark aria-hidden="true" />}
        >
          {savedNow ? savedLabel : saveLabel}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          aria-label={`Share${suffix}`}
          onClick={share}
          className={ACTION_BUTTON}
          icon={<Share aria-hidden="true" />}
        />
      </div>
    );
  },
);
ActionRow.displayName = "ActionRow";

export { ActionRow };
