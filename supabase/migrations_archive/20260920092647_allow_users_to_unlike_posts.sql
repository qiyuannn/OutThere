grant select on table public.post_likes to authenticated;

create policy "Users can read their own post likes"
on public.post_likes for select
to authenticated
using ((select auth.uid()) = user_id);
