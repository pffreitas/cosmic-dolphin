## 2026-05-09 - Semantic Keyboard Shortcut Hints with Safe OS Detection
**Learning:** When implementing client-side OS detection (like `navigator.platform`) for OS-specific keyboard shortcuts (e.g., ⌘ vs Ctrl) in server-side rendered applications like Next.js, doing so directly during render causes SSR hydration mismatches. Additionally, wrapping these hints in semantic `<kbd>` elements enhances both visual distinctiveness and screen reader accessibility.
**Action:** Initialize OS state to `null` and set it inside a `useEffect` hook. Only render the shortcut hint once the OS is determined, and always wrap shortcut keys in `<kbd>` tags for accessibility.

## 2024-05-20 - Adding Loading States to Next.js Server Action Forms
**Learning:** When using Next.js Server Actions in forms, standard `<button type="submit">` elements provide no feedback during async operations, leading to user confusion or potential double submissions.
**Action:** Abstract form submit buttons into client components that utilize `useFormStatus` from `react-dom` to automatically show a disabled loading state (e.g., a spinner) while the action is pending.
