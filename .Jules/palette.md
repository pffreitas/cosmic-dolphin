
## 2026-04-03 - Custom Modal Accessibility
**Learning:** Custom modals (like the new bookmark overlay) require global keydown listeners for Escape since div elements without tabIndex cannot capture keyboard events natively. Click-to-close overlays should also have aria-hidden="true" to prevent screen reader noise.
**Action:** Always implement global Escape listeners and aria-hidden overlays for custom dialogs instead of relying on inline onKeyDown handlers.
