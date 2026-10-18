# Cosmic Dolphin mobile

Expo 54 / React Native client using the shared Signal design system and Supabase authentication. The approved mobile prototype is in [`docs/design-system/prototypes/mobile`](../../docs/design-system/prototypes/mobile/); [IMPLEMENTATION.md](./IMPLEMENTATION.md) describes the connected behavior and its limits.

## Development

Use Bun from the monorepo root:

```bash
bun install
bun run apispec:build
bun run dev:mobile
```

Set these public runtime values in `apps/mobile/.env`:

- `EXPO_PUBLIC_API_URL` — API origin, without `/api/v1`; native devices need a reachable host rather than the computer's loopback address.
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

From `apps/mobile`, `bun run ios`, `bun run android`, or `bun run web` launches the relevant client. The native share extension requires a development build; Expo Go does not include the app's custom share extension.

## Quality checks

From `apps/mobile`:

```bash
bun x tsc --noEmit
bun run lint
bun run test -- --runInBand
```

Both clients consume `docs/design-system/tokens.json`. Run `bun run tokens` from the root after changing canonical tokens, and `bun run tokens:check` to verify generated files.

The mobile UI uses the generated `@cosmic-dolphin/api-client` for feed/discovery, digest, collection, reading, profile and conversation services. Existing bookmark/auth adapters remain compatible with offline caching and incoming share intents. API changes start in TypeSpec; generated client files are never hand edited.

Home combines discovery with tag-grouped topics and server-authored digests; Library remains private. Capture retry is held in memory for the session. The reader displays the full Cosmic brief, with the original article opened separately; highlights require the user to paste a passage. Appearance, reading size and topic preferences persist per account on the device. See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for validation results and remaining native-device checks; UI flows were verified with API fixtures rather than a live backend.

## Internal builds

- `bun run build:dev:android`
- `bun run build:dev:ios`
- `eas build --platform android --profile preview --non-interactive`
- `eas build --platform ios --profile preview --non-interactive`

`.github/workflows/deploy-mobile.yml` runs mobile lint/tests before requesting EAS preview builds on pushes to `main`. To build for TestFlight, manually run **Deploy Mobile** on `main` with `destination: testflight`. This schedules an iOS production build with an incremented build number and automatic App Store Connect submission after build success; Apple processing follows upload.

The workflow requires `EXPO_TOKEN`, configured EAS signing credentials and the runtime variables above in the build environment. TestFlight submission uses the App Store Connect API key stored in EAS credentials, rather than a local `.p8` file. App Store release remains a separate action.

If a build was created but automatic submission failed, configure the missing submission credential in EAS, then rerun the workflow with `destination: testflight` and that build's UUID in `ios_build_id`. This retries submission without creating another build.
