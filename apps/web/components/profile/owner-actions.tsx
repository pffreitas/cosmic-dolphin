import { signOutAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

import { EditProfileDialog } from "./edit-profile-dialog";

/**
 * The owner's slot on `/my/profile` — where Follow sits on someone else's.
 *
 * Sign out lives here because it lives nowhere else any more. D18 deleted the
 * `HeaderAuth` dropdown, and `components/app-chrome.tsx` says why: "the avatar
 * is a link to `/my/profile`, which is where the account lives now — sign-out
 * included. A menu whose only two items are Profile and Sign out is a menu
 * standing in front of a page." This is the page it was standing in front of,
 * so it has to carry the second item.
 *
 * A `<form>` with a server action rather than a click handler: signing out is
 * a mutation of a cookie the server owns, and it works with JavaScript
 * disabled and before hydration finishes.
 */
export function OwnerActions({
  name,
  pictureUrl,
  handle,
  handleAvailableOn,
}: {
  name: string;
  pictureUrl: string;
  handle: string;
  handleAvailableOn?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <EditProfileDialog
        name={name}
        pictureUrl={pictureUrl}
        handle={handle}
        handleAvailableOn={handleAvailableOn}
      />
      <form action={signOutAction}>
        <Button type="submit" variant="ghost">
          Sign out
        </Button>
      </form>
    </div>
  );
}
