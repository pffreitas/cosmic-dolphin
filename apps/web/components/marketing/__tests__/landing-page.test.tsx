import { renderToStaticMarkup } from "react-dom/server";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * The landing page's promises, checked on the first render: one offer, one
 * signup intent, a demo that works without script, honest examples, and the
 * header and footer on the brand ground. docs/design-system/pages.md § Landing.
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

// Hoisted to the workspace root with the root's React; see semantics.test.tsx.
vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  // eslint-disable-next-line @next/next/no-img-element
  AvatarImage: ({ src }: { src?: string }) => <img src={src} alt="" />,
  AvatarFallback: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

// Same reason: `Button asChild` renders through Radix's Slot, which binds the
// root's React. A minimal Slot that merges its props onto the child.
vi.mock("@radix-ui/react-slot", async () => {
  const React = await import("react");
  const Slot = React.forwardRef<HTMLElement, { children?: ReactNode; className?: string }>(
    ({ children, className, ...props }, ref) => {
      if (!React.isValidElement<{ className?: string }>(children)) return null;
      return React.cloneElement(children, {
        ...props,
        ...children.props,
        className: [className, children.props.className].filter(Boolean).join(" "),
        ref,
      } as Record<string, unknown>);
    },
  );
  Slot.displayName = "Slot";
  return { Slot, Slottable: ({ children }: { children?: ReactNode }) => <>{children}</> };
});

import { LandingPage } from "../landing-page";
import { readingSamples } from "../reading-samples";

const html = renderToStaticMarkup(<LandingPage />);

/*
 * The suite runs in node with no DOM, and the web app does not depend on one,
 * so these read the static markup directly. React's server output is regular
 * enough for that: attributes are double-quoted and every element is closed.
 */
const openTags = (markup: string, tag: string) =>
  markup.match(new RegExp(`<${tag}\\b[^>]*>`, "g")) ?? [];
const attr = (tagMarkup: string | undefined, name: string) =>
  tagMarkup?.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const text = (markup: string) => markup.replace(/<[^>]+>/g, "").trim();
const innerOf = (markup: string, tag: string) =>
  [...markup.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "g"))].map(
    (match) => match[1],
  );
const hasClass = (tagMarkup: string | undefined, name: string) =>
  (attr(tagMarkup, "class") ?? "").split(/\s+/).includes(name);
/** Each demo panel's markup, from its opening tag to the next panel or the note. */
const panelMarkup = (id: string) => {
  const start = html.indexOf(`data-demo-panel="${id}"`);
  const rest = html.slice(start + 1);
  const ends = [rest.indexOf("data-demo-panel="), rest.indexOf("reading-demo-note")].filter(
    (index) => index >= 0,
  );
  return rest.slice(0, Math.min(...ends));
};

describe("structure", () => {
  it("has one h1 that states the offer", () => {
    const headings = innerOf(html, "h1");
    expect(headings).toHaveLength(1);
    expect(text(headings[0])).toBe("Actually readwhat you save.");
  });

  it("has one main, and a skip link that reaches it", () => {
    const mains = openTags(html, "main");
    expect(mains).toHaveLength(1);
    expect(attr(mains[0], "id")).toBe("main");
    const skip = openTags(html, "a").find((tag) => hasClass(tag, "landing-skip"));
    expect(attr(skip!, "href")).toBe("#main");
  });

  it("points every in-page link at a section that exists", () => {
    // The product views are inert: their rows keep the components' `href`
    // placeholders, but nothing inside them can be focused or followed.
    const outsideViews = html.replace(/<figure\b[\s\S]*?<\/figure>/g, "");
    const targets = openTags(outsideViews, "a")
      .map((tag) => attr(tag, "href"))
      .filter((href): href is string => Boolean(href?.startsWith("#")));
    expect(targets.length).toBeGreaterThan(0);
    for (const href of targets) expect(html, href).toContain(`id="${href.slice(1)}"`);
  });

  it("names the signup intent one way: every /sign-up link says Get started", () => {
    const signups = [...html.matchAll(/<a\b[^>]*href="\/sign-up"[^>]*>([\s\S]*?)<\/a>/g)];
    expect(signups.length).toBeGreaterThanOrEqual(2);
    for (const [, inner] of signups) expect(text(inner)).toBe("Get started");
  });

  it("gives every image an alt attribute", () => {
    for (const image of openTags(html, "img")) expect(image).toMatch(/\salt="/);
  });
});

describe("the brand ground", () => {
  it("puts the header and footer on the dark token set", () => {
    expect(hasClass(openTags(html, "header")[0], "dark")).toBe(true);
    expect(hasClass(openTags(html, "footer")[0], "dark")).toBe(true);
  });

  it("keeps everything between them light", () => {
    const main = innerOf(html, "main")[0];
    const darkInside = (main.match(/\sclass="[^"]*"/g) ?? []).filter((value) =>
      value.slice(8, -1).split(/\s+/).includes("dark"),
    );
    expect(darkInside).toEqual([]);
  });
});

describe("the reading demo", () => {
  const radios = openTags(html, "input").filter((tag) => attr(tag, "type") === "radio");
  const chosen = radios.filter((tag) => /\schecked(=""|\s|>|\/)/.test(tag));
  const panelIds = openTags(html, "div")
    .map((tag) => attr(tag, "data-demo-panel"))
    .filter((id): id is string => Boolean(id));

  it("offers one radio per example, in one group, with exactly one chosen", () => {
    expect(radios).toHaveLength(readingSamples.length);
    expect(new Set(radios.map((tag) => attr(tag, "name"))).size).toBe(1);
    expect(chosen).toHaveLength(1);
  });

  it("opens on the video", () => {
    expect(attr(chosen[0], "value")).toBe("video");
  });

  it("has a panel for every radio, so the CSS switch always shows something", () => {
    expect([...panelIds].sort()).toEqual(radios.map((tag) => attr(tag, "value")).sort());
  });

  it("labels the group for assistive technology", () => {
    expect(text(innerOf(html, "legend")[0] ?? "")).toBe("Choose an example save");
  });

  it("links every brief back to its real source, in a new tab", () => {
    for (const id of panelIds) {
      const source = openTags(panelMarkup(id), "a").find(
        (tag) => attr(tag, "target") === "_blank",
      );
      const sample = readingSamples.find((item) => item.id === id);
      expect(attr(source!, "href"), id).toBe(sample?.url);
      expect(attr(source!, "rel"), id).toContain("noreferrer");
    }
  });

  it("says the briefs are hand-written examples", () => {
    expect(html).toMatch(/class="reading-demo-note"[^>]*>[^<]*written by hand/);
  });
});

describe("the product views", () => {
  it("are inert and say what they depict", () => {
    const views = openTags(html, "figure");
    expect(views).toHaveLength(3);
    for (const view of views) expect(attr(view, "aria-label")?.length).toBeGreaterThan(20);
    for (const inner of innerOf(html, "figure")) expect(inner).toMatch(/\sinert(=""|\s|>)/);
  });
});

describe("the examples", () => {
  it("are real public https links", () => {
    for (const sample of readingSamples) expect(sample.url).toMatch(/^https:\/\//);
  });

  it("never claim a summary longer than the post it summarises", () => {
    const post = readingSamples.find((sample) => sample.id === "post")!;
    expect(post.summary.length).toBeLessThan(120);
    expect(post.points).toHaveLength(0);
  });
});
