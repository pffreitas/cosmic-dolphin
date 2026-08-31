import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { focusRing } from "@/components/ui/focus-ring";

/**
 * Home's rail — docs/design-system/pages.md § Home.
 *
 * Continue reading · Your topics this week · People you follow.
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
    <h2 className="m-0 pb-2.5 font-sans text-[11px] font-semibold uppercase leading-none tracking-[.07em] text-fg-tertiary">
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
function ProgressMeter({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      className="mt-1.5 h-1 w-full overflow-hidden rounded-pill bg-bg-inset"
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

const RAIL_LINK = cn(
  "block rounded-xs font-sans text-[13px] leading-[1.4] text-fg",
  "hover:underline hover:decoration-line-strong hover:underline-offset-[3px]",
  focusRing
);

const EMPTY_NOTE =
  "m-0 font-sans text-[12.5px] leading-[1.5] text-fg-tertiary";

export function HomeRail({ continueReading, topics, people }: HomeRailProps) {
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
      <Section label="Continue reading">
        {continueReading.length === 0 ? (
          <p className={EMPTY_NOTE}>
            Nothing part-read. Open a save and it appears here.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {continueReading.map((entry) => (
              <li key={entry.bookmarkId} className="min-w-0">
                <Link href={entry.href} className={RAIL_LINK}>
                  <span className="line-clamp-2 font-serif">{entry.title}</span>
                </Link>
                <ProgressMeter percent={entry.percent} />
                <p className="m-0 pt-1 font-sans text-[11.5px] leading-[1.4] text-fg-tertiary">
                  <span className="font-mono">{entry.percent}%</span>
                  {entry.timeLeft ? ` · ${entry.timeLeft}` : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section label="Your topics this week">
        {topics.length === 0 ? (
          <p className={EMPTY_NOTE}>
            Topics appear once the pipeline has tagged a few saves.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {topics.map((topic) => (
              <li key={topic.topic}>
                <Link
                  href={topic.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-pill border border-line bg-bg-subtle px-2.5 py-1",
                    "font-sans text-[12px] leading-none text-fg-secondary",
                    "transition-colors duration-cd-fast ease-cd hover:bg-bg-inset hover:text-fg",
                    focusRing
                  )}
                >
                  {topic.topic}
                  <span className="font-mono text-[11px] text-fg-tertiary">
                    {topic.count}
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
      <Section label="Continue reading">
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton shape="line" className="w-[88%]" />
              <Skeleton className="h-1 w-full rounded-pill" />
              <Skeleton shape="line" className="h-2.5 w-16" />
            </div>
          ))}
        </div>
      </Section>

      <Section label="Your topics this week">
        <div className="flex flex-wrap gap-1.5">
          {[64, 88, 52, 72].map((width, index) => (
            <Skeleton
              key={index}
              className="h-[22px] rounded-pill"
              style={{ width }}
            />
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
