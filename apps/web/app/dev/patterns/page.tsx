import { notFound } from "next/navigation";

import { PatternsGallery } from "./patterns-gallery";

/**
 * `/dev/patterns` — the state gallery for the seven Signal patterns.
 *
 * Every pattern in every state it is required to ship: loading, empty, error,
 * AI-processing, failed, and private-link. This route is the acceptance
 * surface for the rest of the revamp — later deliverables point at it to show
 * their work — and it stays for the duration.
 *
 * Dev-only. `NODE_ENV` is inlined at build time, so in a production build this
 * component is nothing but a `notFound()` — the route answers 404 and the
 * gallery is unreachable. `force-dynamic` keeps Next from trying to prerender
 * a 404 into the static output at build time.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Patterns · dev",
  robots: { index: false, follow: false },
};

export default function DevPatternsPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <PatternsGallery />;
}
