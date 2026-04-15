## 2025-04-15 - OS-Aware Keyboard Shortcuts
**Learning:** Hardcoding keyboard shortcuts (like ⌘) in hints can confuse Windows/Linux users who rely on Ctrl. Using safe client-side OS detection ensures the hint is contextually accurate. Furthermore, `<kbd>` tags provide excellent semantic markup and visual distinctiveness for keyboard shortcut hints within UI components.
**Action:** When adding shortcut hints to UI components, implement a simple client-side check (`navigator.platform`) to display OS-appropriate modifier keys (e.g., ⌘ vs Ctrl) and wrap them in `<kbd>` elements.
