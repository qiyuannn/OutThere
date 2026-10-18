begin;
select plan(10);

-- Exercise actual row access, including unpublished uploads and cleanup.
set local storage.allow_delete_query = 'true';
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');
insert into public.places (google_place_id) values ('post-photo-rls-test');
insert into public.posts (user_id, google_place_id, rating, photo_paths)
values (
  '11111111-1111-1111-1111-111111111111', 'post-photo-rls-test', 8,
  array['11111111-1111-1111-1111-111111111111/published.jpg']
);
insert into storage.objects (bucket_id, name)
values ('post-photos', '11111111-1111-1111-1111-111111111111/published.jpg');

select ok(
  exists (select 1 from storage.buckets where id = 'post-photos' and not public),
  'post photos use a private bucket'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('post-photos', '11111111-1111-1111-1111-111111111111/pending.jpg')$$,
  'owners can upload into their own folder'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('post-photos', '22222222-2222-2222-2222-222222222222/spoofed.jpg')$$,
  '42501', 'new row violates row-level security policy for table "objects"',
  'users cannot upload into another user folder'
);

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select results_eq(
  $$select name from storage.objects where bucket_id = 'post-photos' order by name$$,
  array['11111111-1111-1111-1111-111111111111/published.jpg'],
  'other users can read published photos but cannot read pending uploads'
);
select results_eq(
  $$with deleted as (delete from storage.objects where bucket_id = 'post-photos' returning id)
    select count(*) from deleted$$,
  array[0::bigint],
  'users cannot delete another user photos'
);

set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select results_eq(
  $$select count(*) from storage.objects where bucket_id = 'post-photos'$$,
  array[2::bigint],
  'owners can read their published and pending photos'
);
select results_eq(
  $$with changed as (update storage.objects set name = 'renamed.jpg'
    where bucket_id = 'post-photos' returning id) select count(*) from changed$$,
  array[0::bigint],
  'photo objects cannot be renamed or overwritten through client updates'
);
select results_eq(
  $$with deleted as (delete from storage.objects
    where name = '11111111-1111-1111-1111-111111111111/pending.jpg' returning id)
    select count(*) from deleted$$,
  array[1::bigint],
  'owners can clean up uncommitted uploads'
);

set local role anon;
set local request.jwt.claim.sub = '';
select results_eq(
  $$select count(*) from storage.objects where bucket_id = 'post-photos'$$,
  array[0::bigint],
  'anonymous users cannot read even published photos'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('post-photos', '11111111-1111-1111-1111-111111111111/anonymous.jpg')$$,
  '42501', 'new row violates row-level security policy for table "objects"',
  'anonymous users cannot upload photos'
);

reset role;
select * from finish();
rollback;
