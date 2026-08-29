import * as React from "react";
import Link from "next/link";
import { Bookmark, FolderOpen, Heart } from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { LibraryRow } from "@/components/bookmark/library-row";
import { focusRing } from "@/components/ui/focus-ring";
import type { LibraryItem } from "@/components/bookmark/library/row-data";

import {
  PROFILE_TABS,
  PROFILE_TAB_LABELS,
  ProfileTab,
  countLabel,
  profileTabHref,
} from "./profile-data";

/**
 * The profile page — docs/design-system/pages.md § Profile.
 *
 * "Avatar, name, join date, and counts (saves, collections, followers,
 * following). Tabs for Saves (public only), Collections, and Likes. **Someone
 * else's profile is the same page with a Follow primary button.**"
 *
 * That last sentence is the design of this file. `/my/profile` and
 * `/u/{handle}` are the same component with different props, and both are
 * built from a `PublicProfile` — the shape that structurally cannot carry an
 * email. There is no branch in here that renders a private field for one
 * viewer and not another, because there is no private field in scope.
 *
 * A server component: it holds no state. The two things that do — Follow and
 * the edit dialog — are leaves the page passes in.
 */

export interface ProfileCollectionEntry {
  id: string;
  name: string;
  description?: string;
  saveCount: number;
}

export interface ProfileViewProps {
  /** `/my/profile` or `/u/{handle}` — every tab link is built from it. */
  basePath: string;
  handle: string;
  name: string;
  avatarUrl?: string | null;
  /** Already formatted on the server: "Joined March 2026". */
  joinedAt: string;
  counts: {
    publicSaves: number;
    collections: number;
    followers: number;
    following: number;
  };
  tab: ProfileTab;
  saves: LibraryItem[];
  collections: ProfileCollectionEntry[];
  likes: LibraryItem[];
  /** The reader's own profile. Decides which copy the empty states use. */
  isSelf: boolean;
  /** Follow, or Edit profile and Sign out. One slot, one decisive action. */
  action?: React.ReactNode;
}

function initials(name: string): string {
  return name
    .replace(/^@/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function Count({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-mono text-[13px] font-medium leading-none text-fg tabular-nums">
        {value}
      </span>
      <span className="font-sans text-[13px] leading-none text-fg-secondary">
        {label}
      </span>
    </span>
  );
}

export function ProfileView({
  basePath,
  handle,
  name,
  avatarUrl,
  joinedAt,
  counts,
  tab,
  saves,
  collections,
  likes,
  isSelf,
  action,
}: ProfileViewProps) {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8 py-8">
      <header className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar className="size-16 shrink-0">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-base">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="m-0 truncate font-serif text-[24px] font-semibold leading-[1.25] tracking-[-.01em] text-fg">
                {name}
              </h1>
              <p className="m-0 font-sans text-[13px] leading-[1.4] text-fg-secondary">
                @{handle}
                {joinedAt ? ` · ${joinedAt}` : ""}
              </p>
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Count value={counts.publicSaves} label="public saves" />
          <Count value={counts.collections} label="collections" />
          <Count value={counts.followers} label="followers" />
          <Count value={counts.following} label="following" />
        </div>
      </header>

      <ProfileTabs basePath={basePath} tab={tab} counts={counts} />

      {tab === "saves" ? (
        <SavesTab items={saves} isSelf={isSelf} name={name} />
      ) : tab === "collections" ? (
        <CollectionsTab
          collections={collections}
          isSelf={isSelf}
          name={name}
        />
      ) : (
        <LikesTab items={likes} isSelf={isSelf} name={name} />
      )}
    </div>
  );
}

/**
 * The tabs — real links, not buttons.
 *
 * They change what the URL addresses, so they are anchors: middle-click,
 * ⌘-click and "copy link address" all work, and the page needs no JavaScript
 * to move between them. `aria-current="page"` marks the selected one, which is
 * the tab pattern's equivalent of `aria-selected` when the tabs are links.
 */
function ProfileTabs({
  basePath,
  tab,
  counts,
}: {
  basePath: string;
  tab: ProfileTab;
  counts: ProfileViewProps["counts"];
}) {
  const countFor: Record<ProfileTab, number | null> = {
    saves: counts.publicSaves,
    collections: counts.collections,
    // There is no public "likes" count on a profile — the spec lists four
    // counts and this is not one of them. Showing an invented number under a
    // tab would be worse than showing none.
    likes: null,
  };

  return (
    <nav
      aria-label="Profile sections"
      className="flex items-center gap-1 border-b border-line"
    >
      {PROFILE_TABS.map((candidate) => {
        const active = candidate === tab;
        const count = countFor[candidate];

        return (
          <Link
            key={candidate}
            href={profileTabHref(basePath, candidate)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5",
              "font-sans text-[13.5px] font-medium leading-none",
              "transition-colors duration-cd-fast ease-cd",
              active
                ? "border-accent text-fg"
                : "border-transparent text-fg-secondary hover:text-fg",
              focusRing,
            )}
          >
            {PROFILE_TAB_LABELS[candidate]}
            {count !== null ? (
              <span className="font-mono text-[11.5px] leading-none text-fg-tertiary tabular-nums">
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function RowList({ items }: { items: LibraryItem[] }) {
  return (
    <div className="divide-y divide-line">
      {items.map((item) => (
        <LibraryRow
          key={item.id}
          href={`/bookmarks/${item.id}`}
          title={item.title}
          summary={item.summary}
          // No collection breadcrumb and no read state: both are the owner's
          // private context, and neither survives being made public
          // (docs/functional-spec/06-social.md § Visibility).
          tags={item.tags}
          domain={item.domain}
          savedAt={item.savedAt}
          readingTime={item.readingTime}
          thumbnailUrl={item.thumbnailUrl}
          privateLink={item.privateLink}
        />
      ))}
    </div>
  );
}

function SavesTab({
  items,
  isSelf,
  name,
}: {
  items: LibraryItem[];
  isSelf: boolean;
  name: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        ground
        icon={Bookmark}
        title={
          isSelf
            ? "You haven't made any saves public yet."
            : `${name} hasn't made any saves public.`
        }
        description={
          isSelf
            ? "A save is private until you share it. Anything you make public appears here and in your followers' feeds."
            : "Only public saves appear on a profile. Their library is theirs."
        }
      />
    );
  }

  return <RowList items={items} />;
}

function LikesTab({
  items,
  isSelf,
  name,
}: {
  items: LibraryItem[];
  isSelf: boolean;
  name: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        ground
        icon={Heart}
        title={
          isSelf ? "You haven't liked anything yet." : `${name} hasn't liked anything yet.`
        }
        description="Likes on public saves show up here. A like on something that later became private drops out."
      />
    );
  }

  return <RowList items={items} />;
}

function CollectionsTab({
  collections,
  isSelf,
  name,
}: {
  collections: ProfileCollectionEntry[];
  isSelf: boolean;
  name: string;
}) {
  if (collections.length === 0) {
    return (
      <EmptyState
        ground
        icon={FolderOpen}
        title={
          isSelf
            ? "None of your collections are public."
            : `${name} has no public collections.`
        }
        description={
          isSelf
            ? "Making a collection public shares its name and the public saves in it — never the private ones."
            : "A public collection shows its name and whatever the owner has made public inside it."
        }
      />
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
      {collections.map((collection) => (
        <li key={collection.id} className="flex flex-col gap-1 py-3.5">
          <span className="font-serif text-[16px] font-semibold leading-[1.35] text-fg">
            {collection.name}
          </span>
          {collection.description ? (
            <span className="font-sans text-[13.5px] leading-[1.5] text-fg-secondary">
              {collection.description}
            </span>
          ) : null}
          <span className="font-sans text-[12px] leading-none text-fg-tertiary">
            {countLabel(collection.saveCount, "public save")}
          </span>
        </li>
      ))}
    </ul>
  );
}
