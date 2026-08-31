"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  Atom,
  Bookmark,
  Brain,
  ChevronLeft,
  ChevronRight,
  Circle,
  Compass,
  EyeOff,
  Flame,
  GitBranch,
  Layers3,
  Lightbulb,
  MessageSquareQuote,
  MousePointer2,
  Network,
  Radar,
  RefreshCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

// PROTOTYPE: mocked data only. Do not wire this file to production APIs.

type Variant = "A" | "B" | "C";
type CardType = "insight" | "quote" | "rediscovery" | "connection" | "contradiction";

type Source = {
  bookmarkId: string;
  title: string;
  sourceUrl: string;
  role: "primary" | "supporting" | "quote";
  savedAt: string;
  tag: string;
};

type FeedItem = {
  id: string;
  type: CardType;
  title: string;
  body: string;
  explanation: string;
  score: number;
  novelty: number;
  quality: number;
  serendipity: number;
  opening: string;
  sources: Source[];
};

type InterestSignal = {
  label: string;
  value: number;
  delta: string;
  tone: "green" | "amber" | "blue" | "rose";
};

const variants: { key: Variant; name: string }[] = [
  { key: "A", name: "For You Feed" },
  { key: "B", name: "Signal Graph" },
  { key: "C", name: "Command Home" },
];

const feedItems: FeedItem[] = [
  {
    id: "insight-1",
    type: "insight",
    title: "Systems are quietly beating goals in your library",
    opening: "Top ranked because it connects three strong saves.",
    body:
      "Your saved sources suggest that durable progress comes from repeatable systems, tight feedback loops, and lower-friction defaults more than bursts of motivation.",
    explanation:
      "The algorithm boosted this because it has high source agreement, recent saves, and a clean link to an older practice note.",
    score: 96,
    novelty: 82,
    quality: 94,
    serendipity: 61,
    sources: [
      {
        bookmarkId: "habit-systems",
        title: "Atomic Habits",
        sourceUrl: "https://example.com/atomic-habits",
        role: "primary",
        savedAt: "Saved this week",
        tag: "habits",
      },
      {
        bookmarkId: "product-discovery",
        title: "Continuous Discovery Habits",
        sourceUrl: "https://example.com/discovery",
        role: "supporting",
        savedAt: "Saved this week",
        tag: "research",
      },
      {
        bookmarkId: "practice-note",
        title: "Deliberate Practice Notes",
        sourceUrl: "https://example.com/practice",
        role: "supporting",
        savedAt: "Saved last month",
        tag: "learning",
      },
    ],
  },
  {
    id: "quote-1",
    type: "quote",
    title: "A quote your library keeps circling back to",
    opening: "Exact quote, high replay value.",
    body:
      "You do not rise to the level of your goals. You fall to the level of your systems.",
    explanation:
      "This exact passage anchors multiple saved notes about habits, product cadence, and review rituals.",
    score: 91,
    novelty: 55,
    quality: 98,
    serendipity: 42,
    sources: [
      {
        bookmarkId: "habit-systems",
        title: "Atomic Habits",
        sourceUrl: "https://example.com/atomic-habits",
        role: "quote",
        savedAt: "Saved this week",
        tag: "habits",
      },
    ],
  },
  {
    id: "rediscovery-1",
    type: "rediscovery",
    title: "The decision-making essay is suddenly relevant again",
    opening: "Older save, newly connected.",
    body:
      "You saved an article about decision-making six months ago. It now lines up with this week's leadership and team-principles material.",
    explanation:
      "Rediscovered because the older source shares topic signals with newer saves about judgment, trust, and delegation.",
    score: 88,
    novelty: 91,
    quality: 76,
    serendipity: 96,
    sources: [
      {
        bookmarkId: "decision-making",
        title: "How Leaders Make Better Calls",
        sourceUrl: "https://example.com/decisions",
        role: "primary",
        savedAt: "Saved six months ago",
        tag: "leadership",
      },
      {
        bookmarkId: "team-principles",
        title: "Principles for High-Trust Teams",
        sourceUrl: "https://example.com/teams",
        role: "supporting",
        savedAt: "Saved this week",
        tag: "teams",
      },
    ],
  },
  {
    id: "connection-1",
    type: "connection",
    title: "Product discovery and science share the same move",
    opening: "Surprise connection.",
    body:
      "Your notes about product discovery and scientific experimentation both emphasize testing assumptions before investing heavily.",
    explanation:
      "Lifted into the feed because two unrelated clusters converged on the same decision pattern.",
    score: 84,
    novelty: 93,
    quality: 73,
    serendipity: 89,
    sources: [
      {
        bookmarkId: "product-discovery",
        title: "Continuous Discovery Habits",
        sourceUrl: "https://example.com/discovery",
        role: "primary",
        savedAt: "Saved this week",
        tag: "research",
      },
      {
        bookmarkId: "science-method",
        title: "Notes on Scientific Method",
        sourceUrl: "https://example.com/science",
        role: "supporting",
        savedAt: "Saved four months ago",
        tag: "science",
      },
    ],
  },
  {
    id: "contradiction-1",
    type: "contradiction",
    title: "Two saved sources disagree about planning",
    opening: "Contradiction detected.",
    body:
      "One source argues for tight weekly planning. Another warns that heavy planning can hide weak feedback. The tension is worth inspecting.",
    explanation:
      "Ranked because disagreement is rare in your library and often leads to higher-value reflection.",
    score: 79,
    novelty: 88,
    quality: 68,
    serendipity: 74,
    sources: [
      {
        bookmarkId: "weekly-planning",
        title: "The Weekly Operating Review",
        sourceUrl: "https://example.com/weekly-review",
        role: "primary",
        savedAt: "Saved two weeks ago",
        tag: "planning",
      },
      {
        bookmarkId: "feedback-over-plans",
        title: "Feedback Beats Roadmaps",
        sourceUrl: "https://example.com/feedback",
        role: "supporting",
        savedAt: "Saved yesterday",
        tag: "feedback",
      },
    ],
  },
];

const signals: InterestSignal[] = [
  { label: "Habits", value: 94, delta: "+18 this week", tone: "green" },
  { label: "Leadership", value: 82, delta: "+9 from rediscovery", tone: "amber" },
  { label: "Research", value: 76, delta: "+12 from saves", tone: "blue" },
  { label: "Planning tension", value: 63, delta: "new contradiction", tone: "rose" },
];

const typeMeta = {
  insight: { label: "Insight", icon: Lightbulb, color: "text-emerald-500" },
  quote: { label: "Quote", icon: MessageSquareQuote, color: "text-cyan-500" },
  rediscovery: { label: "Rediscovery", icon: RefreshCcw, color: "text-amber-500" },
  connection: { label: "Connection", icon: GitBranch, color: "text-blue-500" },
  contradiction: { label: "Contradiction", icon: ScanLine, color: "text-rose-500" },
};

export function HomeBriefPrototype({ initialVariant }: { initialVariant: Variant }) {
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const visibleItems = feedItems.filter((item) => !hiddenIds.includes(item.id));

  function hideItem(id: string) {
    setHiddenIds((current) => [...current, id]);
  }

  function saveItem(id: string) {
    setSavedIds((current) => Array.from(new Set([...current, id])));
  }

  return (
    <div className="relative left-1/2 min-h-[calc(100vh-9rem)] w-[min(1280px,calc(100vw-2rem))] -translate-x-1/2 pb-28 text-gray-950 dark:text-gray-50">
      <PrototypeHero />
      {initialVariant === "A" && (
        <VariantForYouFeed
          items={visibleItems}
          savedIds={savedIds}
          onHide={hideItem}
          onSave={saveItem}
        />
      )}
      {initialVariant === "B" && (
        <VariantSignalGraph
          items={visibleItems}
          savedIds={savedIds}
          onHide={hideItem}
          onSave={saveItem}
        />
      )}
      {initialVariant === "C" && (
        <VariantCommandHome
          items={visibleItems}
          savedIds={savedIds}
          onHide={hideItem}
          onSave={saveItem}
        />
      )}
      <PrototypeSwitcher current={initialVariant} />
    </div>
  );
}

function PrototypeHero() {
  return (
    <header className="mb-6 overflow-hidden border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="p-5 sm:p-7">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 dark:border-gray-800 dark:text-gray-300">
              <Brain className="h-3.5 w-3.5" />
              Smart Home Brief prototype
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Source backed
            </span>
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-normal text-gray-950 dark:text-gray-50 sm:text-5xl">
            A homepage that learns what deserves your attention next.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400 sm:text-base">
            A ranked feed from your own library: insight, rediscovery,
            contradiction, and source-backed surprise. The page should feel like
            a personal social network where every post came from things you
            already cared enough to save.
          </p>
        </div>
        <div className="border-t border-gray-200 p-5 dark:border-gray-800 lg:border-l lg:border-t-0">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">
              Ranking model
            </span>
            <Activity className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="space-y-3">
            <SignalBar label="Relevance" value={92} tone="emerald" />
            <SignalBar label="Novelty" value={84} tone="cyan" />
            <SignalBar label="Quality" value={88} tone="amber" />
            <SignalBar label="Serendipity" value={73} tone="rose" />
          </div>
          <p className="mt-4 text-xs leading-5 text-gray-500">
            score = relevance + novelty + quality + serendipity - repetition
          </p>
        </div>
      </div>
    </header>
  );
}

type VariantProps = {
  items: FeedItem[];
  savedIds: string[];
  onHide: (id: string) => void;
  onSave: (id: string) => void;
};

function VariantForYouFeed({ items, savedIds, onHide, onSave }: VariantProps) {
  const lead = items[0];
  const stream = items.slice(1);

  return (
    <main className="grid gap-5 xl:grid-cols-[15rem_minmax(0,1fr)_18rem]">
      <LeftRail />
      <section className="min-w-0">
        <FeedHeader
          title="For You from your library"
          subtitle="Ranked by freshness, novelty, source quality, and surprise."
        />
        {lead && (
          <HeroFeedCard
            item={lead}
            saved={savedIds.includes(lead.id)}
            onHide={onHide}
            onSave={onSave}
          />
        )}
        <div className="mt-4 space-y-3">
          {stream.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              saved={savedIds.includes(item.id)}
              onHide={onHide}
              onSave={onSave}
            />
          ))}
        </div>
        {items.length === 0 && <EmptyState />}
      </section>
      <RightRail items={items} />
    </main>
  );
}

function VariantSignalGraph({ items, savedIds, onHide, onSave }: VariantProps) {
  return (
    <main className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="min-w-0">
        <FeedHeader
          title="Source graph"
          subtitle="A more Linear-like workspace: dense, inspectable, and provenance first."
        />
        <GraphPanel items={items} />
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {items.slice(0, 4).map((item) => (
            <GraphCard
              key={item.id}
              item={item}
              saved={savedIds.includes(item.id)}
              onHide={onHide}
              onSave={onSave}
            />
          ))}
        </div>
        {items.length === 0 && <EmptyState />}
      </section>
      <aside className="space-y-3">
        <AlgorithmPanel />
        <SourceStack items={items} />
      </aside>
    </main>
  );
}

function VariantCommandHome({ items, savedIds, onHide, onSave }: VariantProps) {
  return (
    <main className="space-y-5">
      <FeedHeader
        title="Today in your mind"
        subtitle="A command-center homepage with velocity, surprise, and one-tap reactions."
      />
      <section className="grid gap-3 lg:grid-cols-4">
        {signals.map((signal) => (
          <SignalTile key={signal.label} signal={signal} />
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)]">
        <div className="space-y-3">
          {items.slice(0, 3).map((item, index) => (
            <CommandFeedItem
              key={item.id}
              item={item}
              rank={index + 1}
              saved={savedIds.includes(item.id)}
              onHide={onHide}
              onSave={onSave}
            />
          ))}
        </div>
        <aside className="space-y-3">
          <SurprisePanel items={items.slice(3)} />
          <AlgorithmPanel compact />
        </aside>
      </section>
      {items.length === 0 && <EmptyState />}
    </main>
  );
}

function FeedHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal text-gray-950 dark:text-gray-50">
          {title}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {subtitle}
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <MousePointer2 className="h-3.5 w-3.5" />
        Tuned for attention, still explainable
      </div>
    </div>
  );
}

function LeftRail() {
  return (
    <aside className="hidden space-y-3 xl:block">
      <RailSection title="Today">
        <RailButton active icon={Flame} label="For You" count="5" />
        <RailButton icon={RefreshCcw} label="Rediscover" count="2" />
        <RailButton icon={ScanLine} label="Contradictions" count="1" />
        <RailButton icon={Network} label="Connections" count="4" />
      </RailSection>
      <RailSection title="Modes">
        <RailButton icon={Compass} label="Surprise me" count="on" />
        <RailButton icon={Layers3} label="Deep synthesis" count="beta" />
      </RailSection>
    </aside>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
      <p className="mb-2 px-2 text-xs font-semibold uppercase text-gray-500">
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function RailButton({
  icon: Icon,
  label,
  count,
  active,
}: {
  icon: typeof Flame;
  label: string;
  count: string;
  active?: boolean;
}) {
  return (
    <button
      className={`flex min-h-9 w-full items-center justify-between rounded-md px-2 text-sm ${
        active
          ? "bg-gray-950 text-white dark:bg-gray-50 dark:text-gray-950"
          : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900"
      }`}
      type="button"
    >
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className="text-xs opacity-70">{count}</span>
    </button>
  );
}

function RightRail({ items }: { items: FeedItem[] }) {
  return (
    <aside className="space-y-3">
      <AlgorithmPanel compact />
      <SourceStack items={items} />
    </aside>
  );
}

function HeroFeedCard({ item, saved, onHide, onSave }: ItemCardProps) {
  const meta = typeMeta[item.type];
  const Icon = meta.icon;

  return (
    <article className="overflow-hidden border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium dark:border-gray-800 ${meta.color}`}>
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
            </span>
            <span className="text-xs text-gray-500">{item.opening}</span>
          </div>
          <h3 className="max-w-2xl text-3xl font-semibold leading-tight tracking-normal text-gray-950 dark:text-gray-50">
            {item.title}
          </h3>
          <p className="mt-4 max-w-2xl text-base leading-7 text-gray-700 dark:text-gray-300">
            {item.type === "quote" ? `"${item.body}"` : item.body}
          </p>
          <WhyThisAppeared item={item} />
          <SourceLinks sources={item.sources} />
          <ActionRow item={item} saved={saved} onHide={onHide} onSave={onSave} />
        </div>
        <ScorePanel item={item} />
      </div>
    </article>
  );
}

function FeedCard({ item, saved, onHide, onSave }: ItemCardProps) {
  const meta = typeMeta[item.type];
  const Icon = meta.icon;

  return (
    <article className="border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-gray-200 dark:border-gray-800">
          <Icon className={`h-5 w-5 ${meta.color}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500">{meta.label}</span>
            <Circle className="h-1.5 w-1.5 fill-gray-300 text-gray-300" />
            <span className="text-xs text-gray-500">Rank {item.score}</span>
            <Circle className="h-1.5 w-1.5 fill-gray-300 text-gray-300" />
            <span className="text-xs text-gray-500">{item.opening}</span>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-gray-950 dark:text-gray-50">
            {item.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
            {item.type === "quote" ? `"${item.body}"` : item.body}
          </p>
          <SourceLinks sources={item.sources.slice(0, 2)} compact />
          <ActionRow item={item} saved={saved} onHide={onHide} onSave={onSave} compact />
        </div>
      </div>
    </article>
  );
}

function GraphPanel({ items }: { items: FeedItem[] }) {
  const nodes = items.slice(0, 5);

  return (
    <section className="overflow-hidden border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-gray-950 dark:text-gray-50">
              Interest map
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Algorithmic clusters from your saved content.
            </p>
          </div>
          <Radar className="h-5 w-5 text-cyan-500" />
        </div>
      </div>
      <div className="relative min-h-[24rem] p-5">
        <div className="absolute left-[12%] top-[16%] h-px w-[36%] rotate-12 bg-gray-200 dark:bg-gray-800" />
        <div className="absolute left-[38%] top-[38%] h-px w-[33%] -rotate-6 bg-gray-200 dark:bg-gray-800" />
        <div className="absolute left-[23%] top-[63%] h-px w-[44%] rotate-[-18deg] bg-gray-200 dark:bg-gray-800" />
        {nodes.map((item, index) => (
          <GraphNode key={item.id} item={item} index={index} />
        ))}
        <div className="absolute inset-x-5 bottom-5 grid gap-2 sm:grid-cols-3">
          <SignalBar label="Freshness" value={86} tone="cyan" />
          <SignalBar label="Diversity" value={79} tone="emerald" />
          <SignalBar label="Tension" value={63} tone="rose" />
        </div>
      </div>
    </section>
  );
}

function GraphNode({ item, index }: { item: FeedItem; index: number }) {
  const meta = typeMeta[item.type];
  const Icon = meta.icon;
  const positions = [
    "left-[8%] top-[14%]",
    "left-[46%] top-[10%]",
    "right-[8%] top-[34%]",
    "left-[22%] top-[54%]",
    "right-[22%] top-[60%]",
  ];

  return (
    <div
      className={`absolute w-44 border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-950 ${positions[index]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <Icon className={`h-4 w-4 ${meta.color}`} />
        <span className="text-xs text-gray-500">{item.score}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-gray-950 dark:text-gray-50">
        {item.title}
      </p>
      <p className="mt-1 text-xs text-gray-500">{meta.label}</p>
    </div>
  );
}

function GraphCard({ item, saved, onHide, onSave }: ItemCardProps) {
  return (
    <article className="border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-gray-500">{typeMeta[item.type].label}</p>
          <h3 className="mt-2 text-base font-semibold leading-snug text-gray-950 dark:text-gray-50">
            {item.title}
          </h3>
        </div>
        <span className="rounded-full border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 dark:border-gray-800 dark:text-gray-300">
          {item.score}
        </span>
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-700 dark:text-gray-300">
        {item.type === "quote" ? `"${item.body}"` : item.body}
      </p>
      <SourceLinks sources={item.sources.slice(0, 2)} compact />
      <ActionRow item={item} saved={saved} onHide={onHide} onSave={onSave} compact />
    </article>
  );
}

function CommandFeedItem({ item, rank, saved, onHide, onSave }: ItemCardProps & { rank: number }) {
  const meta = typeMeta[item.type];
  const Icon = meta.icon;

  return (
    <article className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="grid gap-0 md:grid-cols-[4.5rem_minmax(0,1fr)_12rem]">
        <div className="flex items-center justify-center border-b border-gray-200 p-4 dark:border-gray-800 md:border-b-0 md:border-r">
          <span className="text-3xl font-semibold text-gray-950 dark:text-gray-50">
            {rank}
          </span>
        </div>
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Icon className={`h-4 w-4 ${meta.color}`} />
            <span className="text-xs font-medium text-gray-500">{meta.label}</span>
            <span className="text-xs text-gray-400">score {item.score}</span>
          </div>
          <h3 className="mt-2 text-xl font-semibold leading-snug text-gray-950 dark:text-gray-50">
            {item.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
            {item.type === "quote" ? `"${item.body}"` : item.body}
          </p>
          <SourceLinks sources={item.sources.slice(0, 2)} compact />
          <ActionRow item={item} saved={saved} onHide={onHide} onSave={onSave} compact />
        </div>
        <div className="border-t border-gray-200 p-4 dark:border-gray-800 md:border-l md:border-t-0">
          <ScoreMini label="Novelty" value={item.novelty} />
          <ScoreMini label="Quality" value={item.quality} />
          <ScoreMini label="Surprise" value={item.serendipity} />
        </div>
      </div>
    </article>
  );
}

type ItemCardProps = {
  item: FeedItem;
  saved: boolean;
  onHide: (id: string) => void;
  onSave: (id: string) => void;
};

function ScorePanel({ item }: { item: FeedItem }) {
  return (
    <aside className="border-t border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900 lg:border-l lg:border-t-0">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-gray-500">
          Attention score
        </p>
        <TrendingUp className="h-4 w-4 text-emerald-500" />
      </div>
      <p className="mt-2 text-5xl font-semibold text-gray-950 dark:text-gray-50">
        {item.score}
      </p>
      <div className="mt-5 space-y-3">
        <SignalBar label="Novelty" value={item.novelty} tone="cyan" />
        <SignalBar label="Quality" value={item.quality} tone="emerald" />
        <SignalBar label="Serendipity" value={item.serendipity} tone="amber" />
      </div>
    </aside>
  );
}

function WhyThisAppeared({ item }: { item: FeedItem }) {
  return (
    <div className="mt-5 border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-3">
        <Atom className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500" />
        <div>
          <p className="text-sm font-medium text-gray-950 dark:text-gray-50">
            Why this appeared
          </p>
          <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-400">
            {item.explanation}
          </p>
        </div>
      </div>
    </div>
  );
}

function SourceLinks({ sources, compact = false }: { sources: Source[]; compact?: boolean }) {
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "mt-3" : "mt-4"}`}>
      {sources.map((source) => (
        <Link
          key={`${source.bookmarkId}-${source.role}`}
          href={`/bookmarks/${source.bookmarkId}`}
          className="inline-flex min-h-8 max-w-full items-center gap-2 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-900"
        >
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{source.title}</span>
        </Link>
      ))}
    </div>
  );
}

function ActionRow({ item, saved, onHide, onSave, compact = false }: ItemCardProps & { compact?: boolean }) {
  const buttonClass =
    "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-950 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-gray-50";

  return (
    <div className={`flex flex-wrap items-center gap-1 ${compact ? "mt-3" : "mt-4"}`}>
      <button className={buttonClass} type="button">
        <ThumbsUp className="h-3.5 w-3.5" />
        Useful
      </button>
      <button className={buttonClass} type="button">
        <ThumbsDown className="h-3.5 w-3.5" />
        Not useful
      </button>
      <button className={buttonClass} type="button">
        <EyeOff className="h-3.5 w-3.5" />
        Less like this
      </button>
      <button className={buttonClass} type="button" onClick={() => onSave(item.id)}>
        <Bookmark className="h-3.5 w-3.5" />
        {saved ? "Saved" : "Save"}
      </button>
      <button
        aria-label="Dismiss card"
        className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-950 dark:hover:bg-gray-900 dark:hover:text-gray-50"
        type="button"
        onClick={() => onHide(item.id)}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function AlgorithmPanel({ compact = false }: { compact?: boolean }) {
  return (
    <section className="border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
          Algorithm
        </h3>
        <Brain className="h-4 w-4 text-blue-500" />
      </div>
      <div className="space-y-3">
        <SignalBar label="Relevance" value={92} tone="emerald" />
        <SignalBar label="Novelty" value={84} tone="cyan" />
        {!compact && <SignalBar label="Quality" value={88} tone="amber" />}
        <SignalBar label="Repetition guard" value={71} tone="rose" />
      </div>
      <p className="mt-3 text-xs leading-5 text-gray-500">
        New, useful, source-backed, and different from what you saw yesterday.
      </p>
    </section>
  );
}

function SourceStack({ items }: { items: FeedItem[] }) {
  const sources = items.flatMap((item) => item.sources);

  return (
    <section className="border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
      <h3 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
        Source trail
      </h3>
      <div className="mt-3 space-y-2">
        {sources.slice(0, 6).map((source) => (
          <Link
            key={`${source.bookmarkId}-${source.role}-${source.title}`}
            href={`/bookmarks/${source.bookmarkId}`}
            className="block rounded-md border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium text-gray-950 dark:text-gray-50">
                {source.title}
              </p>
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {source.tag}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">{source.savedAt}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SurprisePanel({ items }: { items: FeedItem[] }) {
  return (
    <section className="border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
          Surprise queue
        </h3>
        <Sparkles className="h-4 w-4 text-amber-500" />
      </div>
      {items.length === 0 ? (
        <p className="text-sm leading-6 text-gray-500">
          More surprising cards appear as new saves create fresh clusters.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
              <p className="text-sm font-medium text-gray-950 dark:text-gray-50">
                {item.title}
              </p>
              <p className="mt-1 text-xs text-gray-500">{item.opening}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SignalTile({ signal }: { signal: InterestSignal }) {
  const toneClass = {
    green: "text-emerald-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
    rose: "text-rose-600",
  }[signal.tone];

  return (
    <div className="border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
      <p className="text-sm font-medium text-gray-500">{signal.label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className={`text-4xl font-semibold ${toneClass}`}>{signal.value}</p>
        <p className="pb-1 text-xs text-gray-500">{signal.delta}</p>
      </div>
    </div>
  );
}

function SignalBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "cyan" | "amber" | "rose";
}) {
  const toneClass = {
    emerald: "bg-emerald-500",
    cyan: "bg-cyan-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  }[tone];

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-gray-600 dark:text-gray-300">{label}</span>
        <span className="text-gray-500">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        <div className={`h-full ${toneClass}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ScoreMini({ label, value }: { label: string; value: number }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between gap-2 text-xs">
        <span className="text-gray-500">{label}</span>
        <span className="font-medium text-gray-700 dark:text-gray-200">{value}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        <div className="h-full bg-gray-950 dark:bg-gray-50" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-950">
      <h3 className="text-lg font-semibold text-gray-950 dark:text-gray-50">
        Your feed is cleared
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
        In production, dismissed cards would stay hidden until the cooldown
        expires or fresh saved content creates new candidates.
      </p>
    </div>
  );
}

function PrototypeSwitcher({ current }: { current: Variant }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentIndex = variants.findIndex((variant) => variant.key === current);
  const currentVariant = variants[currentIndex] ?? variants[0];
  const isProduction = process.env.NODE_ENV === "production";

  const goTo = useMemo(() => {
    return (direction: -1 | 1) => {
      const nextIndex = (currentIndex + direction + variants.length) % variants.length;
      const params = new URLSearchParams(searchParams.toString());
      params.set("variant", variants[nextIndex].key);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };
  }, [currentIndex, pathname, router, searchParams]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable='true']")) return;
      if (event.key === "ArrowLeft") goTo(-1);
      if (event.key === "ArrowRight") goTo(1);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo]);

  if (isProduction) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-gray-900 bg-gray-950 px-2 py-2 text-white shadow-2xl">
      <button
        aria-label="Previous prototype variant"
        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"
        type="button"
        onClick={() => goTo(-1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="min-w-44 px-2 text-center text-sm font-medium">
        {currentVariant.key} - {currentVariant.name}
      </div>
      <button
        aria-label="Next prototype variant"
        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"
        type="button"
        onClick={() => goTo(1)}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
