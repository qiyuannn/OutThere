-- ==============================================================================
-- Domain 2: User Profiles, Social Follows & Avatars
-- Purpose: Manages user identity, public/private profile privacy settings,
--          social follow relationships, profile search, and avatar storage.
-- ==============================================================================

-- 1. Profiles Table
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  display_name text not null default '' check (char_length(display_name) <= 60),
  bio text not null default '' check (char_length(bio) <= 240),
  avatar_path text check (char_length(avatar_path) <= 255),
  onboarding_completed boolean not null default false,
  is_private boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint completed_profile_required_fields check (
    not onboarding_completed or (
      username is not null and char_length(btrim(display_name)) > 0
    )
  )
);

-- Optimization indexes for profile lookup and search
create index if not exists profiles_username_idx on public.profiles (username);
create index if not exists profiles_display_name_idx on public.profiles (display_name);
create index if not exists profiles_is_private_idx on public.profiles (is_private);

-- 2. User Follows Table
create table if not exists public.user_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id)
);

create index if not exists user_follows_follower_idx on public.user_follows (follower_id);
create index if not exists user_follows_following_idx on public.user_follows (following_id);

-- 3. Row Level Security: Profiles
alter table public.profiles enable row level security;

revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

-- Users can view their own profile, public profiles, or profiles of users they follow
create policy "Users can read profiles"
  on public.profiles
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or not coalesce(is_private, false)
    or exists (
      select 1 from public.user_follows uf
      where uf.follower_id = (select auth.uid())
        and uf.following_id = profiles.user_id
    )
  );

create policy "Users insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 4. Row Level Security: User Follows
alter table public.user_follows enable row level security;

revoke all on public.user_follows from anon;
grant select, insert, delete on public.user_follows to authenticated;

create policy "Authenticated users can read follows"
  on public.user_follows
  for select
  to authenticated
  using (true);

create policy "Users can follow others"
  on public.user_follows
  for insert
  to authenticated
  with check ((select auth.uid()) = follower_id);

create policy "Users can unfollow or remove followers"
  on public.user_follows
  for delete
  to authenticated
  using ((select auth.uid()) in (follower_id, following_id));

-- 5. Trigger: Automated Profile Creation on User Sign-Up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6. Trigger: Optimistic Concurrency Profile Versioning
create or replace function public.update_profile_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists on_profile_update_version on public.profiles;
create trigger on_profile_update_version
  before update on public.profiles
  for each row execute function public.update_profile_version();

-- 7. Storage Bucket & Policies: Avatars
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy "Signed-in users can read avatars"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'avatars');

create policy "Upload own avatar"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Update own avatar"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Delete own avatar"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- 8. RPC: Fast Profile Search (Autocomplete & Directory)
create or replace function public.search_profiles(
  search_query text,
  limit_count integer default 20
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  bio text,
  avatar_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    user_id,
    username,
    display_name,
    bio,
    avatar_path
  from public.profiles
  where
    onboarding_completed = true
    and username is not null
    and (
      username ilike ('%' || search_query || '%')
      or display_name ilike ('%' || search_query || '%')
    )
  order by
    case
      when lower(username) = lower(search_query) then 0
      when lower(display_name) = lower(search_query) then 1
      when lower(username) like (lower(search_query) || '%') then 2
      when lower(display_name) like (lower(search_query) || '%') then 3
      else 4
    end,
    username asc
  limit least(greatest(limit_count, 1), 50);
$$;

revoke all on function public.search_profiles(text, integer) from public, anon;
grant execute on function public.search_profiles(text, integer) to authenticated;
