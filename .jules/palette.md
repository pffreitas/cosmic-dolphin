## 2026-05-09 - Semantic Keyboard Shortcut Hints with Safe OS Detection
**Learning:** When implementing client-side OS detection (like `navigator.platform`) for OS-specific keyboard shortcuts (e.g., ⌘ vs Ctrl) in server-side rendered applications like Next.js, doing so directly during render causes SSR hydration mismatches. Additionally, wrapping these hints in semantic `<kbd>` elements enhances both visual distinctiveness and screen reader accessibility.
**Action:** Initialize OS state to `null` and set it inside a `useEffect` hook. Only render the shortcut hint once the OS is determined, and always wrap shortcut keys in `<kbd>` tags for accessibility.

## 2024-06-09 - Cross-Platform Keyboard Shortcut Tooltips
**Learning:** Keyboard shortcuts that exclusively check `event.metaKey` exclude Windows/Linux users, while hiding the existence of shortcuts in the UI prevents discovery. Primary actions with global shortcuts benefit significantly from conditional, OS-aware tooltip hints.
**Action:** Always verify `(event.metaKey || event.ctrlKey)` for cross-platform support and wrap primary actions in a `TooltipProvider` with a conditionally rendered semantic `<kbd>` hint using `navigator.platform` detection.
