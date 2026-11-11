import { useState } from "react";
import { useTheme } from "./useTheme";

/** New Architecture outlines sit outside the target, so focus never reflows it. */
export function useControlFocus() {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return {
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    focusStyle: { outlineColor: colors.focus, outlineWidth: focused ? 2 : 0, outlineOffset: 2 },
  };
}
