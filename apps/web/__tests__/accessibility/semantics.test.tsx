import { renderToStaticMarkup } from "react-dom/server";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * Rule ten, semantics half.
 *
 * foundations.md § Accessibility names six things that must be true of the
 * markup, and until now nothing checked any of them:
 *
 *   > Feed and library items are `<article>`; nav is `<nav>` with
 *   > `aria-current="page"`; the like button is a `<button>` with
 *   > `aria-pressed` […] AI processing status updates announce through
 *   > `aria-live="polite"`.
 *
 * The pass is over the **patterns**, not the routes, and that is deliberate.
 * Every feed on the product — `/my/dashboard`, `/explore`, the pending-captures
 * strip — renders `FeedItem`; every list of saves — `/my/library`, `/search`,
 * `/u/{handle}`, the command palette — renders `LibraryRow`; every pipeline
 * readout renders `ProcessingSteps`. Six components carry the semantics of
 * fourteen routes, so asserting them here is both the smaller and the stronger
 * test: a route cannot lose an `<article>` without one of these losing it
 * first. `/dev/patterns`, `/dev/library`, `/dev/bookmark` and `/dev/home` are
 * the same components with the same fixtures, rendered for the eye instead.
 *
 * `renderToStaticMarkup` rather than a browser: these are properties of the
 * first render, and the assertions are about attributes, not layout. The one
 * thing needing a real box — the 44px touch target — is asserted against the
 * declared class, which is where its value comes from.
 */

vi.mock("lucide-react", () => {
  const Icon = () => <svg />;
  return new Proxy(
    {},
    {
      get: (_target, name) => {
        if (typeof name === "symbol" || name === "then") return undefined;
        if (name === "__esModule") return true;
        return Icon;
      },
      has: (_target, name) => typeof name === "string" && name !== "then",
    },
  );
});

/**
 * Stubbed for the reason `components/profile/__tests__/profile.test.tsx`
 * records: `@radix-ui/react-avatar` is hoisted to the workspace root and binds
 * the root's React, while `apps/web` renders with its own pinned React 18, so
 * its `useState` reaches a null dispatcher and throws. A test-environment
 * artefact — Next's bundler resolves the duplicate correctly.
 */
vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  AvatarImage: ({ src }: { src?: string }) => <img src={src} alt="" />,
  AvatarFallback: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const pathname = { current: "/my/library" };
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/providers/command-dialog-provider", () => ({
  useCommandDialog: () => ({ open: false, toggle: () => undefined, setOpen: () => undefined }),
}));

import { AppHeader } from "@/components/app-header";
import { BottomNavigation } from "@/components/mobile/bottom-nav";
import { FeedItem, FeedItemSkeleton } from "@/components/feed/feed-item";
import { LibraryList, LibraryRow } from "@/components/bookmark/library-row";
import { ActionRow } from "@/components/social/action-row";
import { ProcessingSteps, type ProcessingStep } from "@/components/ai/processing-steps";

const render = (node: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(node);

const IN_FLIGHT: ProcessingStep[] = [
  { phase: "fetch", state: "done" },
  { phase: "extract", state: "active" },
  { phase: "summarise", state: "pending" },
  { phase: "file", state: "pending" },
];

// ---------------------------------------------------------------------------
// <article> on the two item patterns
// ---------------------------------------------------------------------------

describe("feed and library items are articles", () => {
  it("wraps a feed item in <article>", () => {
    const html = render(
      <FeedItem
        href="/bookmarks/bk_8f2a"
        title="The Bottleneck Was Never Retrieval"
        provenance={{ sources: [{ domain: "every.to" }], timestamp: "2d" }}
        summary="Agents don't fail because they can't find the right document."
      />,
    );
    expect(html).toContain("<article");
  });

  it("wraps every feed variant, not just the one somebody remembered", () => {
    // A digest and a still-processing save are feed items too, and each is
    // built by a different branch of the component.
    const digest = render(
      <FeedItem
        variant="digest"
        href="/digests/dg_44a1"
        title="Four of your saves are circling the same argument"
        sources={[{ bookmarkId: "bk_8f2a", href: "/bookmarks/bk_8f2a", domain: "every.to" }]}
      />,
    );
    const pending = render(
      <FeedItem
        variant="pending"
        href="/bookmarks/bk_91ff"
        title="Episodic Memory for Long-Horizon Tool-Using Agents"
        provenance={{ sources: [{ domain: "arxiv.org" }], timestamp: "just now" }}
        steps={IN_FLIGHT}
      />,
    );
    expect(digest).toContain("<article");
    expect(pending).toContain("<article");
  });

  it("does NOT make a skeleton an article", () => {
    // The deliberate other half of the rule. `<article>` announces "here is an
    // item"; a skeleton is the absence of one. Marking placeholders up as
    // articles would tell a screen-reader user a loading feed already holds
    // eight posts, and the count would then change under them. Skeletons stay
    // out of the tree — every child carries aria-hidden — and the article count
    // stays equal to the number of real items.
    const html = render(<FeedItemSkeleton />);
    expect(html).not.toContain("<article");
    expect(html).not.toMatch(/aria-(label|labelledby)=/);
  });

  it("wraps a library row in <article>", () => {
    const html = render(
      <LibraryList>
        <LibraryRow
          href="/bookmarks/bk_8f2a"
          title="Tokens are a contract, not a palette"
          domain="linear.app"
          savedAt="3d ago"
        />
      </LibraryList>,
    );
    expect(html).toContain("<article");
  });
});

// ---------------------------------------------------------------------------
// nav + aria-current
// ---------------------------------------------------------------------------

describe("nav marks where you are", () => {
  it("uses a decorative dolphin emoji for the linked brandmark", () => {
    const html = render(<AppHeader currentPath="/my/library" />);
    const brandmark = html.match(
      /<a[^>]*aria-label="Cosmic Dolphin home"[^>]*>.*?<\/a>/,
    )?.[0];

    expect(brandmark).toBeTruthy();
    expect(brandmark).toContain('aria-hidden="true"');
    expect(brandmark).toContain("🐬");
    expect(brandmark).not.toContain("bg-accent");
  });

  it("leaves the header unpainted so only the capsule carries a surface", () => {
    const html = render(<AppHeader currentPath="/my/library" />);
    const header = html.match(/<header[^>]*>/)?.[0];

    expect(header).toBeTruthy();
    expect(header).not.toMatch(/\b(?:bg-|style=)/);
  });

  it("shrink-wraps the desktop capsule around its navigation content", () => {
    const html = render(<AppHeader currentPath="/my/library" />);
    const nav = html.match(/<nav[^>]*>/)?.[0];

    expect(nav).toBeTruthy();
    expect(nav).toContain("inline-grid");
    expect(nav).toContain("w-fit");
  });

  it("puts the header capsule in a <nav> and marks the current destination", () => {
    const html = render(<AppHeader currentPath="/my/library" onSearch={() => undefined} />);
    expect(html).toContain("<nav");
    expect(html).toContain('aria-current="page"');
    // Exactly one destination is current. Two is a lie and zero is a
    // navigation that never tells you where you are.
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("marks a nested route against its section", () => {
    const html = render(<AppHeader currentPath="/my/library/collections/c1" />);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("marks nothing when you are somewhere the capsule does not list", () => {
    const html = render(<AppHeader currentPath="/settings" />);
    expect(html).not.toContain('aria-current="page"');
  });

  it("does the same in the mobile tab bar", () => {
    pathname.current = "/my/dashboard";
    const html = render(<BottomNavigation />);
    expect(html).toContain("<nav");
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("gives the tab bar 44px touch targets", () => {
    // foundations.md § Accessibility: 32px on pointer, 44px on touch. The bar
    // is the only touch-first surface in `apps/web`, so it is the only place
    // the larger floor applies — and it is declared, not inferred from padding.
    pathname.current = "/my/dashboard";
    expect(render(<BottomNavigation />)).toContain("min-h-[44px]");
  });
});

// ---------------------------------------------------------------------------
// aria-pressed on like
// ---------------------------------------------------------------------------

describe("the like button says whether it is pressed", () => {
  it("is a <button> with aria-pressed=false when not liked", () => {
    const html = render(<ActionRow likeCount={12} commentCount={3} />);
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*aria-label="Like"/);
  });

  it("flips to aria-pressed=true when liked", () => {
    const html = render(<ActionRow liked likeCount={13} />);
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*aria-label="Like"/);
  });

  it("names which item it acts on when several rows share a page", () => {
    const html = render(<ActionRow itemTitle="The Bottleneck Was Never Retrieval" />);
    expect(html).toContain('aria-label="Like on The Bottleneck Was Never Retrieval"');
  });

  it("carries the same pressed state on Save, which is also a toggle", () => {
    expect(render(<ActionRow saved />)).toContain('aria-pressed="true"');
  });
});

// ---------------------------------------------------------------------------
// aria-live on processing status
// ---------------------------------------------------------------------------

describe("processing status announces itself", () => {
  it("carries a polite live region", () => {
    const html = render(<ProcessingSteps steps={IN_FLIGHT} announceLabel="A new save" />);
    expect(html).toMatch(/<p[^>]*role="status"[^>]*aria-live="polite"/);
  });

  it("announces the phase in flight, not every token of it", () => {
    const html = render(<ProcessingSteps steps={IN_FLIGHT} announceLabel="A new save" />);
    // One sentence, naming the subject and the phase. `aria-live` on a region
    // that restated itself per token would make the pipeline unusable.
    expect(html).toContain("A new save: Extracted content");
  });

  it("announces a failure rather than falling silent", () => {
    const html = render(
      <ProcessingSteps
        steps={[
          { phase: "fetch", state: "done" },
          { phase: "extract", state: "failed", error: "The page timed out" },
        ]}
        announceLabel="A new save"
      />,
    );
    expect(html).toContain("failed");
  });

  it("reaches the feed through the pending item, which is where users meet it", () => {
    const html = render(
      <FeedItem
        variant="pending"
        href="/bookmarks/bk_91ff"
        title="Episodic Memory for Long-Horizon Tool-Using Agents"
        provenance={{ sources: [{ domain: "arxiv.org" }], timestamp: "just now" }}
        steps={IN_FLIGHT}
      />,
    );
    expect(html).toContain('aria-live="polite"');
  });
});
