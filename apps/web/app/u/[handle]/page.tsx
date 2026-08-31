import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRound } from "lucide-react";

import { createClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProfilePage } from "@/components/profile/profile-page";
import { FollowButton } from "@/components/profile/follow-button";
import { parseProfileTab } from "@/components/profile/profile-data";

/**
 * `/u/{handle}` — someone else's profile.
 *
 * The same page as `/my/profile`, with a **Follow** primary button
 * (docs/design-system/pages.md § Profile). Not "a similar page": literally the
 * same `ProfilePage`, so a tab that exists on one exists on the other and a
 * field hidden from strangers is hidden because it was never fetched, not
 * because this file remembered to leave it out.
 *
 * This route is deliberately **outside `(private)`**. The handle is the
 * product's shareable address — D16's Home and D17's palette both link here —
 * and a link that 404s for anyone not already signed in is not shareable. What
 * a signed-out reader gets is an honest sign-in prompt naming the handle they
 * asked for, rather than a redirect that loses it or a 404 that lies about
 * whether the person exists.
 */
export const dynamic = "force-dynamic";

type Params = { handle: string };
type SearchParams = { tab?: string };

/**
 * The same rule the API applies (`apps/api/src/routes/users.ts`): a handle is
 * 3-30 lowercase letters, numbers and underscores. Anything else cannot exist,
 * so it is a 404 here rather than a request the API will 404 anyway.
 */
const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/;

export default async function PublicProfileRoute({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ handle: raw }, query] = await Promise.all([params, searchParams]);

  const handle = decodeURIComponent(raw).trim().toLowerCase();
  if (!HANDLE_PATTERN.test(handle)) notFound();

  const tab = parseProfileTab(query.tab);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /*
   * Every social read is authenticated, because every social read has to know
   * whether a block stands between the two accounts before it can decide what
   * is visible. Without a session there is no viewer to check, so the honest
   * answer is "sign in", not an empty profile and not a 404 — a 404 would
   * claim the handle does not exist, which is a different and false statement.
   */
  if (!user) {
    return (
      <main className="mx-auto w-full max-w-[720px] py-8">
        <EmptyState
          ground
          icon={UserRound}
          title={`Sign in to see @${handle}`}
          description="Profiles, and the saves people make public on them, are for signed-in readers."
          action={
            <Button asChild variant="primary">
              {/*
                No `redirect_to`: `signInAction` sends every successful sign-in
                to `/`, so a return parameter here would be a promise the auth
                action does not keep. The handle is in the address bar, and the
                browser's back button is honest about what it does.
              */}
              <Link href="/sign-in">Sign in</Link>
            </Button>
          }
        />
      </main>
    );
  }

  return (
    <main>
      <ProfilePage
        handle={handle}
        basePath={`/u/${handle}`}
        tab={tab}
        renderAction={(profile) =>
          profile.isSelf ? (
            // Your own profile, reached by its public address. Follow is not
            // an operation you can perform on yourself, and rendering it
            // disabled would be a control for something that cannot happen.
            <Button asChild variant="secondary">
              <Link href="/my/profile">Edit profile</Link>
            </Button>
          ) : (
            <FollowButton
              handle={profile.handle}
              name={profile.name?.trim() || `@${profile.handle}`}
              following={profile.isFollowedByViewer ?? false}
            />
          )
        }
      />
    </main>
  );
}
