# OutThere 🧭


> **OutThere** is a modern mobile platform built with **Expo 57**, **React Native**, and **Supabase** designed to help people get off their phones and explore the physical world. From algorithmic card discovery and bracket-based place rankings to group outing invites, social feeds, and deep taste profile analytics, OutThere reimagines how we discover and share real-world experiences.

---

## 🌟 Table of Contents

- [Core Features](#-core-features)
  - [1. Discovery](#1-discovery)
  - [2. Rankings & Showdown Engine](#2-rankings--showdown-engine)
  - [3. Invite a Friend](#3-invite-a-friend)
  - [4. Social Feed](#4-social-feed)
  - [5. Taste Profile & Analytics](#5-taste-profile--analytics)
  - [6. Universal Search](#6-universal-search)
- [Monetization & OutThere Pro](#-monetization--outthere-pro)
- [Tech Stack](#-tech-stack)
- [Project Architecture](#-project-architecture)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Configuration](#environment-configuration)
  - [Supabase Backend Setup](#supabase-backend-setup)
  - [Running the App](#running-the-app)
- [Testing & Verification](#-testing--verification)
- [Contributing & Team Workflow](#-contributing--team-workflow)

---

## ✨ Core Features

### 1. Discovery
*An intuitive, gesture-driven recommendation deck that brings real-world exploration to your fingertips.*

- **Swipeable Card Decks**: Swipe right to save a venue to your Bucket List, swipe left to pass, or tap to drill into comprehensive place details (photos, hours, pricing, amenities, and contact info).
- **Dual Modes (Activities vs. Food)**: Switch seamlessly between finding thrilling local activities or discovering your next favorite dining spot.
- **Concentric Circle Traversal**: An algorithmic expansion engine that searches surrounding areas in expanding geometric rings, guaranteeing fresh venue candidates without geographic bias or duplicate fatigue.
- **Tiered Recommendation Queues**: Candidates are dynamically sorted into **High**, **Medium**, and **Low** affinity queues based on match percentage, category weights, and your personal taste profile.
- **Daily Discovery Allowance**: Includes an allowance management system with real-time countdowns for free users, alongside an upgrade path to **OutThere Pro** for unlimited daily swipes.

#### 🌐 Concentric Circle Traversal (Hexagonal 7-Circle Flower Tiling)

Standard radius queries to Google Places suffer from **popularity clustering** (downtown venues consume all 20 results) and **duplicate fatigue** (re-querying returns identical spots). OutThere solves this by tessellating the user's chosen radius $R$ into **7 overlapping geodesic circles**—a central hub surrounded by a **6-petal hexagonal flower**:

```text
                  [ Circle 1 ]
                     0° (N)
                       ▲
                       │
      [ Circle 6 ]     │     [ Circle 2 ]
        300° (NW) ↖    │    ↗  60° (NE)
                    ┌─────┐
                    │ Cir │
    ────────────────│  0  │────────────────
                    │ Hub │
        240° (SW) ↙ └─────┘ ↘  120° (SE)
      [ Circle 5 ]     │     [ Circle 3 ]
                       │
                       ▼
                  [ Circle 4 ]
                    180° (S)
```

##### Geodesic Mathematics & Parameters:

| Parameter | Value / Formula | Description |
| :--- | :--- | :--- |
| **Total Circles** | `TOTAL_SEARCH_CIRCLES = 7` | 1 central hub (`Circle 0`) + 6 outer satellite petals (`Circles 1–6`) |
| **Satellite Offset Distance** | $d = 0.54 \times R$ | Distance from user GPS coordinates to satellite circle centers |
| **Sub-Circle Search Radius** | $r = 0.48 \times R$ | Radius of each individual search query |
| **Angular Bearing Step** | $\Delta\theta = 60^\circ$ | Bearing increments: $0^\circ$ (N), $60^\circ$ (NE), $120^\circ$ (SE), $180^\circ$ (S), $240^\circ$ (SW), $300^\circ$ (NW) |

*Why $d = 0.54R$ and $r = 0.48R$?* In geometric circle-packing theory, these ratios achieve **optimal boundary coverage** across the parent radius $R$. The controlled overlap eliminates coverage blind spots while preventing redundant, costly API queries over identical territory.

##### Traversal Lifecycle:
1. **Immediate Vicinity (Circle 0)**: Always visited first ($d = 0$). Guarantees the user's very first swipe cards are within immediate walking or neighborhood distance.
2. **Replenishment Trigger (`shouldReplenish`)**: As cards are swiped, replenishment fires automatically whenever the `high` preference queue empties or total available cards drop to $\le 2$.
3. **Randomized Traversal Without Replacement**:
   Outer circles (`1` through `6`) are chosen **randomly without replacement** using `pickNextCircle(unvisitedCircles)`. This avoids directional bias (e.g. always querying North first) and makes exploration feel organic and varied.
4. **Feed Exhaustion Guarantee**:
   The feed is marked exhausted only when **all 7 circles** have been searched and all queues are empty, giving users confidence that the entire zone has been thoroughly uncovered before prompting them to adjust the radius slider.

#### 🔄 The Discovery Fetch Process (Google Places API Integration)

OutThere's recommendation engine combines device geolocation, user taste weights, and the **Google Places API (New)** via a secure Supabase Edge Function (`place-recommendations`):

```text
[ Mobile App ] ──( 1. Coords, Mode, Radius, Circle Index )──► [ Supabase Edge Function ]
                                                                       │
             ┌─────────────────────────────────────────────────────────┤
             ▼                                                         ▼
  ( 2. History & Taste Weights )                         ( 3. Geometric Ring Center )
  • Fetch saved & passed place IDs                       • Compute sub-circle geometry
  • Load user category weights                           • Partition search into 3 tiers
             │                                                         │
             └─────────────────────────┬───────────────────────────────┘
                                       │
                                       ▼
                   ( 4. Parallel Google Places API Calls )
                   • High Tier: Favorite user place types
                   • Med Tier: Neutral / exploratory types
                   • Low Tier: Broad discovery types
                                       │
             ┌─────────────────────────┴───────────────────────────────┐
             ▼                                                         ▼
  ( 5. Local DB Caching )                                 ( 6. Enrichment & Media )
  • Upsert places to Supabase DB                          • Resolve Google photo media URIs
  • Prevent redundant external API calls                  • Compute match % from taste weights
             │                                                         │
             └─────────────────────────┬───────────────────────────────┘
                                       │
                                       ▼
[ Mobile App ] ◄──( 7. High / Med / Low Recommendation Queues )────────┘
```

1. **Client Coordinate Acquisition**: The app requests foreground GPS permissions and snaps coordinates to a privacy-friendly precision before sending them alongside the active exploration mode (`food` vs `activities`), radius (1–50 km), and current `circleIndex`.
2. **Server-Side Authorization & History Lookup**: The Edge Function validates the caller's JWT and queries Supabase Postgres for:
   - Previously **saved** and **passed** place IDs (to prevent showing repeats).
   - The user's **taste category weights** (`user_food_category_weights` or `user_activity_category_weights`).
3. **Taste-Weighted Tier Partitioning**: Categories are classified into three search tiers based on personal weights:
   - **High Tier**: High-affinity venue types tailored to personal tastes.
   - **Medium Tier**: Balanced, popular genres for reliable variety.
   - **Low Tier**: Serendipitous discovery genres to break recommendation bubbles.
4. **Parallel Google Places API (New) Queries**:
   - Dispatches parallel `POST /v1/places:searchNearby` requests using Google Places API (New) with an optimized `X-Goog-FieldMask`.
   - Restricts searches to the active circle geometry using `POPULARITY` ranking, while automatically filtering out unwanted types (e.g., lodging and hotels during food exploration).
5. **Local DB Caching & Cost Optimization**: Every fetched venue is upserted into the Supabase `places` table with metadata, hours, and photo references—dramatically reducing repetitive Google Places API costs across all users.
6. **Deduplication, Enrichment & Photo Resolution**:
   - Enforces strict radius boundaries using Haversine distance calculations and removes previously swiped items.
   - Computes normalized match percentages and human-readable recommendation reasons.
   - Directly resolves the primary photo URI from `https://places.googleapis.com/v1/{photoName}/media` with full author attributions.
7. **Client Queue Sampling**: The mobile client balances the returned High, Medium, and Low queues through dynamic sampling, serving fresh cards straight onto the swipe deck.

### 2. Rankings & Showdown Engine
*Forget arbitrary 5-star reviews. OutThere introduces a head-to-head comparison tournament to build an accurate personal leaderboard.*

- **0.0 – 10.0 Rating Precision**: Every spot you visit earns a precise, calibrated score on a 10-point scale.
- **Binary Search Comparison Showdowns**: When rating a new place, choose its general vibe (e.g. *Loved*, *Liked*, *Fine*, *Disliked*). The engine initiates head-to-head comparisons against previously ranked venues in that bracket, using binary search to find its exact rank in just a few taps.
- **Automated List Recalibration**: Rating a new favorite triggers smart recalibration of nearby ranked spots, ensuring your personal leaderboard remains statistically consistent.
- **Food & Activity Separation**: Independent leaderboards for dining and recreation, complete with personal notes, recommendation tags, and visit timestamps.

#### 📐 The Ranking Algorithm (How It Works)

OutThere eliminates rating fatigue and 5-star inflation using a 4-stage algorithmic tournament:

```text
[ New Place ] 
      │
      ▼
1. Vibe Partitioning ────────► Select sentiment bracket (Loved, Liked, Fine, Disliked)
      │
      ▼
2. Binary Search Showdown ───► O(log N) head-to-head comparisons against median bracket items
      │
      ▼
3. Percentile Distribution ──► Interpolate continuous raw score along tier range [Vmin, Vmax]
      │
      ▼
4. Monotonic Recalibration ──► Enforce strict descending steps and dynamically resolve ties
```

1. **Vibe Tier Bounds**: Maps qualitative sentiment to strict numerical brackets:
   - **Loved it! (🤩)**: `8.5 – 10.0` (Baseline: `9.2`) — Standout favorite you'd rush back to
   - **I liked it! (😊)**: `7.0 – 8.4` (Baseline: `7.8`) — Solid, delicious, and would recommend
   - **It was fine (😐)**: `5.0 – 6.9` (Baseline: `6.0`) — Okay, but wouldn't go out of your way
   - **Didn’t like it (😕)**: `0.0 – 4.9` (Baseline: `3.8`) — Disappointing or would not return
2. **Binary Search Insertion ($\mathcal{O}(\log N)$)**:
   - Evaluates the candidate against existing items in the bracket starting at $\text{mid} = \lfloor(\text{low} + \text{high}) / 2\rfloor$.
   - A single head-to-head showdown (*"Which was better: Place A or Place B?"*) halves the search range each round.
   - Terminates in $\le 3$ comparisons for brackets up to 8 venues, or handles immediate equal ties.
3. **Continuous Percentile Distribution**:
   - Computes smooth ratings for $M$ places in the tier without arbitrary clustering:
     $$\text{Percentile}_i = \frac{M - i - 0.5}{M}$$
     $$\text{Score}_i = V_{\min} + \left(\text{Percentile}_i \times (V_{\max} - V_{\min})\right)$$
4. **Strict Monotonic Recalibration**:
   - Applies an active step enforcer (`enforceDescendingSteps`) that dynamically offsets adjacent scores by $\ge 0.1$, guaranteeing that higher-ranked venues always maintain strictly higher scores while staying within bracket bounds.

### 3. Invite a Friend
*Effortless coordination to turn bucket list spots into real-world outings with friends.*

- **One-Tap Outing Invites**: Send an invite directly from any Place Details screen to mutual followers who also saved or loved the spot.
- **"Invite Them" & "Invite All"**: Invite friends individually or rally your entire crew at once with batch invitations.
- **Dedicated Invites Section**: Incoming invitations are pinned at the top of the **Notifications** hub, highlighted with distinct badges so you never miss an outing.
- **Interactive RSVP Flow**: Recipients can accept or decline directly from their notifications with instantaneous status updates (`pending`, `accepted`, `declined`) and automated reciprocal notifications sent back to the inviter.

### 4. Social Feed
*A vibrant community stream connecting your circle's real-world explorations.*

- **Dual Feed Scopes**:
  - **Explore**: A global stream discovering top-rated spots, hidden gems, and reviews from the wider OutThere community.
  - **Following**: A focused stream showing recent check-ins, ratings, and recommendations from people you follow.
- **Rich Post Content**: User posts feature multi-photo carousels, custom 0–10 ratings, review write-ups, and interactive place metadata cards.
- **Social Engagement**: Like posts, join the discussion with threaded comments, and jump straight to the tagged place or creator's profile.
- **Optimistic UI & Pagination**: Fast cursor-based pagination backed by Supabase with instant optimistic updates for likes and follows.

### 5. Taste Profile & Analytics
*A personalized visual footprint of your tastes, adventures, and exploration habits.*

- **Interactive Category Radar Chart**: A dynamic radar chart visualizing your taste distribution across categories in both Activities and Food modes.
- **Active Taste Metrics**: Live metric cards displaying:
  - **Top Preference**: Your highest affinity category with weighted scoring.
  - **Active Taste Coverage**: Number of distinct categories rated out of total catalog genres.
  - **Places Explored**: Total places swiped and reviewed.
  - **Bucket List Count**: Total places queued for future adventures.
- **Visited Places Map**: An interactive map plotting every venue you've rated, letting you visualize your exploration footprint across cities.
- **Past Activities Timeline**: A chronological history of all your check-ins and ratings with detailed category badges.
- **Personalized Onboarding**: Tailor your preferences during onboarding: travel range (1–50 km), budget level, exploration vibe, and primary interests.

### 6. Universal Search
*Lightning-fast discovery for both places and people.*

- **Unified Search Scopes**: Instantly toggle between **Places** and **Profiles** with dedicated search controls.
- **Google Places API (New) Integration**:
  - Real-time debounced autocomplete after 2 characters with instant place suggestions.
  - Comprehensive place normalization preserving official addresses, opening hours, photos, and ratings.
- **Custom Area Biasing**: Search around your current GPS coordinates or pick any specific city/neighborhood using the interactive **Area Sheet**.
- **Deep Place Filters**:
  - **Categories**: Filter by Food & Drink, Nightlife, Outdoor, Culture, Entertainment, and Sports.
  - **Distance**: Fine-tune radius from 1 km to 50 km.
  - **Availability & Pricing**: Filter by *Open Now*, price tiers (`$`, `$$`, `$$$`, `$$$$`), or minimum Google star rating.
  - **Sorting**: Order results by proximity (nearest) or relevance.
- **Profile Discovery**: Search users by username or display name, manage follow requests, and view public profiles and taste breakdowns.

---

## 💎 Monetization & OutThere Pro

OutThere incorporates a hybrid monetization strategy combining premium subscriptions and contextual mobile ads:

- **OutThere Pro (RevenueCat Integration)**:
  - **Unlimited Discovery Swipes**: Bypasses the daily card swipe limits so power users can explore without interruption.
  - **Tiered Subscription Plans**: Flexible monthly, annual, and lifetime packages managed through RevenueCat offerings.
  - **Native Paywall & Customer Center**: Native UI for viewing subscription plans, restoring purchases across devices, and managing renewals backed by the `outthere_pro` entitlement.
  - **Environment Switching**: Seamless switching between the development Test Store and live Apple/Google in-app purchase backends.
- **Mobile Advertising (Google AdMob)**:
  - Contextual banner advertising (`react-native-google-mobile-ads`) thoughtfully integrated into browsing surfaces.
  - Development builds auto-default to Google Test Unit IDs, with production banner IDs configurable via `.env.local`.

---

## 🛠 Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | [Expo SDK 57](https://expo.dev) / [React Native 0.86](https://reactnative.dev) | Cross-platform native application framework |
| **Routing & Navigation** | [Expo Router v57](https://docs.expo.dev/router/introduction/) | Typed file-based routing with deep linking & native tabs |
| **Language** | [TypeScript 6.0](https://www.typescriptlang.org/) | Strict static typing across components, models, and API clients |
| **Database & Auth** | [Supabase](https://supabase.com) | Postgres database, Row Level Security (RLS), PKCE Auth, and RPC functions |
| **Storage** | [Supabase Storage](https://supabase.com/docs/guides/storage) | Private avatar and post image buckets with signed URL generation |
| **Mapping & Places** | [Google Places API (New)](https://developers.google.com/maps) / [react-native-maps](https://github.com/react-native-maps/react-native-maps) | Autocomplete, place details, geocoding, and map rendering |
| **Monetization** | [RevenueCat](https://www.revenuecat.com/) (`react-native-purchases`) | In-app subscriptions, customer center, and OutThere Pro paywall |
| **Styling & Icons** | Native Theme Tokens & SVG | Dynamic dark/light theme tokens and responsive layouts |
| **Testing** | Node.js Test Runner | Fast native test suite with `--experimental-strip-types` |

---

## 📁 Project Architecture

```text
OutThere/
├── assets/                     # App icons, splash screens, and static images
├── docs/                       # Architecture documentation (place-search, revenuecat)
├── src/
│   ├── app/                    # Expo Router routes (file-based navigation)
│   │   ├── (main)/             # Protected tab and stack routes
│   │   │   ├── (tabs)/         # Bottom tab navigator (Discover, Search, Feed, Rankings, Profile)
│   │   │   ├── bucket-list/    # Saved places and bucket list screen
│   │   │   ├── rankings/       # Showdown comparisons and ranking screens
│   │   │   ├── search/         # Search results and place detail views
│   │   │   └── notifications/  # Notification center & place invites
│   │   ├── auth/               # Authentication routes (login, register, reset, callback)
│   │   └── onboarding.tsx      # Multi-step user onboarding flow
│   ├── components/             # Reusable foundation UI (Screen, Card, Button, Tabs, ThemedText)
│   ├── constants/              # App limits, storage keys, timing, and theme palettes
│   ├── features/               # Modular feature domains (domain logic, hooks, screens)
│   │   ├── ads/                # AdMob banner ad components
│   │   ├── auth/               # Auth controllers and validation
│   │   ├── bucket-list/        # Saved places data and operations
│   │   ├── categories/         # Activity and food category taxonomies
│   │   ├── discover/           # Swipe deck, concentric circles, queue sampling
│   │   ├── friends/            # Friend relationships and requests
│   │   ├── notifications/      # Notification handlers and invite RPCs
│   │   ├── place-details/      # Venue detail view, photo viewer, and invite modal
│   │   ├── posts/              # Feed screen, comments, and post creation
│   │   ├── profile/            # Profile screens, taste statistics, radar chart, visited map
│   │   ├── rankings/           # Vibe configs, bracket search, tier scoring, recalibration
│   │   ├── search/             # Autocomplete, area sheets, filter sheets, profile search
│   │   └── subscriptions/      # RevenueCat SDK wrapper, controller, and Pro paywall
│   ├── hooks/                  # Global hooks (useTheme, useColorScheme)
│   ├── lib/                    # Supabase client, storage, auth helpers, date & format utils
│   └── providers/              # Context providers (Auth, Profile, Subscription, Notifications)
├── supabase/
│   ├── functions/              # Edge functions (e.g. place-search with Google Places)
│   └── migrations/             # Versioned SQL migrations with RLS policies & RPCs
└── tests/                      # Comprehensive unit and integration test suite
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v22.13.0` or higher
- **npm**: `v10.0.0` or higher
- **Expo CLI**: included with `npx expo`
- **Mobile Development** *(optional for native builds)*:
  - iOS: macOS with Xcode 15+ and CocoaPods
  - Android: Android Studio and Android SDK / JDK 17

### Environment Configuration

1. Copy `.env.example` to create `.env.local`:

```sh
cp .env.example .env.local
```

2. Populate the required environment variables:

```env
# Supabase credentials (find in Supabase Dashboard -> Settings -> API)
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key

# RevenueCat keys (use Test API Key for local development)
EXPO_PUBLIC_REVENUECAT_MODE=test
EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=test_your_revenuecat_key
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_your_key
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_your_key
```

> **Security Note**: Never commit `.env.local` or include service-role keys or `GOOGLE_PLACES_API_KEY` in `EXPO_PUBLIC_*` client variables. Sensitive keys are securely held by Supabase Edge Functions.

### Supabase Backend Setup

Apply the SQL migrations to your Supabase project to provision tables, indexes, RLS policies, and RPC functions:

```sh
# Using the Supabase CLI
npx supabase db push
```

Key database functions configured by the migrations:
- `send_place_invite`: Dispatches outing invitations to mutual followers.
- `respond_to_place_invite`: Handles accepting or declining invites and alerts the sender.
- `get_follow_relationship` & `send_follow_request`: Manages public/private social follow graphs.

### Running the App

1. Install dependencies:
```sh
npm ci
```

2. Start the development server:
```sh
# Run on web (quickest way to preview UI)
npm run web

# Run on iOS simulator (requires Xcode)
npm run ios

# Run on Android emulator (requires Android Studio)
npm run android

# Run using Expo Dev Client (custom native build)
npm run dev
```

---

## 🧪 Testing & Verification

OutThere maintains a comprehensive, fast test suite covering ranking algorithms, queue sampling, search debounce, auth validation, and notifications.

Run the test suite:
```sh
npm test
```

Perform type checking and linting:
```sh
# TypeScript validation
npm run typecheck

# ESLint check
npm run lint

# Export web build check
npx expo export --platform web
```

---

## 👥 Contributing & Team Workflow

OutThere is organized into modular feature directories under `src/features/` to enable multiple engineers to build concurrently without merge friction:

- **Discover & Bucket List**: `src/features/discover/`, `src/features/bucket-list/`
- **Rankings & Showdown**: `src/features/rankings/`
- **Social Feed & Invites**: `src/features/posts/`, `src/features/notifications/`
- **Search & Places**: `src/features/search/`, `src/features/place-details/`
- **Profiles & Taste Analytics**: `src/features/profile/`

When implementing new routes, create the route entry file in `src/app/` and import the feature screen from `src/features/<feature>/screen.tsx`.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
