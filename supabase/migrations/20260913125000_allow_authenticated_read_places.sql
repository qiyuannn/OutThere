-- Allow authenticated and anon users to read cached places
grant select on public.places to authenticated, anon;

create policy "Allow users to read places"
on public.places
for select
to authenticated, anon
using (true);
