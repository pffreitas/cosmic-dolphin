"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { focusRing } from "@/components/ui/focus-ring";

import type { LibraryTree, LibraryTreeNode } from "./tree";

/**
 * The Library rail — docs/design-system/pages.md § Library.
 *
 * `All saves`, `Inbox`, the collections nested to two levels, then the two
 * saved filters. Each row carries a mono count; the selected row takes
 * `--cd-accent-soft` and `aria-current="page"`, because a highlight nobody can
 * hear is only half a selected state.
 *
 * Rows that name a place a bookmark can live also take drops. Dragging a row
 * from the list onto one of them refiles it and pins the placement against
 * every future run of the pipeline — see 04-library.md § AI filing. Dropping
 * on a saved filter is refused rather than silently reinterpreted: `Read later`
 * is a query, not a folder.
 */
export interface CollectionTreeProps {
  tree: LibraryTree;
  /** `null` means Inbox. Absent target ids never reach this. */
  onDropBookmarks?: (collectionId: string | null) => void;
  /** How many rows the drag is carrying, for the drop hint. */
  draggingCount?: number;
}

export function CollectionTree({
  tree,
  onDropBookmarks,
  draggingCount = 0,
}: CollectionTreeProps) {
  const [over, setOver] = React.useState<string | null>(null);

  return (
    <nav aria-label="Collections" className="flex flex-col gap-4">
      <ul className="m-0 flex list-none flex-col gap-px p-0">
        {tree.top.map((node) => (
          <TreeRow
            key={node.key}
            node={node}
            over={over === node.key}
            setOver={setOver}
            onDropBookmarks={onDropBookmarks}
            draggingCount={draggingCount}
          />
        ))}
      </ul>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 px-2">
          <span className="font-sans text-[11px] font-semibold uppercase tracking-[.08em] text-fg-tertiary">
            Collections
          </span>
          {/* Rule 8: anything the pipeline decided says so. */}
          <span className="inline-flex items-center gap-1 font-sans text-[10.5px] font-semibold uppercase tracking-[.08em] text-ai opacity-85">
            <Sparkles aria-hidden="true" className="size-2.5 shrink-0 fill-current" />
            AI filed
          </span>
        </div>

        {tree.collections.length === 0 ? (
          <p className="m-0 px-2 font-sans text-[12.5px] leading-[1.5] text-fg-tertiary">
            Nothing filed yet. Collections appear as the pipeline finds
            groupings worth keeping.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-px p-0">
            {tree.collections.map((node) => (
              <React.Fragment key={node.key}>
                <TreeRow
                  node={node}
                  over={over === node.key}
                  setOver={setOver}
                  onDropBookmarks={onDropBookmarks}
                  draggingCount={draggingCount}
                />
                {node.children.map((child) => (
                  <TreeRow
                    key={child.key}
                    node={child}
                    depth={1}
                    over={over === child.key}
                    setOver={setOver}
                    onDropBookmarks={onDropBookmarks}
                    draggingCount={draggingCount}
                  />
                ))}
              </React.Fragment>
            ))}
          </ul>
        )}
      </div>

      <ul className="m-0 flex list-none flex-col gap-px p-0">
        {tree.filters.map((node) => (
          <TreeRow
            key={node.key}
            node={node}
            over={over === node.key}
            setOver={setOver}
            onDropBookmarks={onDropBookmarks}
            draggingCount={draggingCount}
          />
        ))}
      </ul>
    </nav>
  );
}

function TreeRow({
  node,
  depth = 0,
  over,
  setOver,
  onDropBookmarks,
  draggingCount,
}: {
  node: LibraryTreeNode;
  depth?: number;
  over: boolean;
  setOver: (key: string | null) => void;
  onDropBookmarks?: (collectionId: string | null) => void;
  draggingCount: number;
}) {
  const droppable =
    node.collectionId !== undefined && draggingCount > 0 && Boolean(onDropBookmarks);

  return (
    <li className="m-0">
      <Link
        href={node.href}
        aria-current={node.active ? "page" : undefined}
        // 32px tall, which is the floor for a pointer target.
        className={cn(
          "flex min-h-8 items-center gap-2 rounded-sm px-2 py-1.5",
          "font-sans text-[13px] leading-[1.35] no-underline",
          "transition-colors duration-cd-fast ease-cd",
          node.active
            ? "bg-accent-soft font-medium text-fg"
            : "text-fg-secondary hover:bg-bg-subtle hover:text-fg",
          over && "bg-accent-soft ring-1 ring-inset ring-accent-border",
          depth > 0 && "pl-[22px]",
          focusRing,
        )}
        onDragOver={
          droppable
            ? (event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setOver(node.key);
              }
            : undefined
        }
        onDragLeave={droppable ? () => setOver(null) : undefined}
        onDrop={
          droppable
            ? (event) => {
                event.preventDefault();
                setOver(null);
                onDropBookmarks?.(node.collectionId ?? null);
              }
            : undefined
        }
      >
        <span className="min-w-0 flex-1 truncate">{node.label}</span>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-fg-tertiary">
          {node.count}
        </span>
      </Link>
    </li>
  );
}

/** The rail before the counts land: real labels, dashes where numbers go. */
export function CollectionTreeSkeleton() {
  const rows = ["All saves", "Inbox", "Read later", "Archive"];

  return (
    <nav aria-label="Collections" className="flex flex-col gap-4">
      <ul className="m-0 flex list-none flex-col gap-px p-0">
        {rows.map((label) => (
          <li key={label} className="m-0">
            <span className="flex min-h-8 items-center gap-2 rounded-sm px-2 py-1.5 font-sans text-[13px] leading-[1.35] text-fg-secondary">
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <span className="shrink-0 font-mono text-[11px] text-fg-tertiary">
                —
              </span>
            </span>
          </li>
        ))}
      </ul>
    </nav>
  );
}
