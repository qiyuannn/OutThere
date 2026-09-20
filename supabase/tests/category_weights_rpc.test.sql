begin;
select plan(4);

select has_function(
  'public',
  'replace_user_category_weights',
  array['text', 'jsonb'],
  'batched category-weight function exists'
);

select ok(
  not has_function_privilege('anon', 'public.replace_user_category_weights(text, jsonb)', 'execute'),
  'anonymous users cannot replace category weights'
);

select ok(
  has_function_privilege('authenticated', 'public.replace_user_category_weights(text, jsonb)', 'execute'),
  'authenticated users can replace their category weights'
);

select results_eq(
  $$
    select prosecdef
    from pg_proc
    where oid = 'public.replace_user_category_weights(text, jsonb)'::regprocedure
  $$,
  array[false],
  'function runs with caller privileges so RLS remains enforced'
);

select * from finish();
rollback;
