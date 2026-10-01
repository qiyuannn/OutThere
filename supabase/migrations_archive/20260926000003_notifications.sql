-- Notifications schema, triggers, and RPCs for follow, like, and comment notifications

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('follow', 'like', 'comment')),
  post_id bigint references public.posts(id) on delete cascade,
  comment_id bigint references public.post_comments(id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Unique indexes for deduplication
create unique index if not exists notifications_follow_unique
  on public.notifications (user_id, actor_id, type)
  where type = 'follow';

create unique index if not exists notifications_like_unique
  on public.notifications (user_id, actor_id, post_id, type)
  where type = 'like';

-- Performance indexes
create index if not exists notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc, id desc);

create index if not exists notifications_unread_idx
  on public.notifications (user_id)
  where not is_read;

create index if not exists notifications_actor_id_idx
  on public.notifications (actor_id);

create index if not exists notifications_post_id_idx
  on public.notifications (post_id)
  where post_id is not null;

create index if not exists notifications_comment_id_idx
  on public.notifications (comment_id)
  where comment_id is not null;

-- RLS
alter table public.notifications enable row level security;

revoke all on table public.notifications from anon, authenticated;
grant select, update, delete on table public.notifications to authenticated;

drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
  on public.notifications
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
  on public.notifications
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own notifications" on public.notifications;
create policy "Users can delete their own notifications"
  on public.notifications
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Follow Triggers
create or replace function public.handle_user_follow_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.follower_id <> NEW.following_id then
    insert into public.notifications (user_id, actor_id, type)
    values (NEW.following_id, NEW.follower_id, 'follow')
    on conflict (user_id, actor_id, type) where type = 'follow'
    do update set created_at = now(), is_read = false;
  end if;
  return NEW;
end;
$$;

revoke all on function public.handle_user_follow_notification() from public, anon, authenticated;

drop trigger if exists on_user_follow_notification on public.user_follows;
create trigger on_user_follow_notification
  after insert on public.user_follows
  for each row execute function public.handle_user_follow_notification();

create or replace function public.handle_user_unfollow_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications
  where user_id = OLD.following_id
    and actor_id = OLD.follower_id
    and type = 'follow';
  return OLD;
end;
$$;

revoke all on function public.handle_user_unfollow_notification() from public, anon, authenticated;

drop trigger if exists on_user_unfollow_notification on public.user_follows;
create trigger on_user_unfollow_notification
  after delete on public.user_follows
  for each row execute function public.handle_user_unfollow_notification();

-- Like Triggers
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

-- Comment Trigger
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

-- RPCs
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
  is_following_actor boolean
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
    pl.display_name as place_name,
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
    ) as is_following_actor
  from public.notifications n
  left join public.profiles p on p.user_id = n.actor_id
  left join public.posts pst on pst.id = n.post_id
  left join public.places pl on pl.google_place_id = pst.google_place_id
  left join public.post_comments pc on pc.id = n.comment_id
  where n.user_id = (select auth.uid())
  order by n.created_at desc, n.id desc
  limit greatest(1, least(p_limit, 100))
  offset greatest(0, p_offset);
$$;

revoke all on function public.get_user_notifications(int, int) from public, anon;
grant execute on function public.get_user_notifications(int, int) to authenticated;

create or replace function public.get_unread_notification_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.notifications
  where user_id = (select auth.uid()) and not is_read;
$$;

revoke all on function public.get_unread_notification_count() from public, anon;
grant execute on function public.get_unread_notification_count() to authenticated;

create or replace function public.mark_notifications_read(p_notification_ids bigint[] default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_notification_ids is null then
    update public.notifications
    set is_read = true
    where user_id = (select auth.uid()) and not is_read;
  else
    update public.notifications
    set is_read = true
    where user_id = (select auth.uid()) and id = any(p_notification_ids);
  end if;
end;
$$;

revoke all on function public.mark_notifications_read(bigint[]) from public, anon;
grant execute on function public.mark_notifications_read(bigint[]) to authenticated;

-- Realtime publication
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
