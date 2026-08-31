"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  BookmarkIcon,
  Check,
  Inbox,
  MoreHorizontal,
  Tag as TagIcon,
  Trash2,
} from "lucide-react";
import {
  BookmarkLibraryCounts,
  BookmarkReadStatus,
  BookmarkScope,
  BookmarkSort,
  Collection,
  CollectionSuggestion,
} from "@cosmic-dolphin/api-client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { focusRing } from "@/components/ui/focus-ring";
import { Input } from "@/components/ui/input";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import {
  LibraryList,
  LibraryRow,
  LibraryRowSkeleton,
} from "@/components/bookmark/library-row";
import { BookmarksClientAPI } from "@/lib/api/bookmarks-client";

import { CollectionTree, CollectionTreeSkeleton } from "./collection-tree";
import {
  LIBRARY_PAGE_SIZE,
  LibraryView as LibraryViewParams,
  READ_STATUS_OPTIONS,
  SORT_OPTIONS,
  SORT_STORAGE_KEY,
  DEFAULT_SORT,
  libraryEmptyCopy,
  libraryHeading,
  libraryHref,
} from "./params";
import type { LibraryItem } from "./row-data";
import { toLibraryItem } from "./row-data";
import {
  EMPTY_SELECTION,
  SelectionState,
  dragPayload,
  selectionClick,
} from "./selection";
import { CollectionSuggestionCallout } from "./suggestion-callout";
import { buildLibraryTree, flattenCollections } from "./tree";

const DRAG_MIME = "application/x-cosmic-bookmarks";

export interface LibraryViewProps {
  view: LibraryViewParams;
  items: LibraryItem[];
  nextCursor?: string;
  /** The list request failed. The rail still renders; the column offers Retry. */
  error?: string;
  counts: BookmarkLibraryCounts | null;
  collections: Collection[];
  /** The one proposal worth answering, if there is one. */
  suggestion?: CollectionSuggestion;
  /** Whether `sort` came from the URL or from the default. */
  sortExplicit: boolean;
}

/**
 * The Library — docs/design-system/pages.md § Library.
 *
 * `216px minmax(0,1fr)`: the collection tree and its suggestion on the left,
 * a header block and a `divide-y` list of rows on the right. Private surface,
 * so there is no like, no comment, no count and no author anywhere in it — a
 * user's Library is theirs (04-library.md).
 *
 * The list is local state seeded once from the server. A `router.refresh()`
 * after a write therefore updates the rail's counts and the suggestion without
 * throwing away the pages the user has already loaded, and without fighting
 * the optimistic row that is already on screen.
 */
export function LibraryView({
  view,
  items: initialItems,
  nextCursor: initialCursor,
  error,
  counts,
  collections,
  suggestion,
  sortExplicit,
}: LibraryViewProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [items, setItems] = React.useState<LibraryItem[]>(initialItems);
  const [cursor, setCursor] = React.useState<string | undefined>(initialCursor);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [selection, setSelection] =
    React.useState<SelectionState>(EMPTY_SELECTION);
  const [dragging, setDragging] = React.useState<string[]>([]);
  const [tagDialogOpen, setTagDialogOpen] = React.useState(false);
  const [tagDraft, setTagDraft] = React.useState("");
  const [pendingDelete, setPendingDelete] = React.useState<LibraryItem[] | null>(
    null
  );

  const tree = React.useMemo(
    () => buildLibraryTree(collections, counts, view),
    [collections, counts, view]
  );
  const flatCollections = React.useMemo(() => flattenCollections(tree), [tree]);
  const collectionName = view.collectionId
    ? collections.find((entry) => entry.id === view.collectionId)?.name
    : undefined;

  const heading = libraryHeading(view, collectionName);
  const selected = React.useMemo(
    () => new Set(selection.selected),
    [selection.selected]
  );
  const inArchive = view.scope === BookmarkScope.Archive;

  // Sort is per-user sticky, stored client side (04-library.md § Ordering).
  // Only an explicit choice is remembered — otherwise the first visit would
  // write the default over whatever the user had picked last time.
  React.useEffect(() => {
    if (!sortExplicit) return;
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, view.sort);
    } catch {
      // Private mode, or storage disabled. Stickiness is a convenience.
    }
  }, [sortExplicit, view.sort]);

  // ...and restored when the URL does not carry one. The URL always wins, so a
  // shared `?sort=oldest` link shows the recipient what the sender saw.
  React.useEffect(() => {
    if (sortExplicit) return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(SORT_STORAGE_KEY);
    } catch {
      return;
    }
    if (
      stored &&
      stored !== view.sort &&
      SORT_OPTIONS.some((option) => option.value === stored)
    ) {
      router.replace(libraryHref({ ...view, sort: stored as BookmarkSort }));
    }
    // Deliberately runs on mount only: re-running it on every navigation would
    // fight the user's next click back to the stored value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function navigate(next: Partial<LibraryViewParams>) {
    router.push(libraryHref({ ...view, ...next }));
  }

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await BookmarksClientAPI.listPage({
        collection_id: view.collectionId,
        scope: view.scope,
        read_status: view.readStatus,
        sort: view.sort,
        limit: LIBRARY_PAGE_SIZE,
        cursor,
      });
      setItems((current) => [
        ...current,
        ...page.bookmarks.map((bookmark) => toLibraryItem(bookmark)),
      ]);
      setCursor(page.nextCursor);
    } catch {
      toast({
        title: "Couldn't load more",
        description: "The next page didn't arrive. Try again.",
        variant: "danger",
      });
    } finally {
      setLoadingMore(false);
    }
  }

  /**
   * Every bulk action, and every row action, goes through here.
   *
   * The shape is always the same: change the rows on screen first, then do the
   * work, then offer an undo for eight seconds — four is not enough time to
   * notice a mistake and reach for the fix. Delete is the exception and asks
   * first, because there is nothing to undo it with.
   */
  async function mutate(options: {
    ids: string[];
    optimistic: (item: LibraryItem) => LibraryItem | null;
    perform: (id: string) => Promise<unknown>;
    revert: (before: LibraryItem) => Promise<unknown>;
    title: string;
    undoTitle: string;
  }) {
    const { ids } = options;
    if (ids.length === 0) return;

    // Captured per click, not per render, so an undo restores the list as it
    // stood when the action ran.
    const snapshot = items;
    const affected = snapshot.filter((item) => ids.includes(item.id));

    setItems((current) =>
      current.flatMap((item) => {
        if (!ids.includes(item.id)) return [item];
        const next = options.optimistic(item);
        return next ? [next] : [];
      })
    );
    setSelection(EMPTY_SELECTION);

    const results = await Promise.allSettled(ids.map(options.perform));
    const failed = results.filter((r) => r.status === "rejected").length;

    if (failed > 0) {
      setItems(snapshot);
      toast({
        title: "That didn't go through",
        description: `${failed} of ${ids.length} couldn't be changed. Nothing was moved.`,
        variant: "danger",
      });
      router.refresh();
      return;
    }

    router.refresh();
    toast({
      title: options.title,
      undo: {
        onUndo: async () => {
          const undone = await Promise.allSettled(affected.map(options.revert));
          if (undone.some((r) => r.status === "rejected")) {
            toast({ title: "Couldn't undo that", variant: "danger" });
            router.refresh();
            return;
          }
          setItems(snapshot);
          toast({ title: options.undoTitle });
          router.refresh();
        },
      },
    });
  }

  function refile(ids: string[], collectionId: string | null) {
    const target = collectionId
      ? flatCollections.find((entry) => entry.id === collectionId)?.name
      : "Inbox";

    return mutate({
      ids,
      // Refiling moves rows out of a collection view; everywhere else the row
      // stays and its breadcrumb changes.
      optimistic: (item) =>
        view.collectionId && view.collectionId !== collectionId
          ? null
          : view.scope === BookmarkScope.Inbox && collectionId !== null
            ? null
            : {
                ...item,
                collectionId,
                filing: false,
                collectionPath: collectionId
                  ? [
                      {
                        id: collectionId,
                        name: target ?? "Collection",
                        href: libraryHref({ collectionId }),
                      },
                    ]
                  : [],
              },
      perform: (id) => BookmarksClientAPI.refile(id, collectionId),
      revert: (before) =>
        BookmarksClientAPI.refile(before.id, before.collectionId),
      title: `Moved ${countLabel(ids.length)} to ${target}`,
      undoTitle: "Move undone",
    });
  }

  function setRead(ids: string[], read: boolean) {
    return mutate({
      ids,
      optimistic: (item) =>
        view.readStatus !== BookmarkReadStatus.All
          ? null
          : { ...item, unread: !read },
      perform: (id) =>
        read
          ? BookmarksClientAPI.markRead(id)
          : BookmarksClientAPI.markUnread(id),
      revert: (before) =>
        before.unread
          ? BookmarksClientAPI.markUnread(before.id)
          : BookmarksClientAPI.markRead(before.id),
      title: read
        ? `Marked ${countLabel(ids.length)} read`
        : `Marked ${countLabel(ids.length)} unread`,
      undoTitle: "Read state restored",
    });
  }

  function addTag(ids: string[], tag: string) {
    const clean = tag.trim();
    if (!clean) return Promise.resolve();

    const byId = new Map(items.map((item) => [item.id, item]));

    return mutate({
      ids,
      optimistic: (item) =>
        item.tags.includes(clean)
          ? item
          : { ...item, tags: [...item.tags, clean] },
      perform: (id) => {
        const item = byId.get(id);
        const tags = item?.tags ?? [];
        return BookmarksClientAPI.update(id, {
          tags: tags.includes(clean) ? tags : [...tags, clean],
        });
      },
      // The whole list goes back, not just the tag that was added — that is
      // why the endpoint takes a list rather than a delta.
      revert: (before) =>
        BookmarksClientAPI.update(before.id, { tags: before.tags }),
      title: `Tagged ${countLabel(ids.length)} “${clean}”`,
      undoTitle: "Tag removed",
    });
  }

  function setArchived(ids: string[], archived: boolean) {
    return mutate({
      ids,
      // Archiving takes a row out of every view except the Archive itself.
      optimistic: () => null,
      perform: (id) => BookmarksClientAPI.update(id, { isArchived: archived }),
      revert: (before) =>
        BookmarksClientAPI.update(before.id, { isArchived: before.archived }),
      title: archived
        ? `Archived ${countLabel(ids.length)}`
        : `Restored ${countLabel(ids.length)}`,
      undoTitle: archived ? "Back in your library" : "Back in the archive",
    });
  }

  async function destroy(targets: LibraryItem[]) {
    const ids = targets.map((item) => item.id);
    const snapshot = items;

    setItems((current) => current.filter((item) => !ids.includes(item.id)));
    setSelection(EMPTY_SELECTION);
    setPendingDelete(null);

    const results = await Promise.allSettled(
      ids.map((id) => BookmarksClientAPI.remove(id))
    );
    const failed = results.filter((r) => r.status === "rejected").length;

    if (failed > 0) {
      setItems(snapshot);
      toast({
        title: "Couldn't delete everything",
        description: `${failed} of ${ids.length} are still there.`,
        variant: "danger",
      });
    } else {
      // No undo: deleting cascades to likes, comments, highlights and chunks.
      // That is why it asked first.
      toast({ title: `Deleted ${countLabel(ids.length)}` });
    }
    router.refresh();
  }

  function toggleAt(index: number, shiftKey: boolean) {
    setSelection((current) =>
      selectionClick(
        items.map((item) => item.id),
        current,
        index,
        shiftKey
      )
    );
  }

  const selectedItems = items.filter((item) => selected.has(item.id));
  const headerCount = countForView();
  const emptyCopy = libraryEmptyCopy(view, counts?.all ?? 0, collectionName);

  function countForView(): number | null {
    if (!counts) return null;
    if (view.collectionId) {
      const flat = [...tree.collections, ...tree.collections.flatMap((n) => n.children)];
      return flat.find((node) => node.collectionId === view.collectionId)?.count ?? 0;
    }
    if (view.scope === BookmarkScope.Inbox) return counts.inbox;
    if (view.scope === BookmarkScope.Archive) return counts.archived;
    return counts.all;
  }

  return (
    <div className="grid grid-cols-1 gap-8 py-6 md:grid-cols-[216px_minmax(0,1fr)]">
      <aside className="flex min-w-0 flex-col gap-5">
        <CollectionTree
          tree={tree}
          draggingCount={dragging.length}
          onDropBookmarks={(collectionId) => {
            const ids = dragging;
            setDragging([]);
            if (ids.length) void refile(ids, collectionId);
          }}
        />
        {suggestion ? (
          <CollectionSuggestionCallout suggestion={suggestion} />
        ) : null}
      </aside>

      <section className="flex min-w-0 flex-col">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-4">
          <div className="min-w-0">
            <h1 className="m-0 font-serif text-[22px] font-semibold leading-[1.25] text-fg">
              {heading.title}
            </h1>
            <p className="m-0 pt-1 font-sans text-[12.5px] leading-[1.4] text-fg-secondary">
              {headerCount === null
                ? "Counts unavailable"
                : `${headerCount} ${heading.countNoun}${headerCount === 1 ? "" : "s"}`}
              {counts && !inArchive ? ` · ${counts.unread} unread` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              aria-label="Read status"
              value={view.readStatus}
              onValueChange={(value) =>
                navigate({ readStatus: value as BookmarkReadStatus })
              }
            >
              {READ_STATUS_OPTIONS.map((option) => (
                <SegmentedItem key={option.value} value={option.value}>
                  {option.label}
                </SegmentedItem>
              ))}
            </Segmented>

            <Segmented
              aria-label="Sort"
              value={view.sort}
              onValueChange={(value) => navigate({ sort: value as BookmarkSort })}
            >
              {SORT_OPTIONS.map((option) => (
                <SegmentedItem key={option.value} value={option.value}>
                  {option.label}
                </SegmentedItem>
              ))}
            </Segmented>
          </div>
        </header>

        {error ? (
          <div className="rounded-md border border-line bg-bg-subtle p-5">
            <p className="m-0 font-sans text-[13.5px] leading-[1.55] text-fg">
              {error}
            </p>
            <p className="m-0 pt-1 font-sans text-[12.5px] leading-[1.5] text-fg-secondary">
              Nothing is lost — the request didn&apos;t come back.
            </p>
            <div className="pt-3">
              <Button size="sm" onClick={() => router.refresh()}>
                Retry
              </Button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            ground
            icon={BookmarkIcon}
            title={emptyCopy.title}
            description={emptyCopy.description}
            action={
              emptyCopy.firstSave ? null : view.sort !== DEFAULT_SORT ||
                view.readStatus !== BookmarkReadStatus.All ? (
                <Button
                  size="sm"
                  onClick={() =>
                    navigate({
                      readStatus: BookmarkReadStatus.All,
                      sort: DEFAULT_SORT,
                    })
                  }
                >
                  Clear filters
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <LibraryList>
              {items.map((item, index) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(event) => {
                    const payload = dragPayload(selection, item.id);
                    setDragging(payload);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(DRAG_MIME, payload.join(","));
                  }}
                  onDragEnd={() => setDragging([])}
                  className={cn(
                    "group/row flex items-start gap-1 border-b border-line last:border-b-0",
                    dragging.includes(item.id) && "opacity-60",
                  )}
                >
                  <SelectionToggle
                    label={item.title}
                    checked={selected.has(item.id)}
                    onToggle={(shiftKey) => toggleAt(index, shiftKey)}
                  />
                  <LibraryRow
                    className={cn(
                      "min-w-0 flex-1 border-b-0",
                      selected.has(item.id) && "bg-accent-soft hover:bg-accent-soft",
                    )}
                    href={item.href}
                    title={item.title}
                    summary={item.summary}
                    collectionPath={item.collectionPath}
                    filing={item.filing}
                    unread={item.unread}
                    tags={item.tags}
                    domain={item.domain}
                    savedAt={item.savedAt}
                    readingTime={item.readingTime}
                    thumbnailUrl={item.thumbnailUrl}
                    privateLink={item.privateLink}
                    summaryLoading={item.summaryLoading}
                    actions={
                      <RowActions
                        item={item}
                        collections={flatCollections}
                        inArchive={inArchive}
                        onSetRead={(read) => void setRead([item.id], read)}
                        onRefile={(collectionId) =>
                          void refile([item.id], collectionId)
                        }
                        onArchive={() =>
                          void setArchived([item.id], !inArchive)
                        }
                        onDelete={() => setPendingDelete([item])}
                      />
                    }
                  />
                </div>
              ))}
            </LibraryList>

            {cursor ? (
              <div className="flex justify-center py-6">
                <Button size="sm" loading={loadingMore} onClick={loadMore}>
                  Load more
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>

      {selectedItems.length > 0 ? (
        <BulkBar
          count={selectedItems.length}
          collections={flatCollections}
          inArchive={inArchive}
          onClear={() => setSelection(EMPTY_SELECTION)}
          onRefile={(collectionId) =>
            void refile(
              selectedItems.map((item) => item.id),
              collectionId
            )
          }
          onSetRead={(read) =>
            void setRead(
              selectedItems.map((item) => item.id),
              read
            )
          }
          onAddTag={() => {
            setTagDraft("");
            setTagDialogOpen(true);
          }}
          onArchive={() =>
            void setArchived(
              selectedItems.map((item) => item.id),
              !inArchive
            )
          }
          onDelete={() => setPendingDelete(selectedItems)}
        />
      ) : null}

      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a tag</DialogTitle>
            <DialogDescription>
              Applied to {countLabel(selectedItems.length)}. Tags already on a
              save are left alone.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={tagDraft}
            placeholder="typography"
            aria-label="Tag"
            onChange={(event) => setTagDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && tagDraft.trim()) {
                event.preventDefault();
                const ids = selectedItems.map((item) => item.id);
                setTagDialogOpen(false);
                void addTag(ids, tagDraft);
              }
            }}
          />
          <DialogFooter>
            <Button size="sm" onClick={() => setTagDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!tagDraft.trim()}
              onClick={() => {
                const ids = selectedItems.map((item) => item.id);
                setTagDialogOpen(false);
                void addTag(ids, tagDraft);
              }}
            >
              Add tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingDelete?.length === 1
                ? "Delete this save?"
                : `Delete ${countLabel(pendingDelete?.length ?? 0)}?`}
            </DialogTitle>
            <DialogDescription>
              {pendingDelete?.length === 1 ? (
                <>
                  <b className="font-medium text-fg">{pendingDelete[0].title}</b>{" "}
                  and everything attached to it — highlights, comments, likes —
                  go permanently. Archiving keeps it searchable instead.
                </>
              ) : (
                <>
                  Everything attached to them — highlights, comments, likes —
                  goes permanently. Archiving keeps them searchable instead.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="dangerSolid"
              onClick={() => pendingDelete && void destroy(pendingDelete)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function countLabel(count: number): string {
  return `${count} ${count === 1 ? "save" : "saves"}`;
}

/**
 * The selection checkbox.
 *
 * It keeps its 32px of gutter whether it is visible or not, so a row does not
 * shift sideways when the pointer arrives — the same reason the unread dot
 * leaves a transparent spacer behind. Shift-click extends from the last row
 * touched.
 */
function SelectionToggle({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: (shiftKey: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`Select ${label}`}
      onClick={(event) => onToggle(event.shiftKey)}
      className={cn(
        "mt-[18px] flex size-8 shrink-0 items-center justify-center rounded-sm",
        "transition-opacity duration-cd-fast ease-cd",
        "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100",
        checked && "opacity-100",
        focusRing,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-[18px] items-center justify-center rounded-xs border",
          checked
            ? "border-accent bg-accent text-accent-fg"
            : "border-line-strong bg-bg-panel",
        )}
      >
        {checked ? <Check className="size-3 [stroke-width:2.4]" /> : null}
      </span>
    </button>
  );
}

function RowActions({
  item,
  collections,
  inArchive,
  onSetRead,
  onRefile,
  onArchive,
  onDelete,
}: {
  item: LibraryItem;
  collections: { id: string; name: string; depth: number }[];
  inArchive: boolean;
  onSetRead: (read: boolean) => void;
  onRefile: (collectionId: string | null) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${item.title}`}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onSetRead(item.unread)}>
          {item.unread ? "Mark as read" : "Mark as unread"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* The keyboard route to the same thing dragging does. */}
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onRefile(null)}>Inbox</DropdownMenuItem>
        {collections.map((collection) => (
          <DropdownMenuItem
            key={collection.id}
            onSelect={() => onRefile(collection.id)}
          >
            <span className={collection.depth > 0 ? "pl-3" : undefined}>
              {collection.name}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onArchive}>
          {inArchive ? "Restore" : "Archive"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDelete}>Delete…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The bulk bar. Sticky at the foot of the viewport while a selection stands,
 * because scrolling to find the thing you selected should not lose the actions
 * that apply to it.
 */
function BulkBar({
  count,
  collections,
  inArchive,
  onClear,
  onRefile,
  onSetRead,
  onAddTag,
  onArchive,
  onDelete,
}: {
  count: number;
  collections: { id: string; name: string; depth: number }[];
  inArchive: boolean;
  onClear: () => void;
  onRefile: (collectionId: string | null) => void;
  onSetRead: (read: boolean) => void;
  onAddTag: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Selection actions"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto flex flex-wrap items-center gap-2",
          "rounded-lg border border-line bg-bg-panel px-3 py-2",
          "shadow-[var(--cd-shadow-popover)]",
        )}
      >
        <span className="px-1 font-sans text-[12.5px] font-medium leading-none text-fg">
          {countLabel(count)} selected
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" icon={<Inbox aria-hidden="true" />}>
              Move to
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => onRefile(null)}>
              Inbox
            </DropdownMenuItem>
            {collections.map((collection) => (
              <DropdownMenuItem
                key={collection.id}
                onSelect={() => onRefile(collection.id)}
              >
                <span className={collection.depth > 0 ? "pl-3" : undefined}>
                  {collection.name}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="sm" onClick={() => onSetRead(true)}>
          Mark read
        </Button>
        <Button size="sm" onClick={() => onSetRead(false)}>
          Mark unread
        </Button>
        <Button size="sm" icon={<TagIcon aria-hidden="true" />} onClick={onAddTag}>
          Add tag
        </Button>
        <Button
          size="sm"
          icon={
            inArchive ? (
              <ArchiveRestore aria-hidden="true" />
            ) : (
              <Archive aria-hidden="true" />
            )
          }
          onClick={onArchive}
        >
          {inArchive ? "Restore" : "Archive"}
        </Button>
        <Button
          size="sm"
          variant="danger"
          icon={<Trash2 aria-hidden="true" />}
          onClick={onDelete}
        >
          Delete
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}

/** Six rows, the geometry of the real ones. */
export function LibraryListSkeleton() {
  return (
    <LibraryList>
      {Array.from({ length: 6 }).map((_, index) => (
        <LibraryRowSkeleton key={index} />
      ))}
    </LibraryList>
  );
}

/**
 * The loading state, in the real layout.
 *
 * The rail's labels render immediately with dashes where the counts go, and
 * the column holds six skeleton rows with the geometry of the real ones — so
 * the only thing that changes when the data lands is the content.
 */
export function LibraryFallback({ view }: { view: LibraryViewParams }) {
  const heading = libraryHeading(view);

  return (
    <div className="grid grid-cols-1 gap-8 py-6 md:grid-cols-[216px_minmax(0,1fr)]">
      <aside className="flex min-w-0 flex-col gap-5">
        <CollectionTreeSkeleton />
      </aside>
      <section className="flex min-w-0 flex-col">
        <header className="pb-4">
          <h1 className="m-0 font-serif text-[22px] font-semibold leading-[1.25] text-fg">
            {heading.title}
          </h1>
          <p className="m-0 pt-1 font-sans text-[12.5px] leading-[1.4] text-fg-secondary">
            Loading your saves…
          </p>
        </header>
        <LibraryListSkeleton />
      </section>
    </div>
  );
}
