"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  AlertTriangle,
  Inbox,
  MoreHorizontal,
  Newspaper,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { ToastProvider } from "@/components/ui/toast";
import { ProvenanceRow, WhyThisAppeared } from "@/components/provenance-row";
import { AiCallout, AiKeyPoint, AiKeyPoints } from "@/components/ai/ai-callout";
import {
  ProcessingSteps,
  type ProcessingStep,
} from "@/components/ai/processing-steps";
import { ActionRow } from "@/components/social/action-row";
import { CommentDrawer } from "@/components/social/comment-drawer";
import { useReshare } from "@/components/social/use-reshare";
import { AppHeader } from "@/components/app-header";
import {
  LibraryList,
  LibraryRow,
  LibraryRowSkeleton,
} from "@/components/bookmark/library-row";
import { FeedItem, FeedItemSkeleton } from "@/components/feed/feed-item";

/* ---------------------------------------------------------------------------
   Fixtures.

   Local on purpose. These patterns are being built before any page consumes
   them, so the gallery feeds them plain props rather than reaching for the API
   — which also means every state below can be rendered on demand instead of
   waiting for the pipeline to happen to be in it.
   --------------------------------------------------------------------------- */

const EVERY = { domain: "every.to" };
const ARXIV = { domain: "arxiv.org" };
const YOUTUBE = { domain: "youtube.com" };
const STRATECHERY = { domain: "stratechery.com" };
const MAYA = { name: "Maya Rodrigues" };

const RANKING_REASON =
  "Three of your last ten saves were about agent memory, and you open 7 of every 10 links Maya shares.";

const ALL_PENDING: ProcessingStep[] = [
  { phase: "fetch", state: "active" },
  { phase: "extract", state: "pending" },
  { phase: "summarise", state: "pending" },
  { phase: "file", state: "pending" },
];

const IN_FLIGHT: ProcessingStep[] = [
  { phase: "fetch", state: "done" },
  { phase: "extract", state: "done" },
  { phase: "summarise", state: "active" },
  { phase: "file", state: "pending" },
];

const ALL_DONE: ProcessingStep[] = [
  { phase: "fetch", state: "done" },
  { phase: "extract", state: "done" },
  { phase: "summarise", state: "done" },
  { phase: "file", state: "done" },
];

const FAILED: ProcessingStep[] = [
  { phase: "fetch", state: "done" },
  { phase: "extract", state: "done" },
  {
    phase: "summarise",
    state: "failed",
    error: "the model timed out three times",
  },
  { phase: "file", state: "done" },
];

/* ---------------------------------------------------------------------------
   Gallery chrome. Deliberately plain: nothing here is a product surface, and
   anything ornamental would compete with what is being inspected.
   --------------------------------------------------------------------------- */

function Section({
  id,
  index,
  title,
  file,
  lede,
  children,
}: {
  id: string;
  index: string;
  title: string;
  file: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-line py-12 first:border-t-0">
      <div className="mb-2 flex flex-wrap items-baseline gap-3">
        <span className="font-mono text-xs text-fg-tertiary">{index}</span>
        <h2 className="m-0 font-serif text-[29px] font-semibold leading-[1.2] tracking-[-.01em] text-fg">
          {title}
        </h2>
        <code className="rounded-xs bg-bg-inset px-1.5 py-0.5 font-mono text-[11.5px] text-fg-secondary">
          {file}
        </code>
      </div>
      <p className="mb-6 max-w-[68ch] font-sans text-[15px] leading-[1.65] text-fg-secondary">
        {lede}
      </p>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

function Case({
  label,
  note,
  children,
  bare = false,
}: {
  label: string;
  note?: string;
  children: React.ReactNode;
  bare?: boolean;
}) {
  return (
    <div>
      <p className="mb-3 font-sans text-[11px] font-semibold uppercase leading-[1.3] tracking-[.09em] text-fg-tertiary">
        {label}
      </p>
      <div
        className={cn(
          bare
            ? undefined
            : "rounded-md border border-line bg-bg-panel p-4",
        )}
      >
        {children}
      </div>
      {note ? (
        <p className="mt-3 max-w-[68ch] font-sans text-[12.5px] leading-[1.4] text-fg-secondary">
          {note}
        </p>
      ) : null}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">{children}</div>
  );
}

function MenuButton() {
  return (
    <Button variant="ghost" size="icon" aria-label="More" type="button">
      <MoreHorizontal aria-hidden="true" />
    </Button>
  );
}

/**
 * The Save action, wired to `useReshare` — the same binding a feed item will
 * use, minus the feed.
 *
 * `offline`, like the comment drawer above it: the gallery has no API behind
 * it, so the hook answers with the outcome named here instead of calling
 * `POST /bookmarks/{id}/reshare`. Everything else — the optimistic press, the
 * toast the server's `alreadySaved` chooses, the fact that a saved item has no
 * undo — is the real thing.
 */
function ReshareCase({
  bookmarkId,
  outcome = "saved",
}: {
  bookmarkId: string;
  outcome?: "saved" | "alreadySaved";
}) {
  const reshare = useReshare({ bookmarkId, offline: true, offlineOutcome: outcome });

  return (
    <ActionRow
      likeCount={41}
      commentCount={3}
      saved={reshare.saved}
      onSaveChange={reshare.onSaveChange}
      saveOnce
      itemTitle="The Bottleneck Was Never Retrieval"
      shareUrl="https://cosmicdolphin.app/s/bk_8f2a"
    />
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <Segmented
      aria-label="Colour mode"
      value={mounted ? (theme ?? "system") : undefined}
      onValueChange={setTheme}
    >
      <SegmentedItem value="light">Light</SegmentedItem>
      <SegmentedItem value="dark">Dark</SegmentedItem>
      <SegmentedItem value="system">System</SegmentedItem>
    </Segmented>
  );
}

/* ------------------------------------------------------------------------- */

export function PatternsGallery() {
  // The feed's comment action, wired to the thing it actually opens. Never
  // inline: decisions.md #18, and patterns.md § Feed item's "don't".
  const [commentsOpen, setCommentsOpen] = React.useState(false);

  return (
    <ToastProvider>
      <div className="w-full pb-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 pt-6">
          <div>
            <p className="mb-3 font-sans text-[11px] font-semibold uppercase leading-[1.3] tracking-[.09em] text-fg-tertiary">
              Dev only · not reachable in production
            </p>
            <h1 className="m-0 max-w-[22ch] font-serif text-[40px] font-semibold leading-[1.1] tracking-[-.015em] text-fg">
              The seven patterns, in every state.
            </h1>
            <p className="mt-4 max-w-[68ch] font-sans text-base leading-[1.65] text-fg-secondary">
              The composite components that carry Cosmic Dolphin&apos;s
              identity, rendered against fixture data before any page consumes
              them. Open{" "}
              <code className="rounded-xs bg-bg-inset px-1.5 py-0.5 font-mono text-[12.5px] text-fg">
                docs/design-system/prototypes/index.html
              </code>{" "}
              beside this and flip both themes.
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* ============ 01 · PROVENANCE ROW ============ */}
        <Section
          id="provenance"
          index="01"
          title="Provenance row"
          file="components/provenance-row.tsx"
          lede="The compact, always-visible answer to “where did this come from”. Every AI output and every feed item carries one, before the title — trust precedes attention."
        >
          <Grid>
            <Case label="Own save">
              <ProvenanceRow
                sources={[EVERY]}
                action="you saved this"
                timestamp="2d"
              />
            </Case>
            <Case label="Shared by someone">
              <ProvenanceRow
                actor={MAYA}
                action="shared"
                sources={[EVERY]}
                timestamp="2d"
              />
            </Case>
            <Case
              label="Reshare · and the same row once the original is gone"
              note="A reshare credits the person it came from. Deleting the original does not touch the reshare — its provenance simply goes null — so the row has to be able to lose the credit and still say something true. That is the second line: the domain alone."
            >
              <div className="flex flex-col gap-2.5">
                <ProvenanceRow
                  sources={[EVERY]}
                  attribution="via Maya Chen"
                  action="you saved this"
                  timestamp="2d"
                />
                <ProvenanceRow
                  sources={[EVERY]}
                  action="you saved this"
                  timestamp="2d"
                />
              </div>
            </Case>
            <Case label="Social signal">
              <ProvenanceRow
                sources={[YOUTUBE]}
                attribution="Karpathy"
                action="liked by 3 people you follow"
              />
            </Case>
            <Case label="AI digest">
              <ProvenanceRow
                lead="Built from"
                sources={[EVERY, ARXIV]}
                moreCount={2}
              />
            </Case>
            <Case label="AI summary">
              <ProvenanceRow
                sources={[EVERY]}
                action="summarised from the full article"
              />
            </Case>
            <Case
              label="Why this appeared"
              note="A sibling disclosure, not a tooltip and never behind a hover. The sentence comes from the ranker; the client never templates one."
            >
              <div className="flex flex-col gap-2.5">
                <ProvenanceRow
                  actor={MAYA}
                  action="shared"
                  sources={[EVERY]}
                  timestamp="2d"
                />
                <WhyThisAppeared reason={RANKING_REASON} />
              </div>
            </Case>
          </Grid>
        </Section>

        {/* ============ 02 · AI CALLOUT ============ */}
        <Section
          id="ai-callout"
          index="02"
          title="AI callout"
          file="components/ai/ai-callout.tsx"
          lede="The quiet editorial layer: a soft gradient ground, one hairline, one corner aura, and a chip that names the author. No output ships without an .ai-foot naming its sources."
        >
          <Case label="Cosmic brief · with key points" bare>
            <AiCallout
              label="Cosmic brief"
              meta="9 min article · read in 40 seconds"
              footer={
                <ProvenanceRow
                  sources={[EVERY]}
                  action="summarised from the full article"
                  trailing={
                    <Button variant="ghost" size="sm" type="button">
                      Regenerate
                    </Button>
                  }
                />
              }
            >
              <p className="m-0 mb-4 font-sans text-[15px] leading-[1.65] text-fg-secondary">
                Retrieval quality has become a distraction. In the
                author&apos;s testing, agents with excellent search still
                looped on solved sub-problems because nothing recorded what had
                already been attempted. The fix is a cheap episodic log, not a
                better index.
              </p>
              <p className="m-0 mb-2.5 font-sans text-[11px] font-semibold uppercase leading-[1.3] tracking-[.09em] text-fg-tertiary">
                Key points
              </p>
              <AiKeyPoints>
                <AiKeyPoint>
                  Retrieval accuracy above ~85% stops predicting task success.
                </AiKeyPoint>
                <AiKeyPoint>
                  Repeated-action loops account for most failed long-horizon
                  runs.
                </AiKeyPoint>
                <AiKeyPoint>
                  An append-only attempt log outperformed a 4× larger context
                  window.
                </AiKeyPoint>
              </AiKeyPoints>
            </AiCallout>
          </Case>

          <Grid>
            <Case label="Compact · collection suggestion" bare>
              <AiCallout label="Suggestion" compact>
                <p className="m-0 mb-3 font-sans text-[13.5px] leading-[1.55] text-fg-secondary">
                  9 saves look like a new collection:{" "}
                  <b className="font-medium text-fg">
                    Typography &amp; reading UX
                  </b>
                  .
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="primary" size="sm" type="button">
                    Create
                  </Button>
                  <Button variant="ghost" size="sm" type="button">
                    Not now
                  </Button>
                </div>
              </AiCallout>
            </Case>

            <Case
              label="AI-processing · the brief has not landed"
              note="The callout holds its frame and its footer; only the body is replaced. Nothing reflows when the summary arrives."
              bare
            >
              <AiCallout
                label="Cosmic brief"
                footer={<ProvenanceRow sources={[EVERY]} action="reading the full article" />}
              >
                <ProcessingSteps
                  steps={IN_FLIGHT}
                  announceLabel="The Bottleneck Was Never Retrieval"
                />
              </AiCallout>
            </Case>
          </Grid>
        </Section>

        {/* ============ 03 · STAGED AI PROGRESS ============ */}
        <Section
          id="processing"
          index="03"
          title="Staged AI progress"
          file="components/ai/processing-steps.tsx"
          lede="One line per phase, with user-facing labels and never an internal name. The row exists the instant a URL is submitted — never a full-screen spinner, never a fake percentage. Phase changes announce once through a polite live region."
        >
          <Grid>
            <Case label="Just submitted">
              <ProcessingSteps steps={ALL_PENDING} announceLabel="A new save" />
            </Case>
            <Case label="In flight">
              <ProcessingSteps steps={IN_FLIGHT} announceLabel="A new save" />
            </Case>
            <Case label="Finished">
              <ProcessingSteps steps={ALL_DONE} announceLabel="A new save" />
            </Case>
            <Case
              label="Failed · partial success"
              note="Summarising failed; filing still ran on the extracted content. The failed phase carries the Retry, and the rest of the item stays usable."
            >
              <ProcessingSteps
                steps={FAILED}
                announceLabel="A new save"
                onRetry={() => undefined}
              />
            </Case>
          </Grid>
        </Section>

        {/* ============ 04 · SOCIAL ACTION ROW ============ */}
        <Section
          id="action-row"
          index="04"
          title="Social action row"
          file="components/social/action-row.tsx"
          lede="like · comment · save · share, in that order, in every context — muscle memory is the point. Zero counts show no number at all, and nothing above four characters goes unabbreviated."
        >
          <Grid>
            <Case
              label="Untouched · no counts yet"
              note="No like count before the first like. The controls are still there; the numbers are not."
            >
              <ActionRow itemTitle="The Bottleneck Was Never Retrieval" shareUrl="https://cosmicdolphin.app/s/bk_8f2a" />
            </Case>
            <Case label="Engaged">
              <ActionRow
                liked
                likeCount={128}
                commentCount={14}
                saved
                itemTitle="The Bottleneck Was Never Retrieval"
                shareUrl="https://cosmicdolphin.app/s/bk_8f2a"
              />
            </Case>
            <Case
              label="Abbreviated counts"
              note="2 100 renders as 2.1k. Try the share button: it copies the link and toasts."
            >
              <ActionRow
                likeCount={2100}
                commentCount={87}
                itemTitle="Building an agent that actually finishes things"
                shareUrl="https://cosmicdolphin.app/s/bk_1d4c"
              />
            </Case>
            <Case
              label="Save · a reshare"
              note="Save is a reshare: it creates your own bookmark, files it in your Inbox, and runs the pipeline for you, so the summary is yours. Press it — the toast is the server's answer. There is no undo here; un-saving is deleting the bookmark, in the Library."
            >
              <ReshareCase bookmarkId="bk_8f2a" />
            </Case>
            <Case
              label="Save · already in your library"
              note="A reshare inherits the URL, so it meets the same per-user uniqueness constraint a duplicate paste does. Nothing is created, nothing is queued, and the toast is the same one a duplicate paste raises."
            >
              <ReshareCase bookmarkId="bk_1d4c" outcome="alreadySaved" />
            </Case>
            <Case label="Digest labels">
              <ActionRow
                likeCount={6}
                saveLabel="Save digest"
                itemTitle="Four of your saves are circling the same argument"
                shareUrl="https://cosmicdolphin.app/s/dg_44a1"
              />
            </Case>
          </Grid>
        </Section>

        {/* ============ 05 · HEADER CAPSULE ============ */}
        <Section
          id="header"
          index="05"
          title="Header capsule"
          file="components/app-header.tsx"
          lede="A glass capsule floating on a tinted band, laid out as a three-column grid so the centre column stays optically centred whatever the sides do. Below 900px the grid collapses and the capsule squares off — resize the window to see it."
        >
          <Case label="Home active" bare>
            <div className="overflow-hidden rounded-lg border border-line">
              <AppHeader
                className="pt-4"
                currentPath="/my/dashboard"
                user={{ name: "Paulo Freitas" }}
                onSearch={() => undefined}
                onSave={() => undefined}
              />
              <div className="bg-bg px-[18px] py-3.5">
                <p className="m-0 font-sans text-[12.5px] leading-[1.4] text-fg-secondary">
                  The band carries the brand colour; the capsule stays glass so
                  the page reads through it.
                </p>
              </div>
            </div>
          </Case>

          <Case label="Library active · signed out (no avatar, no save)" bare>
            <div className="overflow-hidden rounded-lg border border-line">
              <AppHeader
                className="pt-4"
                currentPath="/my/library"
                saveHref="/sign-in"
                saveLabel="Get started"
                onSearch={() => undefined}
              />
            </div>
          </Case>
        </Section>

        {/* ============ 06 · LIBRARY ROW ============ */}
        <Section
          id="library-row"
          index="06"
          title="Library row"
          file="components/bookmark/library-row.tsx"
          lede="Separator rows, not cards. This surface is private, so it carries no social counts. Unread is a 6px dot with a transparent spacer in its place when read, so every title stays on one left edge."
        >
          <Case label="Populated · unread, read, filing, private link" bare>
            <LibraryList>
              <LibraryRow
                href="/bookmarks/bk_8f2a"
                unread
                collectionPath={[
                  { id: "c1", name: "Research", href: "/my/library?c=c1" },
                  { id: "c2", name: "Agent memory", href: "/my/library?c=c2" },
                ]}
                title="The Bottleneck Was Never Retrieval"
                summary="Agents fail because they can't remember what they already tried, not because they can't find the right document."
                tags={["agent memory", "retrieval"]}
                domain="every.to"
                savedAt="2d ago"
                readingTime="9 min"
              />
              <LibraryRow
                href="/bookmarks/bk_2c19"
                unread
                collectionPath={[
                  { id: "c3", name: "Product", href: "/my/library?c=c3" },
                  { id: "c4", name: "Design systems", href: "/my/library?c=c4" },
                ]}
                title="Tokens are a contract, not a palette"
                summary="Why naming a colour --accent instead of --blue-600 is the whole discipline."
                tags={["design systems", "tokens", "naming", "css"]}
                domain="linear.app"
                savedAt="3d ago"
                readingTime="6 min"
              />
              <LibraryRow
                href="/bookmarks/bk_77b0"
                collectionPath={[
                  { id: "c5", name: "Read later", href: "/my/library?c=c5" },
                ]}
                title="Notes on institutional memory"
                summary="A short essay on why teams re-solve the same problem every eighteen months."
                tags={["organisations"]}
                domain="stratechery.com"
                savedAt="1w ago"
                readingTime="12 min"
              />
              <LibraryRow
                href="/bookmarks/bk_91ff"
                unread
                filing
                summaryLoading
                title="Episodic Memory for Long-Horizon Tool-Using Agents"
                domain="arxiv.org"
                savedAt="just now"
              />
              <LibraryRow
                href="/bookmarks/bk_5ad3"
                unread
                privateLink
                collectionPath={[{ id: "c6", name: "Work" }]}
                title="Q3 retrieval eval — internal writeup"
                tags={["evaluation"]}
                domain="notion.so"
                savedAt="4d ago"
              />
            </LibraryList>
          </Case>

          <Grid>
            <Case label="Loading" bare>
              <LibraryList>
                <LibraryRowSkeleton />
                <LibraryRowSkeleton />
                <LibraryRowSkeleton />
              </LibraryList>
            </Case>

            <div className="flex flex-col gap-6">
              <Case label="Empty" bare>
                <EmptyState
                  ground
                  icon={Inbox}
                  title="No unread links in Research"
                  description="Everything filed here has been read. Newer saves land in Inbox until Cosmic works out where they belong."
                  action={
                    <Button variant="primary" type="button">
                      Save a link
                    </Button>
                  }
                />
              </Case>
              <Case label="Error" bare>
                <EmptyState
                  ground
                  icon={AlertTriangle}
                  title="Couldn't load your library"
                  description="The request timed out. Your saves are safe — this is only the list."
                  action={
                    <Button variant="primary" type="button">
                      Try again
                    </Button>
                  }
                />
              </Case>
            </div>
          </Grid>
        </Section>

        {/* ============ 07 · FEED ITEM ============ */}
        <Section
          id="feed-item"
          index="07"
          title="Feed item"
          file="components/feed/feed-item.tsx"
          lede="Four shapes over one skeleton: article, video, digest, pending. Provenance first, then title, summary, tags, “why this appeared”, and the action row — in that order, always."
        >
          <Case label="article · video · digest · pending" bare>
            <div className="flex flex-col">
              <FeedItem
                variant="pending"
                href="/bookmarks/bk_91ff"
                title="Episodic Memory for Long-Horizon Tool-Using Agents"
                provenance={{
                  sources: [ARXIV],
                  action: "you saved this",
                  timestamp: "just now",
                }}
                steps={IN_FLIGHT}
              />

              <FeedItem
                href="/bookmarks/bk_8f2a"
                title="The Bottleneck Was Never Retrieval"
                provenance={{
                  actor: MAYA,
                  action: "shared",
                  sources: [EVERY],
                  timestamp: "2d",
                }}
                menu={<MenuButton />}
                summary="Agents don't fail because they can't find the right document — they fail because they can't remember what they already tried. A case for episodic memory over bigger context windows."
                tags={["agent memory", "retrieval"]}
                readingTime="9 min"
                rankingReason={RANKING_REASON}
                social={{
                  likeCount: 128,
                  commentCount: 14,
                  onComment: () => setCommentsOpen(true),
                  shareUrl: "https://cosmicdolphin.app/s/bk_8f2a",
                }}
              />

              <FeedItem
                variant="digest"
                href="/digests/dg_44a1"
                title="Four of your saves are circling the same argument"
                label="This week in your library"
                menu={<MenuButton />}
                sources={[
                  { bookmarkId: "bk_8f2a", href: "/bookmarks/bk_8f2a", ...EVERY },
                  { bookmarkId: "bk_91ff", href: "/bookmarks/bk_91ff", ...ARXIV },
                  {
                    bookmarkId: "bk_3e77",
                    href: "/bookmarks/bk_3e77",
                    ...STRATECHERY,
                  },
                  { bookmarkId: "bk_1d4c", href: "/bookmarks/bk_1d4c", ...YOUTUBE },
                  { bookmarkId: "bk_5ad3", href: "/bookmarks/bk_5ad3", domain: "notion.so" },
                ]}
                summary="You've been collecting pieces that all push back on scale-first agent design. Two of them contradict each other on evaluation."
                keyPoints={[
                  {
                    term: "Memory beats context.",
                    text: "Three sources argue that episodic state, not window size, is the limiting factor.",
                  },
                  {
                    term: "Evaluation is unresolved.",
                    text: "Chen proposes trajectory-level scoring; Okafor calls it unfalsifiable.",
                  },
                ]}
                social={{
                  likeCount: 6,
                  shareUrl: "https://cosmicdolphin.app/s/dg_44a1",
                }}
              />

              <FeedItem
                variant="video"
                href="/bookmarks/bk_1d4c"
                title="Building an agent that actually finishes things"
                duration="42:18"
                provenance={{
                  sources: [YOUTUBE],
                  attribution: "Karpathy",
                  action: "liked by 3 people you follow",
                }}
                summary="Transcript summarised into six checkpoints — jump to any of them without watching the whole thing."
                social={{
                  likeCount: 2100,
                  commentCount: 87,
                  shareUrl: "https://cosmicdolphin.app/s/bk_1d4c",
                }}
                onWatchWithSummary={() => undefined}
              />
            </div>
          </Case>

          <Case
            label="AI-processing · failed, and private link"
            note="A failed phase goes where the brief would have been, not in place of the item: the tags, the filing and the original link are all still there. A private link is not a failure and never offers Retry."
            bare
          >
            <div className="flex flex-col">
              <FeedItem
                href="/bookmarks/bk_3e77"
                title="The cost of a perfect index"
                provenance={{
                  sources: [STRATECHERY],
                  action: "you saved this",
                  timestamp: "5m",
                }}
                menu={<MenuButton />}
                steps={FAILED}
                onRetry={() => undefined}
                tags={["retrieval", "cost"]}
                readingTime="11 min"
                social={{
                  shareUrl: "https://cosmicdolphin.app/s/bk_3e77",
                }}
              />

              <FeedItem
                href="/bookmarks/bk_5ad3"
                privateLink
                title="Q3 retrieval eval — internal writeup"
                provenance={{
                  sources: [{ domain: "notion.so" }],
                  action: "you saved this",
                  timestamp: "4d",
                }}
                tags={["evaluation"]}
                social={{ shareUrl: "https://cosmicdolphin.app/s/bk_5ad3" }}
              />
            </div>
          </Case>

          <Grid>
            <Case label="Loading" bare>
              <div className="flex flex-col">
                <FeedItemSkeleton />
                <FeedItemSkeleton />
              </div>
            </Case>

            <div className="flex flex-col gap-6">
              <Case label="Empty" bare>
                <EmptyState
                  ground
                  icon={Newspaper}
                  title="Nothing new in For you"
                  description="You've seen everything ranked for you today. Following has 4 saves you haven't opened."
                  action={
                    <Button variant="primary" type="button">
                      Switch to Following
                    </Button>
                  }
                />
              </Case>
              <Case label="Error" bare>
                <EmptyState
                  ground
                  icon={AlertTriangle}
                  title="Couldn't rank your feed"
                  description="The ranker didn't answer in time. Your saves are all still in the Library."
                  action={
                    <Button variant="primary" type="button">
                      Try again
                    </Button>
                  }
                />
              </Case>
            </div>
          </Grid>
        </Section>

        {/* A drawer on desktop, a sheet below 640px — one component, because
            D2's dialog primitive already is both. Offline here: the gallery
            has no API behind it. */}
        <CommentDrawer
          bookmarkId="bk_8f2a"
          open={commentsOpen}
          onOpenChange={setCommentsOpen}
          title="The Bottleneck Was Never Retrieval"
          commentCount={14}
          offline
        />
      </div>
    </ToastProvider>
  );
}
