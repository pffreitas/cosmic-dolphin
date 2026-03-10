import { Metadata } from "next";
import { SharedBookmarkView } from "./SharedBookmarkView";
import {
  Configuration,
  SharedBookmarksApi,
  Bookmark,
} from "@cosmic-dolphin/api-client";

function getApiBasePath(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
}

type SharedBookmarkResponse = Bookmark & { sharedByUserName?: string };

async function getSharedBookmark(
  slug: string,
): Promise<SharedBookmarkResponse | null> {
  try {
    const api = new SharedBookmarksApi(
      new Configuration({ basePath: getApiBasePath() })
    );
    const response = await api.sharedBookmarksFindBySlugRaw({ slug });
    const json = await response.raw.json();
    return json as SharedBookmarkResponse;
  } catch {
    return null;
  }
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const bookmark = await getSharedBookmark(slug);

  if (!bookmark) {
    return { title: "Bookmark not found - Cosmic Dolphin" };
  }

  const title = bookmark.title || "Shared Bookmark";
  const description =
    bookmark.cosmicBriefSummary ||
    bookmark.metadata?.openGraph?.description ||
    "";
  const image = bookmark.metadata?.openGraph?.image;
  const url = `${process.env.NEXT_PUBLIC_SITE_URL || "https://cosmicdolphin.com"}/s/${slug}`;

  return {
    title: `${title} - Cosmic Dolphin`,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Cosmic Dolphin",
      type: "article",
      ...(image && { images: [{ url: image }] }),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image && { images: [image] }),
    },
  };
}

export default async function SharedBookmarkPage({ params }: PageProps) {
  const { slug } = await params;
  const bookmark = await getSharedBookmark(slug);

  if (!bookmark) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-6xl">🐬</div>
        <h1 className="text-2xl font-semibold text-gray-800">
          Bookmark not found
        </h1>
        <p className="text-gray-500">
          This bookmark may have been removed or is no longer public.
        </p>
      </div>
    );
  }

  return (
    <SharedBookmarkView
      bookmark={bookmark}
      sharedByUserName={bookmark.sharedByUserName}
    />
  );
}
