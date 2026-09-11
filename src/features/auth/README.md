# Authentication

- `account/screen.tsx`: sign-in, sign-up, and request-password-reset form modes.
- `callback/screen.tsx`: email-link verification.
- `reset-password/screen.tsx`: choose a password after recovery.
- `components/`: UI used by authentication pages.

Keep new page-specific components, hooks, and tests alongside their screen.
Cross-app session state stays in `src/providers/auth-provider.tsx`; the shared
Supabase client and auth helpers stay in `src/lib`. Coordinate changes to these
contracts because the Profile page and navigation also use authentication.
Route entry points live in `src/app/auth`. Preserve callback URLs when changing
files because Supabase email redirects depend on them.
