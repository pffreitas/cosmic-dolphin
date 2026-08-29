import {
  FollowResponse,
  Profile,
  ResponseError,
  SocialApi,
  UpdateProfileRequest,
} from "@cosmic-dolphin/api-client";

import { getConfiguration } from "@/lib/api/bookmarks-client";

/**
 * The profile's write paths, from the browser.
 *
 * **Failures are kept, and 409 is read.** The handle rules are the API's, not
 * this file's, and the API answers a rejected handle with a 409 carrying a
 * sentence — "that handle is taken", or "you changed it less than 30 days
 * ago". The two are the same status and are told apart by the message, so the
 * message is what gets shown. Re-deriving "which rule did I break" on the
 * client from a cooldown timestamp would be a second implementation of a rule
 * that already exists, and the two would disagree the day it changes.
 */
export namespace ProfileClientAPI {
  async function api(): Promise<SocialApi> {
    return new SocialApi(await getConfiguration());
  }

  export type UpdateResult =
    | { ok: true; profile: Profile }
    | { ok: false; message: string };

  export async function update(
    request: UpdateProfileRequest
  ): Promise<UpdateResult> {
    try {
      const profile = await (
        await api()
      ).profilesUpdate({ updateProfileRequest: request });
      return { ok: true, profile };
    } catch (error) {
      return { ok: false, message: await messageFor(error) };
    }
  }

  export function follow(handle: string): Promise<FollowResponse> {
    return api().then((client) => client.usersFollow({ handle }));
  }

  export function unfollow(handle: string): Promise<FollowResponse> {
    return api().then((client) => client.usersUnfollow({ handle }));
  }

  /**
   * The server's sentence, or a plain one when there isn't a server.
   *
   * The 409s are the interesting case and they are already written for a
   * person to read; paraphrasing them here would put the product's two handle
   * rules in a second place.
   */
  async function messageFor(error: unknown): Promise<string> {
    if (error instanceof ResponseError) {
      try {
        const body = await error.response.json();
        if (typeof body?.error === "string" && body.error.trim()) {
          return body.error;
        }
      } catch {
        // A body that is not JSON says nothing useful; fall through.
      }

      if (error.response.status === 429) {
        return "Too many changes just now. Try again shortly.";
      }
    }

    return "That didn't save. Check your connection and try again.";
  }
}
