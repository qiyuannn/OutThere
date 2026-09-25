-- Index and RPC to fetch mutual followers (people you follow and who follow you) that saved a place

create index if not exists saved_places_place_id_idx
  on public.saved_places (google_place_id);

create or replace function public.get_mutual_followers_saved_place(p_google_place_id text)
returns table (
  user_id uuid,
  display_name text,
  username text,
  avatar_path text,
  saved_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.user_id,
    coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.username), ''), 'OutThere user') as display_name,
    p.username,
    p.avatar_path,
    sp.saved_at
  from public.saved_places sp
  join public.profiles p on p.user_id = sp.user_id
  join public.user_follows f1 on f1.following_id = sp.user_id and f1.follower_id = (select auth.uid())
  join public.user_follows f2 on f2.follower_id = sp.user_id and f2.following_id = (select auth.uid())
  where sp.google_place_id = p_google_place_id
    and sp.user_id <> (select auth.uid())
  order by sp.saved_at desc
  limit 20;
$$;

revoke all on function public.get_mutual_followers_saved_place(text) from public, anon;
grant execute on function public.get_mutual_followers_saved_place(text) to authenticated;
