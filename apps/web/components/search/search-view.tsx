"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search as SearchIcon, SearchX } from "lucide-react";
import type { Collection, HybridSearchResultItem } from "@cosmic-dolphin/api-client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LibraryRowSkeleton } from "@/components/bookmark/library-row";
import { SearchClientAPI } from "@/lib/api/search-client";

import { SearchAnswer, SearchAnswerSkeleton } from "./search-answer";
import { SearchList, SearchRow } from "./search-row";
import {
  DATE_RANGE_OPTIONS,
  READ_STATUS_OPTIONS,
  hasActiveFilters,
  searchHref,
  tagOptions,
  toAnswerSources,
  toSearchItem,
  type AnswerSourceLink,
  type SearchItem,
  type SearchView as SearchViewParams,
} from "./search-data";

const ALL = "__all__";

export interface SearchViewProps {
  view: SearchViewParams;
  /** For the collection filter. The Library's own list, so the names match. */
  collections: Collection[];
}

type Phase = "idle" | "running" | "done" | "error";

/**
 * Search — docs/design-system/pages.md § Search.
 *
 * A query field pinned under the header, an AI answer that names what it read,
 * and results as library rows. The whole view lives in the query string, so a
 * filtered search survives a refresh and can be sent to someone.
 *
 * Results and answer arrive on one SSE stream, in a fixed order: results,
 * then the sources, then the prose. The order is the server's guarantee and
 * this component depends on it — `SearchAnswer` renders nothing until it has
 * sources, which is rule 8 held from the client's end as well.
 */
export function SearchView({ view, collections }: SearchViewProps) {
  const router = useRouter();

  const [draft, setDraft] = React.useState(view.q);
  const [items, setItems] = React.useState<SearchItem[]>([]);
  const [answer, setAnswer] = React.useState("");
  const [sources, setSources] = React.useState<AnswerSourceLink[]>([]);
  const [phase, setPhase] = React.useState<Phase>("idle");
  /** The answer's own lifecycle. It outlives the list's more often than not. */
  const [answering, setAnswering] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  /** The query the rows on screen actually answer — what the marks highlight. */
  const [ranQuery, setRanQuery] = React.useState("");

  // The field is only reset from the URL, never from its own state: retyping
  // while a search runs must not be clobbered when the stream lands.
  React.useEffect(() => {
    setDraft(view.q);
  }, [view.q]);

  const run = React.useCallback(
    async (params: SearchViewParams, signal: AbortSignal) => {
      setItems([]);
      setAnswer("");
      setSources([]);
      setError(undefined);
      setPhase("running");
      setAnswering(true);
      setRanQuery(params.q);

      const now = new Date();

      // The answer streams alongside the list rather than in front of it. They
      // are two different questions — the list honours the reader's filters,
      // the answer is built from the whole library, because narrowing what a
      // question may be answered from is not something a date filter should
      // silently do — and the rows must not wait on a language model.
      void SearchClientAPI.askWithStream(
        params.q,
        {
          onResults: () => undefined,
          onSources: (incoming) => {
            if (signal.aborted) return;
            setSources(toAnswerSources(incoming));
          },
          onChunk: (text) => {
            if (signal.aborted) return;
            setAnswer((previous) => previous + text);
          },
          onDone: () => {
            if (!signal.aborted) setAnswering(false);
          },
          onError: (message) => {
            if (signal.aborted) return;
            // A failed answer is not a failed search. The rows still land.
            setAnswering(false);
            console.error("Search answer failed:", message);
          },
        },
        signal
      )
        .catch((cause) => {
          if (!signal.aborted) console.error("Search answer failed:", cause);
        })
        .finally(() => {
          if (!signal.aborted) setAnswering(false);
        });

      try {
        const listed = await SearchClientAPI.hybridSearch({
          q: params.q,
          collectionId: params.collectionId,
          tag: params.tag,
          readStatus: params.readStatus,
          dateRange: params.dateRange,
        });

        if (signal.aborted) return;

        setItems(
          (listed.results as HybridSearchResultItem[]).map((result) =>
            toSearchItem(result, params.q, now)
          )
        );
        setPhase("done");
      } catch (cause) {
        if (signal.aborted) return;
        console.error("Search failed:", cause);
        setError("Search failed. Try again.");
        setPhase("error");
      }
    },
    []
  );

  // Keyed on the view's fields rather than on the object: the page rebuilds
  // `view` on every navigation, and depending on its identity would re-run the
  // search on renders that changed nothing.
  const { q, collectionId, tag, readStatus, dateRange } = view;

  React.useEffect(() => {
    if (!q) {
      setPhase("idle");
      setAnswering(false);
      setItems([]);
      setAnswer("");
      setSources([]);
      return;
    }

    const controller = new AbortController();
    void run(
      { q, collectionId, tag, readStatus, dateRange },
      controller.signal
    );
    return () => controller.abort();
  }, [run, q, collectionId, tag, readStatus, dateRange]);

  const go = React.useCallback(
    (next: SearchViewParams) => {
      router.push(searchHref(next), { scroll: false });
    },
    [router]
  );

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const q = draft.trim();
    if (!q) return;
    go({ ...view, q });
  };

  const tags = React.useMemo(() => {
    const fromResults = tagOptions(items);
    if (view.tag && !fromResults.some((tag) => tag === view.tag)) {
      return [view.tag, ...fromResults];
    }
    return fromResults;
  }, [items, view.tag]);

  const collectionLabel =
    collections.find((collection) => collection.id === view.collectionId)
      ?.name ?? "Any collection";

  const dateLabel =
    DATE_RANGE_OPTIONS.find((option) => option.value === view.dateRange)
      ?.label ?? "Any time";

  const running = phase === "running";
  const searched = view.q.length > 0;

  return (
    <div className="flex flex-col gap-5 py-6">
      {/*
        Pinned under the header. The field is the page's subject, and a reader
        scrolling a long result list is a reader about to refine the query.
      */}
      <form
        onSubmit={submit}
        role="search"
        className={cn(
          "sticky top-0 z-20 -mx-4 flex flex-col gap-3 px-4 pb-3 pt-1 sm:-mx-6 sm:px-6",
          "bg-bg"
        )}
      >
        <div className="relative">
          {running ? (
            <Loader2
              aria-hidden="true"
              className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-fg-tertiary motion-reduce:animate-none"
            />
          ) : (
            <SearchIcon
              aria-hidden="true"
              className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary [stroke-width:1.8]"
            />
          )}
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search everything you have saved"
            aria-label="Search your library"
            className="h-12 pl-10 pr-3 text-[15px]"
            autoFocus
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={view.readStatus}
            onValueChange={(value) =>
              go({ ...view, readStatus: value as SearchViewParams["readStatus"] })
            }
            aria-label="Read status"
          >
            {READ_STATUS_OPTIONS.map((option) => (
              <SegmentedItem key={option.value} value={option.value}>
                {option.label}
              </SegmentedItem>
            ))}
          </Segmented>

          <Select
            value={view.collectionId ?? ALL}
            onValueChange={(value) =>
              go({
                ...view,
                collectionId: value === ALL ? undefined : value,
              })
            }
          >
            <SelectTrigger
              className="h-8 w-auto min-w-[150px] gap-2 text-[13px]"
              aria-label="Collection"
            >
              {/*
                The label is passed explicitly rather than left to Radix to
                infer from the selected item. Radix fills the trigger by
                portalling the chosen item's text into it, which needs the
                content to have mounted — so a filter restored from the URL
                reads as an empty box until the reader opens it once.
              */}
              <SelectValue>{collectionLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any collection</SelectItem>
              {collections.map((collection) => (
                <SelectItem key={collection.id} value={collection.id}>
                  {collection.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={view.tag ?? ALL}
            onValueChange={(value) =>
              go({ ...view, tag: value === ALL ? undefined : value })
            }
          >
            <SelectTrigger
              className="h-8 w-auto min-w-[120px] gap-2 text-[13px]"
              disabled={tags.length === 0}
              aria-label="Tag"
            >
              <SelectValue>{view.tag ?? "Any tag"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any tag</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={view.dateRange}
            onValueChange={(value) =>
              go({ ...view, dateRange: value as SearchViewParams["dateRange"] })
            }
          >
            <SelectTrigger
              className="h-8 w-auto min-w-[120px] gap-2 text-[13px]"
              aria-label="Saved when"
            >
              <SelectValue>{dateLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters(view) ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                go({ q: view.q, readStatus: "all", dateRange: "any" })
              }
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </form>

      {!searched ? (
        <EmptyState
          icon={SearchIcon}
          title="Search everything you have saved"
          description="Ask a question and get an answer built from your own library, with the saves it came from named underneath."
        />
      ) : null}

      {searched && answering && sources.length === 0 ? (
        <SearchAnswerSkeleton />
      ) : null}

      <SearchAnswer answer={answer} sources={sources} streaming={answering} />

      {searched && phase === "error" ? (
        <EmptyState
          icon={SearchX}
          title="That search did not come back"
          description={error}
          action={
            <Button onClick={() => go(view)} variant="primary">
              Try again
            </Button>
          }
        />
      ) : null}

      {searched && running && items.length === 0 ? (
        <SearchList>
          {[0, 1, 2, 3].map((index) => (
            <LibraryRowSkeleton key={index} />
          ))}
        </SearchList>
      ) : null}

      {items.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="font-sans text-[12.5px] leading-[1.4] text-fg-secondary">
            {items.length} {items.length === 1 ? "result" : "results"}
            {hasActiveFilters(view) ? " in this filter" : ""}
          </p>
          <SearchList>
            {items.map((item) => (
              <SearchRow key={item.key} item={item} query={ranQuery} />
            ))}
          </SearchList>
        </div>
      ) : null}

      {searched && phase === "done" && items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={`Nothing saved matches “${view.q}”`}
          description={
            hasActiveFilters(view)
              ? "Every filter narrows this further. Clearing them may bring the save back."
              : "Try fewer words, or save something on the subject and search again."
          }
          action={
            hasActiveFilters(view) ? (
              <Button
                variant="primary"
                onClick={() =>
                  go({ q: view.q, readStatus: "all", dateRange: "any" })
                }
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : null}
    </div>
  );
}
