import { describe, expect, it } from "bun:test";
import path from "node:path";

function repoPath(relativePath: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(path.join("apps", "api"))
    ? path.resolve(cwd, "../..")
    : cwd;

  return path.join(root, relativePath);
}

describe("API contract", () => {
  it("keeps bookmark created and updated timestamps in the TypeSpec contract", async () => {
    const typeSpec = await Bun.file(
      repoPath("packages/apispec/bookmarks.tsp")
    ).text();
    const bookmarkModel = typeSpec.match(/model Bookmark \{[\s\S]*?\n\}/)?.[0];

    expect(bookmarkModel).toContain("createdAt: utcDateTime;");
    expect(bookmarkModel).toContain("updatedAt: utcDateTime;");
  });

  it("anchors highlights on quote and context, never on offsets", async () => {
    // The contract is where this rule has to hold: a client cannot send an
    // offset it has nowhere to put. If a `startOffset` ever appears in this
    // model, re-extraction starts silently moving highlights onto the wrong
    // sentence and nothing else in the system will notice.
    const typeSpec = await Bun.file(
      repoPath("packages/apispec/reading.tsp")
    ).text();
    const highlight = typeSpec.match(/model Highlight \{[\s\S]*?\n\}/)?.[0];

    expect(highlight).toContain("quote: string;");
    expect(highlight).toContain("prefix?: string;");
    expect(highlight).toContain("suffix?: string;");
    expect(highlight).not.toMatch(/offset/i);
  });

  it("keeps `email` out of the public profile contract", async () => {
    // The contract is the outermost of the four locks on this rule. A client
    // cannot read a field the schema does not describe, and a reviewer looking
    // at one file can see the guarantee holds. The other three are in
    // `packages/shared`: the explicit column list the query selects, the
    // standalone `PublicProfile` type, and `assertPublicProfileHasNoEmail`,
    // which stops the build if the field is ever added.
    const typeSpec = await Bun.file(
      repoPath("packages/apispec/social.tsp")
    ).text();
    const publicProfile = typeSpec.match(
      /model PublicProfile \{[\s\S]*?\n\}/
    )?.[0];

    expect(publicProfile).toContain("handle: string;");
    expect(publicProfile).not.toMatch(/\bemail\b/);
  });

  it("keys every social route on the handle, never on an id", async () => {
    // `/u/{handle}` is the canonical profile URL. A route that took an id
    // would make the shareable link a second lookup away.
    const typeSpec = await Bun.file(
      repoPath("packages/apispec/social.tsp")
    ).text();

    for (const route of [
      '@route("/{handle}")',
      '@route("/{handle}/saves")',
      '@route("/{handle}/followers")',
      '@route("/{handle}/following")',
      '@route("/{handle}/follow")',
      '@route("/{handle}/block")',
    ]) {
      expect(typeSpec).toContain(route);
    }

    const users = typeSpec.match(/interface Users \{[\s\S]*\n\}/)?.[0];
    expect(users).not.toContain("@path id");
  });

  it("keeps reading progress on its own routes, not folded into Bookmark", async () => {
    const reading = await Bun.file(
      repoPath("packages/apispec/reading.tsp")
    ).text();

    expect(reading).toContain('@route("/{id}/progress")');
    expect(reading).toContain('@route("/continue-reading")');
    expect(reading).toContain('@route("/{id}/highlights")');
  });
});

it("public bookmark schemas omit every private capture field and public saves use that schema", async () => {
  const openApi = await Bun.file(repoPath("packages/apispec/tsp-output/@typespec/openapi3/openapi.yaml")).text();
  const publicSchema = openApi.match(/ {4}PublicBookmark:\n([\s\S]*?)(?=\n {4}[A-Za-z]|\n {2}[A-Za-z]|$)/)?.[1];
  expect(publicSchema).toBeDefined();
  for (const field of ["userNote", "laterUntil", "captureSource", "capturePlatform", "captureQueuedAt", "processingFailureCode", "processingError", "processingStartedAt", "processingCompletedAt"]) {
    expect(publicSchema).not.toMatch(new RegExp(`^\\s+${field}:`, "m"));
  }
  const publicSaves = openApi.match(/ {4}PublicSavesResponse:\n([\s\S]*?)(?=\n {4}[A-Za-z]|$)/)?.[1];
  expect(publicSaves).toContain("#/components/schemas/PublicBookmark");
});

it("generated bookmark create preserves the minimal auth-selected response at both success statuses", async () => {
  const { BookmarksApi, Configuration } = await import("@cosmic-dolphin/api-client");
  const minimal = { id: "share-save", message: "Saved", alreadySaved: false };
  for (const status of [201, 200]) {
    const client = new BookmarksApi(new Configuration({ basePath: "https://fixture.invalid/api/v1", accessToken: "cdsk_fixture", fetchApi: async () => new Response(JSON.stringify({ ...minimal, alreadySaved: status === 200 }), { status }) }));
    const result = await client.bookmarksCreate({ createBookmarkRequest: { sourceUrl: "https://example.com", captureSource: "ios_share_extension", capturePlatform: "ios" } });
    expect(Object.keys(result).sort()).toEqual(["alreadySaved", "id", "message"]);
    expect(result).toEqual({ ...minimal, alreadySaved: status === 200 });
  }
});
it("generated JWT create still returns full owner bookmarks with dates and nullable capture fields", async () => {
  const { BookmarksApi, Configuration } = await import("@cosmic-dolphin/api-client");
  const bookmark = { id: "owner-save", userId: "owner", sourceUrl: "https://example.com", createdAt: "2026-11-10T12:00:00Z", updatedAt: "2026-11-10T12:00:00Z", userNote: null, laterUntil: null, captureSource: null, capturePlatform: "unknown", captureQueuedAt: null };
  for (const status of [201, 200]) {
    const client = new BookmarksApi(new Configuration({ basePath: "https://fixture.invalid/api/v1", accessToken: "fixture-jwt", fetchApi: async () => new Response(JSON.stringify({ bookmark, message: "Saved", ...(status === 200 ? { alreadySaved: true } : {}) }), { status }) }));
    const result = await client.bookmarksCreate({ createBookmarkRequest: { sourceUrl: bookmark.sourceUrl } });
    expect("bookmark" in result).toBe(true);
    if (!("bookmark" in result)) throw new Error("Missing owner response");
    expect(result.bookmark.createdAt).toEqual(new Date(bookmark.createdAt));
    expect(result.bookmark).toMatchObject({ userId: "owner", userNote: null, laterUntil: null, captureSource: null });
    expect("id" in result).toBe(false);
  }
});

it("T9 generated owner paste preserves the enum and nullable failure code", async () => {
  const { BookmarksApi, Configuration } = await import("@cosmic-dolphin/api-client");
  for (const processingFailureCode of [null, "paywall", "auth", "blocked", "empty", "unsupported", "unavailable", "provider"] as const) {
    const bookmark = { id: "fictional", userId: "owner", sourceUrl: "https://fictional.example", createdAt: "2026-11-10T00:00:00Z", updatedAt: "2026-11-10T00:00:00Z", processingFailureCode };
    const client = new BookmarksApi(new Configuration({ fetchApi: async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("PUT");
      expect(JSON.parse(init?.body as string)).toEqual({ text: "x".repeat(200) });
      return new Response(JSON.stringify({ bookmark, message: "Reprocessing this bookmark" }));
    } }));
    expect((await client.bookmarksPutContent({ id: bookmark.id, pasteBookmarkContentRequest: { text: "x".repeat(200) } })).bookmark.processingFailureCode).toBe(processingFailureCode);
  }
});
