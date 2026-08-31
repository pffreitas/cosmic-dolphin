import { notFound } from "next/navigation";
import type { PublicProfile } from "@cosmic-dolphin/api-client";

import { ProfileAPI } from "@/lib/api/profile";
import { toLibraryItem } from "@/components/bookmark/library/row-data";
import { ProfileView } from "./profile-view";
import { ProfileTab, formatJoinedAt } from "./profile-data";

/**
 * The one profile loader — `/my/profile` and `/u/{handle}` both call it.
 *
 * "Someone else's profile is the same page with a Follow primary button"
 * (docs/design-system/pages.md § Profile). Two routes that each fetched their
 * own data would be two definitions of what a profile is, and the second one
 * would be the one that forgot a tab.
 *
 * **Only the selected tab is fetched.** A profile page that loaded saves,
 * collections and likes on every visit would pay for three lists to render
 * one, and two of the three would be thrown away — the tab is in the URL, so
 * the server already knows which one is wanted.
 */
export async function ProfilePage({
  handle,
  basePath,
  tab,
  renderAction,
}: {
  handle: string;
  basePath: string;
  tab: ProfileTab;
  /**
   * Follow, or the owner's own controls.
   *
   * A callback rather than a node because the action needs the profile — the
   * Follow button is built from `isFollowedByViewer` and `counts.followers`,
   * and the caller fetching the profile a second time to get them would be two
   * requests for one page.
   */
  renderAction?: (profile: PublicProfile) => React.ReactNode;
}) {
  const profile = await ProfileAPI.publicProfile(handle);

  // `null` covers "no such handle" and "that profile blocked you" alike. The
  // API refuses to tell them apart and so does this — a 403 here would confirm
  // both that the account exists and that something about the caller is why
  // they cannot see it, which is exactly what a block withholds.
  if (!profile) notFound();

  const [saves, collections, likes] = await Promise.all([
    tab === "saves" ? ProfileAPI.saves(handle) : Promise.resolve(null),
    tab === "collections"
      ? ProfileAPI.collections(handle)
      : Promise.resolve(null),
    tab === "likes" ? ProfileAPI.likes(handle) : Promise.resolve(null),
  ]);

  const now = new Date();

  return (
    <ProfileView
      basePath={basePath}
      handle={profile.handle}
      name={profile.name?.trim() || `@${profile.handle}`}
      avatarUrl={profile.pictureUrl}
      joinedAt={formatJoinedAt(profile.joinedAt)}
      counts={profile.counts}
      tab={tab}
      saves={(saves?.bookmarks ?? []).map((bookmark) =>
        toLibraryItem(bookmark, now)
      )}
      collections={(collections?.collections ?? []).map((collection) => ({
        id: collection.id,
        name: collection.name,
        description: collection.description,
        saveCount: collection.saveCount,
      }))}
      likes={(likes?.bookmarks ?? []).map((bookmark) =>
        toLibraryItem(bookmark, now)
      )}
      isSelf={profile.isSelf}
      action={renderAction?.(profile)}
    />
  );
}
