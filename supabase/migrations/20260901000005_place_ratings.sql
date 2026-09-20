create table public.user_place_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_place_id text not null references public.places(google_place_id) on delete cascade,
  mode text not null check (mode in ('food', 'activities')),
  rating numeric(3, 1) not null check (rating between 0 and 10),
  vibe text check (vibe in ('loved', 'liked', 'fine', 'disliked')),
  recommend boolean not null default true,
  notes text check (notes is null or char_length(notes) <= 2000),
  rated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_place_ratings_user_place_key unique (user_id, google_place_id)
);

create index user_place_ratings_user_mode_rating_idx
  on public.user_place_ratings (user_id, mode, rating desc);

create index user_place_ratings_google_place_id_idx
  on public.user_place_ratings (google_place_id);

alter table public.user_place_ratings enable row level security;

revoke all on public.user_place_ratings from anon;
grant select, insert, update, delete on public.user_place_ratings to authenticated;

create policy "Users can read own ratings"
  on public.user_place_ratings for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own ratings"
  on public.user_place_ratings for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own ratings"
  on public.user_place_ratings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own ratings"
  on public.user_place_ratings for delete to authenticated
  using ((select auth.uid()) = user_id);
