import * as React from "react";

/**
 * The head of every auth page — docs/design-system/pages.md § Auth.
 *
 * A 30px serif heading, one line of `body-sm`, then the form. The brandmark
 * lives in the layout's top-left corner, not above every heading.
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
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-[30px] font-semibold leading-[1.15] tracking-[-.022em] text-fg">
          {title}
        </h1>
        <p className="font-sans text-[14px] leading-[1.55] text-fg-secondary">
          {subtitle}
        </p>
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
