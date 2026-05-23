## 2026-05-09 - Semantic Keyboard Shortcut Hints with Safe OS Detection
**Learning:** When implementing client-side OS detection (like `navigator.platform`) for OS-specific keyboard shortcuts (e.g., ⌘ vs Ctrl) in server-side rendered applications like Next.js, doing so directly during render causes SSR hydration mismatches. Additionally, wrapping these hints in semantic `<kbd>` elements enhances both visual distinctiveness and screen reader accessibility.
**Action:** Initialize OS state to `null` and set it inside a `useEffect` hook. Only render the shortcut hint once the OS is determined, and always wrap shortcut keys in `<kbd>` tags for accessibility.

## 2024-05-18 - Cross-Platform Keyboard Shortcut Accessibility
**Learning:** When implementing global keyboard shortcuts in React components, relying solely on `event.metaKey` excludes Windows and Linux users, reducing accessibility.
**Action:** Always check for `(event.metaKey || event.ctrlKey)` to guarantee cross-platform functionality.
