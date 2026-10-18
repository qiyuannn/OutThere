begin;

-- Supabase grants EXECUTE directly to anon by default. Revoking PUBLIC
-- alone in the initial schema does not remove that inherited default grant.
revoke execute on function public.replace_user_category_weights(text, jsonb) from public, anon;
revoke execute on function public.get_feed_posts(timestamptz, bigint, integer, boolean, uuid, text) from public, anon;

-- Storage configuration was omitted from the initial application-schema dump.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-photos', 'post-photos', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- Owners can read pending uploads for cleanup. Other users can read photos
-- only when referenced by a post they can select under the posts RLS policies.
create policy "Read post photos" on storage.objects
for select to authenticated
using (
  bucket_id = 'post-photos'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1 from public.posts p
      where storage.objects.name = any(p.photo_paths)
    )
  )
);

create policy "Upload own post photos" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'post-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Delete own post photos" on storage.objects
for delete to authenticated
using (
  bucket_id = 'post-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
