begin;
select plan(16);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.posts'::regclass),
  'posts has row-level security enabled'
);

select ok(
  not has_table_privilege('anon', 'public.posts', 'select,insert,update,delete'),
  'anonymous users have no posts privileges'
);

select ok(has_table_privilege('authenticated', 'public.posts', 'select'), 'signed-in users can read posts');
select ok(has_table_privilege('authenticated', 'public.posts', 'insert'), 'signed-in users can create posts');
select ok(has_table_privilege('authenticated', 'public.posts', 'delete'), 'signed-in users can delete posts');
select ok(not has_table_privilege('authenticated', 'public.posts', 'update'), 'posts cannot be edited through the client');

select results_eq(
  $$select count(*)::bigint from pg_policies where schemaname = 'public' and tablename = 'posts'$$,
  array[3::bigint],
  'posts has one policy for each exposed operation'
);

select results_eq(
  $$select count(*)::bigint from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like '%post photo%'$$,
  array[3::bigint],
  'post photos have read, upload, and delete policies'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.post_likes'::regclass),
  'post_likes has row-level security enabled'
);

select ok(
  not has_table_privilege('anon', 'public.post_likes', 'select,insert,update,delete'),
  'anonymous users have no post_likes privileges'
);

select ok(has_table_privilege('authenticated', 'public.post_likes', 'select'), 'signed-in users can read likes allowed by RLS');
select ok(has_table_privilege('authenticated', 'public.post_likes', 'insert'), 'signed-in users can like posts');
select ok(has_table_privilege('authenticated', 'public.post_likes', 'delete'), 'signed-in users can remove their likes');
select ok(not has_table_privilege('authenticated', 'public.post_likes', 'update'), 'post likes cannot be edited');

select results_eq(
  $$select count(*)::bigint from pg_policies where schemaname = 'public' and tablename = 'post_likes'$$,
  array[3::bigint],
  'post_likes has one policy for each exposed operation'
);

select ok(
  has_function_privilege('authenticated', 'public.get_feed_posts(timestamptz,bigint,integer,boolean)', 'execute')
  and not has_function_privilege('anon', 'public.get_feed_posts(timestamptz,bigint,integer,boolean)', 'execute'),
  'only signed-in users can call the feed function'
);

select * from finish();
rollback;
