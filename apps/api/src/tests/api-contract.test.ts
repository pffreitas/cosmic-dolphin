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
