## 2026-05-09 - Semantic Keyboard Shortcut Hints with Safe OS Detection
**Learning:** When implementing client-side OS detection (like `navigator.platform`) for OS-specific keyboard shortcuts (e.g., ⌘ vs Ctrl) in server-side rendered applications like Next.js, doing so directly during render causes SSR hydration mismatches. Additionally, wrapping these hints in semantic `<kbd>` elements enhances both visual distinctiveness and screen reader accessibility.
**Action:** Initialize OS state to `null` and set it inside a `useEffect` hook. Only render the shortcut hint once the OS is determined, and always wrap shortcut keys in `<kbd>` tags for accessibility.
## 2025-06-01 - Add ARIA label to scroll-to-bottom button
**Learning:** Icon-only buttons used for navigation or actions within complex interactive components (like a chat interface) often lack context for screen reader users, making the application less accessible.
**Action:** Always ensure that icon-only `Button` components are accompanied by an `aria-label` attribute describing their specific action to improve accessibility and provide a clear, understandable experience for all users.
