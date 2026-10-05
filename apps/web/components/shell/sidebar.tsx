"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Archive,
  ChevronsUpDown,
  Clock3,
  Compass,
  Folder,
  Home,
  Inbox,
  Layers,
  LogOut,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type {
  BookmarkLibraryCounts,
  Collection,
} from "@cosmic-dolphin/api-client";

import { cn } from "@/lib/utils";
import { signOutAction } from "@/app/actions";
import { Brandmark } from "@/components/brand/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { focusRing } from "@/components/ui/focus-ring";
import { parseLibraryView } from "@/components/bookmark/library/params";
import {
  buildLibraryTree,
  type LibraryTree,
  type LibraryTreeNode,
} from "@/components/bookmark/library/tree";
import { useLibraryDnd } from "./library-dnd";

/**
 * The app sidebar — docs/design-system/patterns.md § App shell.
 *
 * Three groups, top to bottom, in the order a reader reaches for them:
 *
 *  1. **Destinations** — Home, Explore, Search. Where you go.
 *  2. **Library** — All saves, Inbox, Read later, Archive, then the
 *     collections. What you have. This used to be a rail inside the Library
 *     page; promoting it here makes a collection one click from anywhere and
 *     turns the AI's filing into the app's navigation, which is the product's
 *     argument made visible.
 *  3. **You** — the account menu, pinned to the bottom.
 *
 * Every row is a 32px link with a 16px glyph. Exactly one row in the whole
 * sidebar is `aria-current="page"` at a time; the groups never duplicate a
 * destination, which is why Library is a group and not also a link above it.
 */
export interface ShellUser {
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  /** Profile route. */
  href: string;
}

export interface SidebarProps {
  user?: ShellUser;
  collections: Collection[];
  counts: BookmarkLibraryCounts | null;
  /** Called after any navigation — the mobile sheet closes itself with it. */
  onNavigate?: () => void;
  /** Overrides the router's path. The dev galleries use it to show a route. */
  currentPath?: string;
  className?: string;
}

interface Destination {
  label: string;
  href: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
}

const DESTINATIONS: Destination[] = [
  {
    label: "Home",
    href: "/my/dashboard",
    icon: Home,
    match: (p) => p === "/my/dashboard" || p.startsWith("/my/dashboard/"),
  },
  {
    label: "Explore",
    href: "/explore",
    icon: Compass,
    match: (p) => p.startsWith("/explore"),
  },
  {
    label: "Search",
    href: "/search",
    icon: Search,
    match: (p) => p.startsWith("/search"),
  },
];

const LIBRARY_ICONS: Record<string, LucideIcon> = {
  all: Layers,
  inbox: Inbox,
  "read-later": Clock3,
  archive: Archive,
};

export function Sidebar({
  user,
  collections,
  counts,
  onNavigate,
  currentPath,
  className,
}: SidebarProps) {
  const routerPath = usePathname() ?? "";
  const pathname = currentPath ?? routerPath;

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex h-14 shrink-0 items-center px-5">
        <Brandmark href="/my/dashboard" />
      </div>

      <div className="scrollbar-quiet flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 pb-6 pt-2">
        <nav aria-label="Primary">
          <ul className="m-0 flex list-none flex-col gap-px p-0">
            {DESTINATIONS.map((destination) => (
              <li key={destination.href}>
                <SidebarLink
                  href={destination.href}
                  icon={destination.icon}
                  active={destination.match(pathname)}
                  onNavigate={onNavigate}
                >
                  {destination.label}
                </SidebarLink>
              </li>
            ))}
          </ul>
        </nav>

        <React.Suspense
          fallback={
            <LibraryGroups
              tree={buildLibraryTree(collections, counts, parseLibraryView({}))}
              onLibrary={false}
              countsKnown={counts !== null}
              onNavigate={onNavigate}
            />
          }
        >
          <LibraryGroupsFromUrl
            pathname={pathname}
            collections={collections}
            counts={counts}
            onNavigate={onNavigate}
          />
        </React.Suspense>
      </div>

      {user ? (
        <div className="shrink-0 border-t border-line p-2">
          <AccountMenu user={user} onNavigate={onNavigate} />
        </div>
      ) : null}
    </div>
  );
}

/** Reads the Library's view off the URL so the right row is current. */
function LibraryGroupsFromUrl({
  pathname,
  collections,
  counts,
  onNavigate,
}: {
  pathname: string;
  collections: Collection[];
  counts: BookmarkLibraryCounts | null;
  onNavigate?: () => void;
}) {
  const searchParams = useSearchParams();
  const onLibrary = pathname === "/my/library";
  const view = parseLibraryView(
    onLibrary
      ? {
          collection_id: searchParams?.get("collection_id") ?? undefined,
          read_status: searchParams?.get("read_status") ?? undefined,
          scope: searchParams?.get("scope") ?? undefined,
          sort: searchParams?.get("sort") ?? undefined,
        }
      : {},
  );

  const tree = React.useMemo(
    () => buildLibraryTree(collections, counts, view),
    [collections, counts, view],
  );

  return (
    <LibraryGroups
      tree={tree}
      onLibrary={onLibrary}
      countsKnown={counts !== null}
      onNavigate={onNavigate}
    />
  );
}

function LibraryGroups({
  tree,
  onLibrary,
  countsKnown,
  onNavigate,
}: {
  tree: LibraryTree;
  onLibrary: boolean;
  countsKnown: boolean;
  onNavigate?: () => void;
}) {
  // Off the Library, nothing in it is the current page — the rows are links,
  // not a selection.
  const isActive = (node: LibraryTreeNode) => onLibrary && node.active;
  const libraryRows = [...tree.top, ...tree.filters];

  return (
    <>
      <nav aria-label="Library" className="flex flex-col gap-1">
        <GroupLabel>Library</GroupLabel>
        <ul className="m-0 flex list-none flex-col gap-px p-0">
          {libraryRows.map((node) => (
            <li key={node.key}>
              <TreeLink
                node={node}
                icon={LIBRARY_ICONS[node.key] ?? Layers}
                active={isActive(node)}
                countsKnown={countsKnown}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      </nav>

      <nav aria-label="Collections" className="flex flex-col gap-1">
        <GroupLabel>
          Collections
        </GroupLabel>

        {tree.collections.length === 0 ? (
          <p className="m-0 px-2.5 py-1 font-sans text-[12.5px] leading-[1.5] text-fg-tertiary">
            Collections appear here as Cosmic finds groupings worth keeping.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-px p-0">
            {tree.collections.map((node) => (
              <li key={node.key}>
                <TreeLink
                  node={node}
                  icon={Folder}
                  active={isActive(node)}
                  countsKnown={countsKnown}
                  onNavigate={onNavigate}
                />
                {node.children.length > 0 ? (
                  <ul className="relative m-0 ml-[19px] flex list-none flex-col gap-px border-l border-line p-0 pl-2">
                    {node.children.map((child) => (
                      <li key={child.key}>
                        <TreeLink
                          node={child}
                          active={isActive(child)}
                          countsKnown={countsKnown}
                          onNavigate={onNavigate}
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </nav>
    </>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-7 items-center gap-2 px-2.5 font-sans text-[11.5px] font-semibold text-fg-tertiary">
      {children}
    </div>
  );
}

const rowClass = (active: boolean) =>
  cn(
    "group flex min-h-8 items-center gap-2.5 rounded-sm px-2.5",
    "font-sans text-[13.5px] leading-none no-underline",
    "transition-colors duration-cd-fast ease-cd",
    active
      ? "bg-bg-panel font-medium text-fg shadow-[inset_0_0_0_1px_var(--cd-border)]"
      : "text-fg-secondary hover:bg-bg-inset hover:text-fg",
    focusRing,
  );

function SidebarLink({
  href,
  icon: Icon,
  active,
  onNavigate,
  children,
}: {
  href: string;
  icon: LucideIcon;
  active: boolean;
  onNavigate?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={rowClass(active)}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0 [stroke-width:1.7]",
          active ? "text-accent" : "text-fg-tertiary group-hover:text-fg-secondary",
        )}
      />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </Link>
  );
}

/**
 * A Library or collection row. Rows that name a place a save can live take
 * drops while the Library is dragging; `Read later` is a query, not a folder,
 * so it never does.
 */
function TreeLink({
  node,
  icon: Icon,
  active,
  countsKnown,
  onNavigate,
}: {
  node: LibraryTreeNode;
  icon?: LucideIcon;
  active: boolean;
  countsKnown: boolean;
  onNavigate?: () => void;
}) {
  const dnd = useLibraryDnd();
  const [over, setOver] = React.useState(false);
  const droppable = dnd.canDrop && node.collectionId !== undefined;

  return (
    <Link
      href={node.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        rowClass(active),
        over && "bg-accent-soft text-fg ring-1 ring-inset ring-accent-border",
      )}
      onDragOver={
        droppable
          ? (event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setOver(true);
            }
          : undefined
      }
      onDragLeave={droppable ? () => setOver(false) : undefined}
      onDrop={
        droppable
          ? (event) => {
              event.preventDefault();
              setOver(false);
              dnd.drop(node.collectionId ?? null);
            }
          : undefined
      }
    >
      {Icon ? (
        <Icon
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 [stroke-width:1.7]",
            active ? "text-accent" : "text-fg-tertiary group-hover:text-fg-secondary",
          )}
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{node.label}</span>
      <span className="nums shrink-0 font-sans text-[11.5px] font-normal text-fg-tertiary">
        {countsKnown ? node.count : "—"}
      </span>
    </Link>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/**
 * The account, as one row: avatar, name, and a menu holding the profile, the
 * theme, and sign-out. The theme lives here rather than as a sun/moon toggle in
 * the chrome — it is a preference you set once, not a control you operate.
 */
function AccountMenu({
  user,
  onNavigate,
}: {
  user: ShellUser;
  onNavigate?: () => void;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex min-h-11 w-full items-center gap-2.5 rounded-sm px-2 text-left",
          "transition-colors duration-cd-fast ease-cd hover:bg-bg-inset data-[state=open]:bg-bg-inset",
          focusRing,
        )}
      >
        <Avatar className="size-7">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-[11px]">{initials(user.name)}</AvatarFallback>
        </Avatar>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-sans text-[13px] font-medium leading-tight text-fg">
            {user.name}
          </span>
          {user.email ? (
            <span className="truncate font-sans text-[11.5px] leading-tight text-fg-tertiary">
              {user.email}
            </span>
          ) : null}
        </span>
        <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-fg-tertiary [stroke-width:1.7]" />
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56">
        <DropdownMenuItem asChild>
          <Link href={user.href} onClick={onNavigate}>
            <UserRound aria-hidden="true" className="size-4 [stroke-width:1.7]" />
            Your profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">Match system</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden="true" className="size-4 [stroke-width:1.7]" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
