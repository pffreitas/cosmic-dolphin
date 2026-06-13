## 2026-05-03 - Added ARIA labels to Profile Dropdown Buttons
**Learning:** Avatar-based profile menu triggers are often missing accessible names, leading to silent or confusing screen reader announcements.
**Action:** Add `aria-label="Open profile menu"` to any icon-only or avatar-only dropdown triggers to improve keyboard and screen reader accessibility.

## 2024-06-13 - Cross-Platform Keyboard Shortcuts
**Learning:** Hardcoding `event.metaKey` for keyboard shortcuts excludes Windows/Linux users. Tooltips for global action shortcuts (`Cmd+K`/`Ctrl+K`) drastically improve feature discovery. Conditionally rendering the OS-specific hint (`isMac`) requires initializing to `null` and updating in `useEffect` to prevent React hydration errors.
**Action:** Always check `event.metaKey || event.ctrlKey` for cross-platform support. Ensure global action buttons display their shortcut in an accessible tooltip (`TooltipProvider` + `<kbd>`).
