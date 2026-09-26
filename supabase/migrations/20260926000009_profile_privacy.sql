-- Migration: Profile Privacy (Public vs Private Profile Toggle)
-- 1. Add is_private column to public.profiles
alter table public.profiles
  add column if not exists is_private boolean not null default false;

-- 2. Update send_follow_request to auto-accept when target user profile is public
create or replace function public.send_follow_request(p_target_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_is_private boolean;
begin
  v_actor_id := (select auth.uid());
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_target_user_id is null or p_target_user_id = v_actor_id then
    raise exception 'Cannot follow yourself';
  end if;

  -- If already following, return 'following'
  if exists (
    select 1 from public.user_follows
    where follower_id = v_actor_id and following_id = p_target_user_id
  ) then
    return 'following';
  end if;

  -- Check if target user profile is private
  select coalesce(is_private, false) into v_is_private
  from public.profiles
  where user_id = p_target_user_id;

  if not coalesce(v_is_private, false) then
    -- PUBLIC PROFILE: auto-accept follow
    insert into public.user_follows (follower_id, following_id)
    values (v_actor_id, p_target_user_id)
    on conflict (follower_id, following_id) do nothing;

    -- Create or refresh notification stating they started following you
    insert into public.notifications (
      user_id,
      actor_id,
      type,
      follow_status,
      is_read,
      created_at
    )
    values (
      p_target_user_id,
      v_actor_id,
      'follow',
      'accepted',
      false,
      now()
    )
    on conflict (user_id, actor_id, type) where type = 'follow'
    do update set
      follow_status = 'accepted',
      is_read = false,
      created_at = now();

    return 'following';
  else
    -- PRIVATE PROFILE: follow request pending approval
    insert into public.notifications (
      user_id,
      actor_id,
      type,
      follow_status,
      is_read,
      created_at
    )
    values (
      p_target_user_id,
      v_actor_id,
      'follow',
      'pending',
      false,
      now()
    )
    on conflict (user_id, actor_id, type) where type = 'follow'
    do update set
      follow_status = 'pending',
      is_read = false,
      created_at = now();

    return 'requested';
  end if;
end;
$$;

revoke all on function public.send_follow_request(uuid) from public, anon;
grant execute on function public.send_follow_request(uuid) to authenticated;

-- 3. Auto-accept pending follow requests when switching profile from private to public
create or replace function public.handle_profile_privacy_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_private is true and new.is_private is false then
    -- Insert accepted follows for any pending requests
    insert into public.user_follows (follower_id, following_id)
    select actor_id, new.user_id
    from public.notifications
    where user_id = new.user_id
      and type = 'follow'
      and follow_status = 'pending'
    on conflict (follower_id, following_id) do nothing;

    -- Update notifications to accepted
    update public.notifications
    set follow_status = 'accepted'
    where user_id = new.user_id
      and type = 'follow'
      and follow_status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_privacy_changed on public.profiles;
create trigger on_profile_privacy_changed
  after update of is_private on public.profiles
  for each row execute function public.handle_profile_privacy_change();

-- 4. Update RLS policies for place ratings and category weights
drop policy if exists "Authenticated users can read place ratings" on public.user_place_ratings;
create policy "Authenticated users can read place ratings"
  on public.user_place_ratings
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.user_id = user_place_ratings.user_id and not coalesce(p.is_private, false)
    )
    or exists (
      select 1 from public.user_follows uf
      where uf.follower_id = (select auth.uid())
        and uf.following_id = user_place_ratings.user_id
    )
  );

drop policy if exists "Users can read food category weights" on public.user_food_category_weights;
create policy "Users can read food category weights"
  on public.user_food_category_weights
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.user_id = user_food_category_weights.user_id and not coalesce(p.is_private, false)
    )
    or exists (
      select 1 from public.user_follows uf
      where uf.follower_id = (select auth.uid())
        and uf.following_id = user_food_category_weights.user_id
    )
  );

drop policy if exists "Users can read activity category weights" on public.user_activity_category_weights;
create policy "Users can read activity category weights"
  on public.user_activity_category_weights
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.user_id = user_activity_category_weights.user_id and not coalesce(p.is_private, false)
    )
    or exists (
      select 1 from public.user_follows uf
      where uf.follower_id = (select auth.uid())
        and uf.following_id = user_activity_category_weights.user_id
    )
  );

-- 5. Update get_feed_posts to enforce privacy when target user is private
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
          and (
            p_target_user_id = requesting_user.id
            or exists (
              select 1 from public.profiles p
              where p.user_id = p_target_user_id and not coalesce(p.is_private, false)
            )
            or exists (
              select 1 from public.user_follows uf
              where uf.follower_id = requesting_user.id
                and uf.following_id = p_target_user_id
            )
          )
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
