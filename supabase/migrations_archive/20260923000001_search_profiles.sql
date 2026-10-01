-- Allow authenticated users to read profiles
drop policy if exists "Read own profile" on public.profiles;
drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Authenticated users can read profiles" on public.profiles;

create policy "Authenticated users can read profiles"
  on public.profiles
  for select
  to authenticated
  using (true);

create index if not exists profiles_display_name_idx on public.profiles (display_name);

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
