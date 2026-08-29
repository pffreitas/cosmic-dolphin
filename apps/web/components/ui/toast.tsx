"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AlertCircle, AlertTriangle, CheckCircle2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { focusRing } from "./focus-ring";

/**
 * Toast — see docs/design-system/components.md#toast.
 *
 * `--cd-bg-panel`, `--cd-radius-md`, `--cd-shadow-popover`, bottom-right on
 * desktop and bottom-centre on mobile. 4s auto-dismiss; anything undoable
 * carries an **Undo** action and stays 8s, because four seconds is not enough
 * time to notice a mistake and reach for the fix.
 *
 * Success toasts colour the ICON with `--cd-success`, never the ground — the
 * ground stays panel so a run of toasts reads as one material.
 *
 * Usage: wrap the tree once in `<ToastProvider>`, then
 *
 *   const { toast } = useToast();
 *   toast({ title: "Saved" });
 *   toast({ title: "Moved to Research", undo: { onUndo: () => restore() } });
 */
const DURATION = 4000;
const DURATION_WITH_UNDO = 8000;

export type ToastVariant = "default" | "success" | "warning" | "danger";

export interface ToastOptions {
  title: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastVariant;
  /**
   * Makes the toast undoable: adds an Undo action and extends the life to 8s.
   */
  undo?: {
    label?: string;
    onUndo: () => void;
  };
  /** Override the auto-dismiss. `null` keeps the toast until it is dismissed. */
  duration?: number | null;
}

interface ToastRecord extends ToastOptions {
  id: string;
}

type ToastContextValue = {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast() must be called inside a <ToastProvider>.");
  }
  return context;
}

/**
 * Same context, but `null` instead of a throw when there is no provider.
 *
 * For shared components that toast as a courtesy rather than as their reason
 * for existing — the social action row's "Link copied", for instance. Those
 * have to keep working on a surface that has not mounted a `<ToastProvider>`
 * yet, and a copied link with no toast is a smaller failure than a crashed
 * feed. Anything whose whole job is the toast should use `useToast()` and get
 * the loud error.
 */
export function useOptionalToast(): ToastContextValue | null {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children?: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const toast = React.useCallback((options: ToastOptions) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [...current, { ...options, id }]);
    return id;
  }, []);

  const value = React.useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: ToastRecord[];
  onDismiss: (id: string) => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      // One polite live region for the whole stack: each toast announces once
      // as it lands, rather than the region being re-read on every change.
      role="status"
      aria-live="polite"
      aria-relevant="additions"
      className={cn(
        "pointer-events-none fixed bottom-0 z-[100] flex flex-col gap-2 p-4",
        // Bottom-centre on mobile, bottom-right from 640px up.
        "inset-x-0 items-center",
        "sm:inset-x-auto sm:right-0 sm:items-end",
      )}
    >
      {toasts.map((entry) => (
        <ToastItem key={entry.id} toast={entry} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}

const VARIANT_ICON: Record<
  Exclude<ToastVariant, "default">,
  { Icon: typeof CheckCircle2; className: string }
> = {
  success: { Icon: CheckCircle2, className: "text-[color:var(--cd-success)]" },
  warning: { Icon: AlertTriangle, className: "text-[color:var(--cd-warning)]" },
  danger: { Icon: AlertCircle, className: "text-[color:var(--cd-danger)]" },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
}) {
  const { id, title, description, variant = "default", undo } = toast;

  const duration =
    toast.duration === null
      ? null
      : (toast.duration ?? (undo ? DURATION_WITH_UNDO : DURATION));

  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (duration === null || paused) return;
    const timer = window.setTimeout(() => onDismiss(id), duration);
    return () => window.clearTimeout(timer);
  }, [duration, paused, id, onDismiss]);

  const art = variant === "default" ? null : VARIANT_ICON[variant];

  return (
    <div
      // Pointer or keyboard attention holds the toast open — four seconds is
      // not a deadline the user agreed to.
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className={cn(
        "pointer-events-auto flex w-[min(92vw,380px)] items-start gap-3",
        "rounded-md border border-line bg-bg-panel p-3 pl-3.5",
        "shadow-[var(--cd-shadow-popover)]",
        "animate-in fade-in-0 slide-in-from-bottom-2 duration-cd ease-cd",
        "motion-reduce:animate-none",
      )}
    >
      {art ? (
        <art.Icon
          aria-hidden="true"
          className={cn("mt-px size-4 shrink-0 [stroke-width:1.7]", art.className)}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-sans text-[13.5px] font-medium leading-[1.4] text-fg">
          {title}
        </p>
        {description ? (
          <p className="font-sans text-[12.5px] leading-[1.4] text-fg-secondary">
            {description}
          </p>
        ) : null}
      </div>

      {undo ? (
        <button
          type="button"
          onClick={() => {
            undo.onUndo();
            onDismiss(id);
          }}
          className={cn(
            "-my-1 shrink-0 rounded-sm px-2 py-1",
            "font-sans text-[12.5px] font-medium text-accent hover:bg-bg-inset",
            "transition-colors duration-cd-fast ease-cd",
            focusRing,
          )}
        >
          {undo.label ?? "Undo"}
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss"
        className={cn(
          "relative -my-1 -mr-1 grid size-6 shrink-0 place-items-center rounded-sm",
          // 32px pointer target without a 32px box: the toast is only 40px
          // tall and a square that size would swallow the row.
          "after:absolute after:left-1/2 after:top-1/2 after:size-8",
          "after:-translate-x-1/2 after:-translate-y-1/2",
          "text-fg-tertiary hover:bg-bg-inset hover:text-fg",
          "transition-colors duration-cd-fast ease-cd",
          focusRing,
        )}
      >
        <X aria-hidden="true" className="size-3.5 [stroke-width:1.7]" />
      </button>
    </div>
  );
}
