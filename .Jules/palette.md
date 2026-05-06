## 2026-05-06 - Add keyboard shortcut hints with kbd tags
**Learning:** When adding keyboard shortcuts to the UI, explicitly wrapping them in semantic <kbd> tags is critical for screen readers, and client-side OS detection is required to display the correct modifier key (⌘ vs Ctrl) without causing SSR hydration mismatches.
**Action:** Always wrap shortcut indicators like "⌘ /" in <kbd> tags and use useEffect for OS-specific rendering in Next.js.
