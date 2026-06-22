import { renderToStaticMarkup } from "react-dom/server";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DesktopSiteHeader, publicHeaderLinks } from "./desktop-site-header";

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

describe("DesktopSiteHeader", () => {
  it("renders the public navigation and Cosmic Dolphin actions when logged out", () => {
    const markup = renderToStaticMarkup(
      <DesktopSiteHeader isLoggedIn={false} authControls={null} />
    );

    expect(markup).toContain("Cosmic Dolphin");
    expect(markup).toContain("Log in");
    expect(markup).toContain("Try Cosmic Dolphin");

    for (const link of publicHeaderLinks) {
      expect(markup).toContain(link.label);
      expect(markup).toContain(`href="${link.href}"`);
    }
  });

  it("keeps authenticated navigation, actions, and auth controls when logged in", () => {
    const markup = renderToStaticMarkup(
      <DesktopSiteHeader
        isLoggedIn
        authenticatedNavigation={<span>App Navigation</span>}
        authenticatedActions={<button type="button">Save Link</button>}
        authControls={<span>Profile Menu</span>}
      />
    );

    expect(markup).toContain("App Navigation");
    expect(markup).toContain("Save Link");
    expect(markup).toContain("Profile Menu");
    expect(markup).not.toContain("Try Cosmic Dolphin");
  });
});
