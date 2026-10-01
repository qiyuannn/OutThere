-- ==============================================================================
-- Domain 6: Follow Requests, Place Invites & Notification Center
-- Purpose: Complete social graph notifications: follow requests, acceptances,
--          likes, comments, outing invitations, and status tracking.
-- ==============================================================================

-- 1. Notifications Table
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('follow', 'like', 'comment', 'invite', 'invite_accepted', 'invite_declined', 'follow_accepted')),
  post_id bigint references public.posts(id) on delete cascade,
  comment_id bigint references public.post_comments(id) on delete cascade,
  google_place_id text,
  place_name text,
  invite_status text check (invite_status is null or invite_status in ('pending', 'accepted', 'declined')),
  follow_status text check (follow_status is null or follow_status in ('pending', 'accepted', 'declined')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Optimization & Deduplication Indexes
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, is_read, created_at desc);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_google_place_id_idx
  on public.notifications (google_place_id)
  where google_place_id is not null;

create unique index if not exists notifications_follow_unique
  on public.notifications (user_id, actor_id, type)
  where type = 'follow';

create unique index if not exists notifications_follow_accepted_unique
  on public.notifications (user_id, actor_id, type)
  where type = 'follow_accepted';

create unique index if not exists notifications_post_like_unique
  on public.notifications (user_id, actor_id, post_id, type)
  where type = 'like';

create unique index if not exists notifications_invite_unique
  on public.notifications (user_id, actor_id, google_place_id, type)
  where type = 'invite';

create unique index if not exists notifications_invite_response_unique
  on public.notifications (user_id, actor_id, google_place_id, type)
  where type in ('invite_accepted', 'invite_declined');

alter table public.notifications enable row level security;

revoke all on public.notifications from anon;
grant select, update, delete on public.notifications to authenticated;

create policy "Users can read their own notifications"
  on public.notifications
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can update their own notifications"
  on public.notifications
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own notifications"
  on public.notifications
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- 2. Automatic Notification Triggers (Likes & Comments)
create or replace function public.handle_post_like_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_author_id uuid;
begin
  select user_id into v_post_author_id
  from public.posts
  where id = NEW.post_id;

  if v_post_author_id is not null and v_post_author_id <> NEW.user_id then
    insert into public.notifications (user_id, actor_id, type, post_id)
    values (v_post_author_id, NEW.user_id, 'like', NEW.post_id)
    on conflict (user_id, actor_id, post_id, type) where type = 'like'
    do update set created_at = now(), is_read = false;
  end if;
  return NEW;
end;
$$;

revoke all on function public.handle_post_like_notification() from public, anon, authenticated;

drop trigger if exists on_post_like_notification on public.post_likes;
create trigger on_post_like_notification
  after insert on public.post_likes
  for each row execute function public.handle_post_like_notification();

create or replace function public.handle_post_unlike_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications
  where post_id = OLD.post_id
    and actor_id = OLD.user_id
    and type = 'like';
  return OLD;
end;
$$;

revoke all on function public.handle_post_unlike_notification() from public, anon, authenticated;

drop trigger if exists on_post_unlike_notification on public.post_likes;
create trigger on_post_unlike_notification
  after delete on public.post_likes
  for each row execute function public.handle_post_unlike_notification();

create or replace function public.handle_post_comment_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_author_id uuid;
begin
  select user_id into v_post_author_id
  from public.posts
  where id = NEW.post_id;

  if v_post_author_id is not null and v_post_author_id <> NEW.user_id then
    insert into public.notifications (user_id, actor_id, type, post_id, comment_id)
    values (v_post_author_id, NEW.user_id, 'comment', NEW.post_id, NEW.id);
  end if;
  return NEW;
end;
$$;

revoke all on function public.handle_post_comment_notification() from public, anon, authenticated;

drop trigger if exists on_post_comment_notification on public.post_comments;
create trigger on_post_comment_notification
  after insert on public.post_comments
  for each row execute function public.handle_post_comment_notification();

-- 3. Trigger: Auto-Accept Follow Requests when Switching Profile to Public
create or replace function public.handle_profile_privacy_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_private is true and new.is_private is false then
    insert into public.user_follows (follower_id, following_id)
    select actor_id, new.user_id
    from public.notifications
    where user_id = new.user_id
      and type = 'follow'
      and follow_status = 'pending'
    on conflict (follower_id, following_id) do nothing;

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

-- 4. RPC: Send Follow Request (Auto-Accepts for Public Profiles)
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

  if exists (
    select 1 from public.user_follows
    where follower_id = v_actor_id and following_id = p_target_user_id
  ) then
    return 'following';
  end if;

  select coalesce(is_private, false) into v_is_private
  from public.profiles
  where user_id = p_target_user_id;

  if not coalesce(v_is_private, false) then
    insert into public.user_follows (follower_id, following_id)
    values (v_actor_id, p_target_user_id)
    on conflict (follower_id, following_id) do nothing;

    insert into public.notifications (
      user_id, actor_id, type, follow_status, is_read, created_at
    )
    values (
      p_target_user_id, v_actor_id, 'follow', 'accepted', false, now()
    )
    on conflict (user_id, actor_id, type) where type = 'follow'
    do update set
      follow_status = 'accepted', is_read = false, created_at = now();

    return 'following';
  else
    insert into public.notifications (
      user_id, actor_id, type, follow_status, is_read, created_at
    )
    values (
      p_target_user_id, v_actor_id, 'follow', 'pending', false, now()
    )
    on conflict (user_id, actor_id, type) where type = 'follow'
    do update set
      follow_status = 'pending', is_read = false, created_at = now();

    return 'requested';
  end if;
end;
$$;

revoke all on function public.send_follow_request(uuid) from public, anon;
grant execute on function public.send_follow_request(uuid) to authenticated;

-- 5. RPC: Cancel Follow Request
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

-- 6. RPC: Respond to Follow Request (Accept or Decline)
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
    insert into public.user_follows (follower_id, following_id)
    values (v_requester_id, v_user_id)
    on conflict (follower_id, following_id) do nothing;

    delete from public.notifications
    where user_id = v_requester_id
      and actor_id = v_user_id
      and type = 'follow_accepted';

    insert into public.notifications (
      user_id, actor_id, type, is_read, created_at
    )
    values (
      v_requester_id, v_user_id, 'follow_accepted', false, now()
    );
  else
    delete from public.user_follows
    where follower_id = v_requester_id and following_id = v_user_id;
  end if;
end;
$$;

revoke all on function public.respond_to_follow_request(bigint, text) from public, anon;
grant execute on function public.respond_to_follow_request(bigint, text) to authenticated;

-- 7. RPC: Get Follow Relationship Status
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

-- 8. RPC: Unfollow User
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

  delete from public.notifications
  where user_id = p_target_user_id
    and actor_id = v_actor_id
    and type in ('follow', 'follow_accepted');
end;
$$;

revoke all on function public.unfollow_user(uuid) from public, anon;
grant execute on function public.unfollow_user(uuid) to authenticated;

-- 9. RPC: Send Place Invite to a Friend
create or replace function public.send_place_invite(
  p_recipient_id uuid,
  p_google_place_id text,
  p_place_name text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_notification_id bigint;
  v_place_name text;
begin
  v_actor_id := (select auth.uid());
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_recipient_id is null or p_recipient_id = v_actor_id then
    raise exception 'Invalid recipient';
  end if;

  if p_google_place_id is null or btrim(p_google_place_id) = '' then
    raise exception 'Invalid place ID';
  end if;

  v_place_name := nullif(btrim(p_place_name), '');
  if v_place_name is null then
    select display_name into v_place_name
    from public.places
    where google_place_id = p_google_place_id;
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    google_place_id,
    place_name,
    invite_status,
    is_read,
    created_at
  )
  values (
    p_recipient_id,
    v_actor_id,
    'invite',
    p_google_place_id,
    v_place_name,
    'pending',
    false,
    now()
  )
  on conflict (user_id, actor_id, google_place_id, type) where type = 'invite'
  do update set
    created_at = now(),
    is_read = false,
    invite_status = 'pending',
    place_name = coalesce(v_place_name, notifications.place_name)
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

revoke all on function public.send_place_invite(uuid, text, text) from public, anon;
grant execute on function public.send_place_invite(uuid, text, text) to authenticated;

-- 10. RPC: Respond to Place Invite (Accept or Decline)
create or replace function public.respond_to_place_invite(
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
  v_inviter_id uuid;
  v_google_place_id text;
  v_place_name text;
  v_response_type text;
  v_status text;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_status in ('accepted', 'accept') then
    v_status := 'accepted';
    v_response_type := 'invite_accepted';
  elsif p_status in ('declined', 'decline', 'rejected', 'reject') then
    v_status := 'declined';
    v_response_type := 'invite_declined';
  else
    raise exception 'Status must be accepted or declined';
  end if;

  update public.notifications
  set invite_status = v_status,
      is_read = true
  where id = p_notification_id
    and user_id = v_user_id
    and type = 'invite'
  returning actor_id, google_place_id, place_name
  into v_inviter_id, v_google_place_id, v_place_name;

  if not found then
    raise exception 'Invite notification not found';
  end if;

  if v_status = 'accepted' and v_google_place_id is not null then
    insert into public.saved_places (user_id, google_place_id, mode, saved_at)
    values (v_user_id, v_google_place_id, 'food', now())
    on conflict (user_id, google_place_id) do nothing;
  end if;

  if v_inviter_id is not null and v_inviter_id <> v_user_id then
    delete from public.notifications
    where user_id = v_inviter_id
      and actor_id = v_user_id
      and google_place_id = v_google_place_id
      and type in ('invite_accepted', 'invite_declined');

    insert into public.notifications (
      user_id,
      actor_id,
      type,
      google_place_id,
      place_name,
      is_read,
      created_at
    )
    values (
      v_inviter_id,
      v_user_id,
      v_response_type,
      v_google_place_id,
      v_place_name,
      false,
      now()
    );
  end if;
end;
$$;

revoke all on function public.respond_to_place_invite(bigint, text) from public, anon;
grant execute on function public.respond_to_place_invite(bigint, text) to authenticated;

-- 11. RPC: Query Sent Invites for Place
create or replace function public.get_sent_place_invites(p_google_place_id text)
returns table (recipient_id uuid, invite_status text)
language sql
stable
security definer
set search_path = ''
as $$
  select user_id as recipient_id, invite_status
  from public.notifications
  where actor_id = (select auth.uid())
    and google_place_id = p_google_place_id
    and type = 'invite';
$$;

revoke all on function public.get_sent_place_invites(text) from public, anon;
grant execute on function public.get_sent_place_invites(text) to authenticated;

-- 12. RPC: Fetch Mutual Followers Who Saved a Place
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

-- 13. RPC: Fetch User Notifications (Prioritizes Pending Invites & Follow Requests)
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

-- 14. RPC: Unread Notification Count
create or replace function public.get_unread_notification_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.notifications
  where user_id = (select auth.uid())
    and is_read = false;
$$;

revoke all on function public.get_unread_notification_count() from public, anon;
grant execute on function public.get_unread_notification_count() to authenticated;

-- 15. RPC: Mark Notifications Read
create or replace function public.mark_notifications_read(p_notification_ids bigint[] default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications
  set is_read = true
  where user_id = (select auth.uid())
    and (p_notification_ids is null or id = any(p_notification_ids));
$$;

revoke all on function public.mark_notifications_read(bigint[]) from public, anon;
grant execute on function public.mark_notifications_read(bigint[]) to authenticated;
