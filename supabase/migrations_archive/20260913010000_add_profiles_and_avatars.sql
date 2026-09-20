create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username is null or username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null default '' check (char_length(display_name) <= 60),
  bio text not null default '' check (char_length(bio) <= 240),
  city text not null default '' check (char_length(city) <= 80),
  interests text[] not null default '{}' check (
    cardinality(interests) <= 10 and array_position(interests, null) is null and
    interests <@ array['nature','culture','active','entertainment','relaxation','learning','cafes','local_food','restaurants','desserts']::text[]
  ),
  budget text not null default 'flexible' check (budget in ('free','low','medium','flexible')),
  travel_radius_meters integer not null default 10000 check (travel_radius_meters between 1000 and 50000),
  exploration_style text not null default 'balanced' check (exploration_style in ('familiar','balanced','adventurous')),
  avatar_path text check (avatar_path is null or avatar_path like user_id::text || '/%'),
  onboarding_step integer not null default 0 check (onboarding_step between 0 and 2),
  onboarding_completed boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint completed_profile_required_fields check (not onboarding_completed or (
    username is not null and char_length(btrim(display_name)) > 0 and
    char_length(btrim(city)) > 0 and cardinality(interests) > 0
  ))
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
create policy "Read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.update_profile_version() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  new.created_at = old.created_at;
  new.version = old.version + 1;
  if old.onboarding_completed then new.onboarding_completed = true; end if;
  return new;
end;
$$;
revoke all on function public.update_profile_version() from public;
create trigger update_profile_version before update on public.profiles for each row execute function public.update_profile_version();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg']);
create policy "Read own avatar" on storage.objects for select to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Upload own avatar" on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Delete own avatar" on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
