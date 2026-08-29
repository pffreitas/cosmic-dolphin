"use client";

import * as React from "react";
import { type DialogProps } from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { focusRingWithin } from "@/components/ui/focus-ring";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";

/**
 * Command palette — see docs/design-system/components.md#command-palette.
 *
 * `--cd-bg-panel`, `--cd-radius-md`, `--cd-shadow-dialog`, **560px wide,
 * anchored 15vh from the top**. That geometry is the whole reason this file
 * builds on the dialog *primitives* rather than on `DialogContent`: the shared
 * content is a bottom sheet below 640px and a vertically centred panel above
 * it, and a palette is neither. A palette that slides up from the bottom edge
 * of a laptop screen is a sheet, and a palette centred in the viewport puts
 * the field the user is typing into halfway down the page.
 *
 * It also drops `DialogContent`'s close button. A palette closes on Escape, on
 * a click outside, and on picking something; an X in the corner would sit on
 * top of the input.
 */
const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-bg-panel text-fg",
      className
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

interface CommandDialogProps extends DialogProps {
  shouldFilter?: boolean;
  /** Accessible name for the dialog. Rendered for screen readers only. */
  label?: string;
  className?: string;
}

const CommandDialog = ({
  children,
  shouldFilter = true,
  label = "Command palette",
  className,
  ...props
}: CommandDialogProps) => {
  return (
    <Dialog {...props}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-[15vh] z-50 w-[calc(100vw-2rem)] max-w-[560px]",
            "-translate-x-1/2 overflow-hidden rounded-md border border-line",
            "bg-bg-panel text-fg shadow-[var(--cd-shadow-dialog)]",
            "duration-cd ease-cd",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "motion-reduce:animate-none",
            className
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            {label}
          </DialogPrimitive.Title>
          <Command shouldFilter={shouldFilter}>{children}</Command>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
};

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div
    className={cn(
      "flex items-center gap-2.5 border-b border-line px-4",
      focusRingWithin,
    )}
    cmdk-input-wrapper=""
  >
    <Search
      aria-hidden="true"
      className="size-4 shrink-0 text-fg-tertiary [stroke-width:1.8]"
    />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-12 w-full bg-transparent font-sans text-[15px] text-fg outline-none",
        "placeholder:text-fg-tertiary disabled:cursor-not-allowed disabled:opacity-45",
        className
      )}
      {...props}
    />
  </div>
));

CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn(
      // Taller than a plain command list: the palette's saves are the same
      // library rows `/search` renders, and three of those is a screenful.
      "max-h-[min(60vh,480px)] overflow-y-auto overflow-x-hidden overscroll-contain",
      className
    )}
    {...props}
  />
));

CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="px-4 py-8 text-center font-sans text-sm text-fg-secondary"
    {...props}
  />
));

CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-2 text-fg",
      "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2",
      "[&_[cmdk-group-heading]]:font-sans [&_[cmdk-group-heading]]:text-[11px]",
      "[&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase",
      "[&_[cmdk-group-heading]]:tracking-[.08em] [&_[cmdk-group-heading]]:text-fg-tertiary",
      className
    )}
    {...props}
  />
));

CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("h-px bg-line", className)}
    {...props}
  />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2.5 rounded-sm px-2.5 py-2",
      "font-sans text-sm text-fg outline-none",
      "transition-colors duration-cd-fast ease-cd",
      "data-[selected=true]:bg-bg-inset data-[selected=true]:text-fg",
      "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-45",
      "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      className
    )}
    {...props}
  />
));

CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        "ml-auto flex items-center gap-1 font-sans text-xs text-fg-tertiary",
        className
      )}
      {...props}
    />
  );
};
CommandShortcut.displayName = "CommandShortcut";

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
