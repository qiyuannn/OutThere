-- Private social storage: clients use the narrow, authenticated social_api RPC.
-- Existing personal profiles/ratings/saved-place policies remain private.
create schema if not exists social_private;
revoke all on schema social_private from public, anon;
grant usage on schema social_private to authenticated, service_role;

create table social_private.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  default_visibility text not null default 'private' check (default_visibility in ('private','friends'))
);
create table social_private.connections (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references auth.users(id) on delete cascade,
  recipient uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  check (sender <> recipient)
);
create unique index social_connection_pair on social_private.connections (least(sender,recipient), greatest(sender,recipient));
create index social_connections_sender on social_private.connections(sender,status);
create index social_connections_recipient on social_private.connections(recipient,status);
create table social_private.blocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,target_id), check (user_id <> target_id)
);
create index social_blocks_target on social_private.blocks(target_id,user_id);
create table social_private.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  rating_id uuid not null unique references public.user_place_ratings(id) on delete cascade,
  google_place_id text not null references public.places(google_place_id),
  mode text not null check (mode in ('food','activities')),
  score numeric(3,1) not null,
  notes text not null default '' check (char_length(notes) <= 2000),
  recommend boolean not null,
  visibility text not null check (visibility in ('private','friends')),
  created_at timestamptz not null default now()
);
create index social_posts_author on social_private.posts(author_id,created_at desc,id desc);
create index social_posts_page on social_private.posts(created_at desc,id desc);
create index social_posts_place on social_private.posts(google_place_id);
create table social_private.reactions (
  post_id uuid not null references social_private.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(post_id,user_id)
);
create index social_reactions_user on social_private.reactions(user_id);
create table social_private.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references social_private.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index social_comments_post on social_private.comments(post_id,created_at desc,id desc);
create index social_comments_author on social_private.comments(author_id);
create table social_private.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('request','accepted','like','comment')),
  connection_id uuid references social_private.connections(id) on delete cascade,
  post_id uuid references social_private.posts(id) on delete cascade,
  comment_id uuid references social_private.comments(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index social_notifications_page on social_private.notifications(recipient_id,created_at desc,id desc);
create index social_notifications_actor on social_private.notifications(actor_id);
create index social_notifications_connection on social_private.notifications(connection_id);
create index social_notifications_post on social_private.notifications(post_id);
create index social_notifications_comment on social_private.notifications(comment_id);
create unique index social_notifications_like_once on social_private.notifications(recipient_id,actor_id,post_id) where kind='like';

alter table social_private.settings enable row level security;
alter table social_private.connections enable row level security;
alter table social_private.blocks enable row level security;
alter table social_private.posts enable row level security;
alter table social_private.reactions enable row level security;
alter table social_private.comments enable row level security;
alter table social_private.notifications enable row level security;
revoke all on all tables in schema social_private from public, anon, authenticated;
grant all on all tables in schema social_private to service_role;

-- Helpers are accessible only inside the explicitly checked API / policies.
create function social_private.blocked(a uuid,b uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from social_private.blocks where (user_id=a and target_id=b) or (user_id=b and target_id=a));
$$;
create function social_private.friends(a uuid,b uuid) returns boolean language sql stable set search_path='' as $$
 select not social_private.blocked(a,b) and exists(select 1 from social_private.connections where status='accepted' and ((sender=a and recipient=b) or (sender=b and recipient=a)));
$$;
create function social_private.visible_profile(viewer uuid,target uuid) returns boolean language sql stable set search_path='' as $$
 select viewer is not null and (viewer=target or (not social_private.blocked(viewer,target) and exists(select 1 from social_private.settings where user_id=target and enabled)));
$$;
create function social_private.visible_post(viewer uuid,post uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from social_private.posts p where p.id=post and (p.author_id=viewer or (p.visibility='friends' and social_private.visible_profile(viewer,p.author_id) and social_private.friends(viewer,p.author_id))));
$$;
create function social_private.person(target uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',p.user_id,'username',p.username,'name',p.display_name,'bio',p.bio,'avatar_path',p.avatar_path) from public.profiles p where p.user_id=target;
$$;
create function social_private.post_json(viewer uuid,post uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',p.id,'author',social_private.person(p.author_id),'google_place_id',p.google_place_id,'mode',p.mode,'score',p.score,'notes',p.notes,'recommend',p.recommend,'visibility',p.visibility,'created_at',p.created_at,
 'liked',exists(select 1 from social_private.reactions r where r.post_id=p.id and r.user_id=viewer),
 'like_count',(select count(*) from social_private.reactions r where r.post_id=p.id and not social_private.blocked(viewer,r.user_id)),
 'comment_count',(select count(*) from social_private.comments c where c.post_id=p.id and social_private.visible_profile(viewer,c.author_id)))
 from social_private.posts p where p.id=post;
$$;

alter table public.user_place_ratings add column social_visibility text not null default 'private' check (social_visibility in ('private','friends'));
-- Sharing is transactional with saving the rating. Recalibration does not change its audience.
create function social_private.sync_rating_post() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.social_visibility='friends' then
   if not exists(select 1 from social_private.settings where user_id=new.user_id and enabled) then
     raise exception 'Enable your social profile before sharing ratings.' using errcode='P0001';
   end if;
   insert into social_private.posts(author_id,rating_id,google_place_id,mode,score,notes,recommend,visibility)
   values(new.user_id,new.id,new.google_place_id,new.mode,new.rating,left(coalesce(new.notes,''),2000),new.recommend,'friends')
   on conflict(rating_id) do update set score=excluded.score,notes=excluded.notes,recommend=excluded.recommend,visibility=excluded.visibility,mode=excluded.mode;
 else
   update social_private.posts set visibility='private',score=new.rating,notes=left(coalesce(new.notes,''),2000),recommend=new.recommend where rating_id=new.id;
 end if;
 return new;
end;
$$;
create trigger sync_social_rating after insert or update of rating,notes,recommend,social_visibility on public.user_place_ratings for each row execute function social_private.sync_rating_post();

create function social_private.api(action text, payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare
 me uuid := auth.uid(); target uuid; post uuid; item uuid; row_connection social_private.connections;
 q text; mode text; text_body text; result jsonb; found_post social_private.posts;
 cutoff timestamptz := coalesce((payload->>'before')::timestamptz,'infinity');
 cutoff_id uuid := coalesce((payload->>'before_id')::uuid,'ffffffff-ffff-ffff-ffff-ffffffffffff');
 page_offset integer := greatest(0,least(coalesce((payload->>'offset')::integer,0),5000));
begin
 if me is null then raise exception 'Sign in to use social features.' using errcode='42501'; end if;
 if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>12000 then raise exception 'Invalid request.'; end if;
 target := (payload->>'user_id')::uuid; post := (payload->>'post_id')::uuid; item := (payload->>'id')::uuid;
 if action='settings' then
   return jsonb_build_object('enabled',coalesce((select enabled from social_private.settings where user_id=me),false),'default_visibility',coalesce((select default_visibility from social_private.settings where user_id=me),'private'));
 elsif action='settings_update' then
   if jsonb_typeof(payload->'enabled') is distinct from 'boolean' or coalesce(payload->>'default_visibility','') not in ('private','friends') then raise exception 'Choose valid privacy settings.'; end if;
   if (payload->>'enabled')::boolean and not exists(select 1 from public.profiles where user_id=me and onboarding_completed and username is not null) then raise exception 'Complete your profile first.'; end if;
   insert into social_private.settings(user_id,enabled,default_visibility) values(me,(payload->>'enabled')::boolean,case when (payload->>'enabled')::boolean then payload->>'default_visibility' else 'private' end)
   on conflict(user_id) do update set enabled=excluded.enabled,default_visibility=excluded.default_visibility;
   if not (payload->>'enabled')::boolean then
     update public.user_place_ratings set social_visibility='private' where user_id=me and social_visibility='friends';
   end if;
   return social_private.api('settings');
 elsif action='people' then
   q := btrim(coalesce(payload->>'query',''));
   if char_length(q)<2 or char_length(q)>80 then return '[]'; end if;
   -- Literal substring matching, including underscores in usernames (not SQL wildcards).
   select coalesce(jsonb_agg(person),'[]') into result from (
     select social_private.person(p.user_id) person from public.profiles p join social_private.settings s on s.user_id=p.user_id
     where s.enabled and p.user_id<>me and not social_private.blocked(me,p.user_id)
       and (strpos(lower(p.username),lower(q))>0 or strpos(lower(p.display_name),lower(q))>0)
     order by p.username,p.user_id limit 21 offset page_offset
   ) t; return result;
 elsif action='profile' then
   target:=coalesce(target,me);
   if not social_private.visible_profile(me,target) then raise exception 'Profile unavailable.' using errcode='42501'; end if;
   select * into row_connection from social_private.connections where (sender=me and recipient=target) or (sender=target and recipient=me);
   return jsonb_build_object('person',social_private.person(target),'relationship',case when target=me then 'self' when row_connection.status='accepted' then 'friends' when row_connection.sender=me then 'outgoing' when row_connection.recipient=me then 'incoming' else 'none' end);
 elsif action='connections' then
   mode:=coalesce(payload->>'mode','friends');
   if mode not in ('friends','incoming','outgoing','blocked') then raise exception 'Invalid connection list.'; end if;
   if mode='blocked' then
     select coalesce(jsonb_agg(person),'[]') into result from (select social_private.person(b.target_id) person from social_private.blocks b where b.user_id=me order by b.created_at desc,b.target_id limit 21 offset page_offset) t;
   else
     select coalesce(jsonb_agg(person),'[]') into result from (
       select social_private.person(case when c.sender=me then c.recipient else c.sender end) person
       from social_private.connections c where
       ((mode='friends' and c.status='accepted' and me in (c.sender,c.recipient)) or (mode='incoming' and c.status='pending' and c.recipient=me) or (mode='outgoing' and c.status='pending' and c.sender=me))
       and social_private.visible_profile(me,case when c.sender=me then c.recipient else c.sender end)
       order by c.created_at desc,c.id limit 21 offset page_offset
     ) t;
   end if; return result;
 elsif action in ('request','accept','decline','cancel','remove_friend','block','unblock') then
   if target is null or target=me then raise exception 'Choose another person.'; end if;
   -- Serialize mutations for an unordered pair, including crossed requests and blocks.
   perform pg_advisory_xact_lock(hashtextextended(least(me,target)::text||greatest(me,target)::text,0));
   if action='unblock' then delete from social_private.blocks where user_id=me and target_id=target; return '{}'; end if;
   if action='block' then
     if not exists(select 1 from auth.users where id=target) then raise exception 'Profile unavailable.'; end if;
     insert into social_private.blocks(user_id,target_id) values(me,target) on conflict do nothing;
     delete from social_private.connections where (sender=me and recipient=target) or (sender=target and recipient=me);
     delete from social_private.notifications where (actor_id=me and recipient_id=target) or (actor_id=target and recipient_id=me);
     return '{}';
   end if;
   if social_private.blocked(me,target) then raise exception 'Connection unavailable.' using errcode='42501'; end if;
   select * into row_connection from social_private.connections where (sender=me and recipient=target) or (sender=target and recipient=me) for update;
   if action='request' then
     if not social_private.visible_profile(me,target) or not exists(select 1 from social_private.settings where user_id=me and enabled) then raise exception 'Enable your social profile and choose an available person.'; end if;
     if row_connection.id is not null then return '{}'; end if;
     if (select count(*) from social_private.connections where sender=me and status='pending')>=100 then raise exception 'You have too many pending requests.'; end if;
     insert into social_private.connections(sender,recipient) values(me,target) returning * into row_connection;
     insert into social_private.notifications(recipient_id,actor_id,kind,connection_id) values(target,me,'request',row_connection.id);
   elsif action='accept' then
     if row_connection.recipient<>me or row_connection.status<>'pending' or row_connection.id is null then raise exception 'Request is no longer available.'; end if;
     if not social_private.visible_profile(me,target) then raise exception 'Profile unavailable.'; end if;
     update social_private.connections set status='accepted' where id=row_connection.id;
     delete from social_private.notifications where connection_id=row_connection.id;
     insert into social_private.notifications(recipient_id,actor_id,kind,connection_id) values(target,me,'accepted',row_connection.id);
   elsif action='decline' then
     delete from social_private.connections where id=row_connection.id and recipient=me and status='pending';
   elsif action='cancel' then
     delete from social_private.connections where id=row_connection.id and sender=me and status='pending';
   elsif action='remove_friend' then
     delete from social_private.connections where id=row_connection.id and status='accepted';
   end if; return '{}';
 elsif action='rating_visibility' then
   if coalesce(payload->>'visibility','') not in ('private','friends') then raise exception 'Choose a valid audience.'; end if;
   update public.user_place_ratings set social_visibility=payload->>'visibility' where id=item and user_id=me;
   if not found then raise exception 'Rating unavailable.' using errcode='42501'; end if;
   return '{}';
 elsif action='feed' then
   if target is not null and not social_private.visible_profile(me,target) then raise exception 'Profile unavailable.' using errcode='42501'; end if;
   select coalesce(jsonb_agg(value),'[]') into result from (
     select social_private.post_json(me,p.id) value from social_private.posts p
     where (target is null or p.author_id=target) and social_private.visible_post(me,p.id)
       and (p.created_at,p.id)<(cutoff,cutoff_id)
     order by p.created_at desc,p.id desc limit 21
   ) t; return result;
 elsif action in ('post','like','unlike','comments','comment','delete_post','post_visibility') then
   if post is null or not social_private.visible_post(me,post) then raise exception 'This post is private or no longer available.' using errcode='42501'; end if;
   select * into found_post from social_private.posts where id=post;
   perform pg_advisory_xact_lock(hashtextextended(least(me,found_post.author_id)::text||greatest(me,found_post.author_id)::text,0));
   select * into found_post from social_private.posts where id=post for update;
   -- Recheck after acquiring the post lock, which serializes deletion and engagement.
   if found_post.id is null or not social_private.visible_post(me,post) then raise exception 'Post unavailable.' using errcode='42501'; end if;
   if action in ('like','comment') and not exists(select 1 from social_private.settings where user_id=me and enabled) then raise exception 'Enable your social profile before joining the conversation.'; end if;
   if action='post' then return social_private.post_json(me,post);
   elsif action='delete_post' then
     if found_post.author_id<>me then raise exception 'Only the author can delete this post.' using errcode='42501'; end if;
     update public.user_place_ratings set social_visibility='private' where id=found_post.rating_id;
     delete from social_private.posts where id=post;
   elsif action='post_visibility' then
     if found_post.author_id<>me then raise exception 'Only the author can change sharing.' using errcode='42501'; end if;
     if coalesce(payload->>'visibility','') not in ('private','friends') then raise exception 'Choose a valid audience.'; end if;
     update public.user_place_ratings set social_visibility=payload->>'visibility' where id=found_post.rating_id;
   elsif action='like' then
     insert into social_private.reactions(post_id,user_id) values(post,me) on conflict do nothing;
     if found and found_post.author_id<>me then
       insert into social_private.notifications(recipient_id,actor_id,kind,post_id) values(found_post.author_id,me,'like',post) on conflict do nothing;
     end if;
   elsif action='unlike' then
     delete from social_private.reactions where post_id=post and user_id=me;
     delete from social_private.notifications where post_id=post and actor_id=me and kind='like';
   elsif action='comments' then
     select coalesce(jsonb_agg(value),'[]') into result from (
       select jsonb_build_object('id',c.id,'author',social_private.person(c.author_id),'body',c.body,'created_at',c.created_at) value
       from social_private.comments c where c.post_id=post and social_private.visible_profile(me,c.author_id)
         and (c.created_at,c.id)<(cutoff,cutoff_id) order by c.created_at desc,c.id desc limit 21
     ) t; return result;
   elsif action='comment' then
     text_body:=btrim(coalesce(payload->>'body',''));
     if char_length(text_body) not between 1 and 1000 then raise exception 'Comments must be 1–1000 characters.'; end if;
     -- Caller-generated UUID makes retry after an uncertain network response idempotent.
     if item is null then raise exception 'Missing comment identifier.'; end if;
     if exists(select 1 from social_private.comments where id=item) then
       if exists(select 1 from social_private.comments where id=item and author_id=me and post_id=post) then return '{}'; end if;
       raise exception 'Invalid comment identifier.';
     end if;
     if (select count(*) from social_private.comments where author_id=me and created_at>now()-interval '1 minute')>=10 then raise exception 'Please wait before posting more comments.'; end if;
     insert into social_private.comments(id,post_id,author_id,body) values(item,post,me,text_body);
     if found_post.author_id<>me then insert into social_private.notifications(recipient_id,actor_id,kind,post_id,comment_id) values(found_post.author_id,me,'comment',post,item); end if;
   end if; return '{}';
 elsif action='delete_comment' then
   delete from social_private.comments where id=item and author_id=me;
   return '{}';
 elsif action in ('notifications','unread','mark_read') then
   if action='mark_read' then
     update social_private.notifications set read_at=now() where recipient_id=me and id=item;
     return '{}';
   end if;
   select coalesce(jsonb_agg(value),'[]') into result from (
     select jsonb_build_object('id',n.id,'actor',social_private.person(n.actor_id),'kind',n.kind,'post_id',n.post_id,'read',n.read_at is not null,'created_at',n.created_at) value
     from social_private.notifications n where n.recipient_id=me
       and not social_private.blocked(me,n.actor_id) and social_private.visible_profile(me,n.actor_id)
       and (n.post_id is null or social_private.visible_post(me,n.post_id))
       and (action<>'unread' or n.read_at is null)
       and (n.created_at,n.id)<(cutoff,cutoff_id)
     order by n.created_at desc,n.id desc limit 21
   ) t;
   if action='unread' then return jsonb_build_object('count',jsonb_array_length(result)); end if;
   return result;
 end if;
 raise exception 'Unknown social action.';
end;
$$;

-- The wrapper is SECURITY INVOKER; only the private implementation elevates,
-- authenticates auth.uid(), and authorizes every operation and returned field.
create function public.social_api(action text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$
 select social_private.api(action,payload);
$$;
revoke all on all functions in schema social_private from public, anon, authenticated;
grant execute on function social_private.api(text,jsonb) to authenticated;
revoke all on function public.social_api(text,jsonb) from public, anon;
grant execute on function public.social_api(text,jsonb) to authenticated;

-- Avatar access is limited to the current photo of opted-in, unblocked profiles.
create function social_private.can_read_avatar(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.profiles p where p.avatar_path=object_name and social_private.visible_profile(auth.uid(),p.user_id));
$$;
revoke all on function social_private.can_read_avatar(text) from public,anon;
grant execute on function social_private.can_read_avatar(text) to authenticated;
create policy "Read opted-in social avatar" on storage.objects for select to authenticated
using (bucket_id='avatars' and social_private.can_read_avatar(name));
;
