create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  display_name text not null default '' check (char_length(display_name) <= 60),
  avatar_path text check (char_length(avatar_path) <= 255),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint completed_profile_required_fields check (
    not onboarding_completed or (
      username is not null and char_length(btrim(display_name)) > 0
    )
  )
);

create index profiles_username_idx on public.profiles (username);

alter table public.profiles enable row level security;

revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

create policy "Users read own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

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
