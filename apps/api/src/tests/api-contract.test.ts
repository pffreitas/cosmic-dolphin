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

  it("keeps reading progress on its own routes, not folded into Bookmark", async () => {
    const reading = await Bun.file(
      repoPath("packages/apispec/reading.tsp")
    ).text();

    expect(reading).toContain('@route("/{id}/progress")');
    expect(reading).toContain('@route("/continue-reading")');
    expect(reading).toContain('@route("/{id}/highlights")');
  });
});
