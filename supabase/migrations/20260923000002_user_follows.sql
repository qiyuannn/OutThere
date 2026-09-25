create table public.user_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint cannot_follow_self check (follower_id <> following_id)
);

create index user_follows_following_idx on public.user_follows (following_id);
create index user_follows_follower_idx on public.user_follows (follower_id);

alter table public.user_follows enable row level security;

revoke all on table public.user_follows from anon, authenticated;
grant select, insert, delete on table public.user_follows to authenticated;

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

create policy "Users can unfollow others"
  on public.user_follows
  for delete
  to authenticated
  using ((select auth.uid()) = follower_id);
