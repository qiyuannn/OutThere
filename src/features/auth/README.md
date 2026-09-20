# Authentication

- `account/screen.tsx`: Google OAuth and email/password sign-in, sign-up, and password recovery.
- `callback/screen.tsx`: OAuth and email verification callback code exchange and session restoration.
- `reset-password/screen.tsx`: choose a new password after recovery.
- `components/`: UI components used by authentication pages.

Keep new page-specific components, hooks, and tests alongside their screen.
Cross-app session state stays in `src/providers/auth-provider.tsx`; the shared
Supabase client and auth helpers stay in `src/lib`. Coordinate changes to these
contracts because the Profile page and navigation also use authentication.
Route entry points live in `src/app/auth`. Preserve callback URLs when changing
files because OAuth deep link redirects depend on them.

