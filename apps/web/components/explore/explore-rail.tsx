import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { focusRing } from "@/components/ui/focus-ring";

/**
 * Explore's rail — docs/design-system/pages.md § Explore: "a rail of trending
 * collections and people to follow".
 *
 * Same contract as Home's rail and the same reason for it: **nothing here is
 * unique.** Below 900px it is not rendered at all, and every destination in it
 * is a profile or a collection reachable from a profile. A server component,
 * because it holds no state — the Follow button that would need one lives on
 * the profile the row links to, not here. A rail full of write actions is a
 * column that can fail.
 */

export interface RailCollection {
  id: string;
  name: string;
  description?: string;
  saveCount: number;
  ownerHandle: string;
  ownerName: string;
  /** The owner's profile. Collections have no route of their own yet. */
  href: string;
}

export interface RailPerson {
  id: string;
  handle: string;
  name: string;
  avatarUrl?: string | null;
  href: string;
  savesThisWeek: number;
  followers: number;
  followed: boolean;
}

export interface ExploreRailProps {
  collections: RailCollection[];
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

const rowLink = cn(
  "-mx-2 flex items-center gap-2.5 rounded-sm px-2 py-2",
  "transition-colors duration-cd-fast ease-cd hover:bg-bg-inset",
  focusRing,
);

function initials(name: string): string {
  return name
    .replace(/^@/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** "4 saves", and never "4 saves this week" when the number is zero. */
function saveCountLabel(count: number, noun = "save"): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function ExploreRail({ collections, people }: ExploreRailProps) {
  // The whole rail is absent when neither section has anything. An empty
  // column of two headings is worse than no column: it reads as broken rather
  // than as young.
  if (collections.length === 0 && people.length === 0) return null;

  return (
    <aside
      aria-label="Trending"
      className="flex w-[268px] shrink-0 flex-col gap-7 max-[900px]:hidden"
    >
      {collections.length > 0 ? (
        <Section label="Trending collections">
          <ul className="m-0 flex list-none flex-col p-0">
            {collections.map((collection) => (
              <li key={collection.id}>
                <Link href={collection.href} className={cn(rowLink, "flex-col items-start gap-0.5")}>
                  <span className="font-serif text-[14px] font-semibold leading-[1.35] text-fg">
                    {collection.name}
                  </span>
                  <span className="font-sans text-[12px] leading-[1.4] text-fg-tertiary">
                    {saveCountLabel(collection.saveCount)} · {collection.ownerName}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {people.length > 0 ? (
        <Section label="People to follow">
          <ul className="m-0 flex list-none flex-col p-0">
            {people.map((person) => (
              <li key={person.id}>
                <Link href={person.href} className={rowLink}>
                  <Avatar className="size-7 shrink-0">
                    {person.avatarUrl ? (
                      <AvatarImage src={person.avatarUrl} alt="" />
                    ) : null}
                    <AvatarFallback>{initials(person.name)}</AvatarFallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-sans text-[13px] font-medium leading-none text-fg">
                      {person.name}
                    </span>
                    <span className="font-sans text-[12px] leading-none text-fg-tertiary">
                      {person.followed
                        ? "Following"
                        : saveCountLabel(person.savesThisWeek, "public save")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </aside>
  );
}

/** The rail's labels arrive immediately; the rows fill in beneath them. */
export function ExploreRailSkeleton() {
  return (
    <aside
      aria-hidden="true"
      className="flex w-[268px] shrink-0 flex-col gap-7 max-[900px]:hidden"
    >
      <Section label="Trending collections">
        <div className="flex flex-col gap-3 pt-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-36" />
        </div>
      </Section>
      <Section label="People to follow">
        <div className="flex flex-col gap-3 pt-1">
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
        </div>
      </Section>
    </aside>
  );
}
