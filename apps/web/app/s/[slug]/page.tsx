import { cache } from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Bookmark,
  Configuration,
  SharedBookmarksApi,
} from "@cosmic-dolphin/api-client";

import { BookmarkDetail } from "@/components/bookmark/detail/bookmark-detail";
import {
  shareUrlForSlug,
  toDetailModel,
  type BookmarkWithSharer,
} from "@/components/bookmark/detail/detail-data";

/**
 * `/s/[slug]` — the public view of a shared save.
 *
 * The same composition as `/bookmarks/[id]`, minus the breadcrumb, the read
 * toggle and the highlights, plus **Save to your library**. All four of those
 * differences are `mode: "shared"` in `toDetailModel`; there is no second
 * layout, and the two pages cannot drift apart.
 *
 * **This route is how the product spreads**, so two things about it are not
 * negotiable:
 *
 *  - It renders on the server, unauthenticated. The fetch is anonymous — no
 *    Supabase session is read, no cookie is required — because the first
 *    visitor is always a stranger and a shared link that needs an account is
 *    not a shared link.
 *
 *  - It ships complete Open Graph tags. A link pasted into Slack, iMessage or
 *    a tweet is unfurled by a crawler that runs no JavaScript and follows no
 *    redirect to a client render; whatever `generateMetadata` returns is the
 *    entire impression the product makes. Title, description, canonical URL,
 *    site name, type, image with dimensions and alt text, `article:*` for the
 *    author and dates, and the Twitter card — all of it, or the unfurl is a
 *    bare domain.
 */
function apiBasePath(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://cosmicdolphin.com"
  );
}

/**
 * Fetched twice per request — once for the metadata, once for the body — and
 * deduplicated by `React.cache`, so the crawler's HEAD-like metadata pass and
 * the render share one call.
 */
const getSharedBookmark = cache(async (
  slug: string,
): Promise<BookmarkWithSharer | null> => {
  try {
    const api = new SharedBookmarksApi(
      new Configuration({ basePath: apiBasePath() }),
    );
    const response = await api.sharedBookmarksFindBySlugRaw({ slug });
    const json = (await response.raw.json()) as Bookmark & {
      sharedByUserName?: string;
    };
    return json?.id ? json : null;
  } catch {
    return null;
  }
});

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const bookmark = await getSharedBookmark(slug);

  if (!bookmark) {
    return {
      title: "Bookmark not found · Cosmic Dolphin",
      robots: { index: false, follow: false },
    };
  }

  const og = bookmark.metadata?.openGraph;
  const title = bookmark.title?.trim() || og?.title || "A save on Cosmic Dolphin";
  const description =
    bookmark.cosmicBriefSummary ||
    og?.description ||
    "Saved and summarised with Cosmic Dolphin.";
  const image = og?.image || undefined;
  const url = shareUrlForSlug(slug);
  const author = bookmark.sharedByUserName || og?.articleAuthor || undefined;

  return {
    metadataBase: new URL(siteUrl()),
    title: `${title} · Cosmic Dolphin`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      siteName: "Cosmic Dolphin",
      locale: og?.locale || "en_US",
      publishedTime:
        og?.articlePublishedTime || new Date(bookmark.createdAt).toISOString(),
      modifiedTime:
        og?.articleModifiedTime || new Date(bookmark.updatedAt).toISOString(),
      ...(author ? { authors: [author] } : {}),
      ...(bookmark.cosmicTags?.length ? { tags: bookmark.cosmicTags } : {}),
      ...(image
        ? {
            images: [
              // Dimensions are declared so the unfurl reserves the right box
              // before the image arrives; without them several clients fall
              // back to the small square card.
              { url: image, width: 1200, height: 630, alt: title },
            ],
          }
        : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function SharedBookmarkPage({ params }: PageProps) {
  const { slug } = await params;
  const bookmark = await getSharedBookmark(slug);

  if (!bookmark) notFound();

  return (
    <BookmarkDetail
      model={toDetailModel(bookmark, { mode: "shared", shareSlug: slug })}
    />
  );
}
