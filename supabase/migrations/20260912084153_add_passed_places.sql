create table public.passed_places (
  user_id uuid not null references auth.users(id) on delete cascade,
  google_place_id text not null check (char_length(google_place_id) between 1 and 255),
  mode text not null check (mode in ('activities', 'food')),
  passed_at timestamptz not null default now(),
  primary key (user_id, google_place_id, mode)
);

alter table public.passed_places enable row level security;

create policy "Users read their passed places"
on public.passed_places for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users create their passed places"
on public.passed_places for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users update their passed places"
on public.passed_places for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users delete their passed places"
on public.passed_places for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.passed_places from anon;
grant select, insert, update, delete on public.passed_places to authenticated;
