# Cosmic Dolphin mobile

Expo 54 / React Native client using generated design tokens, the approved mobile Plum palette and Supabase authentication. [Save + Today's 5](../../docs/specs/mobile-reading-app/2026-11-09-save-and-todays-5.md) and its [prototype](../../docs/specs/mobile-reading-app/2026-11-09-save-and-todays-5/prototype.html) define the shipped scope. [IMPLEMENTATION.md](./IMPLEMENTATION.md) describes connected behavior and proof limits; older prototypes remain exploration records.

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

From `apps/mobile`, `bun run ios` and `bun run android` build/install the native development client; `bun run web` starts the web target. In T3, use its device tools and bound command for UI interaction and never reuse another agent's device claim. The native share extension requires a development build; Expo Go does not include the custom native module/extension. Maintain committed native projects in place; do not run `expo prebuild --clean`.

## Quality checks

From `apps/mobile`:

```bash
bun x tsc --noEmit
bun run lint
bun run test -- --runInBand
```

Both clients consume `docs/design-system/tokens.json`; `color.mobile` supplies the approved mobile overrides. Run `bun run tokens` from the root after changing canonical tokens, and `bun run tokens:check` to verify generated files. Never hand-edit the generated theme or change web colors as a side effect of mobile work.

The mobile UI uses the generated `@cosmic-dolphin/api-client` for feed/discovery, digest, collection, reading, profile and conversation services. Existing bookmark/auth adapters remain compatible with offline caching and incoming share intents. API changes start in TypeSpec; generated client files are never hand edited.

Home puts pending captures above the server's immutable daily picks, with Done, Later and Next pick, while retaining existing feed scopes/discovery and Continue reading. Library remains private. Captures are persisted before transport and replay only for their owning account; latest confirmation edits remain durable through acknowledgement. Ordinary reading actions roll back on offline failure rather than entering a durable queue.

The owner reader offers Brief and Read: extracted stored article text, truthful truncation within the serialized response ceiling, and an explicit Original action. It supports private notes and pasted-text extraction recovery. Public-slug reading stays separate from owner endpoints/caches. Appearance, reading size and topic preferences persist per account on the device. Provider, form and sheet state must all be scoped by account, including stale completions. See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for the integration boundaries and remaining native/session/accessibility beta checks.

## Internal builds

- `bun run build:dev:android`
- `bun run build:dev:ios`
- `eas build --platform android --profile preview --non-interactive`
- `eas build --platform ios --profile preview --non-interactive`

`.github/workflows/deploy-mobile.yml` runs mobile lint/tests before requesting EAS preview builds on pushes to `main`. To build for TestFlight, manually run **Deploy Mobile** on `main` with `destination: testflight`. This schedules an iOS production build with an incremented build number and automatic App Store Connect submission after build success; Apple processing follows upload.

The workflow requires `EXPO_TOKEN`, configured EAS signing credentials and the runtime variables above in the build environment. TestFlight submission uses the App Store Connect API key stored in EAS credentials, rather than a local `.p8` file. App Store release remains a separate action.

If a build was created but automatic submission failed, configure the missing submission credential in EAS, then rerun the workflow with `destination: testflight` and that build's UUID in `ios_build_id`. This retries submission without creating another build.

## Release verification

Follow the [backend/TestFlight runbook](../../docs/runbooks/backend-and-testflight-release.md) before release. A mobile scheduling job or EAS upload alone does not prove TestFlight availability: verify the deployed backend head, production STORE build, submission, Apple processing/compliance and intended beta-group assignment. Committed native projects can ignore `app.json` declarations, so verify the signed host configuration too.

Last verified release (2026-11-12): **1.0.0 (15)** at `10e8ad56de7643fb404ca655c52a7cbab257e819`, available to the existing internal Beta group. Backend [43137645677](https://github.com/pffreitas/cosmic-dolphin/actions/runs/43137645677) and production mobile [43139079920](https://github.com/pffreitas/cosmic-dolphin/actions/runs/43139079920) succeeded. Apple reported VALID / IN_BETA_TESTING after the existing encryption declaration was applied. This historical result does not grant future releases or certify the outstanding beta validations. See the [retrospective](../../docs/retrospectives/2026-11-12-save-and-todays-5.md).
