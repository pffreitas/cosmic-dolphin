"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Favicon chip — see docs/design-system/components.md#favicon-chip.
 *
 * 16px, `--cd-radius-xs`, the site's favicon from
 * `metadata.openGraph.favicon`, falling back to the domain's first letter in
 * `--cd-fg-secondary`.
 *
 * Always paired with the domain in text — the chip alone is not identification,
 * so this component renders only the chip and the provenance row supplies the
 * words beside it.
 */
export interface FaviconChipProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  /** `metadata.openGraph.favicon`. Missing or broken falls back to the letter. */
  src?: string | null;
  /** The domain this chip stands for. Supplies the fallback letter. */
  domain: string;
}

const FaviconChip = React.forwardRef<HTMLSpanElement, FaviconChipProps>(
  ({ className, src, domain, ...props }, ref) => {
    const [failed, setFailed] = React.useState(false);

    // A remote favicon that 404s must not leave a broken-image glyph behind.
    React.useEffect(() => setFailed(false), [src]);

    const letter = domain.replace(/^www\./, "").charAt(0).toUpperCase();
    const showImage = Boolean(src) && !failed;

    return (
      <span
        ref={ref}
        aria-hidden="true"
        className={cn(
          "inline-grid size-4 shrink-0 place-items-center overflow-hidden rounded-xs",
          "bg-bg-inset font-sans text-[9px] font-semibold leading-none text-fg-secondary",
          className,
        )}
        {...props}
      >
        {showImage ? (
          // A plain <img>, not next/image: favicons come from arbitrary
          // third-party hosts and next/image would need every one of them
          // allow-listed in next.config.js.
          <img
            alt=""
            src={src as string}
            width={16}
            height={16}
            loading="lazy"
            decoding="async"
            className="size-4 object-contain"
            onError={() => setFailed(true)}
          />
        ) : (
          letter
        )}
      </span>
    );
  },
);
FaviconChip.displayName = "FaviconChip";

export { FaviconChip };
