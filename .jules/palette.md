## 2026-05-09 - Semantic Keyboard Shortcut Hints with Safe OS Detection
**Learning:** When implementing client-side OS detection (like `navigator.platform`) for OS-specific keyboard shortcuts (e.g., ⌘ vs Ctrl) in server-side rendered applications like Next.js, doing so directly during render causes SSR hydration mismatches. Additionally, wrapping these hints in semantic `<kbd>` elements enhances both visual distinctiveness and screen reader accessibility.
**Action:** Initialize OS state to `null` and set it inside a `useEffect` hook. Only render the shortcut hint once the OS is determined, and always wrap shortcut keys in `<kbd>` tags for accessibility.

## 2026-05-21 - Keyboard Shortcut Hints with Tooltips
**Learning:** For floating or persistent primary actions that have global keyboard shortcuts (like "Save Bookmark" triggered by `Cmd/Ctrl+K`), providing a tooltip explicitly detailing the shortcut significantly improves discoverability without cluttering the UI. Users often miss global shortcuts unless visually hinted contextually near the action button.
**Action:** Always provide tooltip hints for primary actions that support keyboard shortcuts. Wrap the button in a `TooltipProvider` and conditionally display the `isMac` specific shortcut key using semantic `<kbd>` tags.
