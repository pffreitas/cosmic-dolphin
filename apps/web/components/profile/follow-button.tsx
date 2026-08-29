"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ProfileClientAPI } from "@/lib/api/profile-client";

/**
 * Follow — the profile's one primary action (docs/design-system/pages.md
 * § Profile: "someone else's profile is the same page with a **Follow**
 * primary button").
 *
 * Optimistic, and reconciled against the server's own answer rather than
 * against a guess: the button shows the new state immediately, then takes
 * `FollowResponse.following` as the truth one round trip later, and asks the
 * server component above it to re-render so the follower count in the header
 * is the server's number rather than the client's arithmetic.
 *
 * The follower count is deliberately *not* a prop here. It is rendered by
 * `ProfileView` from the profile the server fetched, and a second copy of it
 * living in this component's state would be a second answer to "how many
 * followers" — the two would disagree the moment anybody else followed too.
 *
 * A failure puts the button back and says so. Following is a public act; a
 * control that silently did nothing would leave the reader believing they had
 * followed somebody they had not.
 */
export interface FollowButtonProps {
  handle: string;
  name: string;
  following: boolean;
}

export function FollowButton({
  handle,
  name,
  following: initialFollowing,
}: FollowButtonProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [following, setFollowing] = React.useState(initialFollowing);
  const [pending, setPending] = React.useState(false);

  /*
   * Re-sync when the server disagrees, during render rather than in an effect.
   *
   * `router.refresh()` re-renders this with a fresh `following` from the
   * server, and the optimistic value has to yield to it. Doing that in an
   * effect means a committed render showing the stale value first, and React
   * flags it as a cascading render; comparing the prop against the value this
   * component last saw resolves it in the same pass.
   */
  const [seen, setSeen] = React.useState(initialFollowing);
  if (seen !== initialFollowing) {
    setSeen(initialFollowing);
    setFollowing(initialFollowing);
  }

  const press = async () => {
    if (pending) return;

    const next = !following;
    setFollowing(next);
    setPending(true);

    try {
      const result = next
        ? await ProfileClientAPI.follow(handle)
        : await ProfileClientAPI.unfollow(handle);

      setFollowing(result.following);
      // `seen` is left alone on purpose: it mirrors the *prop*, and moving it
      // here would make the next render see a mismatch against a prop that has
      // not caught up yet and flip the button straight back.
      //
      // The header's follower count, the feed's Following scope and the rails
      // all change shape — the server-rendered half of the app catches up here.
      router.refresh();
    } catch {
      setFollowing(!next);
      toast({
        title: next ? "Couldn't follow" : "Couldn't unfollow",
        description: "Nothing was changed. Try again.",
        variant: "danger",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      type="button"
      // Following is the done state, so it stops being the page's one decisive
      // action and becomes a secondary control that can be undone.
      variant={following ? "secondary" : "primary"}
      loading={pending}
      onClick={press}
      aria-label={following ? `Unfollow ${name}` : `Follow ${name}`}
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}
