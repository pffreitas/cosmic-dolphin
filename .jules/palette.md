## 2026-05-09 - Semantic Keyboard Shortcut Hints with Safe OS Detection
**Learning:** When implementing client-side OS detection (like `navigator.platform`) for OS-specific keyboard shortcuts (e.g., ⌘ vs Ctrl) in server-side rendered applications like Next.js, doing so directly during render causes SSR hydration mismatches. Additionally, wrapping these hints in semantic `<kbd>` elements enhances both visual distinctiveness and screen reader accessibility.
**Action:** Initialize OS state to `null` and set it inside a `useEffect` hook. Only render the shortcut hint once the OS is determined, and always wrap shortcut keys in `<kbd>` tags for accessibility.

## 2024-05-20 - Cross-Platform Keyboard Shortcuts
**Learning:** Next.js React components need client-side OS detection to show the correct keyboard shortcut keys, but it must be initialized as `null` or `false` and set in a `useEffect` to avoid SSR hydration mismatch errors.
**Action:** Always check `event.metaKey || event.ctrlKey` in keydown listeners for cross-platform support, and use `isMac !== null` state to render `⌘` or `Ctrl` wrapped in semantic `<kbd>` tags.
