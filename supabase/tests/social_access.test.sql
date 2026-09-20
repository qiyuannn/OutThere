begin;

-- Keep this test runnable through `supabase db query`, where pgTAP is not
-- installed. Any failed assertion raises and the surrounding transaction is
-- discarded by Postgres.
create function pg_temp.plan(count integer) returns text language sql as $$
  select '1..' || count;
$$;
create function pg_temp.ok(value boolean, description text) returns text language plpgsql as $$
begin
  if value is distinct from true then raise exception 'FAIL: %', description; end if;
  return 'ok - ' || description;
end;
$$;
create function pg_temp.is(actual anyelement, expected anyelement, description text) returns text language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: % (actual %, expected %)', description, actual, expected;
  end if;
  return 'ok - ' || description;
end;
$$;
create function pg_temp.lives_ok(query text, description text) returns text language plpgsql as $$
begin
  execute query;
  return 'ok - ' || description;
exception when others then
  raise exception 'FAIL: % (%)', description, sqlerrm;
end;
$$;
create function pg_temp.throws_ok(query text, expected_state text, expected_message text, description text) returns text language plpgsql as $$
begin
  begin
    execute query;
  exception when others then
    if sqlstate = expected_state and sqlerrm = expected_message then return 'ok - ' || description; end if;
    raise exception 'FAIL: % (state %, message %)', description, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL: % (query succeeded)', description;
end;
$$;
create function pg_temp.finish() returns setof text language sql as $$ select 'complete'::text where false; $$;

select pg_temp.plan(27);

insert into auth.users(id) values
  ('a2000000-0000-4000-8000-000000000001'),
  ('a2000000-0000-4000-8000-000000000002');

insert into public.profiles(user_id, username, display_name, bio, onboarding_completed) values
  ('a2000000-0000-4000-8000-000000000001', 'qa_social_alice', 'QA Alice', 'Alice bio', true),
  ('a2000000-0000-4000-8000-000000000002', 'qa_social_bob', 'QA Bob', 'Bob bio', true);

insert into public.places(google_place_id) values ('social-qa-place');

select pg_temp.ok(
  not has_table_privilege('authenticated', 'social_private.connections', 'select,insert,update,delete'),
  'authenticated clients cannot access private social tables directly'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);

select pg_temp.is(public.social_api('settings')->>'enabled', 'false', 'social profiles start disabled');
select pg_temp.lives_ok(
  $$select public.social_api('settings_update', '{"enabled":true,"default_visibility":"friends"}')$$,
  'Alice can opt in'
);

insert into public.user_place_ratings(user_id, google_place_id, mode, rating, vibe, notes, social_visibility)
values (auth.uid(), 'social-qa-place', 'food', 8.7, 'loved', 'QA shared rating', 'friends');

select pg_temp.is(jsonb_array_length(public.social_api('feed')), 1, 'sharing a rating creates Alice social post');
select set_config('social.test_post', public.social_api('feed')->0->>'id', true);

select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000002', true);
select pg_temp.lives_ok(
  $$select public.social_api('settings_update', '{"enabled":true,"default_visibility":"private"}')$$,
  'Bob can opt in'
);
select pg_temp.is(jsonb_array_length(public.social_api('people', '{"query":"social_al"}')), 1, 'Bob can find Alice by a username substring');
select pg_temp.lives_ok(
  $$select public.social_api('request', '{"user_id":"a2000000-0000-4000-8000-000000000001"}')$$,
  'Bob can send Alice a friend request'
);
select pg_temp.is((public.social_summary()->>'outgoing')::integer, 1, 'Bob has one outgoing request');

select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);
select pg_temp.is((public.social_summary()->>'incoming')::integer, 1, 'Alice has one incoming request');
select pg_temp.is((public.social_summary()->>'unread')::integer, 1, 'Alice receives the request notification');
select pg_temp.lives_ok(
  $$select public.social_api('accept', '{"user_id":"a2000000-0000-4000-8000-000000000002"}')$$,
  'Alice can accept Bob'
);

select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000002', true);
select pg_temp.is((public.social_summary()->>'friends')::integer, 1, 'Bob has one friend after acceptance');
select pg_temp.is(jsonb_array_length(public.social_api('feed')), 1, 'Bob can see Alice shared rating');
select pg_temp.lives_ok(
  format('select public.social_api(''like'', %L)', jsonb_build_object('post_id', current_setting('social.test_post'))),
  'Bob can like Alice rating'
);
select pg_temp.lives_ok(
  format('select public.social_api(''comment'', %L)', jsonb_build_object(
    'post_id', current_setting('social.test_post'),
    'id', 'b2000000-0000-4000-8000-000000000001',
    'body', 'QA comment'
  )),
  'Bob can comment on Alice rating'
);

select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);
select pg_temp.is(
  (public.social_api('post', jsonb_build_object('post_id', current_setting('social.test_post')))->>'like_count')::integer,
  1,
  'Alice sees Bob like'
);
select pg_temp.is(
  (public.social_api('post', jsonb_build_object('post_id', current_setting('social.test_post')))->>'comment_count')::integer,
  1,
  'Alice sees Bob comment'
);
select pg_temp.is((public.social_summary()->>'unread')::integer, 2, 'Alice receives like and comment notifications');
select pg_temp.is(jsonb_array_length(public.social_api('notifications')), 2, 'Alice can read both engagement notifications');
select pg_temp.lives_ok(
  $$select public.social_api('block', '{"user_id":"a2000000-0000-4000-8000-000000000002"}')$$,
  'Alice can block Bob'
);

select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000002', true);
select pg_temp.is(public.social_api('feed'), '[]'::jsonb, 'blocking immediately removes Alice from Bob feed');
select pg_temp.is(public.social_api('people', '{"query":"qa_social_alice"}'), '[]'::jsonb, 'blocking hides Alice from Bob search');
select pg_temp.throws_ok(
  $$select public.social_api('profile', '{"user_id":"a2000000-0000-4000-8000-000000000001"}')$$,
  '42501',
  'Profile unavailable.',
  'blocking prevents Bob from opening Alice profile'
);

select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);
select pg_temp.is(jsonb_array_length(public.social_api('connections', '{"mode":"blocked"}')), 1, 'Alice sees Bob in her blocked list');
select pg_temp.lives_ok(
  $$select public.social_api('unblock', '{"user_id":"a2000000-0000-4000-8000-000000000002"}')$$,
  'Alice can unblock Bob'
);
select pg_temp.is(
  public.social_api('profile', '{"user_id":"a2000000-0000-4000-8000-000000000002"}')->>'relationship',
  'none',
  'unblocking does not silently restore friendship'
);
select pg_temp.is((public.social_summary()->>'friends')::integer, 0, 'both users are no longer friends');

select * from pg_temp.finish();
rollback;
