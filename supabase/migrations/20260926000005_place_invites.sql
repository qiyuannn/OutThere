-- Place invites support in notifications table and RPCs

-- 1. Alter check constraint on type to include 'invite'
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('follow', 'like', 'comment', 'invite'));

-- 2. Add columns for place invites
alter table public.notifications
  add column if not exists google_place_id text,
  add column if not exists place_name text,
  add column if not exists invite_status text default 'pending'
    check (invite_status is null or invite_status in ('pending', 'accepted', 'declined'));

-- 3. Indexes
create index if not exists notifications_google_place_id_idx
  on public.notifications (google_place_id)
  where google_place_id is not null;

create unique index if not exists notifications_invite_unique
  on public.notifications (user_id, actor_id, google_place_id, type)
  where type = 'invite';

-- 4. RPC to send a place invite notification
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

-- 5. RPC to respond (accept / decline) to a place invite
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
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_status not in ('accepted', 'declined') then
    raise exception 'Status must be either accepted or declined';
  end if;

  update public.notifications
  set invite_status = p_status,
      is_read = true
  where id = p_notification_id
    and user_id = v_user_id
    and type = 'invite';
end;
$$;

revoke all on function public.respond_to_place_invite(bigint, text) from public, anon;
grant execute on function public.respond_to_place_invite(bigint, text) to authenticated;

-- 6. RPC to get invites sent by current user for a place
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

-- 7. Update get_user_notifications to return google_place_id, invite_status and sort invites first
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
  invite_status text
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
    n.invite_status
  from public.notifications n
  left join public.profiles p on p.user_id = n.actor_id
  left join public.posts pst on pst.id = n.post_id
  left join public.places pl on pl.google_place_id = coalesce(n.google_place_id, pst.google_place_id)
  left join public.post_comments pc on pc.id = n.comment_id
  where n.user_id = (select auth.uid())
  order by
    case when n.type = 'invite' then 0 else 1 end,
    n.created_at desc,
    n.id desc
  limit greatest(1, least(p_limit, 100))
  offset greatest(0, p_offset);
$$;

revoke all on function public.get_user_notifications(int, int) from public, anon;
grant execute on function public.get_user_notifications(int, int) to authenticated;
