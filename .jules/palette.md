
## 2026-04-19 - Client-Side OS Detection for Keyboard Hints
**Learning:** When displaying OS-specific keyboard shortcuts (like `⌘` vs `Ctrl`), relying on `navigator.platform` during initial render causes SSR hydration mismatch errors in Next.js because the server doesn't know the client's OS.
**Action:** Initialize OS-specific hint state to a default or empty value and perform the `navigator.platform` check inside a `useEffect` hook to ensure it only runs on the client. Wrap the keys in semantic `<kbd>` tags.
