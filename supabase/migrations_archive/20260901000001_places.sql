create table public.places (
  google_place_id text primary key check (char_length(google_place_id) between 1 and 255),
  display_name text not null check (char_length(display_name) between 1 and 255),
  formatted_address text not null check (char_length(formatted_address) between 1 and 500),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  primary_type text check (primary_type is null or char_length(primary_type) between 1 and 100),
  primary_type_display_name text check (primary_type_display_name is null or char_length(primary_type_display_name) between 1 and 100),
  price_level text check (price_level is null or price_level in ('FREE', 'INEXPENSIVE', 'MODERATE', 'EXPENSIVE', 'VERY_EXPENSIVE')),
  rating numeric(3, 2) check (rating is null or (rating >= 1.0 and rating <= 5.0)),
  user_rating_count integer check (user_rating_count is null or user_rating_count >= 0),
  regular_opening_hours jsonb,
  photos jsonb,
  phone_number text check (phone_number is null or char_length(phone_number) between 1 and 50),
  international_phone_number text check (international_phone_number is null or char_length(international_phone_number) between 1 and 50),
  website_uri text check (website_uri is null or char_length(website_uri) between 1 and 1000),
  google_maps_uri text check (google_maps_uri is null or char_length(google_maps_uri) between 1 and 1000),
  cached_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index places_primary_type_idx on public.places (primary_type);
create index places_cached_at_idx on public.places (cached_at desc);

alter table public.places enable row level security;

revoke all on public.places from public, anon;
grant select on public.places to authenticated;
grant all on public.places to service_role;

create policy "Authenticated users can read cached places"
  on public.places
  for select
  to authenticated
  using (true);

create policy "Service role manages cached places"
  on public.places
  for all
  to service_role
  using (true)
  with check (true);
