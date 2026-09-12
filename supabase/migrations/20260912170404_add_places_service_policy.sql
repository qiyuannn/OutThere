create policy "Service role manages fetched places"
on public.places
for all
to service_role
using (true)
with check (true);
