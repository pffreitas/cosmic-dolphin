"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { focusRing } from "./focus-ring";

/**
 * Segmented control — see docs/design-system/components.md#segmented-control.
 *
 * The one place a pill *container* is allowed. Trough `--cd-bg-inset` with 3px
 * padding; the selected segment gets `--cd-bg-panel` and a 1px shadow (in dark
 * mode, `--cd-border-strong` and no shadow).
 *
 * Two to four mutually exclusive options, always with a default selected. More
 * than four is a `Select`, not a segmented control.
 *
 * This is a real radiogroup, not a row of buttons: `role="radiogroup"` on the
 * trough, `role="radio"` + `aria-checked` on the segments, one tab stop for the
 * whole group (roving tabindex), and arrow keys move *and* select — which is
 * what the WAI-ARIA radio pattern specifies and what screen-reader users
 * expect.
 *
 *   <Segmented value={scope} onValueChange={setScope} aria-label="Feed scope">
 *     <SegmentedItem value="for-you">For you</SegmentedItem>
 *     <SegmentedItem value="following">Following</SegmentedItem>
 *     <SegmentedItem value="unread">Unread</SegmentedItem>
 *   </Segmented>
 */
type SegmentedContextValue = {
  value: string | undefined;
  select: (value: string) => void;
};

const SegmentedContext = React.createContext<SegmentedContextValue | null>(null);

function useSegmented(component: string) {
  const context = React.useContext(SegmentedContext);
  if (!context) {
    throw new Error(`<${component}> must be rendered inside a <Segmented>.`);
  }
  return context;
}

export interface SegmentedProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  /** Controlled selection. */
  value?: string;
  /** Uncontrolled starting selection. A segmented control is never empty. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

const Segmented = React.forwardRef<HTMLDivElement, SegmentedProps>(
  (
    { className, value, defaultValue, onValueChange, onKeyDown, ...props },
    forwardedRef,
  ) => {
    const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
    const isControlled = value !== undefined;
    const current = isControlled ? value : uncontrolled;

    const groupRef = React.useRef<HTMLDivElement | null>(null);
    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        groupRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );

    const select = React.useCallback(
      (next: string) => {
        if (!isControlled) setUncontrolled(next);
        onValueChange?.(next);
      },
      [isControlled, onValueChange],
    );

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;

      const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
      if (!keys.includes(event.key)) return;

      const radios = Array.from(
        groupRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="radio"]:not([disabled])',
        ) ?? [],
      );
      if (radios.length === 0) return;

      const activeIndex = radios.findIndex(
        (radio) => radio === document.activeElement,
      );
      const from = activeIndex === -1 ? 0 : activeIndex;

      let nextIndex: number;
      switch (event.key) {
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = radios.length - 1;
          break;
        case "ArrowRight":
        case "ArrowDown":
          nextIndex = (from + 1) % radios.length;
          break;
        default:
          nextIndex = (from - 1 + radios.length) % radios.length;
      }

      event.preventDefault();
      const target = radios[nextIndex];
      target.focus();
      // The radio pattern selects on arrow, it does not merely move focus.
      const nextValue = target.dataset.value;
      if (nextValue !== undefined) select(nextValue);
    };

    return (
      <SegmentedContext.Provider value={{ value: current, select }}>
        <div
          ref={setRefs}
          role="radiogroup"
          onKeyDown={handleKeyDown}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-pill bg-bg-inset p-[3px]",
            className,
          )}
          {...props}
        />
      </SegmentedContext.Provider>
    );
  },
);
Segmented.displayName = "Segmented";

export interface SegmentedItemProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  value: string;
}

const SegmentedItem = React.forwardRef<HTMLButtonElement, SegmentedItemProps>(
  ({ className, value, onClick, ...props }, ref) => {
    const { value: selected, select } = useSegmented("SegmentedItem");
    const checked = selected === value;

    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={checked}
        // Roving tabindex: the group is a single tab stop. A segmented control
        // always ships a default selection; if one is somehow missing, fall
        // back to every segment being tabbable rather than a keyboard trap.
        tabIndex={checked || selected === undefined ? 0 : -1}
        data-value={value}
        data-state={checked ? "checked" : "unchecked"}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) select(value);
        }}
        className={cn(
          "inline-flex h-8 min-w-[64px] items-center justify-center rounded-pill px-3",
          "font-sans text-[12.5px] font-medium leading-none",
          "transition-colors duration-cd-fast ease-cd",
          "text-fg-secondary hover:text-fg",
          "disabled:cursor-not-allowed disabled:opacity-45",
          // Selected: panel fill plus a 1px shadow in light, a border in dark.
          "data-[state=checked]:bg-bg-panel data-[state=checked]:text-fg",
          "data-[state=checked]:shadow-sm",
          "dark:data-[state=checked]:shadow-[inset_0_0_0_1px_var(--cd-border-strong)]",
          focusRing,
          className,
        )}
        {...props}
      />
    );
  },
);
SegmentedItem.displayName = "SegmentedItem";

export { Segmented, SegmentedItem };
