-- Explicit follow requests: notifications, acceptance, decline, and relationship status

-- 1. Drop old automatic trigger on user_follows
drop trigger if exists on_user_follow_notification on public.user_follows;
drop function if exists public.handle_user_follow_notification();
drop trigger if exists on_user_unfollow_notification on public.user_follows;
drop function if exists public.handle_user_unfollow_notification();

-- 2. Update notifications type constraint to include follow_accepted
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('follow', 'like', 'comment', 'invite', 'invite_accepted', 'invite_declined', 'follow_accepted'));

-- 3. Add follow_status column to notifications
alter table public.notifications
  add column if not exists follow_status text default null
    check (follow_status is null or follow_status in ('pending', 'accepted', 'declined'));

-- Existing follow notifications (if any) can be marked as accepted
update public.notifications
set follow_status = 'accepted'
where type = 'follow' and follow_status is null;

-- 4. Unique indexes
drop index if exists public.notifications_follow_unique;
create unique index if not exists notifications_follow_unique
  on public.notifications (user_id, actor_id, type)
  where type = 'follow';

create unique index if not exists notifications_follow_accepted_unique
  on public.notifications (user_id, actor_id, type)
  where type = 'follow_accepted';

-- 5. Send a follow request
create or replace function public.send_follow_request(p_target_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
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

  -- Create or refresh pending follow request notification
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
end;
$$;

revoke all on function public.send_follow_request(uuid) from public, anon;
grant execute on function public.send_follow_request(uuid) to authenticated;

-- 6. Cancel a follow request
create or replace function public.cancel_follow_request(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
begin
  v_actor_id := (select auth.uid());
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.notifications
  where user_id = p_target_user_id
    and actor_id = v_actor_id
    and type = 'follow'
    and follow_status = 'pending';
end;
$$;

revoke all on function public.cancel_follow_request(uuid) from public, anon;
grant execute on function public.cancel_follow_request(uuid) to authenticated;

-- 7. Respond to a follow request (accept or decline)
create or replace function public.respond_to_follow_request(
  p_notification_id bigint,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_requester_id uuid;
  v_status text;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_status in ('accepted', 'accept') then
    v_status := 'accepted';
  elsif p_status in ('declined', 'decline', 'rejected', 'reject') then
    v_status := 'declined';
  else
    raise exception 'Status must be accepted or declined';
  end if;

  -- Update incoming follow request notification
  update public.notifications
  set follow_status = v_status,
      is_read = true
  where id = p_notification_id
    and user_id = v_user_id
    and type = 'follow'
  returning actor_id into v_requester_id;

  if not found then
    raise exception 'Follow request notification not found';
  end if;

  if v_status = 'accepted' then
    -- Insert into user_follows
    insert into public.user_follows (follower_id, following_id)
    values (v_requester_id, v_user_id)
    on conflict (follower_id, following_id) do nothing;

    -- Notify requester that request was accepted
    delete from public.notifications
    where user_id = v_requester_id
      and actor_id = v_user_id
      and type = 'follow_accepted';

    insert into public.notifications (
      user_id,
      actor_id,
      type,
      is_read,
      created_at
    )
    values (
      v_requester_id,
      v_user_id,
      'follow_accepted',
      false,
      now()
    );
  else
    -- If declined, make sure they are not following
    delete from public.user_follows
    where follower_id = v_requester_id and following_id = v_user_id;
  end if;
end;
$$;

revoke all on function public.respond_to_follow_request(bigint, text) from public, anon;
grant execute on function public.respond_to_follow_request(bigint, text) to authenticated;

-- 8. Get follow relationship
create or replace function public.get_follow_relationship(p_target_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
begin
  v_actor_id := (select auth.uid());
  if v_actor_id is null or p_target_user_id is null then
    return 'none';
  end if;

  if exists (
    select 1 from public.user_follows
    where follower_id = v_actor_id and following_id = p_target_user_id
  ) then
    return 'following';
  end if;

  if exists (
    select 1 from public.notifications
    where user_id = p_target_user_id
      and actor_id = v_actor_id
      and type = 'follow'
      and follow_status = 'pending'
  ) then
    return 'requested';
  end if;

  return 'none';
end;
$$;

revoke all on function public.get_follow_relationship(uuid) from public, anon;
grant execute on function public.get_follow_relationship(uuid) to authenticated;

-- 9. Unfollow user
create or replace function public.unfollow_user(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
begin
  v_actor_id := (select auth.uid());
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.user_follows
  where follower_id = v_actor_id and following_id = p_target_user_id;

  -- Clean up any follow request / accepted notifications from this relationship
  delete from public.notifications
  where user_id = p_target_user_id
    and actor_id = v_actor_id
    and type in ('follow', 'follow_accepted');
end;
$$;

revoke all on function public.unfollow_user(uuid) from public, anon;
grant execute on function public.unfollow_user(uuid) to authenticated;

-- 10. Update get_user_notifications to return follow_status and prioritize pending requests
drop function if exists public.get_user_notifications(int, int);

create or replace function public.get_user_notifications(
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id bigint,
  type text,
  created_at timestamptz,
  is_read boolean,
  actor_id uuid,
  actor_display_name text,
  actor_username text,
  actor_avatar_path text,
  post_id bigint,
  place_name text,
  place_category text,
  post_rating numeric,
  post_body text,
  post_photo_path text,
  comment_id bigint,
  comment_body text,
  is_following_actor boolean,
  google_place_id text,
  invite_status text,
  follow_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    n.id,
    n.type,
    n.created_at,
    n.is_read,
    n.actor_id,
    coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.username), ''), 'OutThere user') as actor_display_name,
    p.username as actor_username,
    p.avatar_path as actor_avatar_path,
    n.post_id,
    coalesce(pl.display_name, n.place_name) as place_name,
    pl.primary_type_display_name as place_category,
    pst.rating as post_rating,
    pst.body as post_body,
    case when cardinality(pst.photo_paths) > 0 then pst.photo_paths[1] else null end as post_photo_path,
    n.comment_id,
    pc.body as comment_body,
    exists (
      select 1 from public.user_follows uf
      where uf.follower_id = (select auth.uid())
        and uf.following_id = n.actor_id
    ) as is_following_actor,
    coalesce(n.google_place_id, pst.google_place_id) as google_place_id,
    n.invite_status,
    n.follow_status
  from public.notifications n
  left join public.profiles p on p.user_id = n.actor_id
  left join public.posts pst on pst.id = n.post_id
  left join public.places pl on pl.google_place_id = coalesce(n.google_place_id, pst.google_place_id)
  left join public.post_comments pc on pc.id = n.comment_id
  where n.user_id = (select auth.uid())
  order by
    case
      when n.type = 'invite' and coalesce(n.invite_status, 'pending') = 'pending' then 0
      when n.type = 'follow' and coalesce(n.follow_status, 'pending') = 'pending' then 1
      when n.type = 'invite' then 2
      else 3
    end,
    n.created_at desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.get_user_notifications(int, int) from public, anon;
grant execute on function public.get_user_notifications(int, int) to authenticated;

-- 11. Allow authenticated user to unfollow or remove follower
drop policy if exists "Users can unfollow others" on public.user_follows;
drop policy if exists "Users can unfollow or remove followers" on public.user_follows;
create policy "Users can unfollow or remove followers"
  on public.user_follows
  for delete
  to authenticated
  using ((select auth.uid()) in (follower_id, following_id));
