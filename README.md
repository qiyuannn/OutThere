# OutThere

An Expo 57 / React Native / TypeScript app for real-world discovery.

## Run locally

Requires Node 22.13 or later and npm.

```sh
npm ci
npm run web
```

The foundation runs without service credentials. Discover, Saved, Rankings, Friends,
and Profile are navigable shells; venue discovery, authentication, and rewards are
subsequent features. Existing launcher/splash artwork is still Expo starter artwork.

## Connect Supabase

Copy `.env.example` to `.env.local`, then set your project's URL and publishable key.
Restart Metro after changing environment variables. The client is exported from
`src/lib/supabase.ts`; it is `null` when configuration is missing or the URL is invalid.
Configuration does not prove connectivity. No remote project, schema, or account has
been created, and no live connection has been verified yet.

Use only a publishable key in the app. Privileged credentials and third-party API
secrets belong on the server. Database tables must have appropriate Row Level
Security policies before they are exposed to clients. Native auth persistence and
foreground token refresh are wired for the authentication feature.

## Development builds

`expo-dev-client` and EAS profiles are configured. For local builds, install the
native toolchain (Xcode on macOS for iOS, Android Studio/JDK for Android), then run:

```sh
npm run ios
npm run android
```

For EAS builds, sign in with `npx eas-cli login`, link your team's project with
`npx eas-cli init`, then run one of:

```sh
npm run build:development:android
npm run build:development:ios
npx eas-cli build --profile development-simulator --platform ios
```

The bundle/package identifier `com.outthere.app` is provisional; confirm ownership
before registering a release app. Physical iOS distribution needs Apple signing
and registered devices. Once installed, use `npm run dev` to serve the app.
No cloud build or signing credentials have been created as part of this foundation.

## Project structure

- `src/app`: Expo Router routes; keep screen-specific behavior here.
- `src/components/foundation.tsx`: shared Screen, Card, Button, and EmptyState.
- `src/components/navigation-tabs.tsx`: shared tab navigator for native and web.
- `src/constants/theme.ts`: light/dark colors, typography, spacing.
- `src/lib`: backend clients and shared service integrations.
- `src/providers`: application lifecycle integrations.

Use theme tokens and shared components when adding screens. Import navigation APIs
from `expo-router` (Expo 57), not external React Navigation packages.

## Validation

```sh
npm run typecheck
npx expo install --check
npx expo export --platform web
```

Before merging navigation changes, open all five tabs, use the Discover/Saved
buttons, reload a deep link, and check light/dark mode and narrow screen layouts.
Native camera, location, and signing must be tested on devices when implemented.
