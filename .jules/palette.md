## 2026-05-09 - Semantic Keyboard Shortcut Hints with Safe OS Detection
**Learning:** When implementing client-side OS detection (like `navigator.platform`) for OS-specific keyboard shortcuts (e.g., ⌘ vs Ctrl) in server-side rendered applications like Next.js, doing so directly during render causes SSR hydration mismatches. Additionally, wrapping these hints in semantic `<kbd>` elements enhances both visual distinctiveness and screen reader accessibility.
**Action:** Initialize OS state to `null` and set it inside a `useEffect` hook. Only render the shortcut hint once the OS is determined, and always wrap shortcut keys in `<kbd>` tags for accessibility.
## 2025-06-08 - Keyboard Shortcut Tooltips
**Learning:** Users often miss keyboard shortcuts. Adding a tooltip that conditionally displays the correct OS shortcut (⌘ vs Ctrl) improves discoverability without cluttering the UI, and React's hydration requires careful `isMac` state initialization on mount.
**Action:** When adding global keyboard shortcuts to primary actions, always provide a tooltip hint displaying the correct OS-specific key combination.
