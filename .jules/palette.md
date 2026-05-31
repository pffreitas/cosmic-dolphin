## 2026-05-09 - Semantic Keyboard Shortcut Hints with Safe OS Detection
**Learning:** When implementing client-side OS detection (like `navigator.platform`) for OS-specific keyboard shortcuts (e.g., ⌘ vs Ctrl) in server-side rendered applications like Next.js, doing so directly during render causes SSR hydration mismatches. Additionally, wrapping these hints in semantic `<kbd>` elements enhances both visual distinctiveness and screen reader accessibility.
**Action:** Initialize OS state to `null` and set it inside a `useEffect` hook. Only render the shortcut hint once the OS is determined, and always wrap shortcut keys in `<kbd>` tags for accessibility.

## 2024-10-18 - Cross-Platform Keyboard Shortcuts and Discoverability
**Learning:** Using only `event.metaKey` for keyboard shortcuts limits accessibility by breaking functionality on Windows/Linux devices, which expect `event.ctrlKey`. Furthermore, hidden global shortcuts reduce discoverability; primary action buttons should expose these shortcuts visually to the user.
**Action:** Always check `(event.metaKey || event.ctrlKey)` in keyboard event listeners for cross-platform support, and use a `TooltipProvider` to display conditionally rendered, OS-aware shortcut hints (`⌘` vs `Ctrl`) inside semantic `<kbd>` tags on the respective buttons.
