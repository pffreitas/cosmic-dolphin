"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BookmarkPlus,
  Check,
  ChevronRight,
  ExternalLink,
  MoreHorizontal,
  RotateCcw,
  RotateCw,
  Share as ShareIcon,
  Trash2,
} from "lucide-react";
import { Bookmark, Highlight } from "@cosmic-dolphin/api-client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { focusRing } from "@/components/ui/focus-ring";
import { useToast } from "@/components/ui/toast";
import { ProcessingSteps } from "@/components/ai/processing-steps";
import { ProvenanceRow } from "@/components/provenance-row";
import { ActionRow } from "@/components/social/action-row";
import { CommentThread } from "@/components/social/comment-thread";
import { BookmarksClientAPI } from "@/lib/api/bookmarks-client";
import { useBookmarkProcessingTimeline } from "@/lib/hooks/useBookmarkProcessingTimeline";
import { ReadingProgressTracker } from "@/lib/reading/progress";
import type { HighlightAnchor } from "@/lib/reading/highlight-anchor";

import { CosmicBrief } from "./cosmic-brief";
import type { BookmarkDetailModel } from "./detail-data";
import {
  defaultDetailServices,
  type DetailServices,
} from "./detail-services";
import { OwnSummary } from "./own-summary";
import { Reader } from "./reader";

/**
 * Bookmark detail, and the shared view of it — pages.md § Bookmark detail.
 *
 * One composition serves both routes because they *are* the same page: the
 * shared view is this page with the breadcrumb, the read toggle and the
 * highlights removed and a **Save to your library** CTA added. Building it
 * twice would mean maintaining the argument of the page in two files and
 * discovering, six months from now, that only one of them got the fix.
 *
 * The order is the argument, and it does not get rearranged:
 *
 *   hero → Cosmic brief → reader → social row → comments
 *
 * Hero first because trust precedes attention: where this came from, and what
 * you can do with it, before a word of the AI's prose. The brief before the
 * reader because the brief's whole claim is that it saves you the reader. The
 * social row after the reader because a reaction is a thing you have after
 * reading, and the same row above the text would be asking for one before.
 *
 * Two rules this page owns, and neither is negotiable:
 *
 *  - **Read is never set silently.** Progress crossing 90% raises a toast that
 *    *asks*; taking it up raises a second one that can be undone. The old
 *    `useAutoMarkBookmarkRead` hook did the opposite — 20 seconds of dwell and
 *    a bookmark quietly changed state — and it is deleted, not disabled.
 *
 *  - **A failed run still opens the original.** The thing the user actually
 *    saved is a URL, and the pipeline falling over does not take it away.
 */
export interface BookmarkDetailProps {
  model: BookmarkDetailModel;
  /** Server-rendered starting point; the client refetches its own. */
  initialHighlights?: Highlight[];
  /** Swapped out by `/dev/bookmark`. Every other caller wants the default. */
  services?: DetailServices;
  /** Suppresses the network entirely — the state gallery. */
  offline?: boolean;
}

/** functional-spec/04-library.md: above 95% a bookmark offers to be read. */
const READ_SUGGESTION_PERCENT = 90;

export function BookmarkDetail({
  model,
  initialHighlights = [],
  services = defaultDetailServices,
  offline = false,
}: BookmarkDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const owner = model.mode === "owner";

  const [isRead, setIsRead] = React.useState(model.isRead);
  const [readBusy, setReadBusy] = React.useState(false);
  const [highlights, setHighlights] = React.useState<Highlight[]>(initialHighlights);
  const [restoreOffset, setRestoreOffset] = React.useState<number | null>(null);
  // Recording does not start until the stored position has been read back.
  // Without this the reader's first scroll report — fired on mount, at the top
  // of the page — races the read and can overwrite the position it was about
  // to restore, which is precisely the bug that makes progress *not* survive a
  // reload.
  const [progressReady, setProgressReady] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [savedHere, setSavedHere] = React.useState(false);
  // A private link's reader body is whatever the user has written, so it has
  // to be state rather than a prop: the editor is on this page.
  const [ownSummary, setOwnSummary] = React.useState(model.readerBody);
  const [likeState, setLikeState] = React.useState({
    count: model.likeCount,
    liked: model.isLiked,
  });
  // Server truth until the thread's own fetch lands, then whatever the thread
  // reports. The action row and the thread heading must never disagree, and
  // the thread is the one that just spoke to the server.
  const [commentCount, setCommentCount] = React.useState(model.commentCount);

  const commentsRef = React.useRef<HTMLDivElement>(null);

  // Staged progress, polled only while there is something to poll. The
  // processing state's brief slot is this list, in the brief's own position:
  // the reader is waiting for the summary, so the summary's place is where
  // the waiting is shown.
  const timelineSeed: Bookmark = React.useMemo(
    () => ({
      id: model.id,
      sourceUrl: model.sourceUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
      // The hook reads `processingStatus` and nothing else off this; the rest
      // is the `Bookmark` type's required surface, and the first response
      // from the timeline replaces the whole object anyway.
      userId: "",
      processingStatus: model.state === "processing" ? "processing" : undefined,
    }),
    [model.id, model.sourceUrl, model.state],
  );

  const { bookmark: live, steps } = useBookmarkProcessingTimeline(
    model.id,
    timelineSeed,
    { enabled: !offline && model.state === "processing" },
  );

  const stillProcessing =
    model.state === "processing" && live.processingStatus === "processing";

  // ---- highlights ------------------------------------------------------
  React.useEffect(() => {
    // Highlights are the owner's, and private even on a public bookmark. The
    // shared route does not ask for them, which is a stronger guarantee than
    // asking and filtering.
    if (!owner || offline) return;
    let cancelled = false;
    void services.listHighlights(model.id).then((rows) => {
      if (!cancelled) setHighlights(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [model.id, offline, owner, services]);

  const createHighlight = React.useCallback(
    async (anchor: HighlightAnchor) => {
      try {
        const created = await services.createHighlight(model.id, anchor);
        setHighlights((current) => [...current, created]);
      } catch {
        // Loud, unlike a dropped progress write: a highlight is something a
        // person did on purpose, and silence here would be a lie about it.
        toast({ title: "Couldn't save that highlight", variant: "danger" });
      }
    },
    [model.id, services, toast],
  );

  // ---- read state ------------------------------------------------------
  const setReadRef = React.useRef<
    ((next: boolean, options?: { announce?: boolean }) => Promise<void>) | null
  >(null);

  const setRead = React.useCallback(
    async (next: boolean, options: { announce?: boolean } = {}) => {
      if (readBusy) return;
      const previous = isRead;
      setIsRead(next);
      setReadBusy(true);
      try {
        const result = next
          ? await services.markRead(model.id)
          : await services.markUnread(model.id);
        setIsRead(result.isRead);
        if (options.announce) {
          toast({
            title: next ? "Marked as read" : "Marked as unread",
            variant: "success",
            undo: {
              // Through a ref: the callback closes over itself, and the undo
              // of an undo has to reach the current one rather than the
              // instance that happened to raise the first toast.
              onUndo: () => {
                void setReadRef.current?.(!next);
              },
            },
          });
        }
      } catch {
        setIsRead(previous);
        toast({ title: "Couldn't update read state", variant: "danger" });
      } finally {
        setReadBusy(false);
      }
    },
    [isRead, model.id, readBusy, services, toast],
  );
  React.useEffect(() => {
    setReadRef.current = setRead;
  }, [setRead]);

  // ---- reading progress ------------------------------------------------
  //
  // One tracker for the life of the mount. It owns the 5s throttle, the
  // trailing write and the flush; this component only hands it numbers.
  const trackerRef = React.useRef<ReadingProgressTracker | null>(null);
  React.useEffect(() => {
    if (!owner || offline) return;

    const tracker = new ReadingProgressTracker({
      write: (percent, scrollOffset) =>
        services.saveProgress(model.id, percent, scrollOffset),
    });
    trackerRef.current = tracker;

    // The other half of "progress survives a reload": ask where we were
    // before recording where we are.
    let cancelled = false;
    void services.getProgress(model.id).then((progress) => {
      if (cancelled) return;
      setRestoreOffset(progress?.scrollOffset ?? null);
      setProgressReady(true);
    });

    // A tab going away is an unmount that never fires one. Both paths flush.
    const onHidden = () => {
      if (document.visibilityState === "hidden") void tracker.flush();
    };
    document.addEventListener("visibilitychange", onHidden);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onHidden);
      void tracker.stop();
      trackerRef.current = null;
    };
  }, [model.id, offline, owner, services]);

  const suggested = React.useRef(false);
  const onProgress = React.useCallback(
    (percent: number, scrollOffset: number) => {
      trackerRef.current?.record(percent, scrollOffset);

      if (percent < READ_SUGGESTION_PERCENT) return;
      if (suggested.current || isRead || !owner) return;
      suggested.current = true;

      // A question, not a fait accompli. The action is in the toast because
      // that is where the user's attention already is; nothing changes until
      // they press it, and what they press is itself undoable.
      toast({
        title: "Finished this one?",
        description: "You're at the end of the article.",
        undo: {
          label: "Mark as read",
          onUndo: () => {
            void setRead(true, { announce: true });
          },
        },
      });
    },
    [isRead, owner, setRead, toast],
  );

  // ---- other actions ---------------------------------------------------
  const regenerate = React.useCallback(async () => {
    setRegenerating(true);
    try {
      await services.reprocess(model.id);
      toast({ title: "Rerunning the brief", description: "This takes a moment." });
      router.refresh();
    } catch {
      toast({ title: "Couldn't start a new run", variant: "danger" });
    } finally {
      setRegenerating(false);
    }
  }, [model.id, router, services, toast]);

  /**
   * The shared route's CTA, and the whole point of the route.
   *
   * A stranger who is signed in gets a real save; one who is not gets the
   * sign-in page with a way back to the article they were reading, rather
   * than a dead end that loses the link. Either way the answer arrives in one
   * press.
   */
  const saveToLibrary = React.useCallback(async () => {
    setSaving(true);
    try {
      const created = await BookmarksClientAPI.create({
        sourceUrl: model.sourceUrl,
      });
      setSavedHere(true);
      toast({
        // A duplicate paste is not an error — the API says so and so does the
        // toast, rather than claiming a save that did not happen.
        title: created.alreadySaved
          ? "Already in your library"
          : "Saved to your library",
        description: created.alreadySaved
          ? undefined
          : "Cosmic is reading it now.",
        variant: "success",
        undo: {
          label: "Open",
          onUndo: () => router.push(`/bookmarks/${created.bookmark.id}`),
        },
      });
    } catch {
      const back = model.shareUrl ? new URL(model.shareUrl).pathname : "/";
      router.push(`/sign-in?redirect_to=${encodeURIComponent(back)}`);
    } finally {
      setSaving(false);
    }
  }, [model.shareUrl, model.sourceUrl, router, toast]);

  const remove = React.useCallback(async () => {
    try {
      await BookmarksClientAPI.remove(model.id);
      router.push("/my/library");
    } catch {
      toast({ title: "Couldn't delete this save", variant: "danger" });
    }
  }, [model.id, router, toast]);

  const like = React.useCallback(
    async (next: boolean) => {
      const previous = likeState;
      setLikeState({
        liked: next,
        count: Math.max(0, previous.count + (next ? 1 : -1)),
      });
      try {
        const result = next
          ? await services.like(model.id)
          : await services.unlike(model.id);
        setLikeState({ liked: result.isLiked, count: result.likeCount });
      } catch {
        setLikeState(previous);
      }
    },
    [likeState, model.id, services],
  );

  const highlightCount = owner ? highlights.length : 0;

  return (
    <article className="mx-auto flex w-full max-w-[720px] flex-col gap-8 pt-8">
      {/* 1 · Hero ------------------------------------------------------ */}
      <header className="flex flex-col gap-3.5">
        {owner ? <Breadcrumb model={model} /> : null}

        <h1 className="font-serif text-[30px] font-semibold leading-[1.2] tracking-[-0.01em] text-fg sm:text-[34px]">
          {model.title}
        </h1>

        <ProvenanceRow
          sources={
            model.domain
              ? [
                  {
                    domain: model.domain,
                    faviconUrl: model.faviconUrl,
                    href: model.sourceUrl,
                  },
                ]
              : undefined
          }
          attribution={model.attribution}
          actor={
            model.sharedByName ? { name: model.sharedByName } : undefined
          }
          action={
            model.sharedByName ? "shared" : owner ? "you saved this" : undefined
          }
          timestamp={
            [model.savedAt, model.readingTime].filter(Boolean).join(" · ") ||
            undefined
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          {owner ? (
            <Button
              type="button"
              variant={isRead ? "secondary" : "primary"}
              onClick={() => void setRead(!isRead, { announce: true })}
              loading={readBusy}
              icon={
                isRead ? (
                  <RotateCcw aria-hidden="true" />
                ) : (
                  <Check aria-hidden="true" />
                )
              }
            >
              {isRead ? "Mark as unread" : "Mark as read"}
            </Button>
          ) : (
            // The shared route's one addition. It is the primary because it
            // is the only thing this page asks a stranger to do — and it
            // really saves, rather than dropping them on a sign-in page with
            // the link they came for left behind.
            <Button
              type="button"
              variant="primary"
              onClick={() => void saveToLibrary()}
              loading={saving}
              icon={<BookmarkPlus aria-hidden="true" />}
            >
              {savedHere ? "Saved to your library" : "Save to your library"}
            </Button>
          )}

          <Button asChild variant="secondary" icon={<ExternalLink aria-hidden="true" />}>
            <a href={model.sourceUrl} target="_blank" rel="noopener noreferrer">
              Open original
            </a>
          </Button>

          {owner ? (
            <>
              <Button
                type="button"
                variant="ghost"
                icon={<ShareIcon aria-hidden="true" />}
                onClick={() => void share(model, toast)}
              >
                Share
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="More actions"
                    icon={<MoreHorizontal aria-hidden="true" />}
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => void regenerate()}>
                    <RotateCw aria-hidden="true" />
                    Regenerate brief
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void remove()}>
                    <Trash2 aria-hidden="true" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}
        </div>
      </header>

      {/* 2 · The brief's position, whatever is in it ------------------- */}
      {model.state === "failed" ? (
        <FailureCallout
          reason={model.processingError}
          sourceUrl={model.sourceUrl}
          onRetry={owner ? () => void regenerate() : undefined}
          retrying={regenerating}
        />
      ) : model.state === "private" ? (
        <OwnSummary
          bookmarkId={model.id}
          initialSummary={ownSummary}
          editable={owner && !offline}
          onSaved={setOwnSummary}
        />
      ) : stillProcessing ? (
        <div className="rounded-md border border-line bg-bg-subtle px-4 py-3.5">
          <p className="mb-2.5 font-sans text-[12.5px] font-medium text-fg">
            Reading the page
          </p>
          <ProcessingSteps steps={steps} announceLabel={model.title} />
        </div>
      ) : (
        <CosmicBrief
          summary={model.briefSummary}
          keyPoints={model.keyPoints}
          domain={model.domain}
          faviconUrl={model.faviconUrl}
          sourceUrl={model.sourceUrl}
          meta={model.readingTime ? `${model.readingTime} article` : undefined}
          onRegenerate={owner ? () => void regenerate() : undefined}
          regenerating={regenerating}
        />
      )}

      {/* 3 · Reader ---------------------------------------------------- */}
      <Reader
        body={model.state === "private" ? ownSummary : model.readerBody}
        loading={stillProcessing && !model.readerBody}
        highlights={owner ? highlights : undefined}
        onCreateHighlight={owner && !offline ? createHighlight : undefined}
        onComment={() =>
          commentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
        onProgress={owner && !offline && progressReady ? onProgress : undefined}
        restoreScrollOffset={restoreOffset}
      />

      {model.images.length > 0 ? <ReaderImages images={model.images} /> : null}

      {model.tags.length > 0 ? (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {model.tags.map((tag) => (
            <li
              key={tag}
              className={cn(
                "rounded-pill border border-line bg-bg-subtle px-2.5 py-1",
                "font-sans text-[12px] leading-none text-fg-secondary",
              )}
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      {/* 4 · Social row, with the highlight count ---------------------- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
        <ActionRow
          likeCount={likeState.count}
          liked={likeState.liked}
          onLikeChange={(next) => void like(next)}
          commentCount={commentCount}
          onComment={() =>
            commentsRef.current?.scrollIntoView({ behavior: "smooth" })
          }
          saved={owner || savedHere}
          onSaveChange={owner ? undefined : () => void saveToLibrary()}
          saveLabel="Save"
          savedLabel="Saved"
          shareUrl={model.shareUrl}
          itemTitle={model.title}
        />
        {highlightCount > 0 ? (
          <span className="font-sans text-[12.5px] leading-[1.4] text-fg-secondary">
            {highlightCount} {highlightCount === 1 ? "highlight" : "highlights"}
          </span>
        ) : null}
      </div>

      {/* 5 · Comments ------------------------------------------------- */}
      {/* In full, not in a drawer. The drawer is the *feed's* answer to a
          thread, where a conversation expanded in place would bury the next
          four items; here the reader has reached the end of the thing they
          came for, and the conversation is what comes next. */}
      <div
        ref={commentsRef}
        id="comments"
        data-detail-slot="comments"
        className="scroll-mt-24"
      >
        <CommentThread
          bookmarkId={model.id}
          initialCount={commentCount}
          onCountChange={setCommentCount}
          offline={offline}
        />
      </div>
    </article>
  );
}

function Breadcrumb({ model }: { model: BookmarkDetailModel }) {
  const crumbs = [
    { id: "library", name: "Library", href: "/my/library" },
    ...model.collectionPath,
  ];

  return (
    <nav aria-label="Breadcrumb">
      <ol className="m-0 flex list-none flex-wrap items-center gap-1 p-0 font-sans text-[12.5px] leading-[1.4] text-fg-secondary">
        {crumbs.map((crumb, index) => (
          <li key={crumb.id} className="flex items-center gap-1">
            {index > 0 ? (
              <ChevronRight
                aria-hidden="true"
                className="size-3 shrink-0 text-fg-tertiary [stroke-width:1.7]"
              />
            ) : null}
            <Link
              href={crumb.href}
              className={cn(
                "rounded-xs transition-colors duration-cd-fast ease-cd hover:text-fg",
                focusRing,
              )}
            >
              {crumb.name}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * The failed state. `--cd-danger`, one sentence of what went wrong, a Retry —
 * and the original link, because the save is the URL and the pipeline is not.
 */
function FailureCallout({
  reason,
  sourceUrl,
  onRetry,
  retrying,
}: {
  reason?: string;
  sourceUrl: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex min-w-0 flex-wrap items-start gap-3 rounded-md",
        "border border-[color:var(--cd-danger)] bg-bg-subtle px-4 py-3.5",
      )}
    >
      <AlertCircle
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-[color:var(--cd-danger)] [stroke-width:1.7]"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-sans text-[13.5px] font-medium leading-[1.4] text-fg">
          Cosmic couldn&apos;t finish reading this page.
        </p>
        <p className="font-sans text-[12.5px] leading-[1.5] text-fg-secondary">
          {reason || "The run stopped before the brief was written."} Your save
          is intact and the original still opens.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {onRetry ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onRetry}
            loading={retrying}
            icon={<RotateCw aria-hidden="true" />}
          >
            Retry
          </Button>
        ) : null}
        <Button asChild variant="ghost" size="sm" icon={<ExternalLink aria-hidden="true" />}>
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
            Open original
          </a>
        </Button>
      </div>
    </div>
  );
}

function ReaderImages({
  images,
}: {
  images: { url: string; title?: string; description?: string }[];
}) {
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2">
      {images.map((image) => (
        <li key={image.url} className="flex flex-col gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.title || ""}
            loading="lazy"
            className="w-full rounded-md border border-line object-cover"
          />
          {image.title ? (
            <span className="font-sans text-[12px] leading-[1.4] text-fg-secondary">
              {image.title}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * Share is a copy, not a dialog.
 *
 * The save is already public or it is not; the interesting act is getting the
 * link into a message, and a modal between the user and their clipboard is a
 * step with nothing in it.
 */
async function share(
  model: BookmarkDetailModel,
  toast: ReturnType<typeof useToast>["toast"],
): Promise<void> {
  try {
    const url =
      model.shareUrl ??
      (await BookmarksClientAPI.share(model.id)).shareUrl;
    await navigator.clipboard.writeText(url);
    toast({ title: "Share link copied", description: url });
  } catch {
    toast({ title: "Couldn't create a share link", variant: "danger" });
  }
}
