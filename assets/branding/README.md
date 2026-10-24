# Cosmic Dolphin — Plum shadow production assets

The selected teal dolphin, luminous violet orbit, and guiding star sit on a
purple-black gradient in **both** application themes. The wordmark is white
Inter. This selection supersedes the earlier light recoloring and flat navy
studies; those files remain explorations rather than production references.

The 125-degree background uses #34162F at 0%, #160D1B at 48%, and #050509 at
100%, with a #49273E edge and #F4F3FC lettering. Canonical values live in
`docs/design-system/tokens.json`; `brand-style.json` is a generated export.

| Placement | Production asset | Notes |
| --- | --- | --- |
| Source artwork | `cosmic-dolphin-master.png` | Transparent source; keep unchanged |
| Full signature | `header-capsule.png` | Transparent corners, complete gradient capsule |
| Compact mark | `brand-tile.png` | 256px gradient tile with transparent corners |
| Launcher | `icon.png` | Opaque 1024px square; let the OS apply its mask |
| Adaptive background | `adaptive-background.png` | 1024px gradient, same size as foreground |
| Adaptive foreground | `adaptive-foreground.png` | Transparent, padded inside Android's safe zone |
| Favicon | `favicon.png` | 64px Plum shadow launcher mark |
| Native launch logo | `splash-plaque.png` | 800 × 860 plaque with transparent corners |
| Full splash | `splash-light.png`, `splash-dark.png` | 1290 × 2796; plaque on each system surface |

`icon-light.png` / `icon-dark.png`, `header-light.png` / `header-dark.png`, and
`splash-brand-light.png` / `splash-brand-dark.png` are compatibility aliases:
the branding is intentionally identical in both themes. The outer splash
surface follows system appearance before app preferences can load.

Web headers, sidebar, auth/reset screens, and footer share `Brandmark`. Narrow
public headers switch to a 44px compact tile; compact logged-in toolbars and
marketing marks use `LogoMark`. Both retain accessible names and focus rings.
Mobile top bars and sign-in/sign-up use `BrandSignature`; `BrandMark` is the
compact tile. Mobile uses bundled gradient pixels, so no extra native gradient
dependency or network image is needed. User font scaling remains enabled.

Open `preview.html` for production placement assets in both themes. The
`*-study.html` files retain earlier interactive design explorations.

## Regenerate

From the repository root: `bun run tokens`, then `bun run brand:generate`.
The generator uses Sharp from the existing mobile dependencies and the bundled
Inter font. It synchronizes Expo input assets, the committed Android density
resources, iOS asset catalogs, and web branding/favicon assets.

Native launcher and splash changes require a new native build/install and are
not delivered by an OTA update. The existing Android full-screen overlay is
preserved; keep that customization if regenerating native projects. iOS device
appearance needs a native device/simulator check on macOS.
