insert into public.places (google_place_id)
select google_place_id from public.saved_places
union
select google_place_id from public.passed_places
union
select google_place_id from public.discover_recommendation_impressions
on conflict (google_place_id) do nothing;

create index saved_places_google_place_id_idx
on public.saved_places (google_place_id);

create index passed_places_google_place_id_idx
on public.passed_places (google_place_id);

create index discover_impressions_google_place_id_idx
on public.discover_recommendation_impressions (google_place_id);

alter table public.saved_places
add constraint saved_places_google_place_id_fkey
foreign key (google_place_id)
references public.places (google_place_id)
on update cascade
on delete restrict
not valid;

alter table public.passed_places
add constraint passed_places_google_place_id_fkey
foreign key (google_place_id)
references public.places (google_place_id)
on update cascade
on delete restrict
not valid;

alter table public.discover_recommendation_impressions
add constraint discover_impressions_google_place_id_fkey
foreign key (google_place_id)
references public.places (google_place_id)
on update cascade
on delete restrict
not valid;

alter table public.saved_places
validate constraint saved_places_google_place_id_fkey;

alter table public.passed_places
validate constraint passed_places_google_place_id_fkey;

alter table public.discover_recommendation_impressions
validate constraint discover_impressions_google_place_id_fkey;
