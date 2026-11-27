import { MobileAPI } from "../mobile-api";
import { BookmarksAPI } from "../api";
const mockGetSession = jest.fn();
jest.mock("../supabase", () => ({
  supabase: { auth: { getSession: () => mockGetSession() } },
}));
it.each(["findById", "like", "unlike", "share", "unshare"] as const)(
  "%s refuses a new account before sending a former owner's request",
  async (action) => {
    let finish!: (value: unknown) => void;
    mockGetSession.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const fetch = jest.fn();
    global.fetch = fetch as unknown as typeof global.fetch;
    const request = BookmarksAPI[action]("bookmark-A", "owner-A");
    finish({
      data: {
        session: { access_token: "fictional-B", user: { id: "owner-B" } },
      },
    });
    await expect(request).rejects.toMatchObject({ status: 401 });
    expect(fetch).not.toHaveBeenCalled();
  },
);

it.each(["progress", "saveProgress"] as const)(
  "%s keeps the reading request on its original account",
  async (action) => {
    let finish!: (value: unknown) => void;
    mockGetSession.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const fetch = jest.fn();
    global.fetch = fetch as unknown as typeof global.fetch;
    const request =
      action === "progress"
        ? MobileAPI.progress("bookmark-A", "owner-A")
        : MobileAPI.saveProgress("bookmark-A", 50, 100, "owner-A");
    finish({
      data: {
        session: { access_token: "fictional-B", user: { id: "owner-B" } },
      },
    });
    await expect(request).rejects.toMatchObject({ response: { status: 401 } });
    expect(fetch).not.toHaveBeenCalled();
  },
);

it("normalizes the real wire metadata before rendering the native owner detail", async () => {
  mockGetSession.mockResolvedValueOnce({
    data: { session: { access_token: "fictional-A", user: { id: "owner-A" } } },
  });
  global.fetch = jest.fn(
    async () =>
      new Response(
        JSON.stringify({
          id: "bookmark-A",
          userId: "owner-A",
          sourceUrl: "https://example.invalid/story",
          createdAt: "2026-11-27T12:00:00Z",
          updatedAt: "2026-11-27T12:00:00Z",
          processingStatus: "completed",
          cosmicSummary: "## Saved article",
          cosmicBriefSummary: "The short brief",
          metadata: {
            readingTime:3, openGraph: {
              site_name: "Publication",
              article_author: "Story author",
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  ) as unknown as typeof global.fetch;
  const result = await MobileAPI.bookmark("bookmark-A", "owner-A");
  expect(result.cosmicSummary).toBe("## Saved article");
  expect(result.cosmicBriefSummary).toBe("The short brief");
  expect(result.metadata?.readingTime).toBe(3);
  expect(result.metadata?.openGraph).toMatchObject({
    siteName: "Publication",
    articleAuthor: "Story author",
  });
});
