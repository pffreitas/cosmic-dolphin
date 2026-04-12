## 2024-04-12 - Keyboard Shortcut Hints
**Learning:** Users benefit from explicit visual hints for global keyboard shortcuts, but implementing OS-specific hints (like Cmd vs Ctrl) requires careful handling in Next.js to avoid SSR hydration mismatches.
**Action:** Use a `useEffect` hook to detect `navigator.platform` on the client side, defaulting to a generic or empty state on the server, to safely render OS-specific keyboard shortcut hints.
