# Prototypes

`index.html` is a single self-contained file — no build step. Open it directly:

```bash
open docs/design-system/prototypes/index.html
```

It renders the foundations, the component set, and the three screens (Home, Library, Bookmark
detail) with a light/dark toggle in the header.

**Signal is the adopted direction and the default.** The header also switches to Ember and Graphite,
the two directions that were explored and rejected; they remain as a record of the exploration and
as a way to see why Signal was chosen. Their token files sit in `alternates/`.

Nothing in Ember or Graphite mode is specification. Only Signal is — see
[`../tokens.json`](../tokens.json) and the documents in the parent directory.
