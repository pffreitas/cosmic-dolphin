import { notFound } from "next/navigation";

import { LibraryStates } from "./library-states";

/**
 * `/dev/library` — the Library's state gallery, alongside `/dev/patterns`.
 *
 * The page composes patterns rather than inventing them, so its states are the
 * thing that needs its own surface: six skeleton rows, three distinct empty
 * states, the error panel, and a populated list carrying a filing-in-progress
 * row and a private link. Reaching those through the real route means putting
 * the database into each of them first.
 *
 * Dev-only, the same way `/dev/patterns` is: `NODE_ENV` is inlined at build
 * time, so a production build compiles this to a `notFound()` and the route
 * answers 404.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Library states · dev",
  robots: { index: false, follow: false },
};

export default function DevLibraryPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <LibraryStates />;
}
