-- Migration: Add foreign key relationship between user_place_ratings and places
-- This allows PostgREST to embed places(*) when querying user_place_ratings

-- Ensure any existing ratings have corresponding stub in places if not present
insert into public.places (google_place_id)
select google_place_id from public.user_place_ratings
on conflict (google_place_id) do nothing;

create index if not exists idx_user_place_ratings_google_place_id
on public.user_place_ratings (google_place_id);

alter table public.user_place_ratings
add constraint user_place_ratings_google_place_id_fkey
foreign key (google_place_id)
references public.places (google_place_id)
on update cascade
on delete cascade;
