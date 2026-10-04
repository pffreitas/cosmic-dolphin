import * as React from "react";
import {
  Clock3,
  Compass,
  Folder,
  Home,
  Inbox,
  Layers,
  Link2,
  Search,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo";
import { AiCallout, AiKeyPoint, AiKeyPoints } from "@/components/ai/ai-callout";
import { ProcessingSteps } from "@/components/ai/processing-steps";
import { ProvenanceRow } from "@/components/provenance-row";
import { LibraryList, LibraryRow } from "@/components/bookmark/library-row";
import { Tag } from "@/components/ui/badge";

/**
 * Product vignettes for the signed-out surfaces — the landing page and the
 * auth pages' showcase panel.
 *
 * Every one is built from the product's own components with illustrative
 * content, never a screenshot and never a mock drawn to look like the app. If
 * the Library row changes, the landing page changes with it; the marketing
 * cannot promise a product that no longer exists.
 *
 * They are inert: `inert` on each frame takes every link and button inside out
 * of the tab order and the accessibility tree, and the frame carries a label
 * that says what it depicts.
 */

/** `inert` as a boolean (React 19); cast because the pinned types predate it. */
const INERT = { inert: true } as React.HTMLAttributes<HTMLDivElement>;

/** A browser-less app window: hairline, 12px frame radius, the dialog shadow. */
export function AppWindow({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <figure
      aria-label={label}
      className={cn(
        "relative m-0 overflow-hidden rounded-lg border border-line bg-bg",
        "shadow-[var(--cd-shadow-dialog)]",
        className,
      )}
    >
      <div {...INERT} className="pointer-events-none select-none">
        {children}
      </div>
    </figure>
  );
}

const SIDEBAR_ROWS = [
  { icon: Layers, label: "All saves", count: 148, active: true },
  { icon: Inbox, label: "Inbox", count: 9 },
  { icon: Clock3, label: "Read later", count: 34 },
];

const SIDEBAR_COLLECTIONS = [
  { label: "Agents & memory", count: 17 },
  { label: "Typography", count: 14 },
  { label: "Product strategy", count: 26 },
  { label: "Retrieval", count: 21 },
];

function MiniSidebar() {
  return (
    <div className="flex h-full flex-col gap-5 border-r border-line bg-bg-subtle px-3 py-4">
      <div className="flex items-center gap-2 px-2 font-sans text-[13.5px] font-semibold tracking-[-.015em] text-fg">
        <LogoMark className="size-5" />
        Cosmic Dolphin
      </div>
      <div className="flex flex-col gap-px">
        {[
          { icon: Home, label: "Home" },
          { icon: Compass, label: "Explore" },
          { icon: Search, label: "Search" },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex h-7 items-center gap-2 rounded-sm px-2 font-sans text-[12.5px] text-fg-secondary"
          >
            <Icon aria-hidden="true" className="size-3.5 text-fg-tertiary [stroke-width:1.7]" />
            {label}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-px">
        <div className="px-2 pb-1 font-sans text-[11px] font-semibold text-fg-tertiary">
          Library
        </div>
        {SIDEBAR_ROWS.map(({ icon: Icon, label, count, active }) => (
          <div
            key={label}
            className={cn(
              "flex h-7 items-center gap-2 rounded-sm px-2 font-sans text-[12.5px]",
              active
                ? "bg-bg-panel font-medium text-fg shadow-[inset_0_0_0_1px_var(--cd-border)]"
                : "text-fg-secondary",
            )}
          >
            <Icon
              aria-hidden="true"
              className={cn("size-3.5 [stroke-width:1.7]", active ? "text-accent" : "text-fg-tertiary")}
            />
            <span className="flex-1">{label}</span>
            <span className="nums text-[11px] text-fg-tertiary">{count}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-px">
        <div className="flex items-center px-2 pb-1 font-sans text-[11px] font-semibold text-fg-tertiary">
          Collections
          <span className="ml-auto inline-flex items-center gap-1 font-medium text-ai">
            <Sparkles aria-hidden="true" className="size-2.5 [stroke-width:1.8]" />
            AI filed
          </span>
        </div>
        {SIDEBAR_COLLECTIONS.map(({ label, count }) => (
          <div
            key={label}
            className="flex h-7 items-center gap-2 rounded-sm px-2 font-sans text-[12.5px] text-fg-secondary"
          >
            <Folder aria-hidden="true" className="size-3.5 text-fg-tertiary [stroke-width:1.7]" />
            <span className="flex-1 truncate">{label}</span>
            <span className="nums text-[11px] text-fg-tertiary">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The hero: the Library in its app frame, with a save arriving at the top. */
export function LibraryVignette({ className }: { className?: string }) {
  return (
    <AppWindow
      label="The Cosmic Dolphin library: saved articles, each summarised and filed into an AI-suggested collection."
      className={className}
    >
      <div className="grid grid-cols-[208px_minmax(0,1fr)] max-md:grid-cols-1">
        <div className="max-md:hidden">
          <MiniSidebar />
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="flex h-12 items-center border-b border-line px-5">
            <div className="flex h-8 w-full max-w-[420px] items-center gap-2 rounded-md border border-[color:var(--cd-accent)] bg-bg-panel px-2.5 font-sans text-[12.5px] text-fg">
              <Link2 aria-hidden="true" className="size-3.5 text-accent [stroke-width:1.8]" />
              <span className="truncate">every.to/chain-of-thought/the-memory-problem</span>
              <span className="ml-auto rounded-sm bg-accent px-2 py-1 text-[11.5px] font-medium leading-none text-accent-fg">
                Save
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-4 px-6 pb-2 pt-5">
            <div className="flex flex-col gap-1">
              <div className="font-sans text-[11.5px] font-medium text-fg-tertiary">Library</div>
              <div className="font-serif text-[22px] font-semibold leading-tight tracking-[-.018em] text-fg">
                All saves
              </div>
            </div>
            <div className="flex flex-col gap-2.5 rounded-md border border-line bg-bg-subtle px-3.5 py-3">
              <div className="flex items-center gap-2 font-serif text-[15px] font-semibold text-fg">
                The memory problem nobody is benchmarking
              </div>
              <ProcessingSteps
                layout="inline"
                steps={[
                  { phase: "fetch", state: "done" },
                  { phase: "extract", state: "done" },
                  { phase: "summarise", state: "active" },
                  { phase: "file", state: "pending" },
                ]}
              />
            </div>
            <LibraryList>
              <LibraryRow
                href="#"
                unread
                title="Reading on screens: what twenty years of eye-tracking showed"
                summary="Measure, leading and the paragraph as a unit of attention. The findings are older, and duller, than the discourse."
                collectionPath={[{ id: "t", name: "Typography" }]}
                domain="alistapart.com"
                savedAt="2d ago"
                readingTime="11 min"
                tags={["research", "reading"]}
              />
              <LibraryRow
                href="#"
                title="Why retrieval quality stops predicting task success"
                summary="Past a threshold, better search stops helping agents finish. What they lack is a record of what they already tried."
                collectionPath={[{ id: "a", name: "Agents & memory" }]}
                domain="arxiv.org"
                savedAt="4d ago"
                readingTime="23 min"
                tags={["agents", "evaluation"]}
              />
            </LibraryList>
          </div>
        </div>
      </div>
    </AppWindow>
  );
}

/** The Cosmic brief, on its own: summary, key points, and the sources line. */
export function BriefVignette({ className }: { className?: string }) {
  return (
    <figure
      aria-label="A Cosmic brief: a short summary with key points, naming the article it was written from."
      className={cn("m-0", className)}
    >
      <div {...INERT} className="pointer-events-none select-none">
        <AiCallout
          label="Cosmic brief"
          meta="11 min article"
          className="bg-bg-panel shadow-[var(--cd-shadow-popover)]"
          footer={
            <ProvenanceRow
              sources={[{ domain: "alistapart.com" }]}
              action="summarised from the full article"
            />
          }
        >
          <p className="m-0 font-sans text-[14px] leading-[1.6] text-fg-secondary">
            Two decades of eye-tracking agree on less than the discourse claims:
            line length and leading matter, but the paragraph — not the line —
            is the unit readers actually budget attention by.
          </p>
          <AiKeyPoints className="mt-4">
            <AiKeyPoint term="Measure.">Comprehension holds from 45 to 75 characters.</AiKeyPoint>
            <AiKeyPoint term="Paragraphs.">Readers skip by block, not by line.</AiKeyPoint>
          </AiKeyPoints>
        </AiCallout>
      </div>
    </figure>
  );
}

/** Filing: a save's breadcrumb, the AI marker, and a proposed collection. */
export function FilingVignette({ className }: { className?: string }) {
  return (
    <AppWindow
      label="AI filing: saves grouped into collections the reader can rename or override."
      className={cn("bg-bg-subtle", className)}
    >
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2 font-sans text-[12px] font-semibold text-fg-tertiary">
          Collections
          <span className="ml-auto inline-flex items-center gap-1 font-medium text-ai">
            <Sparkles aria-hidden="true" className="size-3 [stroke-width:1.8]" />
            AI filed
          </span>
        </div>
        <div className="flex flex-col gap-px">
          {[
            ["Agents & memory", 17],
            ["Typography", 14],
            ["Product strategy", 26],
          ].map(([label, count]) => (
            <div
              key={label}
              className="flex h-8 items-center gap-2 rounded-sm px-2 font-sans text-[13px] text-fg-secondary"
            >
              <Folder aria-hidden="true" className="size-4 text-fg-tertiary [stroke-width:1.7]" />
              <span className="flex-1">{label}</span>
              <span className="nums text-[11.5px] text-fg-tertiary">{count}</span>
            </div>
          ))}
        </div>
        <AiCallout compact label="Suggestion" className="mt-1">
          <p className="m-0 font-sans text-[13px] leading-[1.55] text-fg-secondary">
            9 saves look like a new collection:{" "}
            <b className="font-medium text-fg">Reading interfaces</b>
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-pill bg-accent px-3 py-1.5 font-sans text-[12px] font-medium leading-none text-accent-fg">
              Create collection
            </span>
            <span className="px-2 font-sans text-[12px] font-medium text-fg-secondary">Not now</span>
          </div>
        </AiCallout>
      </div>
    </AppWindow>
  );
}

/** A save in flight: the row exists before the summary does. */
export function CaptureVignette({ className }: { className?: string }) {
  return (
    <AppWindow
      label="Saving a link: the row appears at once, then shows each step as the article is read, summarised and filed."
      className={className}
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex h-9 items-center gap-2.5 rounded-md border border-[color:var(--cd-accent)] bg-bg-panel px-3 font-sans text-[13px] text-fg">
          <Link2 aria-hidden="true" className="size-4 text-accent [stroke-width:1.8]" />
          <span className="truncate">stratechery.com/2026/the-cost-of-a-perfect-index</span>
        </div>
        <div className="flex flex-col gap-3 rounded-md border border-line px-4 py-3.5">
          <ProvenanceRow sources={[{ domain: "stratechery.com" }]} timestamp="just now" />
          <div className="font-serif text-[17px] font-semibold leading-snug text-fg">
            The cost of a perfect index
          </div>
          <ProcessingSteps
            steps={[
              { phase: "fetch", state: "done" },
              { phase: "extract", state: "done" },
              { phase: "summarise", state: "done" },
              { phase: "file", state: "active" },
            ]}
          />
          <div className="flex flex-wrap gap-1.5">
            <Tag>retrieval</Tag>
            <Tag>cost</Tag>
          </div>
        </div>
      </div>
    </AppWindow>
  );
}
