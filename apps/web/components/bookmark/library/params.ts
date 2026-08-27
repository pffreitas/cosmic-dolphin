import {
  BookmarkReadStatus,
  BookmarkScope,
  BookmarkSort,
} from "@cosmic-dolphin/api-client";

/**
 * What the Library is currently showing, read off the URL.
 *
 * Every part of it lives in the query string on purpose
 * (docs/functional-spec/04-library.md § Read state): a filtered view has to
 * survive a refresh and be shareable, and a filter held only in React state is
 * neither.
 */
export interface LibraryView {
  /** Which rail row: every save, the unfiled ones, or the archive. */
  scope: BookmarkScope;
  /** Set when a collection row is selected. Wins over `scope`. */
  collectionId?: string;
  readStatus: BookmarkReadStatus;
  sort: BookmarkSort;
}

export const DEFAULT_SORT: BookmarkSort = BookmarkSort.Newest;
export const LIBRARY_PAGE_SIZE = 25;

/** Where the sticky sort is kept — client side, per the spec. */
export const SORT_STORAGE_KEY = "cosmic.library.sort";

export const SORT_OPTIONS: { value: BookmarkSort; label: string }[] = [
  // Chronological first, and always one click away — it is the order the
  // Library falls back to, not one option among four equals.
  { value: BookmarkSort.Newest, label: "Newest" },
  { value: BookmarkSort.Oldest, label: "Oldest" },
  { value: BookmarkSort.RecentlyRead, label: "Recently read" },
  { value: BookmarkSort.LongestUnread, label: "Longest unread" },
];

export const READ_STATUS_OPTIONS: {
  value: BookmarkReadStatus;
  label: string;
}[] = [
  { value: BookmarkReadStatus.All, label: "All" },
  { value: BookmarkReadStatus.Unread, label: "Unread" },
  { value: BookmarkReadStatus.Read, label: "Read" },
];

export type LibraryQueryParams = {
  collection_id?: string;
  read_status?: string;
  scope?: string;
  sort?: string;
};

function isReadStatus(value: string | undefined): value is BookmarkReadStatus {
  return (
    value === BookmarkReadStatus.Unread ||
    value === BookmarkReadStatus.Read ||
    value === BookmarkReadStatus.All
  );
}

function isScope(value: string | undefined): value is BookmarkScope {
  return (
    value === BookmarkScope.All ||
    value === BookmarkScope.Inbox ||
    value === BookmarkScope.Archive
  );
}

function isSort(value: string | undefined): value is BookmarkSort {
  return SORT_OPTIONS.some((option) => option.value === value);
}

/**
 * Anything unrecognised falls back to the default rather than erroring: a
 * hand-edited query string should land the user on their library, not on a
 * 400.
 */
export function parseLibraryView(params: LibraryQueryParams): LibraryView {
  const collectionId = params.collection_id?.trim() || undefined;

  return {
    // A named collection is a scope of its own; `scope` only decides between
    // the three rows that are not collections.
    scope: collectionId
      ? BookmarkScope.All
      : isScope(params.scope)
        ? params.scope
        : BookmarkScope.All,
    collectionId,
    readStatus: isReadStatus(params.read_status)
      ? params.read_status
      : BookmarkReadStatus.All,
    sort: isSort(params.sort) ? params.sort : DEFAULT_SORT,
  };
}

/**
 * The canonical URL for a view. Defaults are omitted, so `All saves · All ·
 * Newest` is the bare `/my/library` and the address bar stays legible.
 */
export function libraryHref(view: Partial<LibraryView>): string {
  const params = new URLSearchParams();

  if (view.collectionId) {
    params.set("collection_id", view.collectionId);
  } else if (view.scope && view.scope !== BookmarkScope.All) {
    params.set("scope", view.scope);
  }

  if (view.readStatus && view.readStatus !== BookmarkReadStatus.All) {
    params.set("read_status", view.readStatus);
  }

  if (view.sort && view.sort !== DEFAULT_SORT) {
    params.set("sort", view.sort);
  }

  const query = params.toString();
  return query ? `/my/library?${query}` : "/my/library";
}

/** Identity of a view, for remounting the client list when the filter moves. */
export function libraryViewKey(view: LibraryView): string {
  return [
    view.collectionId ?? view.scope,
    view.readStatus,
    view.sort,
  ].join("|");
}

export interface LibraryHeading {
  title: string;
  /** What the collection breadcrumb should say when it is not a collection. */
  countNoun: string;
}

export function libraryHeading(
  view: LibraryView,
  collectionName?: string
): LibraryHeading {
  if (view.collectionId) {
    return { title: collectionName ?? "Collection", countNoun: "save" };
  }
  if (view.scope === BookmarkScope.Inbox) {
    return { title: "Inbox", countNoun: "unfiled save" };
  }
  if (view.scope === BookmarkScope.Archive) {
    return { title: "Archive", countNoun: "archived save" };
  }
  return { title: "All saves", countNoun: "save" };
}

export interface LibraryEmptyCopy {
  title: string;
  description: string;
  /** True only for a library with nothing in it at all — the one CTA case. */
  firstSave: boolean;
}

/**
 * Three different emptinesses, three different sentences.
 *
 * components.md: "Empty states name the specific emptiness." A library with
 * nothing in it, a collection nothing has been filed into, and a filter that
 * matched nothing are three different situations, and one shared "Nothing
 * here" would tell the user nothing about which of them they are in.
 */
export function libraryEmptyCopy(
  view: LibraryView,
  totalSaves: number,
  collectionName?: string
): LibraryEmptyCopy {
  if (totalSaves === 0 && view.scope !== BookmarkScope.Archive) {
    return {
      title: "Your library is empty.",
      description:
        "Save a link and it lands here — summarised, tagged, and filed while you get on with something else.",
      firstSave: true,
    };
  }

  const where = view.collectionId
    ? (collectionName ?? "this collection")
    : view.scope === BookmarkScope.Inbox
      ? "your inbox"
      : view.scope === BookmarkScope.Archive
        ? "your archive"
        : "your library";

  if (view.readStatus === BookmarkReadStatus.Unread) {
    return {
      title: `Nothing unread in ${where}.`,
      description: "Every save here has been read. Switch to All to see them.",
      firstSave: false,
    };
  }

  if (view.readStatus === BookmarkReadStatus.Read) {
    return {
      title: `Nothing read in ${where} yet.`,
      description:
        "Saves move here once you mark them read — it never happens on your behalf.",
      firstSave: false,
    };
  }

  if (view.scope === BookmarkScope.Archive) {
    return {
      title: "Nothing archived.",
      description:
        "Archived saves leave the list but stay searchable, and come back whenever you want them.",
      firstSave: false,
    };
  }

  if (view.scope === BookmarkScope.Inbox) {
    return {
      title: "Inbox is clear.",
      description:
        "Everything you have saved has been filed into a collection.",
      firstSave: false,
    };
  }

  return {
    title: `Nothing in ${where} yet.`,
    description:
      "Drag a save onto this collection in the rail, or use a row's overflow menu to move it here.",
    firstSave: false,
  };
}
