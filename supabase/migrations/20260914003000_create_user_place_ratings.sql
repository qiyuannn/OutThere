-- Migration: Create user_place_ratings table for Beli-style rankings
create table if not exists public.user_place_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  google_place_id text not null,
  mode text not null check (mode in ('food', 'activities')),
  rating numeric(3,1) not null check (rating >= 0.0 and rating <= 10.0),
  vibe text not null check (vibe in ('loved', 'liked', 'fine', 'disliked')),
  recommend boolean not null default true,
  notes text,
  rated_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint user_place_ratings_user_place_key unique (user_id, google_place_id)
);

-- Index for fast user mode sorting
create index if not exists idx_user_place_ratings_user_mode_rating
  on public.user_place_ratings (user_id, mode, rating desc);

-- Enable RLS
alter table public.user_place_ratings enable row level security;

-- RLS Policies
create policy "Users can view their own place ratings"
  on public.user_place_ratings for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own place ratings"
  on public.user_place_ratings for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own place ratings"
  on public.user_place_ratings for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete their own place ratings"
  on public.user_place_ratings for delete
  to authenticated
  using (auth.uid() = user_id);
