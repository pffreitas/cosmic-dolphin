import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { focusRing } from "@/components/ui/focus-ring";

/**
 * Home's rail — docs/design-system/pages.md § Home.
 *
 * Your topics this week · People you follow. Continue reading used to open the
 * rail; the morning edition moved it to the top of the page as *Pick up where
 * you left off* (`PickUp`, below), because finishing is what the ranker is
 * tuned for and the thing it optimises should not sit in the margin.
 *
 * **Nothing here is unique.** Below 900px the rail is not rendered at all, and
 * the page's definition of done says that costs the reader nothing — so every
 * destination in it is a link to somewhere they can already get: a bookmark's
 * own detail route, search, a profile. The rail is a shortcut, never a home.
 *
 * A server component on purpose: it holds no state, it takes its percentages
 * and counts already computed, and shipping it as a client component would put
 * three lists' worth of JavaScript on the page to render three lists of links.
 */

export interface ContinueReadingEntry {
  bookmarkId: string;
  href: string;
  title: string;
  /** 0–100, already rounded. */
  percent: number;
  /** "4 min left", or nothing when the pipeline never measured a length. */
  timeLeft?: string;
}

export interface RailTopic {
  topic: string;
  count: number;
  /** Where the topic leads. See the note in `home-view.tsx`. */
  href: string;
}

export interface RailPerson {
  id: string;
  handle: string;
  name: string;
  avatarUrl?: string | null;
  href: string;
  savesThisWeek: number;
}

export interface HomeRailProps {
  continueReading: ContinueReadingEntry[];
  topics: RailTopic[];
  people: RailPerson[];
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="m-0 pb-2.5 font-sans text-[13px] font-semibold leading-none tracking-[-.005em] text-fg">
      {children}
    </h2>
  );
}

function Section({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </section>
  );
}

/** The one place in the rail that is not a link list: a row plus its meter. */
function ProgressMeter({
  percent,
  className,
}: {
  percent: number;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      className={cn("mt-1.5 h-1 w-full overflow-hidden rounded-pill bg-bg-inset", className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${clamped}% read`}
    >
      <div
        className="h-full rounded-pill bg-accent"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

const EMPTY_NOTE =
  "m-0 font-sans text-[12.5px] leading-[1.5] text-fg-tertiary";

/**
 * *Pick up where you left off* — the edition's block 3.
 *
 * Up to three in-progress saves as bordered cards: a title-3 title and a meter
 * with the time left. Absent when nothing is part-read — an empty block above
 * the lead would be the page apologising before it has said anything. Below
 * 640px the cards become a snapping horizontal strip, so three of them cost
 * one row of a phone screen rather than three.
 */
export function PickUp({ entries }: { entries: ContinueReadingEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <section aria-labelledby="home-pickup" className="min-w-0">
      {/*
        No "see all" link: Library has no in-progress filter to land on, and a
        link to a view that ignores its own query string is a link that lies.
      */}
      <h2
        id="home-pickup"
        className="m-0 pb-3 font-sans text-[13px] font-semibold leading-none tracking-[-.005em] text-fg"
      >
        Pick up where you left off
      </h2>
      <ul
        className={cn(
          "m-0 grid list-none gap-3 p-0",
          "grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))]",
          "max-[640px]:-mx-4 max-[640px]:auto-cols-[78%] max-[640px]:grid-flow-col max-[640px]:grid-cols-none",
          "max-[640px]:snap-x max-[640px]:snap-mandatory max-[640px]:overflow-x-auto max-[640px]:px-4",
        )}
      >
        {entries.map((entry) => (
          <li key={entry.bookmarkId} className="min-w-0 snap-start">
            <Link
              href={entry.href}
              className={cn(
                "group flex h-full flex-col gap-3.5 rounded-md border border-line bg-bg-panel px-4 py-3.5",
                "transition-colors duration-cd-fast ease-cd hover:border-line-strong",
                focusRing,
              )}
            >
              <span className="line-clamp-2 font-serif text-[17px] font-semibold leading-[1.35] text-fg group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-[3px]">
                {entry.title}
              </span>
              <span className="mt-auto flex items-center gap-2.5">
                <span className="min-w-0 flex-1">
                  <ProgressMeter percent={entry.percent} className="mt-0" />
                </span>
                <span className="shrink-0 font-sans text-[12.5px] leading-none text-fg-tertiary">
                  {entry.timeLeft ?? `${entry.percent}% read`}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HomeRail({ topics, people }: Omit<HomeRailProps, "continueReading">) {
  return (
    <aside
      aria-label="Reading context"
      /*
        The rail drops entirely below 900px — the breakpoint the page's grid
        uses, not a Tailwind screen, because 900 is where the 680px feed column
        plus a 268px rail plus a 32px gap stops fitting.
      */
      className="flex min-w-0 flex-col gap-7 max-[900px]:hidden"
    >
      <Section label="Your topics this week">
        {topics.length === 0 ? (
          <p className={EMPTY_NOTE}>
            Topics appear once the pipeline has tagged a few saves.
          </p>
        ) : (
          <ul className="-mx-2 m-0 flex list-none flex-col p-0">
            {topics.map((topic) => (
              <li key={topic.topic}>
                <Link
                  href={topic.href}
                  className={cn(
                    "flex items-baseline justify-between gap-3 rounded-sm px-2 py-[7px]",
                    "font-sans text-[13.5px] leading-[1.3] text-fg",
                    "transition-colors duration-cd-fast ease-cd hover:bg-bg-subtle",
                    focusRing
                  )}
                >
                  <span className="min-w-0 truncate">{topic.topic}</span>
                  <span className="shrink-0 font-sans text-[12.5px] text-fg-tertiary">
                    {topic.count === 1 ? "1 save" : `${topic.count} saves`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section label="People you follow">
        {people.length === 0 ? (
          <p className={EMPTY_NOTE}>
            You&apos;re not following anyone yet. Explore is where you find
            people.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {people.map((person) => (
              <li key={person.id}>
                <Link
                  href={person.href}
                  className={cn(
                    "flex min-w-0 items-center gap-2.5 rounded-xs",
                    focusRing
                  )}
                >
                  <Avatar className="size-7 shrink-0">
                    {person.avatarUrl ? (
                      <AvatarImage src={person.avatarUrl} alt="" />
                    ) : null}
                    <AvatarFallback>
                      {person.name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-sans text-[13px] font-medium leading-[1.3] text-fg">
                      {person.name}
                    </span>
                    <span className="truncate font-sans text-[11.5px] leading-[1.3] text-fg-tertiary">
                      {person.savesThisWeek === 0
                        ? "nothing shared this week"
                        : `${person.savesThisWeek} shared this week`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </aside>
  );
}

/**
 * The rail's loading shape.
 *
 * The labels render immediately and only the rows are skeletons
 * (docs/design-system/pages.md § Home, Loading): the reader can already read
 * what is coming, which is the difference between a page that is loading and a
 * page that is broken.
 */
export function HomeRailSkeleton() {
  return (
    <aside
      aria-label="Reading context"
      aria-busy="true"
      className="flex min-w-0 flex-col gap-7 max-[900px]:hidden"
    >
      <Section label="Your topics this week">
        <div className="flex flex-col gap-3 py-1">
          {[88, 64, 76, 52].map((width, index) => (
            <div key={index} className="flex items-center justify-between gap-3">
              <Skeleton shape="line" style={{ width }} />
              <Skeleton shape="line" className="h-2.5 w-12" />
            </div>
          ))}
        </div>
      </Section>

      <Section label="People you follow">
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex items-center gap-2.5">
              <Skeleton className="size-7 shrink-0 rounded-pill" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Skeleton shape="line" className="w-24" />
                <Skeleton shape="line" className="h-2.5 w-20" />
              </div>
            </div>
          ))}
        </div>
      </Section>
    </aside>
  );
}
