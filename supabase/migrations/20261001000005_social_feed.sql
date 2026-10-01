-- ==============================================================================
-- Domain 5: Social Posts, Comments, Likes & Feed
-- Purpose: Manages user reviews/check-ins with photos, comments, and likes.
--          Supplies the Explore and Following feed RPCs with privacy filtering.
-- ==============================================================================

-- 1. Posts Table
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  google_place_id text not null references public.places(google_place_id) on delete cascade,
  rating numeric(5, 2) not null check (rating >= 0 and rating <= 10),
  body text check (char_length(body) <= 1000),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 4),
  created_at timestamptz not null default now()
);

create index if not exists posts_user_created_at_id_idx
  on public.posts (user_id, created_at desc, id desc);

create index if not exists posts_place_created_at_idx
  on public.posts (google_place_id, created_at desc);

alter table public.posts enable row level security;

revoke all on table public.posts from anon, authenticated;
grant select, insert, delete on table public.posts to authenticated;

create policy "Anyone authenticated can read posts"
  on public.posts
  for select
  to authenticated
  using (true);

create policy "Users can create their own posts"
  on public.posts
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own posts"
  on public.posts
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- 2. Post Likes Table
create table if not exists public.post_likes (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_user_id_idx on public.post_likes (user_id);

alter table public.post_likes enable row level security;

revoke all on table public.post_likes from anon, authenticated;
grant select, insert, delete on table public.post_likes to authenticated;

create policy "Authenticated users can read post likes"
  on public.post_likes
  for select
  to authenticated
  using (true);

create policy "Users can like posts"
  on public.post_likes
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can remove their post likes"
  on public.post_likes
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- 3. Post Comments Table
create table if not exists public.post_comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) >= 1 and char_length(body) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_created_at_idx
  on public.post_comments (post_id, created_at asc, id asc);

create index if not exists post_comments_user_id_idx
  on public.post_comments (user_id);

alter table public.post_comments enable row level security;

revoke all on table public.post_comments from anon, authenticated;
grant select, insert, delete on table public.post_comments to authenticated;

create policy "Anyone authenticated can read post comments"
  on public.post_comments
  for select
  to authenticated
  using (true);

create policy "Users can create their own post comments"
  on public.post_comments
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own post comments"
  on public.post_comments
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- 4. Storage Bucket & Policies: Post Photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-photos', 'post-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy "Signed-in users can read post photos"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'post-photos');

create policy "Signed-in users can upload post photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Signed-in users can delete own post photos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- 5. RPC: Fetch Feed Posts (Explore, Following, or Target User with Privacy Controls)
create or replace function public.get_feed_posts(
  p_before_created_at timestamptz default null,
  p_before_id bigint default null,
  p_limit integer default 20,
  p_only_current_user boolean default false,
  p_target_user_id uuid default null,
  p_feed_scope text default 'explore'
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
        when p_feed_scope = 'following' then
          posts.user_id = requesting_user.id
          or exists (
            select 1
            from public.user_follows uf
            where uf.follower_id = requesting_user.id
              and uf.following_id = posts.user_id
          )
        else -- 'explore'
          posts.user_id = requesting_user.id
          or exists (
            select 1
            from public.profiles p
            where p.user_id = posts.user_id
              and not coalesce(p.is_private, false)
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

revoke all on function public.get_feed_posts(timestamptz, bigint, integer, boolean, uuid, text) from public, anon;
grant execute on function public.get_feed_posts(timestamptz, bigint, integer, boolean, uuid, text) to authenticated;

-- 6. RPC: Fetch Post Comments
create or replace function public.get_post_comments(p_post_id bigint)
returns table (
  id bigint,
  post_id bigint,
  user_id uuid,
  body text,
  created_at timestamptz,
  display_name text,
  username text,
  avatar_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    comments.id,
    comments.post_id,
    comments.user_id,
    comments.body,
    comments.created_at,
    coalesce(nullif(btrim(profiles.display_name), ''), nullif(profiles.username, ''), 'OutThere user') as display_name,
    profiles.username,
    profiles.avatar_path
  from public.post_comments comments
  left join public.profiles on profiles.user_id = comments.user_id
  where comments.post_id = p_post_id
  order by comments.created_at asc, comments.id asc;
$$;

revoke all on function public.get_post_comments(bigint) from public, anon;
grant execute on function public.get_post_comments(bigint) to authenticated;

-- 7. RPC: Fetch Single Post Details
create or replace function public.get_post_detail(p_post_id bigint)
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
  where posts.id = p_post_id
    and requesting_user.id is not null
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
    requesting_user.id;
$$;

revoke all on function public.get_post_detail(bigint) from public, anon;
grant execute on function public.get_post_detail(bigint) to authenticated;
