import Link from "next/link";
import { LinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * A shared link that no longer resolves.
 *
 * Unsharing is a thing people do on purpose, so this is not an error page —
 * it says the link stopped working and offers the product, which is the only
 * useful thing left to offer a visitor who arrived from someone else's post.
 */
export default function SharedBookmarkNotFound() {
  return (
    <EmptyState
      icon={LinkIcon}
      title="This link isn't shared any more"
      description="The person who shared it may have made it private, or deleted the save."
      action={
        <Button asChild variant="primary">
          <Link href="/">Go to Cosmic Dolphin</Link>
        </Button>
      }
      className="py-24"
    />
  );
}
