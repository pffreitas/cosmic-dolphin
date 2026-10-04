import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Page header — docs/design-system/components.md § Page header.
 *
 * How every route inside the app shell opens: an optional eyebrow, a `page`
 * title in the serif, one line of description, and the page's own controls on
 * the right, bottom-aligned to the title block. A hairline beneath separates
 * the header from the content when `divider` is set.
 *
 * The title is serif because it names *content* — a collection, a profile,
 * a query — not a control. The controls stay sans.
 */
export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned controls: segmented filters, a sort menu, a primary action. */
  actions?: React.ReactNode;
  divider?: boolean;
  /** Heading level. A page has one h1; a gallery embedding this may want h2. */
  as?: "h1" | "h2";
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  divider = false,
  as: Heading = "h1",
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-8 gap-y-4",
        divider && "border-b border-line pb-5",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow ? (
          <div className="font-sans text-[12.5px] font-medium leading-none text-fg-tertiary">
            {eyebrow}
          </div>
        ) : null}
        <Heading className="m-0 font-serif text-[28px] font-semibold leading-[1.15] tracking-[-.018em] text-fg max-sm:text-[24px]">
          {title}
        </Heading>
        {description ? (
          <div className="nums font-sans text-[13.5px] leading-[1.5] text-fg-secondary">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
