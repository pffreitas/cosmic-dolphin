# Gargantua Ring — approved v0 master

The five artwork files in this directory form the approved flat identity. Use the [client identity standards](../surface-guide.pdf) for placement and reproduction.

Rebuilt from the hand-edited reference (`reference/ring-colour-ref.svg`) with exact geometry.

| File | Use |
| --- | --- |
| `gargantua-colour.svg` | Master: violet→cyan gradient, transparent background |
| `gargantua-colour-on-plum.svg` | Same on the Plum shadow background |
| `gargantua-mono.svg` | One colour, `currentColor` (web) |
| `gargantua-charcoal.svg` / `gargantua-white.svg` | One colour, fixed |
| `construction.svg` | Guides: both circles, the band and its edges, every spike primitive with its Bézier handles |
| `preview/` | PNG previews, the construction sheet, and the new outline over the reference |

Each SVG has two paths, `#black-hole` and `#dolphin`, inside `#mark`.

## Construction

- **Ring:** two true circles fitted to the traced ring. The centre is (392.3, 396.9), the outer radius 295.7 and the inner radius 231.
- **Band:** one straight strip at 30°, 10 units wide, 34 units below-right of the ring centre. It cuts the ring on both sides and runs along every straight spike edge, so they are all exactly collinear.
- **Spikes:** point-symmetric across the band.
  - On each side, a flare sits on one side of the band.
  - A short needle sits on the other side, and its straight edge carries on through the ring as a fine needle that ends at the centre.
  - Every flare and outer-needle curve leaves the outer circle tangentially (G1) and lands on the band edge in a sharp point.
- **Dolphin:** unchanged from the reference, except its tail tip now stops at the band's upper edge.
  - The ring and spikes keep a 16-unit clearance from the dolphin.

## Regenerate or tweak

```
PAPER_DIR=<dir with node_modules/paper@0.12.18 + paperjs-offset@1.0.8> node docs/design-system/logo-study/ring-gargantua/build.mjs
```

All parameters are at the top of `build.mjs` (radii, band angle, offset and width, and each spike's tip distance, base angle and handles). You can also override them inline, for example `P_flare_tip=480 P_g=8`.
