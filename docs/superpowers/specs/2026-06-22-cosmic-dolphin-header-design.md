# Cosmic Dolphin Header Design

## Goal

Update the public desktop header to match the provided Craft-style screenshots while using Cosmic Dolphin branding. The header should read as a floating, rounded, translucent navigation bar with the brand on the left, navigation links centered, and authentication actions on the right.

## Context

The desktop header is implemented inline in `apps/web/app/layout.tsx`. It currently shows an emoji dolphin plus the `Cosmic Dolphin` text, optional authenticated app navigation, bookmark/search actions, and `HeaderAuth`. No dedicated web logo image exists under `apps/web/public`.

## Options Considered

1. Use the existing emoji plus text brand.
   - Fastest and uses existing UI, but it does not match the more polished wordmark-like treatment in the screenshots.

2. Add a local CSS wordmark for `Cosmic Dolphin`.
   - Keeps the change self-contained, avoids blocking on a missing asset, and can match the left brand area visually.
   - Recommended for this pass.

3. Add a new image logo asset.
   - Best if a final brand file exists, but no web asset is currently checked in and the user approved proceeding without one.

## Selected Design

Use a `Cosmic Dolphin` text wordmark on the left, styled as the brand mark inside a pill-shaped header. Keep the public navigation links `Product`, `Community`, `Pricing`, and `Download` in the center. Replace the unauthenticated buttons with a plain `Log in` link and a black pill CTA labeled `Try Cosmic Dolphin`.

For unauthenticated desktop pages, the header should visually match the screenshots:

- Floating pill container with a soft translucent light background.
- Large rounded corners with subtle border and shadow.
- Left brand area using Cosmic Dolphin instead of Craft.
- Center nav links with generous spacing.
- Right auth actions with `Log in` and a black rounded CTA.

For authenticated desktop pages, preserve the existing product workflow controls where possible: existing app menu, command trigger, new bookmark button, and profile dropdown should continue to be available. The visual header shell can be updated without removing authenticated controls.

Mobile header behavior remains out of scope for this change unless required by compile errors.

## Data Flow

No data model or API flow changes are required. Authentication state still comes from the existing Supabase server client in `RootLayout`, and `HeaderAuth` remains responsible for authenticated profile handling.

## Testing

Add focused coverage where practical for the public header rendering: verify the unauthenticated action labels and navigation labels are present. Then run the web lint/typecheck or a targeted test command available in the app.

## Verification

After implementation, start the web dev server and inspect the header in a browser at desktop and mobile widths. Confirm the header does not overlap content awkwardly, the CTA text fits, and the public desktop header matches the provided screenshot structure.
