import { notFound } from "next/navigation";

import { HomeStates } from "./home-states";

/**
 * `/dev/home` — Home's state gallery, alongside `/dev/library`.
 *
 * Home composes patterns rather than inventing them, so its *states* are the
 * thing that needs a surface of its own: three skeleton items, the new-user
 * hero, an empty scope with the control still present, the inline error panel,
 * and the offline strip over cached items. Reaching those through the real
 * route would mean putting the database into each of them first, and two of
 * them — the hero and offline — are states a developer with a populated
 * account and a working connection can never see at all.
 *
 * Dev-only, the same way `/dev/library` is: `NODE_ENV` is inlined at build
 * time, so a production build compiles this to a `notFound()`.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Home states · dev",
  robots: { index: false, follow: false },
};

export default function DevHomePage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <HomeStates />;
}
