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
});
