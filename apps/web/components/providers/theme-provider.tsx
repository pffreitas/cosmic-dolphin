"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Routes that are light only, whatever the reader chose in the app or the OS.
 * The landing page is the brand's first impression and is designed in light;
 * `/` is always the landing, because a signed-in reader is redirected to Home.
 */
const LIGHT_ONLY_ROUTES = new Set(["/"]);

/**
 * The app's one theme provider. `forcedTheme` is applied by next-themes'
 * pre-paint script, so a light-only route never flashes dark, and it leaves the
 * reader's stored preference untouched for every other route.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      forcedTheme={LIGHT_ONLY_ROUTES.has(pathname) ? "light" : undefined}
    >
      {children}
    </NextThemesProvider>
  );
}
