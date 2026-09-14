# OutThere

An Expo 57 / React Native / TypeScript app for real-world discovery.

## Run locally

Requires Node 22.13 or later and npm.

```sh
npm ci
npm run web
```

The app opens to authentication. Discover, Search, Saved, Rankings, and Profile
are protected tabs. New users complete profile onboarding before entering them.
Without service credentials the login form displays an unavailable state. Existing launcher/splash artwork is still Expo starter artwork.

## Place search

Search real places by query and area, with category, distance, open-now, price,
rating and sorting filters. Results connect to place details, Saved and Rankings.
See [place-search setup and behaviour](docs/place-search.md) for backend deployment,
Google API requirements, data lifetime, cost limits and testing.

## Connect Supabase

Copy `.env.example` to `.env.local`, then set your project's URL and publishable key.
Restart Metro after changing environment variables. The client is exported from
`src/lib/supabase.ts`; it is `null` when configuration is missing or the URL is invalid.
Apply the SQL migrations in `supabase/migrations` to your Supabase project before
running the app. They configure the discovery tables and private profiles/avatars.

Use only a publishable key in the app. Privileged credentials and third-party API
secrets belong on the server. Database tables must have appropriate Row Level
Security policies before they are exposed to clients. Native auth persistence and
foreground token refresh are managed by the authentication providers.

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

- `src/app`: thin Expo Router entry points and navigation layouts.
- `src/features`: one folder per page/tab; implement screen behavior here.
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

## Authentication (feature 2)

Email/password sign-up, confirmation resend, sign-in, persisted sessions, local
sign-out, and password recovery are implemented. Signed-out users cannot enter
the main tabs. Supabase remains the source of truth for sessions and password
policy; route guards are not a substitute for database Row Level Security.

In Supabase **Authentication → URL Configuration → Redirect URLs**, allow:

- `outthere://auth/callback`
- `http://localhost:8083/auth/callback` (the current authentication preview)
- `http://localhost:8081/auth/callback` (default Expo web port)
- Your exact deployed web origin followed by `/auth/callback`, when deployed.

Add any other local port you actually use, such as 8082. Keep email confirmation
enabled. The default confirmation and recovery email templates must use
`{{ .ConfirmationURL }}` so Supabase verifies the token before redirecting back.
These dashboard settings have not been changed automatically.

Links use PKCE: request and open the link on the same device/browser. A reset
requested in the simulator must be opened in that simulator, not desktop Safari.
Request a new link if it has expired or was opened elsewhere. A reset link can be
opened using Simulator's Safari; for a link received on the Mac, use
`xcrun simctl openurl booted '<full email link>'` locally (do not commit the link).

The local publishable key is in ignored `.env.local`; teammates need their own
local setup. Restart Metro when changing those values. No native dependency was
added for authentication, so an existing development build can load this update.

Run `npm test` for input/error handling and SDK-backed session and recovery tests
with mocked network responses; no emails or real accounts are created by tests.
For live acceptance, create a test account you control, confirm its email, sign in,
restart the app, sign out, then request a reset and choose a new password. Check
that an old/invalid link shows a recoverable error and a signed-out deep link to
`/profile` returns to sign-in. Live email delivery and redirects still require
verification against the configured project.


## Working on pages as a team

```text
src/
  features/
    discover/screen.tsx
    bucket-list/screen.tsx
    rankings/screen.tsx
    friends/screen.tsx
    profile/screen.tsx
    auth/
      account/screen.tsx
      callback/screen.tsx
      reset-password/screen.tsx
      components/auth-field.tsx
  app/                       # Routing entry points only
    (tabs)/
      (discover)/            # Discover remains at /
      bucket-list/
      rankings/
      friends/
      profile/
      explore/               # Existing /explore redirect
    auth/
      index.tsx              # Account screen at /auth
      callback/
      reset-password/
  components/                # UI shared across pages
  hooks/                     # Shared hooks
  constants/                 # Shared theme
  lib/                       # Shared service clients and auth helpers
  providers/                 # Cross-app state and lifecycle
```

Choose a page folder under `src/features` as your working area. Keep its local
components, hooks, services, styles, and tests in that folder; create subfolders
when needed. Files in `src/app` are routes, so do not put ordinary helpers or
components there. Each tab has its own stack for future detail screens.

Suggested ownership: Person 1 owns Discover and Bucket List; Person 2 owns Auth
and backend infrastructure; Person 3 owns Rankings, Friends, and Profile.
Everyone can work on their own feature branch. Coordinate edits to shared
navigation, providers, dependencies, theme, and database contracts to reduce
merge conflicts. Existing public paths and email callback URLs are unchanged.

## Profile and onboarding (feature 3)

`src/features/profile` owns onboarding, profile display/editing, photo handling,
validation, and persistence. `src/providers/profile-provider.tsx` loads the current
user’s profile; tab routing requires completed onboarding while password recovery
remains accessible independently.

The three onboarding steps collect name/unique username/optional bio and photo,
home city and interests, then budget, travel range (1–50 km), and exploration style.
Each successful step is saved to Supabase and resumes after a restart. The profile
page supports editing all fields and removing or replacing the photo. Concurrent
saves from another device show a reload action instead of silently overwriting.

The preferred range initializes Discover. Interests, budget, and exploration style
are stored; recommendation scoring does not yet use those preferences. Home city
is descriptive and does not replace the device location used by Discover.

Migration `20260913010000_add_profiles_and_avatars.sql` creates `profiles` with
per-user read/write policies and a private `avatars` bucket (JPEG, max 2 MB).
Photos are cropped/resized to 512×512 and accessed with expiring signed URLs.
There is no public/social profile access in this feature.

Photo picking adds native dependencies. After `npm ci`, rebuild with `npm run ios`
or `npm run android` once; refreshing an older development build is insufficient.

Acceptance checks: sign in with a test account, save step 1, restart and resume
step 2, complete onboarding, edit your city/range/interests, restart and verify
persistence, replace/remove a photo, and sign out. Verify blank fields, a taken
username, offline save/retry, and concurrent edits. `npm test` covers validation
and auth regressions; database isolation/completion/version checks were also run
against Supabase in a rolled-back transaction with synthetic records.

## RevenueCat membership

Profile → View membership provides lifetime/yearly/monthly purchases, the
RevenueCat Paywall, restore purchases, and Customer Center. `outthere_pro` controls
the membership status. The current Supabase UUID identifies the RevenueCat
customer. Native development builds must be rebuilt for the new SDKs.

See [the step-by-step RevenueCat guide](docs/revenuecat.md) for complete code
examples, public-key configuration, products/offerings, entitlement setup, testing,
and production requirements. The provided key is configured locally for Test
Store only. Dashboard entitlement attachments, published paywall/Customer Center,
and production store keys must be verified before launch.
