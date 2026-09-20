# Friends and sharing

OutThere's social feature is opt-in and uses mutual friendships. It does not expose a public community feed. A signed-in user enables their social profile in **Feed → Privacy & Sharing**, then other opted-in users can find them by name or username.

## User flows

- Search for opted-in people and send, accept, decline, or cancel requests.
- View friends, pending requests, sent requests, and blocked people.
- Remove a friendship or block/unblock another account.
- Share a new or existing rating with accepted friends. Ratings default to private unless the user chooses Friends.
- View friends' shared ratings in the Friends Feed.
- Like and comment on visible ratings and receive in-app notifications.
- Make a shared rating private or delete its social post without deleting the underlying personal rating.

Blocking removes the friendship and notifications between the two accounts. It also hides both profiles and all shared activity from each other. Disabling the social profile makes every shared rating private.

## Architecture

Routes live below `src/app/(tabs)/feed`. Screens and client data access live in `src/features/social`. The client has access only to the authenticated `public.social_api` and `public.social_summary` RPCs; the social tables are in `social_private`, have RLS enabled, and grant no direct access to authenticated clients.

`20260915114402_social_features.sql` is the migration already applied to the hosted project. `20260920190000_social_summary.sql` adds the count endpoint used by Profile. The consolidated base migrations describe a fresh installation and must keep the `user_place_ratings` UUID/rating schema expected by the social trigger.

The rating trigger creates or updates a private social post when `social_visibility` changes. API calls check authentication, opt-in status, friendship, blocks, ownership, visibility, input size, and cursor limits in the database so deep links cannot bypass the UI rules.

## Validation

Run:

```sh
npm run typecheck
npm run lint
npm test
```

For hosted QA, create two temporary users, complete both profiles, opt both in, then perform all social operations through user sessions. Verify request and acceptance notifications, share a rating from one account, view/like/comment from the other, then block and confirm the profile, feed item, and conversation are no longer accessible. Delete both temporary accounts afterward.
