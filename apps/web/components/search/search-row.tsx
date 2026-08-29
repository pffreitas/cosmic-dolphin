import * as React from "react";

import { cn } from "@/lib/utils";
import { Tag } from "@/components/ui/badge";
import { LibraryList, LibraryRow } from "@/components/bookmark/library-row";
import { ProvenanceRow } from "@/components/provenance-row";

import { highlightSegments, type SearchItem } from "./search-data";

/**
 * The reader's query, marked in a run of text.
 *
 * `--cd-hl-bg` and nothing else: no bold, no colour change, no border. The
 * highlight is there to point, and a pointer that also shouts stops pointing.
 */
export function Highlight({ text, query }: { text: string; query: string }) {
  const segments = React.useMemo(
    () => highlightSegments(text, query),
    [text, query]
  );

  return (
    <>
      {segments.map((segment, index) =>
        segment.hit ? (
          <mark
            key={index}
            className="rounded-xs bg-[var(--cd-hl-bg)] text-fg [box-decoration-break:clone]"
          >
            {segment.text}
          </mark>
        ) : (
          <React.Fragment key={index}>{segment.text}</React.Fragment>
        )
      )}
    </>
  );
}

export interface SearchRowProps {
  item: SearchItem;
  /** The query, for the marks. */
  query: string;
  className?: string;
}

/**
 * One search result — the row **both** search surfaces render.
 *
 * D17's outcome is "one vocabulary across the search route and ⌘K", and the
 * way to actually get that is not two components built to the same spec but
 * one component used twice: `/search` and the `⌘K` palette both render this,
 * so they cannot drift.
 *
 * It is the Library's own row (`LibraryRow`) under the feed's own provenance
 * line (`ProvenanceRow`) — neither reimplemented, neither forked. The row's
 * `domain · time` meta is left off because the provenance line above it
 * already carries both; saying it twice in one row is what makes composite
 * patterns look assembled rather than designed.
 *
 * A semantic-only hit gets a neutral `Related` tag. Without it the reader is
 * looking at a row that contains none of the words they typed and has no way
 * to tell whether that is intelligence or a bug.
 */
export function SearchRow({ item, query, className }: SearchRowProps) {
  const { row } = item;
  const summary = item.snippet ?? row.summary;

  return (
    <div className={cn("border-b border-line last:border-b-0", className)}>
      <ProvenanceRow {...item.provenance} className="pl-[22px] pt-4" />
      <LibraryRow
        className="border-b-0 pt-1.5"
        href={row.href}
        title={<Highlight text={row.title} query={query} />}
        summary={
          summary ? <Highlight text={summary} query={query} /> : undefined
        }
        collectionPath={row.collectionPath}
        filing={row.filing}
        unread={row.unread}
        tags={row.tags}
        badge={
          item.match === "semantic" ? (
            <Tag variant="neutral">Related</Tag>
          ) : null
        }
        readingTime={row.readingTime}
        thumbnailUrl={row.thumbnailUrl}
        privateLink={row.privateLink}
        summaryLoading={row.summaryLoading}
      />
    </div>
  );
}

/** The list container — the Library's, so the hairlines line up with it. */
export const SearchList = LibraryList;
