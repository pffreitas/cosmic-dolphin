"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Compass,
  FolderOpen,
  Home,
  Library,
  Link2,
  Loader2,
  Search,
  UserRound,
} from "lucide-react";
import type {
  Collection,
  HybridSearchResultItem,
  PublicProfile,
} from "@cosmic-dolphin/api-client";

import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCommandDialog } from "@/components/providers/command-dialog-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/use-debounce";
import { useAppDispatch } from "@/lib/store/hooks";
import { saveCapture } from "@/lib/store/slices/bookmarksSlice";
import { useCaptureToast } from "@/components/bookmark/capture-toast";
import { BookmarksClientAPI } from "@/lib/api/bookmarks-client";
import { SearchClientAPI } from "@/lib/api/search-client";
import { SocialClientAPI } from "@/lib/api/social-client";
import { SearchRow } from "@/components/search/search-row";
import {
  searchHref,
  toSearchItem,
  urlFromQuery,
  type SearchItem,
} from "@/components/search/search-data";

/**
 * The command palette — `⌘K`.
 *
 * Sections in **fixed order**: Actions, Your saves, Collections, People. Fixed
 * because a palette whose sections reorder by relevance makes muscle memory
 * impossible: the reader who has pressed ⌘K, typed three letters and hit Enter
 * a hundred times is relying on the shape of the list, not reading it.
 *
 * Saves render `SearchRow` — the same row, with the same provenance line, that
 * `/search` renders. That is the whole of D17's outcome: one vocabulary across
 * the route and the palette, kept by sharing a component rather than by
 * matching a spec twice.
 *
 * **Typing a URL surfaces "Save this link" as the first action.** Pasting a
 * link into a search field is a save that has been mistyped as a query, and
 * the palette answers what was meant. The save itself goes through the same
 * `saveCapture` the header's field uses, so it is optimistic, it never blocks,
 * and it lands in `<PendingCaptures />` like any other paste.
 *
 * There is no bare "Save a link" action. A save needs a URL and the palette's
 * input is the only field in reach, so the action appears exactly when it can
 * be carried out and says what it will do.
 */
export function GlobalCommandDialog() {
  const { open, setOpen } = useCommandDialog();
  const isMobile = useIsMobile();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const announce = useCaptureToast();

  const [value, setValue] = React.useState("");
  const debounced = useDebounce(value, 250);

  const [items, setItems] = React.useState<SearchItem[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [people, setPeople] = React.useState<PublicProfile[]>([]);

  const query = value.trim();
  const url = urlFromQuery(value);

  // Collections and following are the reader's own two small lists. Loaded once
  // when the palette first opens and filtered locally — a keystroke-per-request
  // round trip for twenty rows the browser already has would be slower than
  // typing.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void (async () => {
      const [ownCollections, profile] = await Promise.all([
        BookmarksClientAPI.listCollections().catch(() => []),
        SocialClientAPI.me(),
      ]);
      if (cancelled) return;
      setCollections(ownCollections);

      if (profile?.handle) {
        const followed = await SocialClientAPI.following(profile.handle);
        if (!cancelled) setPeople(followed);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    const term = debounced.trim();
    if (!term) {
      setItems([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const now = new Date();

    void SearchClientAPI.hybridSearch({ q: term, limit: 5 })
      .then((response) => {
        if (cancelled) return;
        setItems(
          (response.results as HybridSearchResultItem[]).map((result) =>
            toSearchItem(result, term, now)
          )
        );
      })
      .catch((error) => {
        // The palette has no room for an error state. A failed search shows
        // no saves; the Actions above still work, and `/search` is one of them.
        if (!cancelled) {
          setItems([]);
          console.error("Palette search failed:", error);
        }
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  React.useEffect(() => {
    if (!open) {
      setValue("");
      setItems([]);
      setSearching(false);
    }
  }, [open]);

  const go = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router, setOpen]
  );

  const save = React.useCallback(
    async (link: string) => {
      setOpen(false);
      const result = await dispatch(saveCapture({ url: link }));
      if (saveCapture.fulfilled.match(result)) {
        announce(result.payload);
      }
    },
    [announce, dispatch, setOpen]
  );

  const matchingCollections = React.useMemo(() => {
    if (!query) return collections.slice(0, 5);
    const needle = query.toLowerCase();
    return collections
      .filter((collection) => collection.name.toLowerCase().includes(needle))
      .slice(0, 5);
  }, [collections, query]);

  const matchingPeople = React.useMemo(() => {
    if (!query) return people.slice(0, 5);
    const needle = query.toLowerCase();
    return people
      .filter(
        (profile) =>
          profile.handle.toLowerCase().includes(needle) ||
          (profile.name ?? "").toLowerCase().includes(needle)
      )
      .slice(0, 5);
  }, [people, query]);

  // The palette is desktop chrome. On mobile the bottom bar's Search tab goes
  // to the route, which is the same vocabulary in a form that fits a thumb.
  if (isMobile) return null;

  const nothing =
    query.length > 0 &&
    !searching &&
    items.length === 0 &&
    matchingCollections.length === 0 &&
    matchingPeople.length === 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      shouldFilter={false}
      label="Search and commands"
    >
      <CommandInput
        placeholder="Search your saves, or paste a link…"
        value={value}
        onValueChange={setValue}
      />
      <CommandList>
        {/* 1 · Actions */}
        <CommandGroup heading="Actions">
          {url ? (
            <CommandItem value="save-this-link" onSelect={() => void save(url)}>
              <Link2 aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                Save this link
                <span className="ml-2 text-fg-tertiary">{url}</span>
              </span>
              <CommandShortcut>
                <Kbd>↵</Kbd>
              </CommandShortcut>
            </CommandItem>
          ) : null}

          {query ? (
            <CommandItem
              value="search-everything"
              onSelect={() => go(searchHref({ q: query, readStatus: "all", dateRange: "any" }))}
            >
              <Search aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                Search everything for “{query}”
              </span>
            </CommandItem>
          ) : null}

          <CommandItem value="go-home" onSelect={() => go("/my/dashboard")}>
            <Home aria-hidden="true" />
            <span className="flex-1">Home</span>
          </CommandItem>
          <CommandItem value="go-library" onSelect={() => go("/my/library")}>
            <Library aria-hidden="true" />
            <span className="flex-1">Library</span>
          </CommandItem>
          <CommandItem value="go-explore" onSelect={() => go("/explore")}>
            <Compass aria-hidden="true" />
            <span className="flex-1">Explore</span>
          </CommandItem>
        </CommandGroup>

        {/* 2 · Your saves — the heading only appears when it has something under it */}
        {query && (searching || items.length > 0) ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Your saves">
              {searching && items.length === 0 ? (
                <CommandItem value="searching" disabled>
                  <Loader2
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                  <span>Searching your library…</span>
                </CommandItem>
              ) : null}

              {items.map((item) => (
                <CommandItem
                  key={item.key}
                  value={`save-${item.key}`}
                  onSelect={() => go(item.row.href)}
                  className="items-stretch px-2.5 py-0"
                >
                  {/*
                    The same row `/search` renders, provenance line and all. A
                    palette that summarised saves differently would be teaching
                    a second vocabulary for the same object.
                  */}
                  <SearchRow
                    item={item}
                    query={query}
                    className="w-full border-b-0"
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {/* 3 · Collections */}
        {matchingCollections.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Collections">
              {matchingCollections.map((collection) => (
                <CommandItem
                  key={collection.id}
                  value={`collection-${collection.id}`}
                  onSelect={() =>
                    go(`/my/library?collection_id=${collection.id}`)
                  }
                >
                  <FolderOpen aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">
                    {collection.name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {/* 4 · People */}
        {matchingPeople.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="People">
              {matchingPeople.map((profile) => (
                <CommandItem
                  key={profile.id}
                  value={`person-${profile.handle}`}
                  onSelect={() => go(`/u/${profile.handle}`)}
                >
                  <Avatar size="inline">
                    {profile.pictureUrl ? (
                      <AvatarImage src={profile.pictureUrl} alt="" />
                    ) : null}
                    <AvatarFallback>
                      {(profile.name ?? profile.handle).slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate">
                    {profile.name ?? profile.handle}
                    <span className="ml-2 text-fg-tertiary">
                      @{profile.handle}
                    </span>
                  </span>
                  <UserRound aria-hidden="true" className="text-fg-tertiary" />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {/*
          Not `CommandEmpty`: that renders when cmdk's own filter matches
          nothing, and the Actions above always match — so it would never
          appear. This is the real emptiness, which is about the reader's
          library and not about the list.
        */}
        {nothing ? (
          <p className="px-4 pb-4 pt-2 text-center font-sans text-sm text-fg-secondary">
            {`Nothing saved matches “${query}”.`}
          </p>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
