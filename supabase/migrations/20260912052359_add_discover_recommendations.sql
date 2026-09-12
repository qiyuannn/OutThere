create table public.discover_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  area_key text not null default 'central' check (char_length(area_key) between 1 and 40),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_m integer not null default 10000 check (radius_m between 1000 and 50000),
  activity_interests text[] not null default '{}',
  food_interests text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.discover_place_actions (
  user_id uuid not null references auth.users(id) on delete cascade,
  google_place_id text not null check (char_length(google_place_id) between 1 and 255),
  mode text not null check (mode in ('activities', 'food')),
  action text not null check (action in ('saved', 'rejected')),
  updated_at timestamptz not null default now(),
  primary key (user_id, google_place_id)
);

create table public.discover_recommendation_impressions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  google_place_id text not null check (char_length(google_place_id) between 1 and 255),
  mode text not null check (mode in ('activities', 'food')),
  score numeric(5, 4) not null check (score between 0 and 1),
  shown_at timestamptz not null default now()
);

create index discover_place_actions_user_action_idx on public.discover_place_actions (user_id, action, updated_at desc);
create index discover_impressions_user_place_idx on public.discover_recommendation_impressions (user_id, google_place_id, shown_at desc);

alter table public.discover_preferences enable row level security;
alter table public.discover_place_actions enable row level security;
alter table public.discover_recommendation_impressions enable row level security;

create policy "Users read their discovery preferences" on public.discover_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create their discovery preferences" on public.discover_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their discovery preferences" on public.discover_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users read their place actions" on public.discover_place_actions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create their place actions" on public.discover_place_actions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their place actions" on public.discover_place_actions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their place actions" on public.discover_place_actions for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read their recommendation impressions" on public.discover_recommendation_impressions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create their recommendation impressions" on public.discover_recommendation_impressions for insert to authenticated with check ((select auth.uid()) = user_id);

revoke all on public.discover_preferences from anon;
revoke all on public.discover_place_actions from anon;
revoke all on public.discover_recommendation_impressions from anon;
grant select, insert, update on public.discover_preferences to authenticated;
grant select, insert, update, delete on public.discover_place_actions to authenticated;
grant select, insert on public.discover_recommendation_impressions to authenticated;
grant usage, select on sequence public.discover_recommendation_impressions_id_seq to authenticated;
