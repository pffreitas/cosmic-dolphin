import {
  Configuration,
  Profile,
  PublicCollectionListResponse,
  PublicProfile,
  PublicSavesResponse,
  SocialApi,
} from "@cosmic-dolphin/api-client";
import { createClient } from "@/utils/supabase/server";

/**
 * Profiles, server side — `/my/profile` and `/u/{handle}`.
 *
 * Two shapes, and the difference is the whole point: `Profile` is the caller's
 * own and carries an email and the handle's claim state; `PublicProfile` is
 * what anybody else gets and structurally cannot hold an email
 * (docs/functional-spec/06-social.md § Profiles). The profile *page* is built
 * from the public one whoever is looking, so there is no branch anywhere in
 * the view that could accidentally render a private field for a stranger.
 *
 * `null` means "no such handle, or that profile blocked you". The API refuses
 * to tell the two apart on purpose and neither does this.
 */

function getApiBasePath(): string {
  const basePath = process.env.NEXT_PUBLIC_API_URL;
  if (!basePath) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Please configure it in your environment variables."
    );
  }
  return basePath;
}

async function api(): Promise<SocialApi> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return new SocialApi(
    new Configuration({
      basePath: getApiBasePath(),
      accessToken: session?.access_token || "",
    })
  );
}

export namespace ProfileAPI {
  /** The caller's own profile — the only shape carrying a handle claim state. */
  export async function me(): Promise<Profile | null> {
    try {
      return await (await api()).profilesGet();
    } catch (error) {
      console.error("Error fetching own profile", error);
      return null;
    }
  }

  export async function publicProfile(
    handle: string
  ): Promise<PublicProfile | null> {
    try {
      return await (await api()).usersGetProfile({ handle });
    } catch (error) {
      // A 404 is the expected answer for a handle that does not exist *and*
      // for one that has blocked the caller. Both land here, both render the
      // same not-found page, and neither is logged as a failure.
      return null;
    }
  }

  export async function saves(
    handle: string,
    limit = 24
  ): Promise<PublicSavesResponse> {
    try {
      return await (await api()).usersGetSaves({ handle, limit });
    } catch (error) {
      console.error("Error fetching public saves", error);
      return { bookmarks: [] };
    }
  }

  export async function collections(
    handle: string,
    limit = 24
  ): Promise<PublicCollectionListResponse> {
    try {
      return await (await api()).usersGetCollections({ handle, limit });
    } catch (error) {
      console.error("Error fetching public collections", error);
      return { collections: [] };
    }
  }

  export async function likes(
    handle: string,
    limit = 24
  ): Promise<PublicSavesResponse> {
    try {
      return await (await api()).usersGetLikes({ handle, limit });
    } catch (error) {
      console.error("Error fetching likes", error);
      return { bookmarks: [] };
    }
  }
}
