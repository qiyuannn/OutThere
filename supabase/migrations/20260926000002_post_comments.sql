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
