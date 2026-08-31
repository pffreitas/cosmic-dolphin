import {
  Configuration,
  SocialApi,
  type Profile,
  type PublicProfile,
} from "@cosmic-dolphin/api-client";
import { createClient } from "@/utils/supabase/client";

function getApiBasePath(): string {
  const basePath = process.env.NEXT_PUBLIC_API_URL;
  if (!basePath) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Please configure it in your environment variables."
    );
  }
  return basePath;
}

async function getApiInstance(): Promise<SocialApi> {
  const supabase = createClient();
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

/**
 * The read-only slice of the social API the command palette needs.
 *
 * The palette's **People** section is the people the reader follows, filtered
 * locally by what they type. There is no people-search endpoint, and inventing
 * one to power a palette section would be a search over every account in the
 * product — a different feature with a different set of privacy questions
 * (`docs/functional-spec/06-social.md`). Following is the set the reader has
 * already chosen, which is also the set they are most likely to be looking for.
 */
export namespace SocialClientAPI {
  export async function me(): Promise<Profile | null> {
    try {
      return await (await getApiInstance()).profilesGet();
    } catch (error) {
      console.error("Error fetching profile", error);
      return null;
    }
  }

  export async function following(
    handle: string,
    limit = 50
  ): Promise<PublicProfile[]> {
    try {
      const response = await (
        await getApiInstance()
      ).usersGetFollowing({ handle, limit });
      return response.profiles ?? [];
    } catch (error) {
      console.error("Error fetching following", error);
      return [];
    }
  }
}
