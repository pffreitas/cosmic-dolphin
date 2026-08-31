import * as React from "react";
import { Check, RotateCw, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Staged AI progress — see docs/design-system/patterns.md#staged-ai-progress.
 *
 * Reads `bookmark_processing_events` and shows one line per phase. The row
 * exists the instant a URL is submitted, inside a real feed or library item —
 * never a full-screen spinner, never a blocking modal, never a progress bar
 * with a fake percentage.
 *
 * Phase changes announce once through a polite live region. The visual list is
 * a plain `<ol>` so a screen reader can also read the whole checklist on
 * demand; the live region carries only the one line that changed, so a phase
 * transition is announced once rather than four times.
 */

/**
 * The phase vocabulary from docs/functional-spec/03-ai-pipeline.md. `embed`
 * runs but is deliberately absent: it has no user-legible output and showing it
 * would pad the list with noise.
 *
 * Labels are user-facing and past/present tense, never internal names.
 */
export const PROCESSING_PHASE_LABELS = {
  fetch: "Fetched page",
  extract: "Extracted content",
  summarise: "Summarising…",
  tag: "Tagging",
  file: "Filing into a collection",
} as const;

export type ProcessingPhase = keyof typeof PROCESSING_PHASE_LABELS;

export type ProcessingStepState = "done" | "active" | "pending" | "failed";

export interface ProcessingStep {
  phase: ProcessingPhase;
  state: ProcessingStepState;
  /** Overrides the phase's default label. Rarely needed. */
  label?: React.ReactNode;
  /** Why the phase failed, in one clause. Shown after the label. */
  error?: React.ReactNode;
}

export interface ProcessingStepsProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onError"> {
  steps: ProcessingStep[];
  /**
   * Starts a fresh run for the failed phase (`POST /bookmarks/{id}/reprocess`).
   * Without it the failed line still renders, just without the Retry button.
   */
  onRetry?: (phase: ProcessingPhase) => void;
  retryLabel?: string;
  /**
   * Names the item in the live announcement, so a screen reader knows which
   * row moved when several are processing at once.
   */
  announceLabel?: string;
}

function Marker({ state }: { state: ProcessingStepState }) {
  const base = "grid size-3.5 shrink-0 place-items-center rounded-pill border-[1.5px]";

  if (state === "done") {
    return (
      <span
        aria-hidden="true"
        className={cn(
          base,
          "border-[color:var(--cd-success)] bg-[color:var(--cd-success)] text-[color:var(--cd-bg)]",
        )}
      >
        <Check className="size-2.5 [stroke-width:3]" />
      </span>
    );
  }

  if (state === "failed") {
    return (
      <span
        aria-hidden="true"
        className={cn(
          base,
          "border-[color:var(--cd-danger)] bg-[color:var(--cd-danger)] text-[color:var(--cd-bg)]",
        )}
      >
        <X className="size-2.5 [stroke-width:3]" />
      </span>
    );
  }

  if (state === "active") {
    return (
      <span
        aria-hidden="true"
        className={cn(
          base,
          "border-accent border-r-transparent animate-spin",
          // Reduced motion keeps the ring whole and dims it rather than
          // spinning: the line is still legibly "the one in flight".
          "motion-reduce:animate-none motion-reduce:border-r-accent motion-reduce:opacity-60",
        )}
      />
    );
  }

  return (
    <span aria-hidden="true" className={cn(base, "border-line-strong")} />
  );
}

const STATE_TEXT: Record<ProcessingStepState, string> = {
  done: "text-fg-secondary",
  active: "text-fg",
  pending: "text-fg-tertiary",
  failed: "text-[color:var(--cd-danger)]",
};

const ProcessingSteps = React.forwardRef<HTMLDivElement, ProcessingStepsProps>(
  (
    { className, steps, onRetry, retryLabel = "Retry", announceLabel, ...props },
    ref,
  ) => {
    const failed = steps.find((step) => step.state === "failed");
    const active = steps.find((step) => step.state === "active");

    const subject = announceLabel ? `${announceLabel}: ` : "";
    let announcement = "";
    if (failed) {
      const label = failed.label ?? PROCESSING_PHASE_LABELS[failed.phase];
      announcement = `${subject}${label} failed.`;
    } else if (active) {
      const label = active.label ?? PROCESSING_PHASE_LABELS[active.phase];
      announcement = `${subject}${label}`;
    } else if (steps.length > 0 && steps.every((step) => step.state === "done")) {
      announcement = `${subject}Processing finished.`;
    }

    return (
      <div ref={ref} className={cn("min-w-0", className)} {...props}>
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
        <ol className="m-0 flex list-none flex-col gap-[9px] p-0">
          {steps.map((step) => (
            <li
              key={step.phase}
              className={cn(
                "flex min-w-0 flex-wrap items-center gap-[9px]",
                "font-sans text-[13px] leading-[1.4]",
                STATE_TEXT[step.state],
              )}
            >
              <Marker state={step.state} />
              <span className="min-w-0">
                {step.label ?? PROCESSING_PHASE_LABELS[step.phase]}
                {step.error ? (
                  <span className="text-fg-secondary"> — {step.error}</span>
                ) : null}
              </span>
              {step.state === "failed" && onRetry ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="px-2"
                  icon={<RotateCw aria-hidden="true" />}
                  onClick={() => onRetry(step.phase)}
                >
                  {retryLabel}
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    );
  },
);
ProcessingSteps.displayName = "ProcessingSteps";

export { ProcessingSteps };
