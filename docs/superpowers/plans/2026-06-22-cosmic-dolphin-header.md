# Cosmic Dolphin Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Craft-style public desktop header using Cosmic Dolphin branding.

**Architecture:** Extract the desktop header markup from `RootLayout` into a focused server-renderable component. Keep authentication state in `RootLayout`, pass authenticated-only slots into the header component, and render a dedicated public nav/action set when logged out.

**Tech Stack:** Next.js 16 App Router, React 18, Tailwind CSS, Vitest with `react-dom/server`, Bun.

## Global Constraints

- Use Bun commands, not npm/yarn.
- Do not edit generated `packages/api-client` files.
- Keep the change scoped to the web header.
- Use the existing Supabase auth state from `apps/web/app/layout.tsx`.
- Preserve authenticated app controls: `CosmicMenu`, `CommandDialogTrigger`, `NewBookmarkButton`, and `HeaderAuth`.
- Public desktop header copy: `Product`, `Community`, `Pricing`, `Download`, `Log in`, `Try Cosmic Dolphin`.
- Mobile header behavior is out of scope unless compile errors require changes.

---

### Task 1: Extract And Test Desktop Header

**Files:**
- Create: `apps/web/components/desktop-site-header.tsx`
- Create: `apps/web/components/desktop-site-header.test.tsx`
- Modify: `apps/web/app/layout.tsx`

**Interfaces:**
- Consumes: `React.ReactNode` slots from `RootLayout`.
- Produces: `DesktopSiteHeader(props: DesktopSiteHeaderProps): JSX.Element`.
- `DesktopSiteHeaderProps`:

```tsx
type DesktopSiteHeaderProps = {
  isLoggedIn: boolean;
  authenticatedNavigation?: React.ReactNode;
  authenticatedActions?: React.ReactNode;
  authControls: React.ReactNode;
};
```

- [ ] **Step 1: Write the failing test**

Create `apps/web/components/desktop-site-header.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DesktopSiteHeader,
  publicHeaderLinks,
} from "./desktop-site-header";

describe("DesktopSiteHeader", () => {
  it("renders the public Craft-style navigation and Cosmic Dolphin actions when logged out", () => {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/web && bun run test -- components/desktop-site-header.test.tsx
```

Expected: FAIL because `./desktop-site-header` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/components/desktop-site-header.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";

export const publicHeaderLinks = [
  { label: "Product", href: "#product" },
  { label: "Community", href: "#community" },
  { label: "Pricing", href: "#pricing" },
  { label: "Download", href: "#download" },
] as const;

export type DesktopSiteHeaderProps = {
  isLoggedIn: boolean;
  authenticatedNavigation?: ReactNode;
  authenticatedActions?: ReactNode;
  authControls: ReactNode;
};

export function DesktopSiteHeader({
  isLoggedIn,
  authenticatedNavigation,
  authenticatedActions,
  authControls,
}: DesktopSiteHeaderProps) {
  return (
    <div className="w-full px-4 pt-4">
      <header className="mx-auto flex h-20 max-w-[1400px] items-center rounded-[2rem] border border-white/70 bg-white/80 px-8 shadow-[0_18px_55px_rgba(15,23,42,0.14)] backdrop-blur-xl">
        <div className="flex min-w-0 flex-1 items-center">
          <Link
            href="/"
            aria-label="Cosmic Dolphin home"
            className="flex items-center whitespace-nowrap text-[1.65rem] font-black leading-none tracking-normal text-black"
          >
            Cosmic Dolphin
          </Link>
          {isLoggedIn && authenticatedNavigation}
        </div>

        {!isLoggedIn && (
          <nav
            aria-label="Primary"
            className="hidden flex-1 items-center justify-center gap-10 text-[1.72rem] font-normal text-black lg:flex"
          >
            {publicHeaderLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap transition-opacity hover:opacity-65"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex flex-1 items-center justify-end gap-4">
          {isLoggedIn ? (
            <>
              {authenticatedActions}
              {authControls}
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="whitespace-nowrap text-[1.72rem] font-normal text-black transition-opacity hover:opacity-65"
              >
                Log in
              </Link>
              <Link
                href="/sign-up"
                className="whitespace-nowrap rounded-full bg-black px-7 py-3 text-[1.55rem] font-bold leading-none text-white shadow-[inset_0_-1px_0_rgba(255,255,255,0.18)] transition-transform hover:scale-[1.015]"
              >
                Try Cosmic Dolphin
              </Link>
            </>
          )}
        </div>
      </header>
    </div>
  );
}
```

Modify `apps/web/app/layout.tsx`:

```tsx
import { DesktopSiteHeader } from "@/components/desktop-site-header";
```

Replace the desktop header wrapper inside the desktop layout with:

```tsx
<DesktopSiteHeader
  isLoggedIn={isLoggedIn}
  authenticatedNavigation={isLoggedIn ? <CosmicMenu /> : undefined}
  authenticatedActions={
    isLoggedIn ? (
      <div className="flex items-center gap-3">
        <CommandDialogTrigger />
        <NewBookmarkButton />
      </div>
    ) : undefined
  }
  authControls={<HeaderAuth />}
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/web && bun run test -- components/desktop-site-header.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run static checks**

Run:

```bash
cd apps/web && bun run typecheck
cd apps/web && bun run lint
```

Expected: both commands exit 0.

- [ ] **Step 6: Verify in browser**

Run:

```bash
cd apps/web && bun run dev
```

Open `http://localhost:3001` at desktop width. Confirm the header is a rounded translucent pill, uses Cosmic Dolphin branding, and has the public nav plus `Log in` and `Try Cosmic Dolphin` on the right.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/desktop-site-header.tsx apps/web/components/desktop-site-header.test.tsx apps/web/app/layout.tsx docs/superpowers/plans/2026-06-22-cosmic-dolphin-header.md
git commit -m "feat: update public header branding"
```
