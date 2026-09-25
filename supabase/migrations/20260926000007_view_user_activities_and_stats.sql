-- Allow authenticated users to view ratings and category weights for other profiles
drop policy if exists "Users can read own ratings" on public.user_place_ratings;
drop policy if exists "Authenticated users can read place ratings" on public.user_place_ratings;
create policy "Authenticated users can read place ratings"
  on public.user_place_ratings
  for select
  to authenticated
  using (true);

drop policy if exists "Users manage their food category weights" on public.user_food_category_weights;
drop policy if exists "Users can read food category weights" on public.user_food_category_weights;
create policy "Users can read food category weights"
  on public.user_food_category_weights
  for select
  to authenticated
  using (true);

drop policy if exists "Users manage their own food category weights" on public.user_food_category_weights;
create policy "Users manage their own food category weights"
  on public.user_food_category_weights
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their activity category weights" on public.user_activity_category_weights;
drop policy if exists "Users can read activity category weights" on public.user_activity_category_weights;
create policy "Users can read activity category weights"
  on public.user_activity_category_weights
  for select
  to authenticated
  using (true);

drop policy if exists "Users manage their own activity category weights" on public.user_activity_category_weights;
create policy "Users manage their own activity category weights"
  on public.user_activity_category_weights
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Update get_feed_posts to support fetching posts for a target user (past activities)
drop function if exists public.get_feed_posts(timestamptz, bigint, integer, boolean);
drop function if exists public.get_feed_posts(timestamptz, bigint, integer, boolean, uuid);

create or replace function public.get_feed_posts(
  p_before_created_at timestamptz default null,
  p_before_id bigint default null,
  p_limit integer default 20,
  p_only_current_user boolean default false,
  p_target_user_id uuid default null
)
returns table (
  id bigint,
  user_id uuid,
  google_place_id text,
  rating numeric,
  body text,
  photo_paths text[],
  created_at timestamptz,
  display_name text,
  avatar_path text,
  place_name text,
  place_category text,
  place_address text,
  place_price_level text,
  regular_opening_hours jsonb,
  like_count bigint,
  liked_by_me boolean,
  comment_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with requesting_user as (
    select auth.uid() as id
  )
  select
    posts.id,
    posts.user_id,
    posts.google_place_id,
    posts.rating,
    posts.body,
    posts.photo_paths,
    posts.created_at,
    coalesce(nullif(btrim(profiles.display_name), ''), nullif(profiles.username, ''), 'OutThere user') as display_name,
    profiles.avatar_path,
    coalesce(nullif(btrim(places.display_name), ''), 'Unknown place') as place_name,
    places.primary_type_display_name as place_category,
    places.formatted_address as place_address,
    places.price_level as place_price_level,
    places.regular_opening_hours,
    count(distinct post_likes.user_id)::bigint as like_count,
    coalesce(bool_or(post_likes.user_id = requesting_user.id), false) as liked_by_me,
    (select count(*)::bigint from public.post_comments pc where pc.post_id = posts.id) as comment_count
  from public.posts
  cross join requesting_user
  left join public.profiles on profiles.user_id = posts.user_id
  left join public.places on places.google_place_id = posts.google_place_id
  left join public.post_likes on post_likes.post_id = posts.id
  where requesting_user.id is not null
    and (
      case
        when p_target_user_id is not null then
          posts.user_id = p_target_user_id
        when p_only_current_user then
          posts.user_id = requesting_user.id
        else
          posts.user_id = requesting_user.id
          or exists (
            select 1
            from public.user_follows uf
            where uf.follower_id = requesting_user.id
              and uf.following_id = posts.user_id
          )
      end
    )
    and (
      p_before_created_at is null
      or p_before_id is null
      or (posts.created_at, posts.id) < (p_before_created_at, p_before_id)
    )
  group by
    posts.id,
    profiles.display_name,
    profiles.username,
    profiles.avatar_path,
    places.display_name,
    places.primary_type_display_name,
    places.formatted_address,
    places.price_level,
    places.regular_opening_hours,
    requesting_user.id
  order by posts.created_at desc, posts.id desc
  limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.get_feed_posts(timestamptz, bigint, integer, boolean, uuid) from public, anon;
grant execute on function public.get_feed_posts(timestamptz, bigint, integer, boolean, uuid) to authenticated;
