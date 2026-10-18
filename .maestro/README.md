# OutThere Maestro End-to-End Tests

Lightweight, robust smoke tests covering the app's critical paths using [Maestro](https://maestro.mobile.dev/).

## Flows Included

1. `01-auth-flow.yaml`: Welcome screen entry points, switching between Email Sign In and Sign Up modes.
2. `02-search-flow.yaml`: Navigation to Search, opening search filter bottom sheet, category selection, and typing queries.
3. `03-membership-paywall-flow.yaml`: Navigating to Profile, opening OutThere Pro subscription paywall, checking Pro benefits, and testing status refresh / restore entry points.

## How to Run

### 1. Install Maestro (if not already installed)
```bash
curl -FsSL "https://get.maestro.mobile.dev" | bash
```

### 2. Start the App in an iOS Simulator or Android Emulator
```bash
npm run ios
# or
npm run android
```

### 3. Run the Flows
```bash
npm run test:e2e
# or run a single flow:
maestro test .maestro/01-auth-flow.yaml
```
