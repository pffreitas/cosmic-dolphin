# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
    npx expo start
   ```

## Test, lint, build, and publish commands

From `apps/mobile`:

- Run tests: `npm run test`
- Run lint: `npm run lint`
- Build internal Android dev client: `npm run build:dev:android`
- Build internal iOS dev client: `npm run build:dev:ios`
- Trigger internal preview build manually (Android): `eas build --platform android --profile preview --non-interactive`
- Trigger internal preview build manually (iOS): `eas build --platform ios --profile preview --non-interactive`

This app currently uses EAS Build for continuous delivery of internal binaries. Store submission (`eas submit`) is not part of the default push pipeline.

## CI/CD (push to main)

GitHub Actions workflow: `.github/workflows/deploy-mobile.yml`

Behavior:

- Triggers on pushes to `main` when mobile-relevant paths change.
- Runs quality checks first (`lint` + `test`).
- If checks pass, triggers EAS internal preview builds for both Android and iOS.
- Adds generated build IDs and links to the GitHub workflow job summary.

Required GitHub secret:

- `EXPO_TOKEN`: used by `expo/expo-github-action` to authenticate EAS CLI in CI.

One-time EAS prerequisites:

- Configure iOS and Android signing credentials for non-interactive internal builds.
- Ensure required mobile runtime variables are available in EAS for the build profile/environment:
  - `EXPO_PUBLIC_API_URL`
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Manual rerun:

- Open GitHub Actions and run the **Deploy Mobile (Internal Builds)** workflow via `workflow_dispatch`.

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
