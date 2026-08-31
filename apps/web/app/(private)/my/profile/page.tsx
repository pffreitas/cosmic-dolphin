import { redirect } from "next/navigation";
import { UserRound } from "lucide-react";

import { createClient } from "@/utils/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { ProfilePage } from "@/components/profile/profile-page";
import { OwnerActions } from "@/components/profile/owner-actions";
import { EditProfileDialog } from "@/components/profile/edit-profile-dialog";
import {
  formatHandleAvailableOn,
  parseProfileTab,
} from "@/components/profile/profile-data";
import { ProfileAPI } from "@/lib/api/profile";

/**
 * `/my/profile` — docs/design-system/pages.md § Profile.
 *
 * What stood here until D18: a hand-rolled `fetch` of `/profile`, a
 * `ProfileForm` of three rounded cards, and a `PUT /profile` that could only
 * ever send a display name. It is gone. The page is now the *same* page as
 * `/u/{handle}` — one `ProfilePage`, one `ProfileView`, one definition of what
 * a profile is — and the only difference is what goes in the action slot.
 *
 * That is deliberate, and it is the guarantee: the owner sees exactly what
 * everybody else sees, so "is this save public?" is answered by looking rather
 * than by remembering. A separate owner-only view is the arrangement in which
 * a private save quietly starts appearing on a public tab and nobody notices,
 * because the person who could notice is looking at a different page.
 *
 * The page is built from `PublicProfile` even for its owner. `Profile` — the
 * shape that carries an email — is read only to fill the edit dialog and to
 * know which handle to ask for.
 */
export const dynamic = "force-dynamic";

type SearchParams = { tab?: string };

export default async function MyProfilePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const tab = parseProfileTab((await searchParams).tab);
  const me = await ProfileAPI.me();

  if (!me) {
    return (
      <main className="mx-auto w-full max-w-[720px] py-8">
        <EmptyState
          ground
          icon={UserRound}
          title="We couldn't load your profile."
          description="The request didn't reach us. Reload the page — nothing has been changed."
        />
      </main>
    );
  }

  const name = me.name?.trim() ?? "";
  const pictureUrl = me.pictureUrl?.trim() ?? "";
  const handleAvailableOn = formatHandleAvailableOn(me.handleChangeAvailableAt);

  /*
   * The degraded case the contract warns about: `handle` is "absent only in
   * the degraded case where a handle could not be minted at signup"
   * (packages/apispec/social.tsp). Without one there is no `/u/{handle}` to
   * render, so the page asks for a handle instead of rendering an empty
   * profile — and it asks with the same dialog that edits one, rather than a
   * second form that would drift from it.
   */
  if (!me.handle) {
    return (
      <main className="mx-auto w-full max-w-[720px] py-8">
        <EmptyState
          ground
          icon={UserRound}
          title="Pick a handle to finish your profile."
          description="Your profile lives at /u/your-handle. Until you choose one there is no address to publish, so nothing you make public has anywhere to appear."
          action={
            <EditProfileDialog
              name={name}
              pictureUrl={pictureUrl}
              handle=""
              handleAvailableOn={handleAvailableOn}
            />
          }
        />
      </main>
    );
  }

  const handle = me.handle;

  return (
    <main>
      <ProfilePage
        handle={handle}
        basePath="/my/profile"
        tab={tab}
        renderAction={() => (
          <OwnerActions
            name={name}
            pictureUrl={pictureUrl}
            handle={handle}
            handleAvailableOn={handleAvailableOn}
          />
        )}
      />
    </main>
  );
}
