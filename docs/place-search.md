# Place search

The Search tab now searches Google Places (New). Page routes live in
`src/app/(tabs)/search`; its UI, filters, area picker, state and client service live
in `src/features/search`. The shared validation contract is in
`supabase/functions/_shared/search-contract.ts`, and the backend is
`supabase/functions/place-search`.

## Run locally

1. `npm ci`
2. Keep the existing Supabase URL and publishable key in `.env.local`.
3. `npm run dev`, then open the existing iOS development build. No new native
   dependency was added by Search. A build older than main's native dependencies
   may need `npm run ios` once.
4. Open **Search**, enter a place name or query, and choose a search area.
   Current location requests foreground permission only. Manual area lookup works
   without granting location access. On a simulator, its configured simulated
   location may be far from your intended city; use a manual area in that case.

## Backend deployment

The project already has a server-side `GOOGLE_PLACES_API_KEY` secret. Enable
Places API (New) and billing for that Google project. Never add this key or a
Supabase service-role key to `EXPO_PUBLIC_*` variables.

```sh
npx --yes supabase login
npx --yes supabase functions deploy place-search --project-ref xbplrsrhcexaafdngbof --use-api
```

Keep JWT verification enabled. The handler also verifies the user with Supabase
Auth **before** any Google request, including area and detail requests. It uses
the service role only to insert place IDs for the existing saved/rating foreign
keys. Existing cached rows are preserved. No SQL migration is required.

## Behaviour

- Place-name autocomplete appears after two characters and a 350 ms typing pause.
  Google Places Autocomplete supplies up to five names and addresses; tapping a
  suggestion opens that exact place by ID. Suggestions prioritize the selected
  area but are not restricted by full-result filters. Without an area, Google's
  default geographic bias applies. Suggestion failures leave full search usable.
  Superseded responses and pending requests after selection are ignored.
- Submit-based free-text queries remain available, with a selected centre and a 1–50 km radius.
- All/Food/Activities; specific supported venue categories; open now; a single
  price tier; minimum Google rating; relevance or nearest sorting.
- Filter changes stay in the sheet until **Apply filters**. Close discards them.
  Active chips can be removed individually.
- Google receives supported filters; the backend additionally enforces the exact
  radius and mode. Google's text-search location is a bias, so explicit locations
  in a query can produce out-of-area candidates; those are excluded.
- Unknown hours, prices and ratings remain unknown. They do not pass a filter
  requiring a known value. Free is filtered after retrieval because Google's
  Text Search request does not accept the Free price level.
- Nearest means straight-line distance among loaded matching results, not a
  comprehensive inventory or driving time. Results are capped at three provider
  pages of 20 candidates. Empty filtered pages can still have **Load more**.
- Cursors are signed, expire after 15 minutes, and are bound to the user's ID,
  query, centre and filters. Results are deduplicated; a superseded request cannot
  replace a newer search. Load-more retries retain existing results.
- Eight recent user-entered queries are stored locally, separately per account,
  with a clear-history action. Location and provider result data are not saved
  in search history.
- Result cards show photos, Google rating, category, straight-line distance,
  price, hours and address. Details fetch additional fields on demand and support
  directions, website, calling, saving, and the existing rating workflow.
- Food/activity classification is passed to details and save/rating actions.
  Rankings refresh on focus after rating from Search.

## Content lifetime and attribution

Search inserts only Google place IDs into the existing `places` table. It does
not persist result content or photo resource names. A bounded in-memory display
cache holds at most 120 places for two minutes. New ID-only entries are hydrated
on demand in Saved and Rankings. Photo disk caching is disabled on Search and
its live detail view. Google Maps/provider attribution and source photo links
are displayed.

The older Discover implementation still persists full Google place snapshots.
This feature preserves that existing data and behaviour; it does not migrate or
certify the rest of the app's content-storage policy. Public Terms of Use and a
Privacy Policy are still an app-wide launch requirement.

## Cost and operational bounds

Each page makes one Text Search request and resolves at most 20 thumbnail photos,
in groups of four. Photos time out independently and degrade to placeholders.
Details are requested in batches of at most 10 IDs, with four calls at a time.
List field masks omit the additional detail-only fields.

The endpoint has a per-user, per-worker limit of 60 search/detail units per
minute, provider request timeouts, request-size limits, and bounded pagination.
This in-memory limit is **not a global distributed quota**: multiple Edge workers
have separate counters. Before broad rollout, set Google project quotas/budget
alerts and add a shared quota store if a strict per-account spend ceiling is
needed. Autocomplete uses one lightweight request per debounced input, without
photos or stored predictions. It currently uses per-request billing (no session
token), and each call counts toward the endpoint's quota. Avoid automatic polling.

## Verification

```sh
npm test
npm run typecheck
npx --yes deno check supabase/functions/place-search/index.ts supabase/functions/place-search/search.ts
npx expo export --platform ios --platform web --output-dir /tmp/outthere-search-export
```

The search tests cover request validation, geographic edge cases, missing data,
mode classification, supported provider filters, result deduplication, recent
history, authentication of every action, request limits, cursor tampering and
binding, pagination limits, empty pages, and provider/storage failure handling.

Manual smoke test: choose an area → search → apply/remove filters → load more →
open details → save → reopen from Saved → rate → revisit Rankings. Also test
denied location, offline retry, and rapid successive searches. Tests use stubbed
Google responses; the simulator smoke test verifies the deployed integration.

References: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/),
[Google Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search),
[Places attribution and storage policies](https://developers.google.com/maps/documentation/places/web-service/policies),
[Supabase function authentication](https://supabase.com/docs/guides/functions/auth).
