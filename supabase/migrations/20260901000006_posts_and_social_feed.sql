create table public.posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  google_place_id text not null references public.places(google_place_id) on delete cascade,
  rating numeric(5, 2) not null check (rating >= 0 and rating <= 10),
  body text check (char_length(body) <= 1000),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 4),
  created_at timestamptz not null default now()
);

create index posts_user_created_at_id_idx
  on public.posts (user_id, created_at desc, id desc);

create index posts_place_created_at_idx
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

create table public.post_likes (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index post_likes_user_id_idx on public.post_likes (user_id);

alter table public.post_likes enable row level security;

revoke all on table public.post_likes from anon, authenticated;
grant select, insert, delete on table public.post_likes to authenticated;

create policy "Users can read their own post likes"
  on public.post_likes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

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

create or replace function public.get_feed_posts(
  p_before_created_at timestamptz default null,
  p_before_id bigint default null,
  p_limit integer default 20,
  p_only_current_user boolean default false
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
  liked_by_me boolean
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
    count(post_likes.user_id)::bigint as like_count,
    coalesce(bool_or(post_likes.user_id = requesting_user.id), false) as liked_by_me
  from public.posts
  cross join requesting_user
  left join public.profiles on profiles.user_id = posts.user_id
  left join public.places on places.google_place_id = posts.google_place_id
  left join public.post_likes on post_likes.post_id = posts.id
  where requesting_user.id is not null
    and (not p_only_current_user or posts.user_id = requesting_user.id)
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

revoke all on function public.get_feed_posts(timestamptz, bigint, integer, boolean) from public, anon;
grant execute on function public.get_feed_posts(timestamptz, bigint, integer, boolean) to authenticated;
