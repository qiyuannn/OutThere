create table public.saved_places (
  user_id uuid not null references auth.users(id) on delete cascade,
  google_place_id text not null references public.places(google_place_id) on delete cascade,
  mode text not null check (mode in ('activities', 'food')),
  created_at timestamptz not null default now(),
  primary key (user_id, google_place_id)
);

create index saved_places_user_mode_created_idx on public.saved_places (user_id, mode, created_at desc);

alter table public.saved_places enable row level security;

revoke all on public.saved_places from anon;
grant select, insert, delete on public.saved_places to authenticated;

create policy "Users read their saved places"
  on public.saved_places
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert their saved places"
  on public.saved_places
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users delete their saved places"
  on public.saved_places
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create table public.passed_places (
  user_id uuid not null references auth.users(id) on delete cascade,
  google_place_id text not null references public.places(google_place_id) on delete cascade,
  mode text not null check (mode in ('activities', 'food')),
  created_at timestamptz not null default now(),
  primary key (user_id, google_place_id)
);

create index passed_places_user_mode_created_idx on public.passed_places (user_id, mode, created_at desc);

alter table public.passed_places enable row level security;

revoke all on public.passed_places from anon;
grant select, insert on public.passed_places to authenticated;

create policy "Users read their passed places"
  on public.passed_places
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert their passed places"
  on public.passed_places
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create or replace function public.get_saved_places_with_details(p_mode text default null)
returns table (
  google_place_id text,
  mode text,
  saved_at timestamptz,
  display_name text,
  formatted_address text,
  latitude double precision,
  longitude double precision,
  primary_type text,
  primary_type_display_name text,
  price_level text,
  rating numeric,
  user_rating_count integer,
  regular_opening_hours jsonb,
  photos jsonb,
  phone_number text,
  international_phone_number text,
  website_uri text,
  google_maps_uri text,
  cached_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.google_place_id,
    s.mode,
    s.created_at as saved_at,
    p.display_name,
    p.formatted_address,
    p.latitude,
    p.longitude,
    p.primary_type,
    p.primary_type_display_name,
    p.price_level,
    p.rating,
    p.user_rating_count,
    p.regular_opening_hours,
    p.photos,
    p.phone_number,
    p.international_phone_number,
    p.website_uri,
    p.google_maps_uri,
    p.cached_at,
    p.updated_at
  from public.saved_places s
  join public.places p on p.google_place_id = s.google_place_id
  where s.user_id = (select auth.uid())
    and (p_mode is null or s.mode = p_mode)
  order by s.created_at desc;
$$;

revoke execute on function public.get_saved_places_with_details(text) from public, anon;
grant execute on function public.get_saved_places_with_details(text) to authenticated;
