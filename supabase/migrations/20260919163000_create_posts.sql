create table public.posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  google_place_id text not null references public.places(google_place_id) on delete restrict,
  rating numeric(3, 1) not null check (rating between 0.0 and 10.0),
  body text not null default '' check (char_length(body) <= 2000),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 5),
  created_at timestamptz not null default now(),
  constraint posts_have_content check (char_length(btrim(body)) > 0 or cardinality(photo_paths) > 0)
);

create index posts_created_at_idx on public.posts (created_at desc);
create index posts_user_created_at_idx on public.posts (user_id, created_at desc);
create index posts_google_place_id_idx on public.posts (google_place_id);

alter table public.posts enable row level security;

revoke all on table public.posts from anon, authenticated;
grant select, insert, delete on table public.posts to authenticated;
revoke all on sequence public.posts_id_seq from anon, authenticated;
grant usage, select on sequence public.posts_id_seq to authenticated;

create policy "Signed-in users can read posts"
on public.posts for select
to authenticated
using (true);

create policy "Users can create their own posts"
on public.posts for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own posts"
on public.posts for delete
to authenticated
using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-photos',
  'post-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
);

create policy "Signed-in users can read post photos"
on storage.objects for select
to authenticated
using (bucket_id = 'post-photos');

create policy "Users can upload their own post photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'post-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete their own post photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'post-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
