import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/s/[slug]`'s Open Graph tags, asserted against the metadata object Next
 * renders into `<head>`.
 *
 * This is the acceptance test for "the shared route returns complete OG tags
 * to an unauthenticated fetch". A crawler runs no JavaScript and follows no
 * redirect to a client render, so whatever `generateMetadata` returns is the
 * entire impression a pasted link makes. Curling the live route only proves
 * the not-found path without a database behind it; mocking the fetch is what
 * pins the populated case down, and keeps it pinned.
 */

const findBySlugRaw = vi.fn();

// Spread the real module: the page pulls enums (BookmarkSort and friends)
// through this same package transitively, and replacing it wholesale turns
// those into undefined far away from here.
vi.mock("@cosmic-dolphin/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@cosmic-dolphin/api-client")>()),
  SharedBookmarksApi: class {
    sharedBookmarksFindBySlugRaw = findBySlugRaw;
  },
}));

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));

// `React.cache` is a server API with no implementation in the node test
// environment. Identity is the right stand-in: it only dedupes the metadata
// pass against the render pass, and each test performs one.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T,>(fn: T) => fn,
}));

const SHARED = {
  id: "b1",
  userId: "u1",
  slug: "highlights-that-survive",
  sourceUrl: "https://every.to/an-article",
  createdAt: "2026-08-25T12:00:00.000Z",
  updatedAt: "2026-08-26T09:30:00.000Z",
  title: "Highlights that survive a re-extraction",
  cosmicBriefSummary: "Anchoring by quote and context instead of offsets.",
  cosmicTags: ["anchoring", "reading"],
  sharedByUserName: "Dan Shipper",
  metadata: {
    openGraph: {
      image: "https://every.to/cover.png",
      locale: "en_GB",
      articlePublishedTime: "2026-08-01T00:00:00.000Z",
    },
  },
};

function respondWith(body: unknown) {
  findBySlugRaw.mockResolvedValue({ raw: { json: async () => body } });
}

async function metadataFor(slug: string) {
  const { generateMetadata } = await import("../page");
  return generateMetadata({ params: Promise.resolve({ slug }) });
}

describe("/s/[slug] Open Graph tags", () => {
  beforeEach(() => {
    vi.resetModules();
    findBySlugRaw.mockReset();
  });

  it("ships every tag an unfurl needs", async () => {
    respondWith(SHARED);

    const meta = await metadataFor("highlights-that-survive");
    const og = meta.openGraph as Record<string, unknown>;

    expect(og.type).toBe("article");
    expect(og.title).toBe(SHARED.title);
    expect(og.description).toBe(SHARED.cosmicBriefSummary);
    expect(og.siteName).toBe("Cosmic Dolphin");
    expect(og.url).toContain("/s/highlights-that-survive");
    expect(meta.alternates?.canonical).toBe(og.url);

    // A missing width/height is why several clients fall back to the small
    // square card, so the dimensions are part of "complete".
    expect(og.images).toEqual([
      {
        url: SHARED.metadata.openGraph.image,
        width: 1200,
        height: 630,
        alt: SHARED.title,
      },
    ]);

    expect(og.authors).toEqual(["Dan Shipper"]);
    expect(og.tags).toEqual(["anchoring", "reading"]);
    expect(og.locale).toBe("en_GB");
    expect(og.publishedTime).toBe("2026-08-01T00:00:00.000Z");
    expect(og.modifiedTime).toBe("2026-08-26T09:30:00.000Z");

    expect(meta.twitter).toMatchObject({
      card: "summary_large_image",
      title: SHARED.title,
      description: SHARED.cosmicBriefSummary,
    });
  });

  it("falls back to the summary card when there is no image", async () => {
    respondWith({ ...SHARED, metadata: { openGraph: {} } });

    const meta = await metadataFor("highlights-that-survive");

    expect((meta.twitter as Record<string, unknown>).card).toBe("summary");
    expect((meta.openGraph as Record<string, unknown>).images).toBeUndefined();
  });

  it("fetches anonymously — a shared link that needs an account is not shared", async () => {
    respondWith(SHARED);

    await metadataFor("highlights-that-survive");

    expect(findBySlugRaw).toHaveBeenCalledWith({
      slug: "highlights-that-survive",
    });
    // One argument, and no init object carrying an Authorization header.
    expect(findBySlugRaw.mock.calls[0]).toHaveLength(1);
  });

  it("refuses to advertise a bookmark that is not there", async () => {
    respondWith({});

    const meta = await metadataFor("gone");

    expect(meta.openGraph).toBeUndefined();
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});
