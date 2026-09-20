grant select on public.places to authenticated;

create policy "Users read their saved place details"
on public.places
for select
to authenticated
using (
  exists (
    select 1
    from public.saved_places
    where saved_places.google_place_id = places.google_place_id
      and saved_places.user_id = (select auth.uid())
  )
);
