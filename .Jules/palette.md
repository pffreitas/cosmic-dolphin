## 2026-05-03 - Added ARIA labels to Profile Dropdown Buttons
**Learning:** Avatar-based profile menu triggers are often missing accessible names, leading to silent or confusing screen reader announcements.
**Action:** Add `aria-label="Open profile menu"` to any icon-only or avatar-only dropdown triggers to improve keyboard and screen reader accessibility.
## 2025-01-01 - Added Tooltip Hint for Keyboard Shortcut
**Learning:** Keyboard shortcuts that only rely on `metaKey` (Mac) alienate Windows/Linux users, and hidden shortcuts have poor discoverability.
**Action:** When implementing global shortcuts, check both `metaKey` and `ctrlKey`, and expose the shortcut visually in the UI (e.g., via a Tooltip on the primary action button) showing the OS-appropriate modifier key to improve accessibility.
