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
- Report a visible user, post, or comment with a reason and optional details.
- Delete an account after typing the current username and confirming the irreversible action.
- Opt in to push notifications for friend requests, likes and comments received while the app is closed.

Blocking removes the friendship and notifications between the two accounts. It also hides both profiles and all shared activity from each other. Disabling the social profile makes every shared rating private.

## Architecture

Routes live below `src/app/(tabs)/feed`. Screens and client data access live in `src/features/social`. The client has access only to the authenticated `public.social_api` and `public.social_summary` RPCs; the social tables are in `social_private`, have RLS enabled, and grant no direct access to authenticated clients.

`20260915114402_social_features.sql` is the migration already applied to the hosted project. `20260920190000_social_summary.sql` adds the count endpoint used by Profile. The consolidated base migrations describe a fresh installation and must keep the `user_place_ratings` UUID/rating schema expected by the social trigger.

The rating trigger creates or updates a private social post when `social_visibility` changes. API calls check authentication, opt-in status, friendship, blocks, ownership, visibility, input size, and cursor limits in the database so deep links cannot bypass the UI rules.

Reports are written through `public.social_report` into a private moderation queue. Mobile clients cannot read or modify that table. Report snapshots contain only the visible content needed for review, and repeat reports from the same account update the existing queue item.

Moderation is handled by the authenticated `moderate-social` Edge Function. It accepts only users whose protected Auth `app_metadata.role` is `moderator` (or whose `app_metadata.is_moderator` is `true`). Moderators can dismiss a report, remove a post/comment, or suspend an account from social participation. Decisions and private notes are written to an append-only audit table. Assign moderator metadata only through a trusted admin environment; never put that role in user-editable metadata.

Account deletion runs in the authenticated `delete-account` Edge Function. It verifies the bearer token and typed username, deletes the Auth user so application rows cascade, then clears the avatar through the Storage API. Store subscriptions must be cancelled separately through Apple or Google.

Push tokens are opt-in, limited per user, and stored in `social_private`. The client invokes `social-push` after a notification-producing database action; the function authenticates that actor, atomically claims only notifications produced by that user, and sends generic copy through Expo. Disabling push or signing out unregisters the device. Push requires an EAS project ID, a rebuilt development client, and a physical device; the iOS Simulator cannot receive remote push notifications.

The in-app Privacy Policy and Terms of Use are reachable from Account & Privacy and the membership screen. Replace the project-team contact wording with a monitored support address before distributing the app beyond the award evaluation group.

Friends and people search use bounded offset pages. Feed posts, notifications, and comments use timestamp-plus-ID cursors so records with equal timestamps are neither skipped nor duplicated. Screens retain loaded results, show a reconnect state when offline, and expose retry actions for server failures.

## Validation

Run:

```sh
npm run typecheck
npm run lint
npm test
```

For hosted QA, create two temporary users, complete both profiles, opt both in, then perform all social operations through user sessions. Verify request and acceptance notifications, share a rating from one account, view/like/comment from the other, then block and confirm the profile, feed item, and conversation are no longer accessible. Delete both temporary accounts afterward.

For moderation QA, give only the reviewer account the protected moderator app metadata, submit reports from a normal account, and verify dismiss, content removal and suspension. For push QA, install a fresh native build on a physical device, enable notifications from Account & Privacy, background the app, and trigger each social notification from the second account.
