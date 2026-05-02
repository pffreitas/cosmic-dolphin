
## 2026-05-02 - Add ARIA Labels and explicit Label associations to inputs
**Learning:** Relying solely on placeholders for form inputs without `aria-label` or explicitly linked `<Label>` elements results in poor screen-reader accessibility, as the placeholder text may not be reliably announced or understood as the field's name.
**Action:** Always ensure that every `<input>` or `<Input>` component has either an associated `<Label htmlFor="id">` (and corresponding `id` on the input) or an explicit `aria-label` attribute if no visible label is present.
