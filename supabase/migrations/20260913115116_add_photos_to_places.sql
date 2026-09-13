alter table public.places
add column if not exists photos jsonb not null default '[]'::jsonb;
