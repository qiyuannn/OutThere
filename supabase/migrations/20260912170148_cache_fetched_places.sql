create table public.places (
  google_place_id text primary key check (char_length(google_place_id) between 1 and 255),
  display_name text,
  formatted_address text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  primary_type_display_name text,
  rating numeric(2, 1) check (rating between 0 and 5),
  user_rating_count bigint check (user_rating_count >= 0),
  price_level text check (price_level is null or char_length(price_level) <= 64),
  open_now boolean,
  google_maps_uri text,
  photo_name text,
  photo_attribution_display_name text,
  photo_attribution_uri text,
  first_fetched_at timestamptz not null default now(),
  last_fetched_at timestamptz not null default now()
);

create index places_last_fetched_at_idx on public.places (last_fetched_at);

alter table public.places enable row level security;

revoke all on public.places from anon, authenticated;
grant select, insert, update, delete on public.places to service_role;
