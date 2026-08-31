import Link from "next/link";
import { UserRoundX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * `/u/{handle}`'s 404.
 *
 * The copy is careful, because the status code is doing two jobs: the API
 * answers "no such handle" and "that profile blocked you" with the same 404 on
 * purpose, and a page that said "this person doesn't exist" would turn a block
 * into a disclosure — telling the blocked reader that the account is real and
 * that something about *them* is why they cannot see it.
 *
 * So it says what is true of both: this profile isn't available here.
 */
export default function ProfileNotFound() {
  return (
    <EmptyState
      icon={UserRoundX}
      title="This profile isn't available"
      description="The handle may have changed, or the profile isn't one you can see."
      action={
        <Button asChild variant="primary">
          <Link href="/explore">Explore</Link>
        </Button>
      }
      className="py-24"
    />
  );
}
