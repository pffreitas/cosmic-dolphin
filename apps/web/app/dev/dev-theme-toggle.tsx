"use client";

import * as React from "react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

/**
 * The light/dark toggle shared by the dev state galleries.
 *
 * `resolvedTheme` is undefined on the server and on the first client render —
 * next-themes only knows the answer after it has read the DOM. Branching on it
 * during render therefore ships one label in the HTML and a different one on
 * hydration, and React treats that text mismatch as a hydration failure: it
 * stops attaching handlers to the surrounding tree, and every control on the
 * page goes dead while still looking fine in a screenshot. That is a
 * particularly bad failure on a gallery whose whole job is to let someone click
 * through states.
 *
 * Rendering the label only once mounted keeps the server and first client
 * render identical. The button reserves its width so the label appearing does
 * not shift the header.
 */
export function DevThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      size="sm"
      className="min-w-[4.5rem]"
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Colour mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted ? (isDark ? "Light" : "Dark") : null}
    </Button>
  );
}
