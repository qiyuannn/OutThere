create table public.saved_places (
  user_id uuid not null references auth.users(id) on delete cascade,
  google_place_id text not null check (char_length(google_place_id) between 1 and 255),
  mode text not null check (mode in ('activities', 'food')),
  saved_at timestamptz not null default now(),
  primary key (user_id, google_place_id)
);

create index saved_places_user_saved_at_idx on public.saved_places (user_id, saved_at desc);

alter table public.saved_places enable row level security;

create policy "Users read their saved places"
on public.saved_places for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users create their saved places"
on public.saved_places for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users update their saved places"
on public.saved_places for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users delete their saved places"
on public.saved_places for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.saved_places from anon;
grant select, insert, update, delete on public.saved_places to authenticated;

insert into public.saved_places (user_id, google_place_id, mode, saved_at)
select user_id, google_place_id, mode, updated_at
from public.discover_place_actions
where action = 'saved'
on conflict (user_id, google_place_id) do update
set mode = excluded.mode,
    saved_at = excluded.saved_at;

drop table public.discover_place_actions;

