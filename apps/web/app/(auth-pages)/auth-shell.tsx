import * as React from "react";

import { Brandmark } from "@/components/app-header";

/**
 * The head of every auth page — docs/design-system/pages.md § Auth.
 *
 * "Brandmark, `title-2` heading, one line of `body-sm`, then the form."
 * `title-2` is 20px/600 serif (docs/design-system/foundations.md), which is
 * what replaces the three pages' hand-set 2rem Georgia headings. Georgia was
 * not a token, was not the product's serif, and was inlined as a `style` prop
 * on each of the three so they could drift.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  /** The "already have an account?" line. Below the form, never inside it. */
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Brandmark />
        <div className="flex flex-col gap-1.5">
          <h1 className="font-serif text-[20px] font-semibold leading-[1.3] tracking-[-.01em] text-fg">
            {title}
          </h1>
          <p className="font-sans text-[13.5px] leading-[1.55] text-fg-secondary">
            {subtitle}
          </p>
        </div>
      </div>

      {children}

      {footer ? (
        <p className="font-sans text-[13px] leading-[1.5] text-fg-secondary">
          {footer}
        </p>
      ) : null}
    </div>
  );
}

/**
 * One labelled field with its message slot.
 *
 * The message lives here, under the input, because that is the rule the auth
 * pages exist to satisfy: no page-level banner. Making it part of the field
 * rather than something each page remembers to place is what stops the rule
 * decaying on the next form somebody adds.
 */
export function AuthField({
  label,
  htmlFor,
  children,
  message,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  message?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="font-sans text-[12.5px] font-medium leading-none text-fg-secondary"
      >
        {label}
      </label>
      {children}
      {message}
    </div>
  );
}
