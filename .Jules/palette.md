## 2026-05-03 - Added ARIA labels to Profile Dropdown Buttons
**Learning:** Avatar-based profile menu triggers are often missing accessible names, leading to silent or confusing screen reader announcements.
**Action:** Add `aria-label="Open profile menu"` to any icon-only or avatar-only dropdown triggers to improve keyboard and screen reader accessibility.

## 2024-05-18 - Improve URL input and form submission in the Add Bookmark modal
**Learning:** Having an input field with just 'Enter' to submit is an accessibility barrier for mobile users and screen readers. Wrapping inputs in a `<form>` tags helps trigger mobile keyboards submit buttons, and having a visible submit button ensures the action is always discoverable.
**Action:** Always wrap inputs that submit data in a `<form>` and provide a visible submit button with proper `aria-labels` and `type="submit"` to ensure full accessibility across devices.
