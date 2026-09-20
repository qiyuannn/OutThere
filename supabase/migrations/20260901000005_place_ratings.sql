create table public.user_place_ratings (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  google_place_id text not null references public.places(google_place_id) on delete cascade,
  mode text not null check (mode in ('activities', 'food')),
  vibe text check (vibe in ('fine', 'liked', 'loved', 'disliked')),
  score numeric(5, 2) check (score >= 0 and score <= 10),
  rank_position integer not null check (rank_position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_place_ratings_user_place_key unique (user_id, google_place_id)
);

create index user_place_ratings_user_mode_rank_idx
  on public.user_place_ratings (user_id, mode, rank_position asc);

alter table public.user_place_ratings enable row level security;

revoke all on public.user_place_ratings from anon;
grant select, insert, update, delete on public.user_place_ratings to authenticated;

create policy "Users can read own ratings"
  on public.user_place_ratings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own ratings"
  on public.user_place_ratings
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own ratings"
  on public.user_place_ratings
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own ratings"
  on public.user_place_ratings
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
