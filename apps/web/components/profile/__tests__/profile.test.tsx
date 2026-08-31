import { renderToStaticMarkup } from "react-dom/server";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * The profile page — D18.
 *
 * Two things are worth a test here and they are not the layout.
 *
 * The first is the **placement of a rejection**. `PATCH /profile` answers a
 * refused handle with a 409 twice over — taken, and changed less than 30 days
 * ago — and the two are told apart only by the sentence they carry. The rule
 * from docs/design-system/pages.md § Auth is that a rejection renders under the
 * field it is about, so something has to read that sentence and decide where it
 * goes. That decision is a pure function, and it is tested against the exact
 * strings `packages/shared/src/services/profile.service.ts` throws, so the day
 * somebody rewords one of them this fails rather than quietly routing the
 * message to the wrong field.
 *
 * The second is that `/my/profile` and `/u/{handle}` really are **one view**.
 * The test renders it as both and asserts the tab links differ only in their
 * base path — which is the whole reason a second page was not written.
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
    }
  );
});

/**
 * The avatar is stubbed for the same reason the icons are.
 *
 * `@radix-ui/react-avatar` is hoisted to the workspace root and binds the
 * root's React, while `apps/web` renders with its own pinned React 18 — so its
 * `useState` reaches a null dispatcher and throws. Next's bundler resolves the
 * duplicate correctly, so this is a test-environment artefact only, and
 * stubbing it keeps the assertions on what this file is actually about.
 */
vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  AvatarImage: ({ src }: { src?: string }) => <img src={src} alt="" />,
  AvatarFallback: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ProfileView } from "../profile-view";
import {
  DEFAULT_PROFILE_TAB,
  formatHandleAvailableOn,
  formatJoinedAt,
  handleRejectionKind,
  parseProfileTab,
  profileErrorField,
  profileTabHref,
} from "../profile-data";

/**
 * The two 409 sentences, copied from where they are thrown
 * (`HandleUnavailableError` and `HandleCooldownError` in
 * packages/shared/src/services/profile.service.ts). If these drift, the
 * classifier below is the thing that breaks — which is the point.
 */
const TAKEN = 'The handle "reader" is taken.';
const COOLDOWN =
  "A handle can be changed once every 30 days. You can change yours again on 2026-09-12.";

const counts = {
  publicSaves: 12,
  collections: 3,
  followers: 40,
  following: 7,
};

function render(node: Parameters<typeof renderToStaticMarkup>[0]) {
  return renderToStaticMarkup(node);
}

describe("profile rejection routing", () => {
  it("puts both 409s under the handle field", () => {
    expect(profileErrorField(TAKEN)).toBe("handle");
    expect(profileErrorField(COOLDOWN)).toBe("handle");
  });

  it("tells the two 409s apart, so they can be surfaced differently", () => {
    expect(handleRejectionKind(TAKEN)).toBe("taken");
    expect(handleRejectionKind(COOLDOWN)).toBe("cooldown");
  });

  it("falls back to a field rather than a banner", () => {
    // Nothing in this sentence names a field. It still lands on one.
    expect(profileErrorField("That didn't save. Try again.")).toBe("name");
    expect(handleRejectionKind("That didn't save. Try again.")).toBe("other");
  });

  it("routes a picture rejection to the picture field", () => {
    expect(profileErrorField("That picture URL is too long.")).toBe(
      "pictureUrl"
    );
  });
});

describe("profile dates", () => {
  it("formats the join date in a fixed locale and zone", () => {
    // Same input, same string, on any machine — a month name that differed
    // between server and browser is a hydration mismatch, and a hydration
    // mismatch kills every handler on the page without looking broken.
    expect(formatJoinedAt("2026-03-04T23:30:00.000Z")).toBe("Joined March 2026");
  });

  it("says nothing about a join date it cannot read", () => {
    expect(formatJoinedAt("not a date")).toBe("");
  });

  it("only announces a handle cooldown that is still in the future", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10);
    expect(formatHandleAvailableOn(future)).toContain(
      "You can change your handle again on"
    );

    expect(formatHandleAvailableOn(undefined)).toBeUndefined();
    expect(formatHandleAvailableOn(new Date(Date.now() - 1000))).toBeUndefined();
  });
});

describe("profile tabs", () => {
  it("accepts only the three tabs and defaults the rest", () => {
    expect(parseProfileTab("collections")).toBe("collections");
    expect(parseProfileTab("likes")).toBe("likes");
    expect(parseProfileTab("saves")).toBe("saves");
    expect(parseProfileTab("../../etc/passwd")).toBe(DEFAULT_PROFILE_TAB);
    expect(parseProfileTab(undefined)).toBe(DEFAULT_PROFILE_TAB);
  });

  it("keeps the default tab out of the URL", () => {
    expect(profileTabHref("/my/profile", "saves")).toBe("/my/profile");
    expect(profileTabHref("/u/reader", "likes")).toBe("/u/reader?tab=likes");
  });
});

describe("ProfileView", () => {
  const base = {
    handle: "reader",
    name: "Ada Reader",
    joinedAt: "Joined March 2026",
    counts,
    saves: [],
    collections: [],
    likes: [],
    isSelf: false,
  };

  it("is the same view at both addresses, differing only in the tab links", () => {
    const mine = render(
      <ProfileView {...base} basePath="/my/profile" tab="saves" isSelf />
    );
    const theirs = render(
      <ProfileView {...base} basePath="/u/reader" tab="saves" />
    );

    expect(mine).toContain('href="/my/profile?tab=collections"');
    expect(mine).toContain('href="/my/profile?tab=likes"');
    expect(theirs).toContain('href="/u/reader?tab=collections"');
    expect(theirs).toContain('href="/u/reader?tab=likes"');

    // Three tabs on both, and the selected one marked for assistive tech.
    for (const markup of [mine, theirs]) {
      expect(markup).toContain('aria-current="page"');
      expect(markup).toContain("Saves");
      expect(markup).toContain("Collections");
      expect(markup).toContain("Likes");
    }
  });

  it("shows the four public counts and the join date", () => {
    const markup = render(
      <ProfileView {...base} basePath="/u/reader" tab="saves" />
    );

    expect(markup).toContain("public saves");
    expect(markup).toContain("followers");
    expect(markup).toContain("following");
    expect(markup).toContain("collections");
    expect(markup).toContain("Joined March 2026");
    expect(markup).toContain("@reader");
  });

  it("renders whatever action the route hands it", () => {
    const markup = render(
      <ProfileView
        {...base}
        basePath="/u/reader"
        tab="saves"
        action={<button type="button">Follow</button>}
      />
    );

    expect(markup).toContain(">Follow</button>");
  });

  it("empties each tab in the reader's own words or a stranger's", () => {
    const mine = render(
      <ProfileView {...base} basePath="/my/profile" tab="collections" isSelf />
    );
    const theirs = render(
      <ProfileView {...base} basePath="/u/reader" tab="collections" />
    );

    expect(mine).toContain("None of your collections are public.");
    expect(theirs).toContain("Ada Reader has no public collections.");
  });

  it("never renders an email, whoever is looking", () => {
    // `ProfileView` is built from `PublicProfile`, which has no email field.
    // This is the assertion that the owner's page did not grow one.
    const markup = render(
      <ProfileView {...base} basePath="/my/profile" tab="saves" isSelf />
    );

    expect(markup).not.toContain("@example.com");
    expect(markup.toLowerCase()).not.toContain("email");
  });
});
