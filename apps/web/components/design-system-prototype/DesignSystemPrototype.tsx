"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  Bookmark,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  FolderTree,
  Heart,
  Library,
  MessageCircle,
  MoreHorizontal,
  Network,
  PanelLeft,
  Search,
  Share2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  contentTitleStyle,
  feedItems,
  folders,
  libraryItems,
  screens,
  systems,
  type ScreenKey,
  type SystemKey,
} from "./prototype-data";

export function DesignSystemPrototype() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const system = normalizeSystem(searchParams.get("system"));
  const screen = normalizeScreen(searchParams.get("screen"));
  const systemIndex = systems.findIndex((item) => item.key === system);
  const currentSystem = systems[systemIndex];

  function updateQuery(next: Partial<{ system: SystemKey; screen: ScreenKey }>) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.system) params.set("system", next.system);
    if (next.screen) params.set("screen", next.screen);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function stepSystem(direction: 1 | -1) {
    const nextIndex = (systemIndex + direction + systems.length) % systems.length;
    updateQuery({ system: systems[nextIndex].key });
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (isTyping) return;
      if (event.key === "ArrowLeft") stepSystem(-1);
      if (event.key === "ArrowRight") stepSystem(1);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemIndex, searchParams]);

  return (
    <div className="relative left-1/2 min-h-[calc(100vh-9rem)] w-[min(1480px,calc(100vw-1.5rem))] -translate-x-1/2 pb-28">
      <PrototypeHeader
        currentSystem={currentSystem}
        system={system}
        screen={screen}
        onSystemChange={(next) => updateQuery({ system: next })}
        onScreenChange={(next) => updateQuery({ screen: next })}
      />

      {system === "blue" && <BlueSystem screen={screen} />}
      {system === "amber" && <AmberSystem screen={screen} />}
      {system === "mono" && <MonoSystem screen={screen} />}

      {process.env.NODE_ENV !== "production" && (
        <PrototypeSwitcher
          system={system}
          screen={screen}
          onPrevious={() => stepSystem(-1)}
          onNext={() => stepSystem(1)}
          onScreenChange={(next) => updateQuery({ screen: next })}
        />
      )}
    </div>
  );
}

function normalizeSystem(value: string | null): SystemKey {
  return value === "amber" || value === "mono" || value === "blue"
    ? value
    : "blue";
}

function normalizeScreen(value: string | null): ScreenKey {
  return value === "library" || value === "detail" || value === "home"
    ? value
    : "home";
}

function PrototypeHeader({
  currentSystem,
  system,
  screen,
  onSystemChange,
  onScreenChange,
}: {
  currentSystem: (typeof systems)[number];
  system: SystemKey;
  screen: ScreenKey;
  onSystemChange: (next: SystemKey) => void;
  onScreenChange: (next: ScreenKey) => void;
}) {
  return (
    <header className="mb-5 border border-zinc-200 bg-white/88 p-4 shadow-[0_18px_55px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/88">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
              <Sparkles className="h-3.5 w-3.5" />
              Prototype · throwaway UI
            </span>
            <span className="inline-flex items-center rounded-full bg-zinc-950 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-zinc-950">
              {currentSystem.label} · {currentSystem.name}
            </span>
          </div>
          <h1
            className="text-3xl font-semibold leading-tight tracking-normal text-zinc-950 dark:text-zinc-50 sm:text-4xl"
            style={contentTitleStyle}
          >
            Cosmic Dolphin design-system prototype
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Three visual systems showing the same core product surfaces: an
            algorithmic social home feed, an AI-organized library, and a saved
            bookmark detail page.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <SegmentedControl
            label="System"
            value={system}
            items={systems.map((item) => ({
              key: item.key,
              label: item.label,
              title: item.name,
            }))}
            onChange={(next) => onSystemChange(next as SystemKey)}
          />
          <SegmentedControl
            label="Screen"
            value={screen}
            items={screens.map((item) => ({
              key: item.key,
              label: item.label,
              title: item.label,
            }))}
            onChange={(next) => onScreenChange(next as ScreenKey)}
          />
        </div>
      </div>
      <p className="mt-3 text-xs text-zinc-500">{currentSystem.summary}</p>
    </header>
  );
}

function SegmentedControl({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: Array<{ key: string; label: string; title: string }>;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </span>
      <div className="flex flex-wrap gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            title={item.title}
            onClick={() => onChange(item.key)}
            className={cn(
              "min-h-8 rounded-md px-3 text-xs font-medium transition-colors",
              value === item.key
                ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-white"
                : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PrototypeSwitcher({
  system,
  screen,
  onPrevious,
  onNext,
  onScreenChange,
}: {
  system: SystemKey;
  screen: ScreenKey;
  onPrevious: () => void;
  onNext: () => void;
  onScreenChange: (next: ScreenKey) => void;
}) {
  const current = systems.find((item) => item.key === system)!;

  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-zinc-200 bg-zinc-950 p-2 text-white shadow-[0_22px_70px_rgba(15,23,42,0.36)]">
      <button
        type="button"
        aria-label="Previous design system"
        onClick={onPrevious}
        className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="min-w-[15rem] px-2 text-center">
        <p className="text-xs font-semibold">
          {current.label} · {current.name}
        </p>
        <p className="text-[11px] text-zinc-400">
          Use arrow keys to compare systems
        </p>
      </div>
      <button
        type="button"
        aria-label="Next design system"
        onClick={onNext}
        className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <div className="ml-1 hidden gap-1 border-l border-white/15 pl-2 sm:flex">
        {screens.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onScreenChange(item.key)}
            className={cn(
              "rounded-full px-3 py-2 text-xs font-medium transition-colors",
              screen === item.key
                ? "bg-white text-zinc-950"
                : "text-zinc-300 hover:bg-white/10 hover:text-white"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function BlueSystem({ screen }: { screen: ScreenKey }) {
  return (
    <SystemFrame
      className="border-slate-200 bg-[#f6fafc] text-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
      chrome={<BlueChrome />}
    >
      {screen === "home" && <BlueHome />}
      {screen === "library" && <BlueLibrary />}
      {screen === "detail" && <BlueDetail />}
    </SystemFrame>
  );
}

function AmberSystem({ screen }: { screen: ScreenKey }) {
  return (
    <SystemFrame
      className="border-stone-200 bg-[#fbf7ef] text-stone-950 dark:border-stone-800 dark:bg-[#17130e] dark:text-stone-50"
      chrome={<AmberChrome />}
    >
      {screen === "home" && <AmberHome />}
      {screen === "library" && <AmberLibrary />}
      {screen === "detail" && <AmberDetail />}
    </SystemFrame>
  );
}

function MonoSystem({ screen }: { screen: ScreenKey }) {
  return (
    <SystemFrame
      className="border-zinc-200 bg-[#f7f7f5] text-zinc-950 dark:border-zinc-800 dark:bg-black dark:text-zinc-50"
      chrome={<MonoChrome />}
    >
      {screen === "home" && <MonoHome />}
      {screen === "library" && <MonoLibrary />}
      {screen === "detail" && <MonoDetail />}
    </SystemFrame>
  );
}

function SystemFrame({
  className,
  chrome,
  children,
}: {
  className: string;
  chrome: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("overflow-hidden border shadow-sm", className)}>
      {chrome}
      <div className="min-h-[760px] p-4 sm:p-6">{children}</div>
    </section>
  );
}

function BlueChrome() {
  return (
    <div className="flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/84 px-5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/84">
      <div className="flex items-center gap-7">
        <BrandLockup accent="bg-cyan-500" text="text-slate-950 dark:text-white" />
        <nav className="hidden items-center gap-1 md:flex">
          <NavPill active icon={<BookOpen />} label="Home" />
          <NavPill icon={<Library />} label="Library" />
          <NavPill icon={<Network />} label="Explore" />
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <SearchBox placeholder="Ask your saved links" />
        <AvatarMark />
      </div>
    </div>
  );
}

function AmberChrome() {
  return (
    <div className="flex min-h-16 items-center justify-between border-b border-amber-900/10 bg-[#fffaf0]/86 px-5 backdrop-blur dark:border-amber-100/10 dark:bg-[#17130e]/86">
      <BrandLockup accent="bg-amber-500" text="text-stone-950 dark:text-stone-50" />
      <nav className="hidden items-center gap-6 text-sm text-stone-600 dark:text-stone-300 md:flex">
        <span className="font-medium text-stone-950 dark:text-stone-50">Today</span>
        <span>Library</span>
        <span>Circles</span>
        <span>Notes</span>
      </nav>
      <button className="rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-white dark:bg-stone-50 dark:text-stone-950">
        Save link
      </button>
    </div>
  );
}

function MonoChrome() {
  return (
    <div className="grid min-h-16 grid-cols-[1fr_auto_1fr] items-center border-b border-zinc-200 bg-white px-5 dark:border-zinc-800 dark:bg-black">
      <BrandLockup accent="bg-zinc-950 dark:bg-white" text="text-zinc-950 dark:text-white" />
      <nav className="hidden items-center gap-5 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500 md:flex">
        <span className="text-zinc-950 dark:text-zinc-50">Feed</span>
        <span>Library</span>
        <span>Graph</span>
      </nav>
      <div className="flex justify-end">
        <button className="h-9 rounded-md border border-zinc-300 px-3 text-sm font-medium dark:border-zinc-700">
          Command K
        </button>
      </div>
    </div>
  );
}

function BrandLockup({ accent, text }: { accent: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("h-7 w-7 rounded-md", accent)} />
      <span className={cn("text-base font-semibold tracking-normal", text)}>
        Cosmic Dolphin
      </span>
    </div>
  );
}

function SearchBox({ placeholder }: { placeholder: string }) {
  return (
    <div className="hidden h-9 w-64 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 md:flex">
      <Search className="h-4 w-4" />
      <span>{placeholder}</span>
    </div>
  );
}

function AvatarMark() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white dark:bg-white dark:text-slate-950">
      PF
    </div>
  );
}

function NavPill({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium",
        active
          ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-200"
          : "text-slate-500"
      )}
    >
      <span className="[&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      {label}
    </span>
  );
}

function BlueHome() {
  return (
    <div className="grid gap-5 xl:grid-cols-[15rem_minmax(0,1fr)_20rem]">
      <aside className="hidden space-y-3 xl:block">
        <BluePanel className="p-3">
          <RailTitle>Feed modes</RailTitle>
          <RailItem active icon={<Sparkles />} label="For you" value="23" />
          <RailItem icon={<Clock3 />} label="Fresh saves" value="8" />
          <RailItem icon={<MessageCircle />} label="Discussed" value="11" />
          <RailItem icon={<Archive />} label="Rediscover" value="5" />
        </BluePanel>
        <BluePanel className="p-3">
          <RailTitle>AI structure</RailTitle>
          {["Design systems", "Work rituals", "AI agents", "Writing"].map(
            (item) => (
              <div key={item} className="flex items-center justify-between rounded-md px-2 py-2 text-sm text-slate-600 dark:text-slate-300">
                <span>{item}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
              </div>
            )
          )}
        </BluePanel>
      </aside>
      <main className="min-w-0 space-y-4">
        <div>
          <p className="text-sm font-medium text-cyan-700 dark:text-cyan-300">
            Ranked for your attention
          </p>
          <h2
            className="mt-1 max-w-3xl text-4xl font-semibold leading-tight text-slate-950 dark:text-white"
            style={contentTitleStyle}
          >
            A calmer feed of links your network and library say matter.
          </h2>
        </div>
        <BlueFeedCard item={feedItems[0]} featured />
        {feedItems.slice(1).map((item) => (
          <BlueFeedCard key={item.id} item={item} />
        ))}
      </main>
      <aside className="space-y-3">
        <BluePanel className="p-4">
          <RailTitle>Why this feed</RailTitle>
          <MetricBar label="Personal relevance" value="92" />
          <MetricBar label="Source quality" value="88" />
          <MetricBar label="Trusted social proof" value="74" />
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Social signals support ranking, but do not overpower source quality
            or personal usefulness.
          </p>
        </BluePanel>
        <BluePanel className="p-4">
          <RailTitle>People shaping this</RailTitle>
          {["Maya Chen", "Jonas Reed", "Anika Rao"].map((name) => (
            <div key={name} className="flex items-center justify-between border-t border-slate-100 py-3 text-sm first:border-t-0 dark:border-slate-800">
              <span>{name}</span>
              <span className="text-cyan-700 dark:text-cyan-300">trusted</span>
            </div>
          ))}
        </BluePanel>
      </aside>
    </div>
  );
}

function BlueLibrary() {
  return (
    <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="space-y-3">
        <BluePanel className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <RailTitle>AI folders</RailTitle>
            <FolderTree className="h-4 w-4 text-cyan-600" />
          </div>
          <div className="space-y-1">
            {folders.map((folder) => (
              <button
                key={folder.name}
                className={cn(
                  "flex min-h-9 w-full items-center justify-between rounded-md px-2 text-left text-sm",
                  folder.active
                    ? "bg-cyan-50 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
                )}
              >
                <span>{folder.name}</span>
                <span className="text-xs opacity-70">{folder.count}</span>
              </button>
            ))}
          </div>
        </BluePanel>
        <BluePanel className="p-4">
          <RailTitle>Suggested merge</RailTitle>
          <p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
            “Product research” and “Discovery” have 16 overlapping links.
          </p>
          <button className="mt-3 rounded-md bg-cyan-600 px-3 py-2 text-sm font-medium text-white">
            Review suggestion
          </button>
        </BluePanel>
      </aside>
      <main className="min-w-0">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold" style={contentTitleStyle}>
              Library
            </h2>
            <p className="text-sm text-slate-500">
              Chronological saves, organized by editable AI structure.
            </p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
              Chronological
            </button>
            <button className="rounded-md bg-slate-950 px-3 py-2 text-sm text-white dark:bg-white dark:text-slate-950">
              Search library
            </button>
          </div>
        </div>
        <BluePanel className="divide-y divide-slate-100 dark:divide-slate-800">
          {libraryItems.map((item) => (
            <LibraryRow key={item.title} item={item} accent="cyan" />
          ))}
        </BluePanel>
      </main>
    </div>
  );
}

function BlueDetail() {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <article className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span>producttalk.org</span>
          <span>·</span>
          <span>Saved today</span>
          <span className="rounded-full bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-200">
            AI summarized
          </span>
        </div>
        <h2
          className="max-w-4xl text-5xl font-semibold leading-[1.05] tracking-normal text-slate-950 dark:text-white"
          style={contentTitleStyle}
        >
          Continuous Discovery Habits
        </h2>
        <SourcePreview tone="blue" />
        <BluePanel className="p-5">
          <SectionLabel tone="blue">AI brief</SectionLabel>
          <p className="mt-3 text-lg leading-8 text-slate-700 dark:text-slate-200">
            The article argues that discovery works best as a weekly habit:
            talk to customers continuously, test assumptions early, and keep
            decisions close to evidence.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {["Interview weekly", "Map assumptions", "Test before building"].map(
              (item) => (
                <div key={item} className="rounded-md border border-cyan-100 bg-cyan-50/60 p-3 text-sm font-medium text-cyan-900 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-100">
                  {item}
                </div>
              )
            )}
          </div>
        </BluePanel>
        <CommentsPreview tone="blue" />
      </article>
      <aside className="space-y-3">
        <BluePanel className="p-4">
          <RailTitle>Provenance</RailTitle>
          <FactLine label="Source" value="Product Talk" />
          <FactLine label="Added by" value="You" />
          <FactLine label="Used in" value="4 feed insights" />
          <FactLine label="Confidence" value="High" />
        </BluePanel>
        <BluePanel className="p-4">
          <RailTitle>AI organization</RailTitle>
          <TagCloud tone="blue" />
        </BluePanel>
      </aside>
    </div>
  );
}

function AmberHome() {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
      <main className="space-y-4">
        <section className="border border-amber-900/10 bg-[#fffdf7] p-6 dark:border-amber-100/10 dark:bg-[#1e1811]">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            Today’s reading network
          </p>
          <h2
            className="mt-2 max-w-3xl text-5xl font-semibold leading-[1.04] text-stone-950 dark:text-stone-50"
            style={contentTitleStyle}
          >
            The best saves from people you trust, softened into an editorial
            brief.
          </h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <AmberFeatureCard item={feedItems[0]} />
            <div className="space-y-3 border-t border-amber-900/10 pt-4 dark:border-amber-100/10 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
              <SignalNote label="Why this surfaced" value="3 sources, 2 trusted saves, high topic overlap" />
              <SignalNote label="Reading time" value="8 minutes, summary ready" />
              <SignalNote label="Social layer" value="9 comments, 42 likes" />
            </div>
          </div>
        </section>
        <div className="grid gap-3 lg:grid-cols-2">
          {feedItems.slice(1).map((item) => (
            <AmberSmallCard key={item.id} item={item} />
          ))}
        </div>
      </main>
      <aside className="space-y-3">
        <AmberPanel className="p-4">
          <RailTitle>Trusted circles</RailTitle>
          {["Design readers", "Product thinkers", "Quiet internet"].map((item) => (
            <div key={item} className="flex items-center justify-between border-t border-amber-900/10 py-3 text-sm first:border-t-0 dark:border-amber-100/10">
              <span>{item}</span>
              <span className="text-amber-700 dark:text-amber-300">active</span>
            </div>
          ))}
        </AmberPanel>
        <AmberPanel className="p-4">
          <RailTitle>Editor’s pattern</RailTitle>
          <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-300">
            Warm surfaces emphasize what is worth reading, while social signals
            stay tucked below the content.
          </p>
        </AmberPanel>
      </aside>
    </div>
  );
}

function AmberLibrary() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-3">
        {folders.slice(0, 3).map((folder) => (
          <AmberPanel key={folder.name} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  AI shelf
                </p>
                <h3 className="mt-1 text-xl font-semibold" style={contentTitleStyle}>
                  {folder.name}
                </h3>
              </div>
              <span className="rounded-full border border-amber-900/10 px-2 py-1 text-xs text-stone-500 dark:border-amber-100/10">
                {folder.count}
              </span>
            </div>
            <p className="mt-3 text-sm leading-5 text-stone-600 dark:text-stone-300">
              Suggested grouping based on recent saves, topic overlap, and
              recurring source patterns.
            </p>
          </AmberPanel>
        ))}
      </div>
      <AmberPanel className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-amber-900/10 p-4 dark:border-amber-100/10">
          <div>
            <h2 className="text-2xl font-semibold" style={contentTitleStyle}>
              Recent saves
            </h2>
            <p className="text-sm text-stone-500">
              Chronological archive with warm AI filing hints.
            </p>
          </div>
          <button className="rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-white">
            Refine folders
          </button>
        </div>
        <div className="divide-y divide-amber-900/10 dark:divide-amber-100/10">
          {libraryItems.map((item) => (
            <LibraryRow key={item.title} item={item} accent="amber" />
          ))}
        </div>
      </AmberPanel>
    </div>
  );
}

function AmberDetail() {
  return (
    <div className="mx-auto max-w-5xl">
      <article className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <main className="space-y-5">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            Saved in Product / Discovery
          </p>
          <h2
            className="text-5xl font-semibold leading-[1.05] text-stone-950 dark:text-stone-50"
            style={contentTitleStyle}
          >
            Continuous Discovery Habits
          </h2>
          <SourcePreview tone="amber" />
          <AmberPanel className="p-6">
            <SectionLabel tone="amber">Editorial AI brief</SectionLabel>
            <p className="mt-3 text-lg leading-8 text-stone-700 dark:text-stone-200">
              Keep discovery continuous enough that product decisions stay in
              contact with reality. The strongest practice is not a perfect
              research plan, but a weekly loop that teams can sustain.
            </p>
            <blockquote
              className="mt-5 border-l-2 border-amber-500 pl-4 text-xl leading-8 text-stone-800 dark:text-stone-100"
              style={contentTitleStyle}
            >
              “The best product decisions stay close to evidence.”
            </blockquote>
          </AmberPanel>
          <CommentsPreview tone="amber" />
        </main>
        <aside className="space-y-3">
          <AmberPanel className="p-4">
            <RailTitle>Reading state</RailTitle>
            <FactLine label="Summary" value="Ready" />
            <FactLine label="Highlights" value="6 found" />
            <FactLine label="Comments" value="Open" />
          </AmberPanel>
          <AmberPanel className="p-4">
            <RailTitle>Tags</RailTitle>
            <TagCloud tone="amber" />
          </AmberPanel>
        </aside>
      </article>
    </div>
  );
}

function MonoHome() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <main className="space-y-3">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ["Relevance", "92"],
            ["Quality", "88"],
            ["Novelty", "81"],
            ["Social", "64"],
          ].map(([label, value]) => (
            <div key={label} className="border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                {label}
              </p>
              <p className="mt-2 text-3xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <div className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
            <div>
              <h2 className="text-xl font-semibold" style={contentTitleStyle}>
                For you
              </h2>
              <p className="text-sm text-zinc-500">
                Ranked links, inspectable reasons, no ornamental noise.
              </p>
            </div>
            <MoreHorizontal className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {feedItems.map((item, index) => (
              <MonoFeedRow key={item.id} item={item} rank={index + 1} />
            ))}
          </div>
        </div>
      </main>
      <aside className="space-y-3">
        <MonoPanel title="Ranking explanation">
          <FactLine label="Primary" value="Personal relevance" />
          <FactLine label="Secondary" value="Source quality" />
          <FactLine label="Support" value="Trusted social signals" />
        </MonoPanel>
        <MonoPanel title="Provenance queue">
          {feedItems.map((item) => (
            <div key={item.id} className="border-t border-zinc-200 py-3 text-sm first:border-t-0 dark:border-zinc-800">
              <p className="font-medium">{item.domain}</p>
              <p className="text-zinc-500">{item.kind}</p>
            </div>
          ))}
        </MonoPanel>
      </aside>
    </div>
  );
}

function MonoLibrary() {
  return (
    <div className="grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
            Tree
          </p>
          <PanelLeft className="h-4 w-4 text-zinc-500" />
        </div>
        {folders.map((folder) => (
          <div key={folder.name} className={cn("flex items-center justify-between rounded-md px-2 py-2 text-sm", folder.active ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950" : "text-zinc-600 dark:text-zinc-300")}>
            <span>{folder.name}</span>
            <span className="text-xs opacity-60">{folder.count}</span>
          </div>
        ))}
      </aside>
      <main className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-zinc-200 p-4 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-semibold" style={contentTitleStyle}>
              All saved links
            </h2>
            <p className="text-sm text-zinc-500">
              Chronological list with AI category certainty.
            </p>
          </div>
          <button className="h-9 rounded-md border border-zinc-300 px-3 text-sm font-medium dark:border-zinc-700">
            Filters
          </button>
        </div>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {libraryItems.map((item) => (
            <LibraryRow key={item.title} item={item} accent="mono" />
          ))}
        </div>
      </main>
    </div>
  );
}

function MonoDetail() {
  return (
    <div className="grid gap-4 xl:grid-cols-[15rem_minmax(0,1fr)_18rem]">
      <aside className="hidden border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 xl:block">
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
          Document
        </p>
        <div className="mt-4 space-y-3 text-sm">
          <FactLine label="Domain" value="producttalk.org" />
          <FactLine label="Saved" value="Today" />
          <FactLine label="Folder" value="Product" />
          <FactLine label="Public" value="No" />
        </div>
      </aside>
      <article className="space-y-4">
        <h2
          className="text-5xl font-semibold leading-[1.05]"
          style={contentTitleStyle}
        >
          Continuous Discovery Habits
        </h2>
        <SourcePreview tone="mono" />
        <div className="border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <SectionLabel tone="mono">AI summary</SectionLabel>
          <p className="mt-3 text-lg leading-8 text-zinc-700 dark:text-zinc-200">
            Continuous discovery turns research into a cadence. The operational
            claim is simple: small weekly learning loops outperform occasional
            research pushes.
          </p>
          <div className="mt-5 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {["Talk to customers every week", "Test assumptions before building", "Keep source evidence attached"].map((item) => (
              <div key={item} className="flex items-center gap-3 py-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-zinc-500" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
        <CommentsPreview tone="mono" />
      </article>
      <aside className="space-y-3">
        <MonoPanel title="Why this matters">
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            Appears in four saved-link clusters and two people you trust saved
            related pieces this week.
          </p>
        </MonoPanel>
        <MonoPanel title="Tags">
          <TagCloud tone="mono" />
        </MonoPanel>
      </aside>
    </div>
  );
}

function BlueFeedCard({
  item,
  featured,
}: {
  item: (typeof feedItems)[number];
  featured?: boolean;
}) {
  return (
    <article className="overflow-hidden border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className={cn("grid gap-0", featured && "lg:grid-cols-[minmax(0,1fr)_18rem]")}>
        <div className="p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 font-medium text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/60 dark:text-cyan-200">
              {item.kind}
            </span>
            <span>{item.author}</span>
            <span>·</span>
            <span>{item.domain}</span>
          </div>
          <h3
            className={cn(
              "font-semibold leading-tight tracking-normal text-slate-950 dark:text-white",
              featured ? "text-3xl" : "text-xl"
            )}
            style={contentTitleStyle}
          >
            {item.title}
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {item.summary}
          </p>
          <WhyLine tone="blue" text={item.why} />
          <SocialRow tone="blue" likes={item.likes} comments={item.comments} />
        </div>
        {featured && (
          <div className="min-h-48 border-t border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900 lg:border-l lg:border-t-0">
            <img src={item.image} alt="" className="h-full min-h-48 w-full object-cover" />
          </div>
        )}
      </div>
    </article>
  );
}

function AmberFeatureCard({ item }: { item: (typeof feedItems)[number] }) {
  return (
    <div>
      <div className="mb-4 h-48 overflow-hidden rounded-md bg-amber-100">
        <img src={item.image} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-stone-500">
        <span>{item.author}</span>
        <span>·</span>
        <span>{item.domain}</span>
        <span>·</span>
        <span>{item.kind}</span>
      </div>
      <h3 className="mt-2 text-2xl font-semibold leading-tight" style={contentTitleStyle}>
        {item.title}
      </h3>
      <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-300">
        {item.summary}
      </p>
      <SocialRow tone="amber" likes={item.likes} comments={item.comments} />
    </div>
  );
}

function AmberSmallCard({ item }: { item: (typeof feedItems)[number] }) {
  return (
    <article className="border border-amber-900/10 bg-[#fffdf7] p-4 dark:border-amber-100/10 dark:bg-[#1e1811]">
      <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
        {item.kind} · {item.domain}
      </p>
      <h3 className="mt-2 text-xl font-semibold leading-snug" style={contentTitleStyle}>
        {item.title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-300">
        {item.summary}
      </p>
      <WhyLine tone="amber" text={item.why} />
    </article>
  );
}

function MonoFeedRow({
  item,
  rank,
}: {
  item: (typeof feedItems)[number];
  rank: number;
}) {
  return (
    <article className="grid gap-4 p-4 md:grid-cols-[3rem_minmax(0,1fr)_8rem]">
      <div className="text-2xl font-semibold tabular-nums text-zinc-400">
        {rank.toString().padStart(2, "0")}
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span>{item.kind}</span>
          <span>·</span>
          <span>{item.domain}</span>
          <span>·</span>
          <span>{item.author}</span>
        </div>
        <h3 className="mt-2 text-xl font-semibold leading-tight" style={contentTitleStyle}>
          {item.title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          {item.summary}
        </p>
      </div>
      <div className="flex items-start justify-end">
        <SocialRow tone="mono" likes={item.likes} comments={item.comments} compact />
      </div>
    </article>
  );
}

function LibraryRow({
  item,
  accent,
}: {
  item: (typeof libraryItems)[number];
  accent: "cyan" | "amber" | "mono";
}) {
  const accentClass =
    accent === "cyan"
      ? "text-cyan-700 bg-cyan-50 dark:bg-cyan-950/60 dark:text-cyan-200"
      : accent === "amber"
        ? "text-amber-800 bg-amber-100 dark:bg-amber-950/50 dark:text-amber-200"
        : "text-zinc-700 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-200";

  return (
    <article className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_9rem_7rem] md:items-center">
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span>{item.age}</span>
          <span>·</span>
          <span>{item.domain}</span>
          <span>·</span>
          <span>{item.folder}</span>
        </div>
        <h3 className="truncate text-lg font-semibold leading-tight" style={contentTitleStyle}>
          {item.title}
        </h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-current/10 px-2 py-0.5 text-xs text-zinc-500">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <span className={cn("w-fit rounded-full px-2.5 py-1 text-xs font-medium", accentClass)}>
        {item.status}
      </span>
      <div className="text-sm text-zinc-500 md:text-right">
        AI fit <span className="font-semibold text-zinc-900 dark:text-zinc-100">{item.score}</span>
      </div>
    </article>
  );
}

function SourcePreview({ tone }: { tone: "blue" | "amber" | "mono" }) {
  const border =
    tone === "blue"
      ? "border-slate-200 dark:border-slate-800"
      : tone === "amber"
        ? "border-amber-900/10 dark:border-amber-100/10"
        : "border-zinc-200 dark:border-zinc-800";
  const bg =
    tone === "amber"
      ? "bg-[#fffdf7] dark:bg-[#1e1811]"
      : "bg-white dark:bg-zinc-950";

  return (
    <a
      href="#"
      className={cn("grid overflow-hidden border md:grid-cols-[minmax(0,1fr)_16rem]", border, bg)}
    >
      <div className="p-4">
        <div className="mb-2 flex items-center gap-2 text-sm text-zinc-500">
          <ExternalLink className="h-4 w-4" />
          <span>producttalk.org</span>
        </div>
        <h3 className="text-lg font-semibold">Original source preview</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          A practical guide to making discovery continuous through habits,
          source-backed learning, and small weekly rituals.
        </p>
      </div>
      <img
        src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80"
        alt=""
        className="h-44 w-full object-cover md:h-full"
      />
    </a>
  );
}

function CommentsPreview({ tone }: { tone: "blue" | "amber" | "mono" }) {
  const panel =
    tone === "blue"
      ? "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
      : tone === "amber"
        ? "border-amber-900/10 bg-[#fffdf7] dark:border-amber-100/10 dark:bg-[#1e1811]"
        : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950";

  return (
    <section className={cn("border p-4", panel)}>
      <div className="flex items-center justify-between">
        <SectionLabel tone={tone}>Conversation</SectionLabel>
        <button className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
          Expand comments
        </button>
      </div>
      <div className="mt-4 flex gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
          MR
        </div>
        <div>
          <p className="text-sm font-medium">Maya Reed</p>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            The useful bit here is the cadence. I saved this next to our team
            review ritual.
          </p>
        </div>
      </div>
    </section>
  );
}

function BluePanel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950", className)}>
      {children}
    </div>
  );
}

function AmberPanel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("border border-amber-900/10 bg-[#fffdf7] dark:border-amber-100/10 dark:bg-[#1e1811]", className)}>
      {children}
    </div>
  );
}

function MonoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <RailTitle>{title}</RailTitle>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function RailTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
      {children}
    </p>
  );
}

function RailItem({
  icon,
  label,
  value,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-9 items-center justify-between rounded-md px-2 text-sm",
        active
          ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
          : "text-slate-600 dark:text-slate-300"
      )}
    >
      <span className="flex items-center gap-2 [&_svg]:h-4 [&_svg]:w-4">
        {icon}
        {label}
      </span>
      <span className="text-xs opacity-70">{value}</span>
    </div>
  );
}

function MetricBar({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-cyan-500" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function SignalNote({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-400">
        {label}
      </p>
      <p className="mt-1 text-sm leading-5 text-stone-700 dark:text-stone-200">
        {value}
      </p>
    </div>
  );
}

function WhyLine({
  tone,
  text,
}: {
  tone: "blue" | "amber";
  text: string;
}) {
  const className =
    tone === "blue"
      ? "border-cyan-100 bg-cyan-50/70 text-cyan-900 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-100"
      : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100";
  return (
    <div className={cn("mt-4 flex gap-2 rounded-md border px-3 py-2 text-xs leading-5", className)}>
      <Brain className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function SocialRow({
  tone,
  likes,
  comments,
  compact,
}: {
  tone: "blue" | "amber" | "mono";
  likes: number;
  comments: number;
  compact?: boolean;
}) {
  const active =
    tone === "blue"
      ? "text-cyan-700 dark:text-cyan-300"
      : tone === "amber"
        ? "text-amber-700 dark:text-amber-300"
        : "text-zinc-800 dark:text-zinc-100";

  return (
    <div className={cn("mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-500", compact && "mt-0 justify-end gap-2")}>
      <span className={cn("flex items-center gap-1.5", active)}>
        <Heart className="h-4 w-4" />
        {likes}
      </span>
      <span className="flex items-center gap-1.5">
        <MessageCircle className="h-4 w-4" />
        {comments}
      </span>
      {!compact && (
        <>
          <span className="flex items-center gap-1.5">
            <Bookmark className="h-4 w-4" />
            Save
          </span>
          <span className="flex items-center gap-1.5">
            <Share2 className="h-4 w-4" />
            Share
          </span>
        </>
      )}
    </div>
  );
}

function SectionLabel({ tone, children }: { tone: "blue" | "amber" | "mono"; children: React.ReactNode }) {
  const className =
    tone === "blue"
      ? "text-cyan-700 dark:text-cyan-300"
      : tone === "amber"
        ? "text-amber-700 dark:text-amber-300"
        : "text-zinc-500";

  return (
    <p className={cn("flex items-center gap-2 text-sm font-semibold", className)}>
      <Sparkles className="h-4 w-4" />
      {children}
    </p>
  );
}

function FactLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-zinc-200 py-3 text-sm first:border-t-0 dark:border-zinc-800">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium text-zinc-900 dark:text-zinc-100">{value}</span>
    </div>
  );
}

function TagCloud({ tone }: { tone: "blue" | "amber" | "mono" }) {
  const tags = ["research", "product", "interviews", "habits", "decision loops"];
  const className =
    tone === "blue"
      ? "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-200"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        : "border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span key={tag} className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", className)}>
          {tag}
        </span>
      ))}
    </div>
  );
}
