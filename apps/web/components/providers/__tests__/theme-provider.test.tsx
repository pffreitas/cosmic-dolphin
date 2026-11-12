import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The landing is light only; every other route keeps the reader's theme.
 * docs/design-system/pages.md § Landing.
 */

const pathname = { current: "/" };
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

const received: Record<string, unknown>[] = [];
vi.mock("next-themes", () => ({
  ThemeProvider: ({ children, ...props }: { children?: ReactNode }) => {
    received.push(props);
    return <>{children}</>;
  },
}));

import { ThemeProvider } from "../theme-provider";

function propsFor(route: string) {
  pathname.current = route;
  received.length = 0;
  renderToStaticMarkup(
    <ThemeProvider>
      <p />
    </ThemeProvider>,
  );
  return received[0];
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    received.length = 0;
  });

  it("forces light on the landing page", () => {
    expect(propsFor("/").forcedTheme).toBe("light");
  });

  it.each(["/sign-in", "/my/dashboard", "/my/library", "/s/abc"])(
    "leaves %s to the reader's choice",
    (route) => {
      expect(propsFor(route).forcedTheme).toBeUndefined();
    },
  );

  it("keeps the app's theme settings", () => {
    expect(propsFor("/my/dashboard")).toMatchObject({
      attribute: "class",
      defaultTheme: "light",
      enableSystem: true,
      disableTransitionOnChange: true,
    });
  });
});
