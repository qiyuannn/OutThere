begin;
select plan(12);

-- Check RLS is enabled on saved_places and passed_places
select ok(
  (select relrowsecurity from pg_class where oid = 'public.saved_places'::regclass),
  'saved_places has row-level security enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.passed_places'::regclass),
  'passed_places has row-level security enabled'
);

-- Check anon has no table privileges on saved_places
select ok(
  not has_table_privilege('anon', 'public.saved_places', 'select,insert,update,delete'),
  'anonymous users have no saved_places privileges'
);

-- Check anon has no table privileges on passed_places
select ok(
  not has_table_privilege('anon', 'public.passed_places', 'select,insert,update,delete'),
  'anonymous users have no passed_places privileges'
);

-- Check authenticated user privileges on saved_places
select ok(has_table_privilege('authenticated', 'public.saved_places', 'select'), 'authenticated users can read saved_places');
select ok(has_table_privilege('authenticated', 'public.saved_places', 'insert'), 'authenticated users can insert saved_places');
select ok(has_table_privilege('authenticated', 'public.saved_places', 'update'), 'authenticated users can update saved_places');
select ok(has_table_privilege('authenticated', 'public.saved_places', 'delete'), 'authenticated users can delete saved_places');

-- Check policy count on saved_places (select, insert, update, delete)
select results_eq(
  $$select count(*)::bigint from pg_policies where schemaname = 'public' and tablename = 'saved_places'$$,
  array[4::bigint],
  'saved_places has exactly four policies covering CRUD operations'
);

-- Check policy count on passed_places (select, insert, update, delete)
select results_eq(
  $$select count(*)::bigint from pg_policies where schemaname = 'public' and tablename = 'passed_places'$$,
  array[4::bigint],
  'passed_places has exactly four policies covering CRUD operations'
);

-- Check RLS enabled on user_place_ratings
select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_place_ratings'::regclass),
  'user_place_ratings has row-level security enabled'
);

-- Check authenticated can insert into user_place_ratings
select ok(
  has_table_privilege('authenticated', 'public.user_place_ratings', 'insert'),
  'authenticated users can insert their own ratings'
);

select * from finish();
rollback;
