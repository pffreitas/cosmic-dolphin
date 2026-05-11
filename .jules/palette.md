## 2026-05-09 - Semantic Keyboard Shortcut Hints with Safe OS Detection
**Learning:** When implementing client-side OS detection (like `navigator.platform`) for OS-specific keyboard shortcuts (e.g., ⌘ vs Ctrl) in server-side rendered applications like Next.js, doing so directly during render causes SSR hydration mismatches. Additionally, wrapping these hints in semantic `<kbd>` elements enhances both visual distinctiveness and screen reader accessibility.
**Action:** Initialize OS state to `null` and set it inside a `useEffect` hook. Only render the shortcut hint once the OS is determined, and always wrap shortcut keys in `<kbd>` tags for accessibility.

## 2026-05-11 - Add Keyboard Shortcut Hint to Primary Action Buttons
**Learning:** Users often don't realize there are keyboard shortcuts for primary actions (like 'Save Bookmark') unless they are explicitly displayed. However, these shortcuts need to be conditionally rendered after SSR to prevent hydration errors and use semantic HTML.
**Action:** Add visual keyboard shortcut hints (using `<kbd>` tags) directly inside the primary action buttons, conditionally checking `isMac` state after mounting, similar to how the search dialog trigger does it.
