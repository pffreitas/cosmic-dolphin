## 2026-04-20 - Adding ARIA labels to Input components
**Learning:** The application uses `<Input>` components without `<Label>` wrappers for authentication and search forms, relying entirely on visual placeholders. This makes these inputs inaccessible to screen readers as placeholders aren't reliably announced.
**Action:** Always ensure `<Input>` fields without explicit `<Label>` elements have an `aria-label` attribute clearly describing their purpose, particularly for standard auth and search forms.
