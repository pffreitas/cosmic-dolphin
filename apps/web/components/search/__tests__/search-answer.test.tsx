import { renderToStaticMarkup } from "react-dom/server";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { SearchAnswer } from "../search-answer";
import { toAnswerSources } from "../search-data";

/**
 * Lucide is stubbed, and not for convenience.
 *
 * The workspace root hoists React 19 (the mobile app's) while `apps/web` pins
 * React 18 in its own `node_modules`. `lucide-react` lives at the root, so it
 * builds its icons with React 19's element type, and React 18's
 * `renderToStaticMarkup` refuses them: "Objects are not valid as a React
 * child". Next's bundler resolves this correctly, so it is a test-environment
 * problem only — but until the workspace agrees on one React, a server-render
 * test of any component containing an icon has to stub the icons.
 */
vi.mock("lucide-react", () => {
  const Icon = () => <svg />;
  return new Proxy(
    {},
    {
      get: (_target, name) => {
        // A module object with a `then` is one the loader awaits forever.
        if (typeof name === "symbol" || name === "then") return undefined;
        if (name === "__esModule") return true;
        return Icon;
      },
      // Vitest checks the mock actually exports what the module under test
      // imports, so the proxy has to answer `in` as well as `get`.
      has: (_target, name) => typeof name === "string" && name !== "then",
    }
  );
});

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

/**
 * Rule 8 for `/search/ask`, asserted on the thing that renders.
 *
 * "Every `search/ask` answer links its sources" has a corollary that is the
 * harder half of it: **an answer that cites nothing must not render as an
 * answer.** The easy way to fail this is to let the model write "I couldn't
 * find anything" and put it in a callout with an empty foot — an AI output
 * with no provenance, which is exactly what the rule exists to prevent.
 *
 * The server keeps the same rule from its end (`apps/api/src/tests/
 * search.test.ts`); this is the second lock, on the client, because either
 * side alone is one careless change away from losing it.
 */
describe("SearchAnswer", () => {
  const sources = toAnswerSources([
    {
      bookmarkId: "bk-1",
      title: "The thing",
      domain: "every.to",
      faviconUrl: "https://every.to/favicon.ico",
    },
    { bookmarkId: "bk-2", title: "Another thing", domain: "stratechery.com" },
  ]);

  it("renders nothing at all when it has no sources to name", () => {
    const markup = renderToStaticMarkup(
      <SearchAnswer
        answer="Memory beats context, and three of your saves say so."
        sources={[]}
      />
    );

    expect(markup).toBe("");
  });

  it("renders nothing when it has sources but no answer and nothing is coming", () => {
    const markup = renderToStaticMarkup(
      <SearchAnswer answer="   " sources={sources} streaming={false} />
    );

    expect(markup).toBe("");
  });

  it("names every source, each one as a link to its bookmark", () => {
    const markup = renderToStaticMarkup(
      <SearchAnswer
        answer="Memory beats context, and two of your saves say so."
        sources={sources}
      />
    );

    expect(markup).toContain("Memory beats context");
    expect(markup).toContain("Built from");

    for (const source of sources) {
      expect(markup).toContain(source.domain);
      // Named *and* clickable. A source that is not a link is not provenance.
      expect(markup).toContain(`href="/bookmarks/${source.bookmarkId}"`);
    }
  });

  it("never folds a source into a count", () => {
    const many = toAnswerSources(
      Array.from({ length: 7 }, (_, index) => ({
        bookmarkId: `bk-${index}`,
        title: `Save ${index}`,
        domain: `source-${index}.example`,
      }))
    );

    const markup = renderToStaticMarkup(
      <SearchAnswer answer="An answer." sources={many} />
    );

    // The digest's foot may tail into "+n more" because its sources are also
    // its content. An answer's may not: a bookmark inside a count is neither
    // named nor a link.
    expect(markup).not.toContain("more");
    for (const source of many) {
      expect(markup).toContain(`href="/bookmarks/${source.bookmarkId}"`);
    }
  });

  it("shows the callout as soon as the sources land, before the prose", () => {
    // The server sends `sources` before the first chunk precisely so this is
    // possible: the reader sees what the answer will be built from while it is
    // still being written, never a paragraph with nothing under it.
    const markup = renderToStaticMarkup(
      <SearchAnswer answer="" sources={sources} streaming />
    );

    expect(markup).toContain("Built from");
    expect(markup).toContain("every.to");
  });
});
