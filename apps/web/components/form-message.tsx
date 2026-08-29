import { cn } from "@/lib/utils";

/**
 * A message about one field — D18.
 *
 * The rule from docs/design-system/pages.md § Auth: **errors render inline
 * under the offending field, never as a page-level banner.** A banner at the
 * top of a form makes the reader map a sentence onto a field themselves, and
 * on a two-field form that is a coin toss.
 *
 * So this is a field-level message, not a panel. It carries an `id` for the
 * field's `aria-describedby`, and `role="alert"` on the error arm so a screen
 * reader hears it when it appears rather than only if the user happens to
 * navigate back over the field.
 *
 * Colour is never the only carrier: the error arm is announced, described and
 * paired with `aria-invalid` on the field itself, which the caller sets.
 */
export type Message =
  | { success: string }
  | { error: string }
  | { message: string };

export interface FormMessageProps {
  /** Nothing renders when there is nothing to say. */
  message?: Message | null;
  /** Point the field's `aria-describedby` here. */
  id?: string;
  className?: string;
}

export function FormMessage({ message, id, className }: FormMessageProps) {
  if (!message) return null;

  const base = "font-sans text-[12.5px] leading-[1.45]";

  if ("error" in message) {
    return (
      <p
        id={id}
        role="alert"
        className={cn(base, "text-[color:var(--cd-danger)]", className)}
      >
        {message.error}
      </p>
    );
  }

  if ("success" in message) {
    return (
      <p
        id={id}
        role="status"
        className={cn(base, "text-[color:var(--cd-success)]", className)}
      >
        {message.success}
      </p>
    );
  }

  if (!message.message) return null;

  return (
    <p id={id} className={cn(base, "text-fg-secondary", className)}>
      {message.message}
    </p>
  );
}

/**
 * Which field an auth error is about.
 *
 * Supabase answers with a sentence, not a field name, so something has to
 * decide where the sentence goes. This reads the sentence rather than guessing
 * from the endpoint, and falls back to the caller's `fallback` — which is the
 * field that form's failures are usually about — rather than to a banner.
 *
 * It is a small mapping and it will be wrong occasionally. That is a better
 * trade than a page-level banner, which is wrong about *location* every single
 * time by not having one.
 */
export function fieldForAuthError(
  error: string,
  fallback: "email" | "password"
): "email" | "password" {
  const text = error.toLowerCase();

  if (
    text.includes("email") ||
    text.includes("already registered") ||
    text.includes("user already")
  ) {
    return "email";
  }

  if (text.includes("password")) return "password";

  return fallback;
}
