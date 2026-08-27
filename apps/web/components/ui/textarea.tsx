import * as React from "react";

import { cn } from "@/lib/utils";
import { fieldSurface } from "./input";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        fieldSurface,
        "flex min-h-[60px] resize-y px-3 py-2.5 leading-[1.55]",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
