## 2024-04-10 - Auth Input ARIA Labels

**Learning:** Inputs without associated labels (relying only on placeholders) are inaccessible to screen readers, and SubmitButtons relying on form contexts that may not exist can lock users out of submitting forms.
**Action:** Always add `aria-label` to standalone inputs and provide default fallbacks for context-dependent UI components.
