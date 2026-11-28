# Milky Way launch

The splash centers the approved flat Gargantua v0 mark on a full-bleed Milky Way star field. The background is original ImageGen artwork. The [background plate](../../../apps/mobile/assets/images/launch/milky-way.webp) contains its generation prompt in XMP. The mark comes from the identity kit.

The native screen shows the mark on Plum. React takes over at the same scale and brings in the bundled sky at 55% opacity over Plum. When the opening route is ready, the mark accelerates toward the viewer while the star field holds. Home starts to appear when the diameter of the opening reaches 85% of the screen diagonal. The exit lasts 640 ms, with the final 192 ms reserved for the reveal. Reduce Motion uses a 150 ms crossfade. Artwork adds no minimum wait.

[Replay the composition](replay.html) with the mobile Home fixture. The browser preview demonstrates the framing and motion. Native cold launch remains to be verified on development builds for iOS and Android.

Run `node apps/mobile/scripts/generate-launch-art.mjs` from the repository root to regenerate the mark assets from the identity kit.

The Milky Way revision passed TypeScript, token lint, all 46 focused mobile tests, and a browser check of both motion modes.
