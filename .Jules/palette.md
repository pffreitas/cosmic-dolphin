
## 2024-05-17 - Missing ARIA labels on placeholder-only inputs
**Learning:** Auth forms often rely solely on placeholders for labels (e.g. `placeholder="Email"`), which is a common accessibility anti-pattern as screen readers may not read them reliably and the context is lost when typing. Also found a placeholder mismatch (`"Username"` for `type="email"`).
**Action:** When working with shadcn `Input` components used without a `<Label>`, always ensure an `aria-label` is present and matches the expected input type to provide accessible names for screen readers.
