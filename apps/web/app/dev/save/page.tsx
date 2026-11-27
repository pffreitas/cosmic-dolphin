import { notFound } from "next/navigation";
import NewBookmarkButton from "@/components/bookmark/new-bookmark";
import { HomeStates } from "../home/home-states";

export const dynamic = "force-dynamic";
export const metadata = { title: "Save parity · dev", robots: { index: false, follow: false } };

/** Logged-out development fixture: mount the production Save dialog over the
 * matched Home/AppShell fixture without manufacturing a server session. */
export default function SaveParityPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <><HomeStates /><NewBookmarkButton showTrigger={false} /></>;
}
