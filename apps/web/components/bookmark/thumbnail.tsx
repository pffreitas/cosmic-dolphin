"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The thumbnail box shared by the feed item and the library row.
 *
 * Source: `metadata.openGraph.image`. When there is none — or when it fails to
 * load — the box holds its geometry and fills with a token-built placeholder
 * rather than collapsing, because a thumbnail that disappears reflows the row
 * around it and the list stops being scannable.
 *
 * Sizes come from the caller: 132×88 in a feed item, full-width × 210 for
 * video, 88×64 in a library row. Radius too: `md` in the feed, `sm` in the
 * Library.
 *
 * Always decorative. The title beside it is the accessible name, so the image
 * carries an empty alt and never repeats it.
 */
export interface ThumbnailProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  src?: string | null;
  /** Bottom-right badge — a video's mono duration. */
  badge?: React.ReactNode;
}

/**
 * Two soft radial washes mixed out of the accent and the foreground over
 * `--cd-bg-inset`. `color-mix` keeps it token-pure: there is no literal here,
 * and it re-derives itself in dark mode along with everything else.
 */
const PLACEHOLDER = cn(
  "bg-bg-inset",
  "bg-[image:radial-gradient(110%_85%_at_16%_10%,color-mix(in_srgb,var(--cd-accent)_62%,transparent),transparent_58%),radial-gradient(95%_95%_at_86%_90%,color-mix(in_srgb,var(--cd-fg)_38%,transparent),transparent_56%)]",
);

const Thumbnail = React.forwardRef<HTMLDivElement, ThumbnailProps>(
  ({ className, src, badge, ...props }, ref) => {
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => setFailed(false), [src]);

    const showImage = Boolean(src) && !failed;

    return (
      <div
        ref={ref}
        className={cn(
          "relative shrink-0 overflow-hidden border border-line",
          !showImage && PLACEHOLDER,
          className,
        )}
        {...props}
      >
        {showImage ? (
          // A plain <img>, not next/image: Open Graph images come from
          // arbitrary third-party hosts and next/image would need every one of
          // them allow-listed in next.config.js.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            src={src as string}
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : null}
        {badge ? (
          // A solid panel chip rather than the prototype's fixed dark scrim:
          // a white-on-black badge only has its contrast in light mode, and
          // there is no "always light" token to spend on it.
          <span
            className={cn(
              "absolute bottom-1.5 right-1.5 z-[1] rounded-xs border border-line",
              "bg-bg-panel px-1.5 py-0.5 font-mono text-[10.5px] leading-[1.4] text-fg",
            )}
          >
            {badge}
          </span>
        ) : null}
      </div>
    );
  },
);
Thumbnail.displayName = "Thumbnail";

export { Thumbnail };