import Link from "next/link";
import { BookmarkX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * The detail page's fourth state, at a real 404.
 *
 * One route out, and it is Library — the place the reader was going when they
 * followed the link. A 404 whose only offer is the browser's back button
 * makes a dead end out of what is usually a stale bookmark in someone's
 * notes.
 */
export default function BookmarkNotFound() {
  return (
    <EmptyState
      icon={BookmarkX}
      title="This save isn't here"
      description="It may have been deleted, or it belongs to someone else's library."
      action={
        <Button asChild variant="primary">
          <Link href="/my/library">Back to Library</Link>
        </Button>
      }
      className="py-24"
    />
  );
}
