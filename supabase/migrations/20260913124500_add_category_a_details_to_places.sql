alter table public.places
  add column if not exists website_uri text,
  add column if not exists phone_number text,
  add column if not exists regular_opening_hours jsonb not null default '[]'::jsonb,
  add column if not exists amenities jsonb not null default '{}'::jsonb;
