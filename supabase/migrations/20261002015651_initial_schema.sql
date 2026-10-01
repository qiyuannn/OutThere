-- Initial application schema migration, derived from full_schema.sql.
-- Target: fresh Supabase PostgreSQL 17+ database, executed as postgres.
-- Requires Supabase auth.users, auth.uid(), and standard Supabase roles.
-- Creates public application objects plus discovery_private and social_private.
-- Schema only: no user data, auth/storage customizations, or object ownership export.
-- Preserves source function security modes, constraints, RLS policies and grants.
-- Managed supabase_admin default privileges are intentionally not altered.
-- Not an incremental migration: do not apply after the earlier initial migration.

BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

SET LOCAL statement_timeout = 0;
SET LOCAL lock_timeout = 0;
SET LOCAL idle_in_transaction_session_timeout = 0;
SET LOCAL transaction_timeout = 0;
SET LOCAL client_encoding = 'UTF8';
SET LOCAL standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', true);
SET LOCAL check_function_bodies = false;
SET LOCAL xmloption = content;
SET LOCAL client_min_messages = warning;
SET LOCAL row_security = off;

--
-- Name: discovery_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA discovery_private;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: social_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA social_private;


--
-- Name: adjust_category_weights(uuid, text, text[], numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.adjust_category_weights(p_user_id uuid, p_mode text, p_category_keys text[], p_delta numeric) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  cat text;
begin
  if p_mode = 'food' then
    foreach cat in array p_category_keys loop
      insert into public.user_food_category_weights (user_id, category_key, weight, updated_at)
      values (p_user_id, cat, greatest(0.00, least(1.00, 0.00 + p_delta)), now())
      on conflict (user_id, category_key) do update
      set weight = greatest(0.00, least(1.00, public.user_food_category_weights.weight + p_delta)),
          updated_at = now();
    end loop;
  elsif p_mode = 'activities' then
    foreach cat in array p_category_keys loop
      insert into public.user_activity_category_weights (user_id, category_key, weight, updated_at)
      values (p_user_id, cat, greatest(0.00, least(1.00, 0.00 + p_delta)), now())
      on conflict (user_id, category_key) do update
      set weight = greatest(0.00, least(1.00, public.user_activity_category_weights.weight + p_delta)),
          updated_at = now();
    end loop;
  end if;
end;
$$;


--
-- Name: cancel_follow_request(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_follow_request(p_target_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_actor_id uuid;
begin
  v_actor_id := (select auth.uid());
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.notifications
  where user_id = p_target_user_id
    and actor_id = v_actor_id
    and type = 'follow'
    and follow_status = 'pending';
end;
$$;


--
-- Name: claim_social_push(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_social_push(p_actor uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', claimed.id, 'recipient_id', claimed.recipient_id, 'kind', claimed.kind,
    'post_id', claimed.post_id, 'actor_name', claimed.actor_name, 'token', tokens.token
  )), '[]'::jsonb) into result
  from social_private.claim_push_notifications(p_actor) claimed
  join social_private.push_tokens tokens on tokens.user_id = claimed.recipient_id;
  return result;
end;
$$;


--
-- Name: complete_social_push(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_social_push(p_notification_ids uuid[]) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  update social_private.notifications set pushed_at = now()
  where id = any(p_notification_ids) and push_attempted_at is not null;
$$;


--
-- Name: discovery_allowance(uuid, timestamp with time zone, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.discovery_allowance(p_user_id uuid, p_pro_until timestamp with time zone, p_request_id uuid DEFAULT NULL::uuid, p_place_id text DEFAULT NULL::text, p_mode text DEFAULT NULL::text, p_choice text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_usage discovery_private.allowances%rowtype;
  v_receipt discovery_private.swipe_receipts%rowtype;
  v_now timestamptz;
  v_unlimited boolean;
  v_accepted boolean := false;
  v_duplicate boolean := false;
begin
  if p_user_id is null then raise exception 'User is required' using errcode = '22023'; end if;
  if p_request_id is not null and (p_place_id is null or char_length(p_place_id) not between 1 and 255
    or p_mode is null or p_mode not in ('food', 'activities')
    or p_choice is null or p_choice not in ('pass', 'save', 'details')) then
    raise exception 'Invalid swipe' using errcode = '22023';
  end if;

  insert into discovery_private.allowances(user_id) values (p_user_id) on conflict do nothing;
  select * into strict v_usage from discovery_private.allowances where user_id = p_user_id for update;
  -- Time is sampled AFTER the lock, including when a request waits at expiry.
  v_now := clock_timestamp();
  v_unlimited := coalesce(p_pro_until > v_now, false);
  if v_usage.window_started_at + interval '24 hours' <= v_now then
    v_usage.window_started_at := null;
    v_usage.used := 0;
  end if;

  if p_request_id is not null then
    select * into v_receipt from discovery_private.swipe_receipts
      where user_id = p_user_id and request_id = p_request_id;
    if found then
      if v_receipt.place_id <> p_place_id or v_receipt.mode <> p_mode or v_receipt.choice <> p_choice then
        raise exception 'Request ID already used for a different swipe' using errcode = '22023';
      end if;
      v_duplicate := true;
      v_accepted := true;
    elsif v_unlimited or v_usage.used < 10 then
      if p_choice = 'pass' then
        insert into public.passed_places(user_id, google_place_id, mode, passed_at)
          values (p_user_id, p_place_id, p_mode, v_now)
          on conflict (user_id, google_place_id, mode) do update set passed_at = excluded.passed_at;
      else
        insert into public.saved_places(user_id, google_place_id, mode, saved_at)
          values (p_user_id, p_place_id, p_mode, v_now)
          on conflict (user_id, google_place_id) do update set mode = excluded.mode, saved_at = excluded.saved_at;
      end if;
      if not v_unlimited then
        v_usage.window_started_at := coalesce(v_usage.window_started_at, v_now);
        v_usage.used := v_usage.used + 1;
      end if;
      insert into discovery_private.swipe_receipts(user_id, request_id, place_id, mode, choice)
        values (p_user_id, p_request_id, p_place_id, p_mode, p_choice);
      v_accepted := true;
    end if;
  end if;

  update discovery_private.allowances set used = v_usage.used, window_started_at = v_usage.window_started_at
    where user_id = p_user_id;
  return jsonb_build_object(
    'accepted', v_accepted, 'duplicate', v_duplicate,
    'unlimited', v_unlimited, 'limit', 10,
    'remaining', case when v_unlimited then null else 10 - v_usage.used end,
    'resetsAt', case when v_unlimited then null else v_usage.window_started_at + interval '24 hours' end,
    'proExpiresAt', case when v_unlimited and isfinite(p_pro_until) then p_pro_until else null end,
    'serverTime', v_now
  );
end;
$$;


--
-- Name: get_feed_posts(timestamp with time zone, bigint, integer, boolean, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_feed_posts(p_before_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id bigint DEFAULT NULL::bigint, p_limit integer DEFAULT 20, p_only_current_user boolean DEFAULT false, p_target_user_id uuid DEFAULT NULL::uuid, p_feed_scope text DEFAULT 'explore'::text) RETURNS TABLE(id bigint, user_id uuid, google_place_id text, rating numeric, body text, photo_paths text[], created_at timestamp with time zone, display_name text, avatar_path text, place_name text, place_category text, place_address text, place_price_level text, regular_opening_hours jsonb, like_count bigint, liked_by_me boolean, comment_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  with requesting_user as (
    select auth.uid() as id
  )
  select
    posts.id,
    posts.user_id,
    posts.google_place_id,
    posts.rating,
    posts.body,
    posts.photo_paths,
    posts.created_at,
    coalesce(nullif(btrim(profiles.display_name), ''), nullif(profiles.username, ''), 'OutThere user') as display_name,
    profiles.avatar_path,
    coalesce(nullif(btrim(places.display_name), ''), 'Unknown place') as place_name,
    places.primary_type_display_name as place_category,
    places.formatted_address as place_address,
    places.price_level as place_price_level,
    places.regular_opening_hours,
    count(distinct post_likes.user_id)::bigint as like_count,
    coalesce(bool_or(post_likes.user_id = requesting_user.id), false) as liked_by_me,
    (select count(*)::bigint from public.post_comments pc where pc.post_id = posts.id) as comment_count
  from public.posts
  cross join requesting_user
  left join public.profiles on profiles.user_id = posts.user_id
  left join public.places on places.google_place_id = posts.google_place_id
  left join public.post_likes on post_likes.post_id = posts.id
  where requesting_user.id is not null
    and (
      case
        when p_target_user_id is not null then
          posts.user_id = p_target_user_id
          and (
            p_target_user_id = requesting_user.id
            or exists (
              select 1 from public.profiles p
              where p.user_id = p_target_user_id and not coalesce(p.is_private, false)
            )
            or exists (
              select 1 from public.user_follows uf
              where uf.follower_id = requesting_user.id
                and uf.following_id = p_target_user_id
            )
          )
        when p_only_current_user then
          posts.user_id = requesting_user.id
        when p_feed_scope = 'following' then
          posts.user_id = requesting_user.id
          or exists (
            select 1
            from public.user_follows uf
            where uf.follower_id = requesting_user.id
              and uf.following_id = posts.user_id
          )
        else -- 'explore'
          posts.user_id = requesting_user.id
          or exists (
            select 1
            from public.profiles p
            where p.user_id = posts.user_id
              and not coalesce(p.is_private, false)
          )
      end
    )
    and (
      p_before_created_at is null
      or p_before_id is null
      or (posts.created_at, posts.id) < (p_before_created_at, p_before_id)
    )
  group by
    posts.id,
    profiles.display_name,
    profiles.username,
    profiles.avatar_path,
    places.display_name,
    places.primary_type_display_name,
    places.formatted_address,
    places.price_level,
    places.regular_opening_hours,
    requesting_user.id
  order by posts.created_at desc, posts.id desc
  limit least(greatest(p_limit, 1), 50);
$$;


--
-- Name: get_follow_relationship(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_follow_relationship(p_target_user_id uuid) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_actor_id uuid;
begin
  v_actor_id := (select auth.uid());
  if v_actor_id is null or p_target_user_id is null then
    return 'none';
  end if;

  if exists (
    select 1 from public.user_follows
    where follower_id = v_actor_id and following_id = p_target_user_id
  ) then
    return 'following';
  end if;

  if exists (
    select 1 from public.notifications
    where user_id = p_target_user_id
      and actor_id = v_actor_id
      and type = 'follow'
      and follow_status = 'pending'
  ) then
    return 'requested';
  end if;

  return 'none';
end;
$$;


--
-- Name: get_mutual_followers_saved_place(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_mutual_followers_saved_place(p_google_place_id text) RETURNS TABLE(user_id uuid, display_name text, username text, avatar_path text, saved_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    p.user_id,
    coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.username), ''), 'OutThere user') as display_name,
    p.username,
    p.avatar_path,
    sp.saved_at
  from public.saved_places sp
  join public.profiles p on p.user_id = sp.user_id
  join public.user_follows f1 on f1.following_id = sp.user_id and f1.follower_id = (select auth.uid())
  join public.user_follows f2 on f2.follower_id = sp.user_id and f2.following_id = (select auth.uid())
  where sp.google_place_id = p_google_place_id
    and sp.user_id <> (select auth.uid())
  order by sp.saved_at desc
  limit 20;
$$;


--
-- Name: get_post_comments(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_post_comments(p_post_id bigint) RETURNS TABLE(id bigint, post_id bigint, user_id uuid, body text, created_at timestamp with time zone, display_name text, username text, avatar_path text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    comments.id,
    comments.post_id,
    comments.user_id,
    comments.body,
    comments.created_at,
    coalesce(nullif(btrim(profiles.display_name), ''), nullif(profiles.username, ''), 'OutThere user') as display_name,
    profiles.username,
    profiles.avatar_path
  from public.post_comments comments
  left join public.profiles on profiles.user_id = comments.user_id
  where comments.post_id = p_post_id
  order by comments.created_at asc, comments.id asc;
$$;


--
-- Name: get_post_detail(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_post_detail(p_post_id bigint) RETURNS TABLE(id bigint, user_id uuid, google_place_id text, rating numeric, body text, photo_paths text[], created_at timestamp with time zone, display_name text, avatar_path text, place_name text, place_category text, place_address text, place_price_level text, regular_opening_hours jsonb, like_count bigint, liked_by_me boolean, comment_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  with requesting_user as (
    select auth.uid() as id
  )
  select
    posts.id,
    posts.user_id,
    posts.google_place_id,
    posts.rating,
    posts.body,
    posts.photo_paths,
    posts.created_at,
    coalesce(nullif(btrim(profiles.display_name), ''), nullif(profiles.username, ''), 'OutThere user') as display_name,
    profiles.avatar_path,
    coalesce(nullif(btrim(places.display_name), ''), 'Unknown place') as place_name,
    places.primary_type_display_name as place_category,
    places.formatted_address as place_address,
    places.price_level as place_price_level,
    places.regular_opening_hours,
    count(distinct post_likes.user_id)::bigint as like_count,
    coalesce(bool_or(post_likes.user_id = requesting_user.id), false) as liked_by_me,
    (select count(*)::bigint from public.post_comments pc where pc.post_id = posts.id) as comment_count
  from public.posts
  cross join requesting_user
  left join public.profiles on profiles.user_id = posts.user_id
  left join public.places on places.google_place_id = posts.google_place_id
  left join public.post_likes on post_likes.post_id = posts.id
  where posts.id = p_post_id
    and requesting_user.id is not null
  group by
    posts.id,
    profiles.display_name,
    profiles.username,
    profiles.avatar_path,
    places.display_name,
    places.primary_type_display_name,
    places.formatted_address,
    places.price_level,
    places.regular_opening_hours,
    requesting_user.id;
$$;


--
-- Name: get_sent_place_invites(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_sent_place_invites(p_google_place_id text) RETURNS TABLE(recipient_id uuid, invite_status text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select user_id as recipient_id, invite_status
  from public.notifications
  where actor_id = (select auth.uid())
    and google_place_id = p_google_place_id
    and type = 'invite';
$$;


--
-- Name: get_unread_notification_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_unread_notification_count() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select count(*)::integer
  from public.notifications
  where user_id = (select auth.uid()) and not is_read;
$$;


--
-- Name: get_user_notifications(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_notifications(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(id bigint, type text, created_at timestamp with time zone, is_read boolean, actor_id uuid, actor_display_name text, actor_username text, actor_avatar_path text, post_id bigint, place_name text, place_category text, post_rating numeric, post_body text, post_photo_path text, comment_id bigint, comment_body text, is_following_actor boolean, google_place_id text, invite_status text, follow_status text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    n.id,
    n.type,
    n.created_at,
    n.is_read,
    n.actor_id,
    coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.username), ''), 'OutThere user') as actor_display_name,
    p.username as actor_username,
    p.avatar_path as actor_avatar_path,
    n.post_id,
    coalesce(pl.display_name, n.place_name) as place_name,
    pl.primary_type_display_name as place_category,
    pst.rating as post_rating,
    pst.body as post_body,
    case when cardinality(pst.photo_paths) > 0 then pst.photo_paths[1] else null end as post_photo_path,
    n.comment_id,
    pc.body as comment_body,
    exists (
      select 1 from public.user_follows uf
      where uf.follower_id = (select auth.uid())
        and uf.following_id = n.actor_id
    ) as is_following_actor,
    coalesce(n.google_place_id, pst.google_place_id) as google_place_id,
    n.invite_status,
    n.follow_status
  from public.notifications n
  left join public.profiles p on p.user_id = n.actor_id
  left join public.posts pst on pst.id = n.post_id
  left join public.places pl on pl.google_place_id = coalesce(n.google_place_id, pst.google_place_id)
  left join public.post_comments pc on pc.id = n.comment_id
  where n.user_id = (select auth.uid())
  order by
    case
      when n.type = 'invite' and coalesce(n.invite_status, 'pending') = 'pending' then 0
      when n.type = 'follow' and coalesce(n.follow_status, 'pending') = 'pending' then 1
      when n.type = 'invite' then 2
      else 3
    end,
    n.created_at desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;


--
-- Name: handle_post_comment_notification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_post_comment_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_post_author_id uuid;
begin
  select user_id into v_post_author_id
  from public.posts
  where id = NEW.post_id;

  if v_post_author_id is not null and v_post_author_id <> NEW.user_id then
    insert into public.notifications (user_id, actor_id, type, post_id, comment_id)
    values (v_post_author_id, NEW.user_id, 'comment', NEW.post_id, NEW.id);
  end if;
  return NEW;
end;
$$;


--
-- Name: handle_post_like_notification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_post_like_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_post_author_id uuid;
begin
  select user_id into v_post_author_id
  from public.posts
  where id = NEW.post_id;

  if v_post_author_id is not null and v_post_author_id <> NEW.user_id then
    insert into public.notifications (user_id, actor_id, type, post_id)
    values (v_post_author_id, NEW.user_id, 'like', NEW.post_id)
    on conflict (user_id, actor_id, post_id, type) where type = 'like'
    do update set created_at = now(), is_read = false;
  end if;
  return NEW;
end;
$$;


--
-- Name: handle_post_unlike_notification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_post_unlike_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  delete from public.notifications
  where post_id = OLD.post_id
    and actor_id = OLD.user_id
    and type = 'like';
  return OLD;
end;
$$;


--
-- Name: handle_profile_privacy_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_profile_privacy_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if old.is_private is true and new.is_private is false then
    -- Insert accepted follows for any pending requests
    insert into public.user_follows (follower_id, following_id)
    select actor_id, new.user_id
    from public.notifications
    where user_id = new.user_id
      and type = 'follow'
      and follow_status = 'pending'
    on conflict (follower_id, following_id) do nothing;

    -- Update notifications to accepted
    update public.notifications
    set follow_status = 'accepted'
    where user_id = new.user_id
      and type = 'follow'
      and follow_status = 'pending';
  end if;
  return new;
end;
$$;


--
-- Name: mark_notifications_read(bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_notifications_read(p_notification_ids bigint[] DEFAULT NULL::bigint[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if p_notification_ids is null then
    update public.notifications
    set is_read = true
    where user_id = (select auth.uid()) and not is_read;
  else
    update public.notifications
    set is_read = true
    where user_id = (select auth.uid()) and id = any(p_notification_ids);
  end if;
end;
$$;


--
-- Name: moderate_social_report(uuid, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.moderate_social_report(p_report_id uuid, p_resolution text, p_notes text, p_moderator uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select social_private.moderate_report(p_report_id, p_resolution, p_notes, p_moderator);
$$;


--
-- Name: moderation_queue(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.moderation_queue(p_status text, p_offset integer DEFAULT 0) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) from (
    select id, target_type, target_id, target_author_id, reason, details, context,
      status, resolution, moderator_notes, created_at, reviewed_at
    from social_private.reports
    where status = p_status
    order by created_at asc
    limit 21 offset greatest(0, least(p_offset, 5000))
  ) q;
$$;


--
-- Name: remove_social_push_tokens(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_social_push_tokens(p_tokens text[]) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  delete from social_private.push_tokens where token = any(p_tokens);
$$;


--
-- Name: replace_user_category_weights(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replace_user_category_weights(p_mode text, p_weights jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_user_id uuid;
begin
  select auth.uid() into v_user_id;

  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_mode not in ('food', 'activities') then
    raise exception 'Invalid category mode' using errcode = '22023';
  end if;

  if p_weights is null or jsonb_typeof(p_weights) <> 'object' then
    raise exception 'Category weights must be a JSON object' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_each(p_weights) as item
    where char_length(item.key) not between 1 and 80
      or jsonb_typeof(item.value) <> 'number'
  ) then
    raise exception 'Category weights contain an invalid key or value' using errcode = '22023';
  end if;

  if p_mode = 'food' then
    delete from public.user_food_category_weights
    where user_id = v_user_id;

    insert into public.user_food_category_weights (user_id, category_key, weight, updated_at)
    select
      v_user_id,
      item.key,
      greatest(0.00, least(1.00, (item.value::text)::numeric)),
      now()
    from jsonb_each(p_weights) as item;
  else
    delete from public.user_activity_category_weights
    where user_id = v_user_id;

    insert into public.user_activity_category_weights (user_id, category_key, weight, updated_at)
    select
      v_user_id,
      item.key,
      greatest(0.00, least(1.00, (item.value::text)::numeric)),
      now()
    from jsonb_each(p_weights) as item;
  end if;
end;
$$;


--
-- Name: FUNCTION replace_user_category_weights(p_mode text, p_weights jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.replace_user_category_weights(p_mode text, p_weights jsonb) IS 'Atomically replaces the authenticated user category weights for one ranking mode.';


--
-- Name: respond_to_follow_request(bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.respond_to_follow_request(p_notification_id bigint, p_status text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_user_id uuid;
  v_requester_id uuid;
  v_status text;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_status in ('accepted', 'accept') then
    v_status := 'accepted';
  elsif p_status in ('declined', 'decline', 'rejected', 'reject') then
    v_status := 'declined';
  else
    raise exception 'Status must be accepted or declined';
  end if;

  -- Update incoming follow request notification
  update public.notifications
  set follow_status = v_status,
      is_read = true
  where id = p_notification_id
    and user_id = v_user_id
    and type = 'follow'
  returning actor_id into v_requester_id;

  if not found then
    raise exception 'Follow request notification not found';
  end if;

  if v_status = 'accepted' then
    -- Insert into user_follows
    insert into public.user_follows (follower_id, following_id)
    values (v_requester_id, v_user_id)
    on conflict (follower_id, following_id) do nothing;

    -- Notify requester that request was accepted
    delete from public.notifications
    where user_id = v_requester_id
      and actor_id = v_user_id
      and type = 'follow_accepted';

    insert into public.notifications (
      user_id,
      actor_id,
      type,
      is_read,
      created_at
    )
    values (
      v_requester_id,
      v_user_id,
      'follow_accepted',
      false,
      now()
    );
  else
    -- If declined, make sure they are not following
    delete from public.user_follows
    where follower_id = v_requester_id and following_id = v_user_id;
  end if;
end;
$$;


--
-- Name: respond_to_place_invite(bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.respond_to_place_invite(p_notification_id bigint, p_status text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_user_id uuid;
  v_inviter_id uuid;
  v_google_place_id text;
  v_place_name text;
  v_response_type text;
  v_status text;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_status in ('accepted', 'accept') then
    v_status := 'accepted';
    v_response_type := 'invite_accepted';
  elsif p_status in ('declined', 'decline', 'rejected', 'reject') then
    v_status := 'declined';
    v_response_type := 'invite_declined';
  else
    raise exception 'Status must be accepted or declined';
  end if;

  -- Update incoming invite notification
  update public.notifications
  set invite_status = v_status,
      is_read = true
  where id = p_notification_id
    and user_id = v_user_id
    and type = 'invite'
  returning actor_id, google_place_id, place_name
  into v_inviter_id, v_google_place_id, v_place_name;

  if not found then
    raise exception 'Invite notification not found';
  end if;

  -- If accepted, ensure place is on recipient saved list
  if v_status = 'accepted' and v_google_place_id is not null then
    insert into public.saved_places (user_id, google_place_id, mode, saved_at)
    values (v_user_id, v_google_place_id, 'food', now())
    on conflict (user_id, google_place_id) do nothing;
  end if;

  -- Trigger notification to the original inviter
  if v_inviter_id is not null and v_inviter_id <> v_user_id then
    delete from public.notifications
    where user_id = v_inviter_id
      and actor_id = v_user_id
      and google_place_id = v_google_place_id
      and type in ('invite_accepted', 'invite_declined');

    insert into public.notifications (
      user_id,
      actor_id,
      type,
      google_place_id,
      place_name,
      is_read,
      created_at
    )
    values (
      v_inviter_id,
      v_user_id,
      v_response_type,
      v_google_place_id,
      v_place_name,
      false,
      now()
    );
  end if;
end;
$$;


--
-- Name: search_profiles(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_profiles(search_query text, limit_count integer DEFAULT 20) RETURNS TABLE(user_id uuid, username text, display_name text, bio text, avatar_path text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    user_id,
    username,
    display_name,
    bio,
    avatar_path
  from public.profiles
  where
    onboarding_completed = true
    and username is not null
    and (
      username ilike ('%' || search_query || '%')
      or display_name ilike ('%' || search_query || '%')
    )
  order by
    case
      when lower(username) = lower(search_query) then 0
      when lower(display_name) = lower(search_query) then 1
      when lower(username) like (lower(search_query) || '%') then 2
      when lower(display_name) like (lower(search_query) || '%') then 3
      else 4
    end,
    username asc
  limit least(greatest(limit_count, 1), 50);
$$;


--
-- Name: send_follow_request(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_follow_request(p_target_user_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_actor_id uuid;
  v_is_private boolean;
begin
  v_actor_id := (select auth.uid());
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_target_user_id is null or p_target_user_id = v_actor_id then
    raise exception 'Cannot follow yourself';
  end if;

  -- If already following, return 'following'
  if exists (
    select 1 from public.user_follows
    where follower_id = v_actor_id and following_id = p_target_user_id
  ) then
    return 'following';
  end if;

  -- Check if target user profile is private
  select coalesce(is_private, false) into v_is_private
  from public.profiles
  where user_id = p_target_user_id;

  if not coalesce(v_is_private, false) then
    -- PUBLIC PROFILE: auto-accept follow
    insert into public.user_follows (follower_id, following_id)
    values (v_actor_id, p_target_user_id)
    on conflict (follower_id, following_id) do nothing;

    -- Create or refresh notification stating they started following you
    insert into public.notifications (
      user_id,
      actor_id,
      type,
      follow_status,
      is_read,
      created_at
    )
    values (
      p_target_user_id,
      v_actor_id,
      'follow',
      'accepted',
      false,
      now()
    )
    on conflict (user_id, actor_id, type) where type = 'follow'
    do update set
      follow_status = 'accepted',
      is_read = false,
      created_at = now();

    return 'following';
  else
    -- PRIVATE PROFILE: follow request pending approval
    insert into public.notifications (
      user_id,
      actor_id,
      type,
      follow_status,
      is_read,
      created_at
    )
    values (
      p_target_user_id,
      v_actor_id,
      'follow',
      'pending',
      false,
      now()
    )
    on conflict (user_id, actor_id, type) where type = 'follow'
    do update set
      follow_status = 'pending',
      is_read = false,
      created_at = now();

    return 'requested';
  end if;
end;
$$;


--
-- Name: send_place_invite(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_place_invite(p_recipient_id uuid, p_google_place_id text, p_place_name text DEFAULT NULL::text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_actor_id uuid;
  v_notification_id bigint;
  v_place_name text;
begin
  v_actor_id := (select auth.uid());
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_recipient_id is null or p_recipient_id = v_actor_id then
    raise exception 'Invalid recipient';
  end if;

  if p_google_place_id is null or btrim(p_google_place_id) = '' then
    raise exception 'Invalid place ID';
  end if;

  v_place_name := nullif(btrim(p_place_name), '');
  if v_place_name is null then
    select display_name into v_place_name
    from public.places
    where google_place_id = p_google_place_id;
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    google_place_id,
    place_name,
    invite_status,
    is_read,
    created_at
  )
  values (
    p_recipient_id,
    v_actor_id,
    'invite',
    p_google_place_id,
    v_place_name,
    'pending',
    false,
    now()
  )
  on conflict (user_id, actor_id, google_place_id, type) where type = 'invite'
  do update set
    created_at = now(),
    is_read = false,
    invite_status = 'pending',
    place_name = coalesce(v_place_name, notifications.place_name)
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;


--
-- Name: social_api(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.social_api(action text, payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if action in ('settings_update', 'request', 'accept', 'rating_visibility', 'like', 'comment', 'post_visibility')
    and not social_private.active_user(auth.uid()) then
    raise exception 'Your social access has been suspended.' using errcode = '42501';
  end if;
  return social_private.api(action, payload);
end;
$$;


--
-- Name: social_register_push_token(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.social_register_push_token(p_token text, p_device_id text, p_platform text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in to enable notifications.' using errcode = '42501'; end if;
  if p_token !~ '^ExponentPushToken\[[A-Za-z0-9_-]+\]$|^ExpoPushToken\[[A-Za-z0-9_-]+\]$'
    or char_length(p_device_id) not between 1 and 128
    or p_platform not in ('ios', 'android') then
    raise exception 'Invalid push notification registration.';
  end if;
  if not exists(select 1 from social_private.push_tokens where user_id = me and device_id = p_device_id)
    and (select count(*) from social_private.push_tokens where user_id = me) >= 5 then
    delete from social_private.push_tokens where id = (
      select id from social_private.push_tokens where user_id = me order by updated_at asc limit 1
    );
  end if;
  -- A native token identifies one app installation. Move it to the currently
  -- authenticated account so a signed-out user cannot receive another account's alerts.
  delete from social_private.push_tokens where token = p_token and user_id <> me;
  insert into social_private.push_tokens(user_id, token, device_id, platform)
  values (me, p_token, p_device_id, p_platform)
  on conflict (user_id, device_id) do update
    set token = excluded.token, platform = excluded.platform, updated_at = now();
end;
$_$;


--
-- Name: social_report(text, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.social_report(p_target_type text, p_target_id uuid, p_reason text, p_details text DEFAULT ''::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  me uuid := auth.uid();
  author uuid;
  report_context jsonb;
  report_id uuid;
  clean_details text := btrim(coalesce(p_details, ''));
begin
  if me is null then
    raise exception 'Sign in to report content.' using errcode = '42501';
  end if;
  if p_target_type not in ('user', 'post', 'comment')
    or p_reason not in ('spam', 'harassment', 'inappropriate', 'misinformation', 'other')
    or p_target_id is null
    or char_length(clean_details) > 1000 then
    raise exception 'Choose a valid report reason and keep details under 1000 characters.' using errcode = 'P0001';
  end if;
  if (select count(*) from social_private.reports where reporter_id = me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'You have submitted too many reports today.' using errcode = 'P0001';
  end if;

  if p_target_type = 'user' then
    author := p_target_id;
    if author = me or not social_private.visible_profile(me, author) then
      raise exception 'This profile or content is no longer available.' using errcode = '42501';
    end if;
    select jsonb_build_object('username', p.username, 'name', p.display_name, 'bio', p.bio)
      into report_context from public.profiles p where p.user_id = author;
  elsif p_target_type = 'post' then
    select p.author_id,
      jsonb_build_object('google_place_id', p.google_place_id, 'score', p.score, 'notes', p.notes)
      into author, report_context
      from social_private.posts p
      where p.id = p_target_id and social_private.visible_post(me, p.id);
    if author is null or author = me then
      raise exception 'This profile or content is no longer available.' using errcode = '42501';
    end if;
  else
    select c.author_id,
      jsonb_build_object('post_id', c.post_id, 'body', c.body)
      into author, report_context
      from social_private.comments c
      where c.id = p_target_id and social_private.visible_post(me, c.post_id)
        and social_private.visible_profile(me, c.author_id);
    if author is null or author = me then
      raise exception 'This profile or content is no longer available.' using errcode = '42501';
    end if;
  end if;

  insert into social_private.reports (
    reporter_id, target_type, target_id, target_author_id, reason, details, context
  ) values (
    me, p_target_type, p_target_id, author, p_reason, clean_details, coalesce(report_context, '{}')
  )
  on conflict (reporter_id, target_type, target_id) where reporter_id is not null
  do update set
    reason = excluded.reason,
    details = excluded.details,
    context = excluded.context,
    status = 'open',
    updated_at = now()
  returning id into report_id;

  return report_id;
end;
$$;


--
-- Name: social_summary(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.social_summary() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Sign in to use social features.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'enabled', coalesce((select enabled from social_private.settings where user_id = me), false),
    'friends', (select count(*) from social_private.connections where status = 'accepted' and me in (sender, recipient)),
    'incoming', (select count(*) from social_private.connections where status = 'pending' and recipient = me),
    'outgoing', (select count(*) from social_private.connections where status = 'pending' and sender = me),
    'unread', (
      select count(*) from social_private.notifications n
      where n.recipient_id = me
        and n.read_at is null
        and not social_private.blocked(me, n.actor_id)
        and social_private.visible_profile(me, n.actor_id)
        and (n.post_id is null or social_private.visible_post(me, n.post_id))
    )
  );
end;
$$;


--
-- Name: social_unregister_push_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.social_unregister_push_token(p_device_id text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  delete from social_private.push_tokens where user_id = auth.uid() and device_id = p_device_id;
$$;


--
-- Name: unfollow_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unfollow_user(p_target_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_actor_id uuid;
begin
  v_actor_id := (select auth.uid());
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.user_follows
  where follower_id = v_actor_id and following_id = p_target_user_id;

  -- Clean up any follow request / accepted notifications from this relationship
  delete from public.notifications
  where user_id = p_target_user_id
    and actor_id = v_actor_id
    and type in ('follow', 'follow_accepted');
end;
$$;


--
-- Name: update_profile_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_profile_version() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.updated_at = now();
  new.created_at = old.created_at;
  new.version = old.version + 1;
  if old.onboarding_completed then new.onboarding_completed = true; end if;
  return new;
end;
$$;


--
-- Name: active_user(uuid); Type: FUNCTION; Schema: social_private; Owner: -
--

CREATE FUNCTION social_private.active_user(target uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select target is not null and not exists (
    select 1 from social_private.user_moderation where user_id = target and status = 'suspended'
  );
$$;


--
-- Name: api(text, jsonb); Type: FUNCTION; Schema: social_private; Owner: -
--

CREATE FUNCTION social_private.api(action text, payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
 me uuid := auth.uid(); target uuid; post uuid; item uuid; row_connection social_private.connections;
 q text; mode text; text_body text; result jsonb; found_post social_private.posts;
 cutoff timestamptz := coalesce((payload->>'before')::timestamptz,'infinity');
 cutoff_id uuid := coalesce((payload->>'before_id')::uuid,'ffffffff-ffff-ffff-ffff-ffffffffffff');
 page_offset integer := greatest(0,least(coalesce((payload->>'offset')::integer,0),5000));
begin
 if me is null then raise exception 'Sign in to use social features.' using errcode='42501'; end if;
 if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>12000 then raise exception 'Invalid request.'; end if;
 target := (payload->>'user_id')::uuid; post := (payload->>'post_id')::uuid; item := (payload->>'id')::uuid;
 if action='settings' then
   return jsonb_build_object('enabled',coalesce((select enabled from social_private.settings where user_id=me),false),'default_visibility',coalesce((select default_visibility from social_private.settings where user_id=me),'private'));
 elsif action='settings_update' then
   if jsonb_typeof(payload->'enabled') is distinct from 'boolean' or coalesce(payload->>'default_visibility','') not in ('private','friends') then raise exception 'Choose valid privacy settings.'; end if;
   if (payload->>'enabled')::boolean and not exists(select 1 from public.profiles where user_id=me and onboarding_completed and username is not null) then raise exception 'Complete your profile first.'; end if;
   insert into social_private.settings(user_id,enabled,default_visibility) values(me,(payload->>'enabled')::boolean,case when (payload->>'enabled')::boolean then payload->>'default_visibility' else 'private' end)
   on conflict(user_id) do update set enabled=excluded.enabled,default_visibility=excluded.default_visibility;
   if not (payload->>'enabled')::boolean then
     update public.user_place_ratings set social_visibility='private' where user_id=me and social_visibility='friends';
   end if;
   return social_private.api('settings');
 elsif action='people' then
   q := btrim(coalesce(payload->>'query',''));
   if char_length(q)<2 or char_length(q)>80 then return '[]'; end if;
   -- Literal substring matching, including underscores in usernames (not SQL wildcards).
   select coalesce(jsonb_agg(person),'[]') into result from (
     select social_private.person(p.user_id) person from public.profiles p join social_private.settings s on s.user_id=p.user_id
     where s.enabled and p.user_id<>me and not social_private.blocked(me,p.user_id)
       and (strpos(lower(p.username),lower(q))>0 or strpos(lower(p.display_name),lower(q))>0)
     order by p.username,p.user_id limit 21 offset page_offset
   ) t; return result;
 elsif action='profile' then
   target:=coalesce(target,me);
   if not social_private.visible_profile(me,target) then raise exception 'Profile unavailable.' using errcode='42501'; end if;
   select * into row_connection from social_private.connections where (sender=me and recipient=target) or (sender=target and recipient=me);
   return jsonb_build_object('person',social_private.person(target),'relationship',case when target=me then 'self' when row_connection.status='accepted' then 'friends' when row_connection.sender=me then 'outgoing' when row_connection.recipient=me then 'incoming' else 'none' end);
 elsif action='connections' then
   mode:=coalesce(payload->>'mode','friends');
   if mode not in ('friends','incoming','outgoing','blocked') then raise exception 'Invalid connection list.'; end if;
   if mode='blocked' then
     select coalesce(jsonb_agg(person),'[]') into result from (select social_private.person(b.target_id) person from social_private.blocks b where b.user_id=me order by b.created_at desc,b.target_id limit 21 offset page_offset) t;
   else
     select coalesce(jsonb_agg(person),'[]') into result from (
       select social_private.person(case when c.sender=me then c.recipient else c.sender end) person
       from social_private.connections c where
       ((mode='friends' and c.status='accepted' and me in (c.sender,c.recipient)) or (mode='incoming' and c.status='pending' and c.recipient=me) or (mode='outgoing' and c.status='pending' and c.sender=me))
       and social_private.visible_profile(me,case when c.sender=me then c.recipient else c.sender end)
       order by c.created_at desc,c.id limit 21 offset page_offset
     ) t;
   end if; return result;
 elsif action in ('request','accept','decline','cancel','remove_friend','block','unblock') then
   if target is null or target=me then raise exception 'Choose another person.'; end if;
   -- Serialize mutations for an unordered pair, including crossed requests and blocks.
   perform pg_advisory_xact_lock(hashtextextended(least(me,target)::text||greatest(me,target)::text,0));
   if action='unblock' then delete from social_private.blocks where user_id=me and target_id=target; return '{}'; end if;
   if action='block' then
     if not exists(select 1 from auth.users where id=target) then raise exception 'Profile unavailable.'; end if;
     insert into social_private.blocks(user_id,target_id) values(me,target) on conflict do nothing;
     delete from social_private.connections where (sender=me and recipient=target) or (sender=target and recipient=me);
     delete from social_private.notifications where (actor_id=me and recipient_id=target) or (actor_id=target and recipient_id=me);
     return '{}';
   end if;
   if social_private.blocked(me,target) then raise exception 'Connection unavailable.' using errcode='42501'; end if;
   select * into row_connection from social_private.connections where (sender=me and recipient=target) or (sender=target and recipient=me) for update;
   if action='request' then
     if not social_private.visible_profile(me,target) or not exists(select 1 from social_private.settings where user_id=me and enabled) then raise exception 'Enable your social profile and choose an available person.'; end if;
     if row_connection.id is not null then return '{}'; end if;
     if (select count(*) from social_private.connections where sender=me and status='pending')>=100 then raise exception 'You have too many pending requests.'; end if;
     insert into social_private.connections(sender,recipient) values(me,target) returning * into row_connection;
     insert into social_private.notifications(recipient_id,actor_id,kind,connection_id) values(target,me,'request',row_connection.id);
   elsif action='accept' then
     if row_connection.recipient<>me or row_connection.status<>'pending' or row_connection.id is null then raise exception 'Request is no longer available.'; end if;
     if not social_private.visible_profile(me,target) then raise exception 'Profile unavailable.'; end if;
     update social_private.connections set status='accepted' where id=row_connection.id;
     delete from social_private.notifications where connection_id=row_connection.id;
     insert into social_private.notifications(recipient_id,actor_id,kind,connection_id) values(target,me,'accepted',row_connection.id);
   elsif action='decline' then
     delete from social_private.connections where id=row_connection.id and recipient=me and status='pending';
   elsif action='cancel' then
     delete from social_private.connections where id=row_connection.id and sender=me and status='pending';
   elsif action='remove_friend' then
     delete from social_private.connections where id=row_connection.id and status='accepted';
   end if; return '{}';
 elsif action='rating_visibility' then
   if coalesce(payload->>'visibility','') not in ('private','friends') then raise exception 'Choose a valid audience.'; end if;
   update public.user_place_ratings set social_visibility=payload->>'visibility' where id=item and user_id=me;
   if not found then raise exception 'Rating unavailable.' using errcode='42501'; end if;
   return '{}';
 elsif action='feed' then
   if target is not null and not social_private.visible_profile(me,target) then raise exception 'Profile unavailable.' using errcode='42501'; end if;
   select coalesce(jsonb_agg(value),'[]') into result from (
     select social_private.post_json(me,p.id) value from social_private.posts p
     where (target is null or p.author_id=target) and social_private.visible_post(me,p.id)
       and (p.created_at,p.id)<(cutoff,cutoff_id)
     order by p.created_at desc,p.id desc limit 21
   ) t; return result;
 elsif action in ('post','like','unlike','comments','comment','delete_post','post_visibility') then
   if post is null or not social_private.visible_post(me,post) then raise exception 'This post is private or no longer available.' using errcode='42501'; end if;
   select * into found_post from social_private.posts where id=post;
   perform pg_advisory_xact_lock(hashtextextended(least(me,found_post.author_id)::text||greatest(me,found_post.author_id)::text,0));
   select * into found_post from social_private.posts where id=post for update;
   -- Recheck after acquiring the post lock, which serializes deletion and engagement.
   if found_post.id is null or not social_private.visible_post(me,post) then raise exception 'Post unavailable.' using errcode='42501'; end if;
   if action in ('like','comment') and not exists(select 1 from social_private.settings where user_id=me and enabled) then raise exception 'Enable your social profile before joining the conversation.'; end if;
   if action='post' then return social_private.post_json(me,post);
   elsif action='delete_post' then
     if found_post.author_id<>me then raise exception 'Only the author can delete this post.' using errcode='42501'; end if;
     update public.user_place_ratings set social_visibility='private' where id=found_post.rating_id;
     delete from social_private.posts where id=post;
   elsif action='post_visibility' then
     if found_post.author_id<>me then raise exception 'Only the author can change sharing.' using errcode='42501'; end if;
     if coalesce(payload->>'visibility','') not in ('private','friends') then raise exception 'Choose a valid audience.'; end if;
     update public.user_place_ratings set social_visibility=payload->>'visibility' where id=found_post.rating_id;
   elsif action='like' then
     insert into social_private.reactions(post_id,user_id) values(post,me) on conflict do nothing;
     if found and found_post.author_id<>me then
       insert into social_private.notifications(recipient_id,actor_id,kind,post_id) values(found_post.author_id,me,'like',post) on conflict do nothing;
     end if;
   elsif action='unlike' then
     delete from social_private.reactions where post_id=post and user_id=me;
     delete from social_private.notifications where post_id=post and actor_id=me and kind='like';
   elsif action='comments' then
     select coalesce(jsonb_agg(value),'[]') into result from (
       select jsonb_build_object('id',c.id,'author',social_private.person(c.author_id),'body',c.body,'created_at',c.created_at) value
       from social_private.comments c where c.post_id=post and social_private.visible_profile(me,c.author_id)
         and (c.created_at,c.id)<(cutoff,cutoff_id) order by c.created_at desc,c.id desc limit 21
     ) t; return result;
   elsif action='comment' then
     text_body:=btrim(coalesce(payload->>'body',''));
     if char_length(text_body) not between 1 and 1000 then raise exception 'Comments must be 1–1000 characters.'; end if;
     -- Caller-generated UUID makes retry after an uncertain network response idempotent.
     if item is null then raise exception 'Missing comment identifier.'; end if;
     if exists(select 1 from social_private.comments where id=item) then
       if exists(select 1 from social_private.comments where id=item and author_id=me and post_id=post) then return '{}'; end if;
       raise exception 'Invalid comment identifier.';
     end if;
     if (select count(*) from social_private.comments where author_id=me and created_at>now()-interval '1 minute')>=10 then raise exception 'Please wait before posting more comments.'; end if;
     insert into social_private.comments(id,post_id,author_id,body) values(item,post,me,text_body);
     if found_post.author_id<>me then insert into social_private.notifications(recipient_id,actor_id,kind,post_id,comment_id) values(found_post.author_id,me,'comment',post,item); end if;
   end if; return '{}';
 elsif action='delete_comment' then
   delete from social_private.comments where id=item and author_id=me;
   return '{}';
 elsif action in ('notifications','unread','mark_read') then
   if action='mark_read' then
     update social_private.notifications set read_at=now() where recipient_id=me and id=item;
     return '{}';
   end if;
   select coalesce(jsonb_agg(value),'[]') into result from (
     select jsonb_build_object('id',n.id,'actor',social_private.person(n.actor_id),'kind',n.kind,'post_id',n.post_id,'read',n.read_at is not null,'created_at',n.created_at) value
     from social_private.notifications n where n.recipient_id=me
       and not social_private.blocked(me,n.actor_id) and social_private.visible_profile(me,n.actor_id)
       and (n.post_id is null or social_private.visible_post(me,n.post_id))
       and (action<>'unread' or n.read_at is null)
       and (n.created_at,n.id)<(cutoff,cutoff_id)
     order by n.created_at desc,n.id desc limit 21
   ) t;
   if action='unread' then return jsonb_build_object('count',jsonb_array_length(result)); end if;
   return result;
 end if;
 raise exception 'Unknown social action.';
end;
$$;


--
-- Name: blocked(uuid, uuid); Type: FUNCTION; Schema: social_private; Owner: -
--

CREATE FUNCTION social_private.blocked(a uuid, b uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 select exists(select 1 from social_private.blocks where (user_id=a and target_id=b) or (user_id=b and target_id=a));
$$;


--
-- Name: can_read_avatar(text); Type: FUNCTION; Schema: social_private; Owner: -
--

CREATE FUNCTION social_private.can_read_avatar(object_name text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select auth.uid() is not null and exists(select 1 from public.profiles p where p.avatar_path=object_name and social_private.visible_profile(auth.uid(),p.user_id));
$$;


--
-- Name: claim_push_notifications(uuid); Type: FUNCTION; Schema: social_private; Owner: -
--

CREATE FUNCTION social_private.claim_push_notifications(p_actor uuid) RETURNS TABLE(id uuid, recipient_id uuid, kind text, post_id uuid, actor_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  return query
  with claimed as (
    update social_private.notifications n set push_attempted_at = now()
    where n.id in (
      select candidate.id from social_private.notifications candidate
      where candidate.actor_id = p_actor and candidate.push_attempted_at is null
        and candidate.created_at > now() - interval '10 minutes'
      order by candidate.created_at limit 20 for update skip locked
    )
    returning n.id, n.recipient_id, n.kind, n.post_id, n.actor_id
  )
  select c.id, c.recipient_id, c.kind, c.post_id, coalesce(p.display_name, p.username, 'A friend')
  from claimed c left join public.profiles p on p.user_id = c.actor_id;
end;
$$;


--
-- Name: friends(uuid, uuid); Type: FUNCTION; Schema: social_private; Owner: -
--

CREATE FUNCTION social_private.friends(a uuid, b uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 select not social_private.blocked(a,b) and exists(select 1 from social_private.connections where status='accepted' and ((sender=a and recipient=b) or (sender=b and recipient=a)));
$$;


--
-- Name: moderate_report(uuid, text, text, uuid); Type: FUNCTION; Schema: social_private; Owner: -
--

CREATE FUNCTION social_private.moderate_report(p_report_id uuid, p_resolution text, p_notes text, p_moderator uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare report_row social_private.reports; clean_notes text := btrim(coalesce(p_notes, ''));
begin
  if p_resolution not in ('dismiss', 'remove_content', 'suspend_user')
    or char_length(clean_notes) > 2000 or p_moderator is null then
    raise exception 'Invalid moderation decision.';
  end if;
  select * into report_row from social_private.reports where id = p_report_id for update;
  if report_row.id is null then raise exception 'Report not found.'; end if;
  if report_row.status not in ('open', 'reviewed') then raise exception 'This report has already been resolved.'; end if;

  if p_resolution = 'remove_content' then
    if report_row.target_type = 'post' then
      update public.user_place_ratings r set social_visibility = 'private'
      from social_private.posts p where p.id = report_row.target_id and r.id = p.rating_id;
    elsif report_row.target_type = 'comment' then
      delete from social_private.comments where id = report_row.target_id;
    else
      raise exception 'Remove content applies only to posts and comments.';
    end if;
  elsif p_resolution = 'suspend_user' then
    insert into social_private.user_moderation(user_id, status, reason, report_id, reviewed_by)
    values (report_row.target_author_id, 'suspended', clean_notes, report_row.id, p_moderator)
    on conflict (user_id) do update set reason = excluded.reason, report_id = excluded.report_id,
      reviewed_by = excluded.reviewed_by, reviewed_at = now();
    update social_private.settings set enabled = false where user_id = report_row.target_author_id;
    update public.user_place_ratings set social_visibility = 'private'
      where user_id = report_row.target_author_id and social_visibility = 'friends';
  end if;

  update social_private.reports set
    status = case when p_resolution = 'dismiss' then 'dismissed' else 'actioned' end,
    resolution = p_resolution, moderator_notes = clean_notes,
    reviewed_by = p_moderator, reviewed_at = now(), updated_at = now()
  where id = report_row.id;
  insert into social_private.moderation_audit(report_id, moderator_id, action, target_type, target_id, notes)
  values (report_row.id, p_moderator, p_resolution, report_row.target_type, report_row.target_id, clean_notes);
end;
$$;


--
-- Name: person(uuid); Type: FUNCTION; Schema: social_private; Owner: -
--

CREATE FUNCTION social_private.person(target uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 select jsonb_build_object('id',p.user_id,'username',p.username,'name',p.display_name,'bio',p.bio,'avatar_path',p.avatar_path) from public.profiles p where p.user_id=target;
$$;


--
-- Name: post_json(uuid, uuid); Type: FUNCTION; Schema: social_private; Owner: -
--

CREATE FUNCTION social_private.post_json(viewer uuid, post uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 select jsonb_build_object('id',p.id,'author',social_private.person(p.author_id),'google_place_id',p.google_place_id,'mode',p.mode,'score',p.score,'notes',p.notes,'recommend',p.recommend,'visibility',p.visibility,'created_at',p.created_at,
 'liked',exists(select 1 from social_private.reactions r where r.post_id=p.id and r.user_id=viewer),
 'like_count',(select count(*) from social_private.reactions r where r.post_id=p.id and not social_private.blocked(viewer,r.user_id)),
 'comment_count',(select count(*) from social_private.comments c where c.post_id=p.id and social_private.visible_profile(viewer,c.author_id)))
 from social_private.posts p where p.id=post;
$$;


--
-- Name: sync_rating_post(); Type: FUNCTION; Schema: social_private; Owner: -
--

CREATE FUNCTION social_private.sync_rating_post() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 if new.social_visibility='friends' then
   if not exists(select 1 from social_private.settings where user_id=new.user_id and enabled) then
     raise exception 'Enable your social profile before sharing ratings.' using errcode='P0001';
   end if;
   insert into social_private.posts(author_id,rating_id,google_place_id,mode,score,notes,recommend,visibility)
   values(new.user_id,new.id,new.google_place_id,new.mode,new.rating,left(coalesce(new.notes,''),2000),new.recommend,'friends')
   on conflict(rating_id) do update set score=excluded.score,notes=excluded.notes,recommend=excluded.recommend,visibility=excluded.visibility,mode=excluded.mode;
 else
   update social_private.posts set visibility='private',score=new.rating,notes=left(coalesce(new.notes,''),2000),recommend=new.recommend where rating_id=new.id;
 end if;
 return new;
end;
$$;


--
-- Name: visible_post(uuid, uuid); Type: FUNCTION; Schema: social_private; Owner: -
--

CREATE FUNCTION social_private.visible_post(viewer uuid, post uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 select exists(select 1 from social_private.posts p where p.id=post and (p.author_id=viewer or (p.visibility='friends' and social_private.visible_profile(viewer,p.author_id) and social_private.friends(viewer,p.author_id))));
$$;


--
-- Name: visible_profile(uuid, uuid); Type: FUNCTION; Schema: social_private; Owner: -
--

CREATE FUNCTION social_private.visible_profile(viewer uuid, target uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select viewer is not null and social_private.active_user(target) and (
    viewer = target or (
      not social_private.blocked(viewer, target)
      and exists(select 1 from social_private.settings where user_id = target and enabled)
    )
  );
$$;


SET LOCAL default_tablespace = '';

SET LOCAL default_table_access_method = heap;

--
-- Name: allowances; Type: TABLE; Schema: discovery_private; Owner: -
--

CREATE TABLE discovery_private.allowances (
    user_id uuid NOT NULL,
    window_started_at timestamp with time zone,
    used integer DEFAULT 0 NOT NULL,
    CONSTRAINT allowances_check CHECK (((window_started_at IS NOT NULL) OR (used = 0))),
    CONSTRAINT allowances_used_check CHECK (((used >= 0) AND (used <= 50)))
);


--
-- Name: swipe_receipts; Type: TABLE; Schema: discovery_private; Owner: -
--

CREATE TABLE discovery_private.swipe_receipts (
    user_id uuid NOT NULL,
    request_id uuid NOT NULL,
    place_id text NOT NULL,
    mode text NOT NULL,
    choice text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT swipe_receipts_choice_check CHECK ((choice = ANY (ARRAY['pass'::text, 'save'::text, 'details'::text]))),
    CONSTRAINT swipe_receipts_mode_check CHECK ((mode = ANY (ARRAY['food'::text, 'activities'::text])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    type text NOT NULL,
    post_id bigint,
    comment_id bigint,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    google_place_id text,
    place_name text,
    invite_status text DEFAULT 'pending'::text,
    follow_status text,
    CONSTRAINT notifications_follow_status_check CHECK (((follow_status IS NULL) OR (follow_status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])))),
    CONSTRAINT notifications_invite_status_check CHECK (((invite_status IS NULL) OR (invite_status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])))),
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['follow'::text, 'like'::text, 'comment'::text, 'invite'::text, 'invite_accepted'::text, 'invite_declined'::text, 'follow_accepted'::text])))
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.notifications ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: passed_places; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.passed_places (
    user_id uuid NOT NULL,
    google_place_id text NOT NULL,
    mode text NOT NULL,
    passed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT passed_places_google_place_id_check CHECK (((char_length(google_place_id) >= 1) AND (char_length(google_place_id) <= 255))),
    CONSTRAINT passed_places_mode_check CHECK ((mode = ANY (ARRAY['activities'::text, 'food'::text])))
);


--
-- Name: places; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.places (
    google_place_id text NOT NULL,
    display_name text,
    formatted_address text,
    latitude double precision,
    longitude double precision,
    primary_type_display_name text,
    rating numeric(2,1),
    user_rating_count bigint,
    price_level text,
    google_maps_uri text,
    first_fetched_at timestamp with time zone DEFAULT now() NOT NULL,
    last_fetched_at timestamp with time zone DEFAULT now() NOT NULL,
    photos jsonb DEFAULT '[]'::jsonb NOT NULL,
    website_uri text,
    phone_number text,
    regular_opening_hours jsonb DEFAULT '[]'::jsonb NOT NULL,
    amenities jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT places_google_place_id_check CHECK (((char_length(google_place_id) >= 1) AND (char_length(google_place_id) <= 255))),
    CONSTRAINT places_latitude_check CHECK (((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision))),
    CONSTRAINT places_longitude_check CHECK (((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision))),
    CONSTRAINT places_price_level_check CHECK (((price_level IS NULL) OR (char_length(price_level) <= 64))),
    CONSTRAINT places_rating_check CHECK (((rating >= (0)::numeric) AND (rating <= (5)::numeric))),
    CONSTRAINT places_user_rating_count_check CHECK ((user_rating_count >= 0))
);


--
-- Name: post_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_comments (
    id bigint NOT NULL,
    post_id bigint NOT NULL,
    user_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT post_comments_body_check CHECK (((char_length(btrim(body)) >= 1) AND (char_length(body) <= 1000)))
);


--
-- Name: post_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.post_comments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.post_comments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: post_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_likes (
    post_id bigint NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posts (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    google_place_id text NOT NULL,
    rating numeric(3,1) NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    photo_paths text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT posts_body_check CHECK ((char_length(body) <= 2000)),
    CONSTRAINT posts_have_content CHECK (((char_length(btrim(body)) > 0) OR (cardinality(photo_paths) > 0))),
    CONSTRAINT posts_photo_paths_check CHECK ((cardinality(photo_paths) <= 5)),
    CONSTRAINT posts_rating_check CHECK (((rating >= 0.0) AND (rating <= 10.0)))
);


--
-- Name: posts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.posts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.posts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    user_id uuid NOT NULL,
    username text,
    display_name text DEFAULT ''::text NOT NULL,
    bio text DEFAULT ''::text NOT NULL,
    avatar_path text,
    onboarding_completed boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_private boolean DEFAULT false NOT NULL,
    CONSTRAINT completed_profile_required_fields CHECK (((NOT onboarding_completed) OR ((username IS NOT NULL) AND (char_length(btrim(display_name)) > 0)))),
    CONSTRAINT profiles_bio_check CHECK ((char_length(bio) <= 240)),
    CONSTRAINT profiles_check CHECK (((avatar_path IS NULL) OR (avatar_path ~~ ((user_id)::text || '/%'::text)))),
    CONSTRAINT profiles_display_name_check CHECK ((char_length(display_name) <= 60)),
    CONSTRAINT profiles_username_check CHECK (((username IS NULL) OR (username ~ '^[a-z0-9_]{3,24}$'::text)))
);


--
-- Name: saved_places; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_places (
    user_id uuid NOT NULL,
    google_place_id text NOT NULL,
    mode text NOT NULL,
    saved_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT saved_places_google_place_id_check CHECK (((char_length(google_place_id) >= 1) AND (char_length(google_place_id) <= 255))),
    CONSTRAINT saved_places_mode_check CHECK ((mode = ANY (ARRAY['activities'::text, 'food'::text])))
);


--
-- Name: user_activity_category_weights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_activity_category_weights (
    user_id uuid NOT NULL,
    category_key text NOT NULL,
    weight numeric(3,2) DEFAULT 0.00 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_activity_category_weights_category_key_check CHECK (((char_length(category_key) >= 1) AND (char_length(category_key) <= 80))),
    CONSTRAINT user_activity_category_weights_weight_check CHECK (((weight >= 0.00) AND (weight <= 1.00)))
);


--
-- Name: user_follows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_follows (
    follower_id uuid NOT NULL,
    following_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cannot_follow_self CHECK ((follower_id <> following_id))
);


--
-- Name: user_food_category_weights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_food_category_weights (
    user_id uuid NOT NULL,
    category_key text NOT NULL,
    weight numeric(3,2) DEFAULT 0.00 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_food_category_weights_category_key_check CHECK (((char_length(category_key) >= 1) AND (char_length(category_key) <= 80))),
    CONSTRAINT user_food_category_weights_weight_check CHECK (((weight >= 0.00) AND (weight <= 1.00)))
);


--
-- Name: user_place_ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_place_ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    google_place_id text NOT NULL,
    mode text NOT NULL,
    rating numeric(3,1) NOT NULL,
    vibe text,
    recommend boolean DEFAULT true NOT NULL,
    notes text,
    rated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    social_visibility text DEFAULT 'private'::text NOT NULL,
    CONSTRAINT user_place_ratings_mode_check CHECK ((mode = ANY (ARRAY['food'::text, 'activities'::text]))),
    CONSTRAINT user_place_ratings_rating_check CHECK (((rating >= 0.0) AND (rating <= 10.0))),
    CONSTRAINT user_place_ratings_social_visibility_check CHECK ((social_visibility = ANY (ARRAY['private'::text, 'friends'::text]))),
    CONSTRAINT user_place_ratings_vibe_check CHECK ((vibe = ANY (ARRAY['loved'::text, 'liked'::text, 'fine'::text, 'disliked'::text])))
);


--
-- Name: blocks; Type: TABLE; Schema: social_private; Owner: -
--

CREATE TABLE social_private.blocks (
    user_id uuid NOT NULL,
    target_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT blocks_check CHECK ((user_id <> target_id))
);


--
-- Name: comments; Type: TABLE; Schema: social_private; Owner: -
--

CREATE TABLE social_private.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT comments_body_check CHECK (((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 1000)))
);


--
-- Name: connections; Type: TABLE; Schema: social_private; Owner: -
--

CREATE TABLE social_private.connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender uuid NOT NULL,
    recipient uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT connections_check CHECK ((sender <> recipient)),
    CONSTRAINT connections_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text])))
);


--
-- Name: moderation_audit; Type: TABLE; Schema: social_private; Owner: -
--

CREATE TABLE social_private.moderation_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid,
    moderator_id uuid,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id uuid NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT moderation_audit_action_check CHECK ((action = ANY (ARRAY['dismiss'::text, 'remove_content'::text, 'suspend_user'::text]))),
    CONSTRAINT moderation_audit_notes_check CHECK ((char_length(notes) <= 2000)),
    CONSTRAINT moderation_audit_target_type_check CHECK ((target_type = ANY (ARRAY['user'::text, 'post'::text, 'comment'::text])))
);


--
-- Name: notifications; Type: TABLE; Schema: social_private; Owner: -
--

CREATE TABLE social_private.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    kind text NOT NULL,
    connection_id uuid,
    post_id uuid,
    comment_id uuid,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    push_attempted_at timestamp with time zone,
    pushed_at timestamp with time zone,
    CONSTRAINT notifications_kind_check CHECK ((kind = ANY (ARRAY['request'::text, 'accepted'::text, 'like'::text, 'comment'::text])))
);


--
-- Name: posts; Type: TABLE; Schema: social_private; Owner: -
--

CREATE TABLE social_private.posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    author_id uuid NOT NULL,
    rating_id uuid NOT NULL,
    google_place_id text NOT NULL,
    mode text NOT NULL,
    score numeric(3,1) NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    recommend boolean NOT NULL,
    visibility text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT posts_mode_check CHECK ((mode = ANY (ARRAY['food'::text, 'activities'::text]))),
    CONSTRAINT posts_notes_check CHECK ((char_length(notes) <= 2000)),
    CONSTRAINT posts_visibility_check CHECK ((visibility = ANY (ARRAY['private'::text, 'friends'::text])))
);


--
-- Name: push_tokens; Type: TABLE; Schema: social_private; Owner: -
--

CREATE TABLE social_private.push_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    device_id text NOT NULL,
    platform text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT push_tokens_device_id_check CHECK (((char_length(device_id) >= 1) AND (char_length(device_id) <= 128))),
    CONSTRAINT push_tokens_platform_check CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text]))),
    CONSTRAINT push_tokens_token_check CHECK ((token ~ '^ExponentPushToken\[[A-Za-z0-9_-]+\]$|^ExpoPushToken\[[A-Za-z0-9_-]+\]$'::text))
);


--
-- Name: reactions; Type: TABLE; Schema: social_private; Owner: -
--

CREATE TABLE social_private.reactions (
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reports; Type: TABLE; Schema: social_private; Owner: -
--

CREATE TABLE social_private.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid,
    target_type text NOT NULL,
    target_id uuid NOT NULL,
    target_author_id uuid NOT NULL,
    reason text NOT NULL,
    details text DEFAULT ''::text NOT NULL,
    context jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    resolution text,
    moderator_notes text DEFAULT ''::text NOT NULL,
    CONSTRAINT reports_details_check CHECK ((char_length(details) <= 1000)),
    CONSTRAINT reports_moderator_notes_check CHECK ((char_length(moderator_notes) <= 2000)),
    CONSTRAINT reports_reason_check CHECK ((reason = ANY (ARRAY['spam'::text, 'harassment'::text, 'inappropriate'::text, 'misinformation'::text, 'other'::text]))),
    CONSTRAINT reports_resolution_check CHECK ((resolution = ANY (ARRAY['dismiss'::text, 'remove_content'::text, 'suspend_user'::text]))),
    CONSTRAINT reports_status_check CHECK ((status = ANY (ARRAY['open'::text, 'reviewed'::text, 'dismissed'::text, 'actioned'::text]))),
    CONSTRAINT reports_target_type_check CHECK ((target_type = ANY (ARRAY['user'::text, 'post'::text, 'comment'::text])))
);


--
-- Name: settings; Type: TABLE; Schema: social_private; Owner: -
--

CREATE TABLE social_private.settings (
    user_id uuid NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    default_visibility text DEFAULT 'private'::text NOT NULL,
    CONSTRAINT settings_default_visibility_check CHECK ((default_visibility = ANY (ARRAY['private'::text, 'friends'::text])))
);


--
-- Name: user_moderation; Type: TABLE; Schema: social_private; Owner: -
--

CREATE TABLE social_private.user_moderation (
    user_id uuid NOT NULL,
    status text NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    report_id uuid,
    reviewed_by uuid,
    reviewed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_moderation_reason_check CHECK ((char_length(reason) <= 2000)),
    CONSTRAINT user_moderation_status_check CHECK ((status = 'suspended'::text))
);


--
-- Name: allowances allowances_pkey; Type: CONSTRAINT; Schema: discovery_private; Owner: -
--

ALTER TABLE ONLY discovery_private.allowances
    ADD CONSTRAINT allowances_pkey PRIMARY KEY (user_id);


--
-- Name: swipe_receipts swipe_receipts_pkey; Type: CONSTRAINT; Schema: discovery_private; Owner: -
--

ALTER TABLE ONLY discovery_private.swipe_receipts
    ADD CONSTRAINT swipe_receipts_pkey PRIMARY KEY (user_id, request_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: passed_places passed_places_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passed_places
    ADD CONSTRAINT passed_places_pkey PRIMARY KEY (user_id, google_place_id, mode);


--
-- Name: places places_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.places
    ADD CONSTRAINT places_pkey PRIMARY KEY (google_place_id);


--
-- Name: post_comments post_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_comments
    ADD CONSTRAINT post_comments_pkey PRIMARY KEY (id);


--
-- Name: post_likes post_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_pkey PRIMARY KEY (post_id, user_id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: saved_places saved_places_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_places
    ADD CONSTRAINT saved_places_pkey PRIMARY KEY (user_id, google_place_id);


--
-- Name: user_activity_category_weights user_activity_category_weights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_category_weights
    ADD CONSTRAINT user_activity_category_weights_pkey PRIMARY KEY (user_id, category_key);


--
-- Name: user_follows user_follows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_follows
    ADD CONSTRAINT user_follows_pkey PRIMARY KEY (follower_id, following_id);


--
-- Name: user_food_category_weights user_food_category_weights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_food_category_weights
    ADD CONSTRAINT user_food_category_weights_pkey PRIMARY KEY (user_id, category_key);


--
-- Name: user_place_ratings user_place_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_place_ratings
    ADD CONSTRAINT user_place_ratings_pkey PRIMARY KEY (id);


--
-- Name: user_place_ratings user_place_ratings_user_place_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_place_ratings
    ADD CONSTRAINT user_place_ratings_user_place_key UNIQUE (user_id, google_place_id);


--
-- Name: blocks blocks_pkey; Type: CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.blocks
    ADD CONSTRAINT blocks_pkey PRIMARY KEY (user_id, target_id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: connections connections_pkey; Type: CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.connections
    ADD CONSTRAINT connections_pkey PRIMARY KEY (id);


--
-- Name: moderation_audit moderation_audit_pkey; Type: CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.moderation_audit
    ADD CONSTRAINT moderation_audit_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: posts posts_rating_id_key; Type: CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.posts
    ADD CONSTRAINT posts_rating_id_key UNIQUE (rating_id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_token_key; Type: CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.push_tokens
    ADD CONSTRAINT push_tokens_token_key UNIQUE (token);


--
-- Name: push_tokens push_tokens_user_id_device_id_key; Type: CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.push_tokens
    ADD CONSTRAINT push_tokens_user_id_device_id_key UNIQUE (user_id, device_id);


--
-- Name: reactions reactions_pkey; Type: CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.reactions
    ADD CONSTRAINT reactions_pkey PRIMARY KEY (post_id, user_id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (user_id);


--
-- Name: user_moderation user_moderation_pkey; Type: CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.user_moderation
    ADD CONSTRAINT user_moderation_pkey PRIMARY KEY (user_id);


--
-- Name: idx_user_place_ratings_google_place_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_place_ratings_google_place_id ON public.user_place_ratings USING btree (google_place_id);


--
-- Name: idx_user_place_ratings_user_mode_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_place_ratings_user_mode_rating ON public.user_place_ratings USING btree (user_id, mode, rating DESC);


--
-- Name: notifications_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_actor_id_idx ON public.notifications USING btree (actor_id);


--
-- Name: notifications_comment_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_comment_id_idx ON public.notifications USING btree (comment_id) WHERE (comment_id IS NOT NULL);


--
-- Name: notifications_follow_accepted_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notifications_follow_accepted_unique ON public.notifications USING btree (user_id, actor_id, type) WHERE (type = 'follow_accepted'::text);


--
-- Name: notifications_follow_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notifications_follow_unique ON public.notifications USING btree (user_id, actor_id, type) WHERE (type = 'follow'::text);


--
-- Name: notifications_google_place_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_google_place_id_idx ON public.notifications USING btree (google_place_id) WHERE (google_place_id IS NOT NULL);


--
-- Name: notifications_invite_response_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notifications_invite_response_unique ON public.notifications USING btree (user_id, actor_id, google_place_id, type) WHERE (type = ANY (ARRAY['invite_accepted'::text, 'invite_declined'::text]));


--
-- Name: notifications_invite_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notifications_invite_unique ON public.notifications USING btree (user_id, actor_id, google_place_id, type) WHERE (type = 'invite'::text);


--
-- Name: notifications_like_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notifications_like_unique ON public.notifications USING btree (user_id, actor_id, post_id, type) WHERE (type = 'like'::text);


--
-- Name: notifications_post_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_post_id_idx ON public.notifications USING btree (post_id) WHERE (post_id IS NOT NULL);


--
-- Name: notifications_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_unread_idx ON public.notifications USING btree (user_id) WHERE (NOT is_read);


--
-- Name: notifications_user_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_created_at_idx ON public.notifications USING btree (user_id, created_at DESC, id DESC);


--
-- Name: passed_places_google_place_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX passed_places_google_place_id_idx ON public.passed_places USING btree (google_place_id);


--
-- Name: places_last_fetched_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX places_last_fetched_at_idx ON public.places USING btree (last_fetched_at);


--
-- Name: post_comments_post_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX post_comments_post_created_at_idx ON public.post_comments USING btree (post_id, created_at, id);


--
-- Name: post_comments_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX post_comments_user_id_idx ON public.post_comments USING btree (user_id);


--
-- Name: post_likes_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX post_likes_user_id_idx ON public.post_likes USING btree (user_id);


--
-- Name: posts_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_created_at_idx ON public.posts USING btree (created_at DESC);


--
-- Name: posts_google_place_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_google_place_id_idx ON public.posts USING btree (google_place_id);


--
-- Name: posts_user_created_at_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_user_created_at_id_idx ON public.posts USING btree (user_id, created_at DESC, id DESC);


--
-- Name: posts_user_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_user_created_at_idx ON public.posts USING btree (user_id, created_at DESC);


--
-- Name: profiles_display_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_display_name_idx ON public.profiles USING btree (display_name);


--
-- Name: profiles_is_private_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_is_private_idx ON public.profiles USING btree (is_private);


--
-- Name: saved_places_google_place_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX saved_places_google_place_id_idx ON public.saved_places USING btree (google_place_id);


--
-- Name: saved_places_place_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX saved_places_place_id_idx ON public.saved_places USING btree (google_place_id);


--
-- Name: saved_places_user_saved_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX saved_places_user_saved_at_idx ON public.saved_places USING btree (user_id, saved_at DESC);


--
-- Name: user_follows_follower_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_follows_follower_idx ON public.user_follows USING btree (follower_id);


--
-- Name: user_follows_following_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_follows_following_idx ON public.user_follows USING btree (following_id);


--
-- Name: social_blocks_target; Type: INDEX; Schema: social_private; Owner: -
--

CREATE INDEX social_blocks_target ON social_private.blocks USING btree (target_id, user_id);


--
-- Name: social_comments_author; Type: INDEX; Schema: social_private; Owner: -
--

CREATE INDEX social_comments_author ON social_private.comments USING btree (author_id);


--
-- Name: social_comments_post; Type: INDEX; Schema: social_private; Owner: -
--

CREATE INDEX social_comments_post ON social_private.comments USING btree (post_id, created_at DESC, id DESC);


--
-- Name: social_connection_pair; Type: INDEX; Schema: social_private; Owner: -
--

CREATE UNIQUE INDEX social_connection_pair ON social_private.connections USING btree (LEAST(sender, recipient), GREATEST(sender, recipient));


--
-- Name: social_connections_recipient; Type: INDEX; Schema: social_private; Owner: -
--

CREATE INDEX social_connections_recipient ON social_private.connections USING btree (recipient, status);


--
-- Name: social_connections_sender; Type: INDEX; Schema: social_private; Owner: -
--

CREATE INDEX social_connections_sender ON social_private.connections USING btree (sender, status);


--
-- Name: social_notifications_actor; Type: INDEX; Schema: social_private; Owner: -
--

CREATE INDEX social_notifications_actor ON social_private.notifications USING btree (actor_id);


--
-- Name: social_notifications_comment; Type: INDEX; Schema: social_private; Owner: -
--

CREATE INDEX social_notifications_comment ON social_private.notifications USING btree (comment_id);


--
-- Name: social_notifications_connection; Type: INDEX; Schema: social_private; Owner: -
--

CREATE INDEX social_notifications_connection ON social_private.notifications USING btree (connection_id);


--
-- Name: social_notifications_like_once; Type: INDEX; Schema: social_private; Owner: -
--

CREATE UNIQUE INDEX social_notifications_like_once ON social_private.notifications USING btree (recipient_id, actor_id, post_id) WHERE (kind = 'like'::text);


--
-- Name: social_notifications_page; Type: INDEX; Schema: social_private; Owner: -
--

CREATE INDEX social_notifications_page ON social_private.notifications USING btree (recipient_id, created_at DESC, id DESC);


--
-- Name: social_notifications_post; Type: INDEX; Schema: social_private; Owner: -
--

CREATE INDEX social_notifications_post ON social_private.notifications USING btree (post_id);


--
-- Name: social_posts_author; Type: INDEX; Schema: social_private; Owner: -
--

CREATE INDEX social_posts_author ON social_private.posts USING btree (author_id, created_at DESC, id DESC);


--
-- Name: social_posts_page; Type: INDEX; Schema: social_private; Owner: -
--

CREATE INDEX social_posts_page ON social_private.posts USING btree (created_at DESC, id DESC);


--
-- Name: social_posts_place; Type: INDEX; Schema: social_private; Owner: -
--

CREATE INDEX social_posts_place ON social_private.posts USING btree (google_place_id);


--
-- Name: social_push_tokens_user; Type: INDEX; Schema: social_private; Owner: -
--

CREATE INDEX social_push_tokens_user ON social_private.push_tokens USING btree (user_id);


--
-- Name: social_reactions_user; Type: INDEX; Schema: social_private; Owner: -
--

CREATE INDEX social_reactions_user ON social_private.reactions USING btree (user_id);


--
-- Name: social_reports_reporter_target; Type: INDEX; Schema: social_private; Owner: -
--

CREATE UNIQUE INDEX social_reports_reporter_target ON social_private.reports USING btree (reporter_id, target_type, target_id) WHERE (reporter_id IS NOT NULL);


--
-- Name: social_reports_review_queue; Type: INDEX; Schema: social_private; Owner: -
--

CREATE INDEX social_reports_review_queue ON social_private.reports USING btree (status, created_at);


--
-- Name: social_reports_target; Type: INDEX; Schema: social_private; Owner: -
--

CREATE INDEX social_reports_target ON social_private.reports USING btree (target_type, target_id);


--
-- Name: post_comments on_post_comment_notification; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_post_comment_notification AFTER INSERT ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.handle_post_comment_notification();


--
-- Name: post_likes on_post_like_notification; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_post_like_notification AFTER INSERT ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.handle_post_like_notification();


--
-- Name: post_likes on_post_unlike_notification; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_post_unlike_notification AFTER DELETE ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.handle_post_unlike_notification();


--
-- Name: profiles on_profile_privacy_changed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_profile_privacy_changed AFTER UPDATE OF is_private ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_profile_privacy_change();


--
-- Name: user_place_ratings sync_social_rating; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_social_rating AFTER INSERT OR UPDATE OF rating, notes, recommend, social_visibility ON public.user_place_ratings FOR EACH ROW EXECUTE FUNCTION social_private.sync_rating_post();


--
-- Name: profiles update_profile_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profile_version BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_profile_version();


--
-- Name: allowances allowances_user_id_fkey; Type: FK CONSTRAINT; Schema: discovery_private; Owner: -
--

ALTER TABLE ONLY discovery_private.allowances
    ADD CONSTRAINT allowances_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: swipe_receipts swipe_receipts_user_id_fkey; Type: FK CONSTRAINT; Schema: discovery_private; Owner: -
--

ALTER TABLE ONLY discovery_private.swipe_receipts
    ADD CONSTRAINT swipe_receipts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.post_comments(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: passed_places passed_places_google_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passed_places
    ADD CONSTRAINT passed_places_google_place_id_fkey FOREIGN KEY (google_place_id) REFERENCES public.places(google_place_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: passed_places passed_places_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passed_places
    ADD CONSTRAINT passed_places_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: post_comments post_comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_comments
    ADD CONSTRAINT post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_comments post_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_comments
    ADD CONSTRAINT post_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: post_likes post_likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_likes post_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: posts posts_google_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_google_place_id_fkey FOREIGN KEY (google_place_id) REFERENCES public.places(google_place_id) ON DELETE RESTRICT;


--
-- Name: posts posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: saved_places saved_places_google_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_places
    ADD CONSTRAINT saved_places_google_place_id_fkey FOREIGN KEY (google_place_id) REFERENCES public.places(google_place_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: saved_places saved_places_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_places
    ADD CONSTRAINT saved_places_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_activity_category_weights user_activity_category_weights_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_category_weights
    ADD CONSTRAINT user_activity_category_weights_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_follows user_follows_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_follows
    ADD CONSTRAINT user_follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_follows user_follows_following_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_follows
    ADD CONSTRAINT user_follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_food_category_weights user_food_category_weights_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_food_category_weights
    ADD CONSTRAINT user_food_category_weights_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_place_ratings user_place_ratings_google_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_place_ratings
    ADD CONSTRAINT user_place_ratings_google_place_id_fkey FOREIGN KEY (google_place_id) REFERENCES public.places(google_place_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_place_ratings user_place_ratings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_place_ratings
    ADD CONSTRAINT user_place_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: blocks blocks_target_id_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.blocks
    ADD CONSTRAINT blocks_target_id_fkey FOREIGN KEY (target_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: blocks blocks_user_id_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.blocks
    ADD CONSTRAINT blocks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: comments comments_author_id_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.comments
    ADD CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: comments comments_post_id_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.comments
    ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES social_private.posts(id) ON DELETE CASCADE;


--
-- Name: connections connections_recipient_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.connections
    ADD CONSTRAINT connections_recipient_fkey FOREIGN KEY (recipient) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: connections connections_sender_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.connections
    ADD CONSTRAINT connections_sender_fkey FOREIGN KEY (sender) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: moderation_audit moderation_audit_moderator_id_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.moderation_audit
    ADD CONSTRAINT moderation_audit_moderator_id_fkey FOREIGN KEY (moderator_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: moderation_audit moderation_audit_report_id_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.moderation_audit
    ADD CONSTRAINT moderation_audit_report_id_fkey FOREIGN KEY (report_id) REFERENCES social_private.reports(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_actor_id_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.notifications
    ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_comment_id_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.notifications
    ADD CONSTRAINT notifications_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES social_private.comments(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_connection_id_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.notifications
    ADD CONSTRAINT notifications_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES social_private.connections(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_post_id_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.notifications
    ADD CONSTRAINT notifications_post_id_fkey FOREIGN KEY (post_id) REFERENCES social_private.posts(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_recipient_id_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.notifications
    ADD CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: posts posts_author_id_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.posts
    ADD CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: posts posts_google_place_id_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.posts
    ADD CONSTRAINT posts_google_place_id_fkey FOREIGN KEY (google_place_id) REFERENCES public.places(google_place_id);


--
-- Name: posts posts_rating_id_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.posts
    ADD CONSTRAINT posts_rating_id_fkey FOREIGN KEY (rating_id) REFERENCES public.user_place_ratings(id) ON DELETE CASCADE;


--
-- Name: push_tokens push_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.push_tokens
    ADD CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reactions reactions_post_id_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.reactions
    ADD CONSTRAINT reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES social_private.posts(id) ON DELETE CASCADE;


--
-- Name: reactions reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.reactions
    ADD CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reports reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.reports
    ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: reports reports_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.reports
    ADD CONSTRAINT reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: settings settings_user_id_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.settings
    ADD CONSTRAINT settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_moderation user_moderation_report_id_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.user_moderation
    ADD CONSTRAINT user_moderation_report_id_fkey FOREIGN KEY (report_id) REFERENCES social_private.reports(id) ON DELETE SET NULL;


--
-- Name: user_moderation user_moderation_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.user_moderation
    ADD CONSTRAINT user_moderation_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: user_moderation user_moderation_user_id_fkey; Type: FK CONSTRAINT; Schema: social_private; Owner: -
--

ALTER TABLE ONLY social_private.user_moderation
    ADD CONSTRAINT user_moderation_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: allowances; Type: ROW SECURITY; Schema: discovery_private; Owner: -
--

ALTER TABLE discovery_private.allowances ENABLE ROW LEVEL SECURITY;

--
-- Name: swipe_receipts; Type: ROW SECURITY; Schema: discovery_private; Owner: -
--

ALTER TABLE discovery_private.swipe_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: places Allow users to read places; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to read places" ON public.places FOR SELECT TO authenticated, anon USING (true);


--
-- Name: post_comments Anyone authenticated can read post comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone authenticated can read post comments" ON public.post_comments FOR SELECT TO authenticated USING (true);


--
-- Name: user_follows Authenticated users can read follows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read follows" ON public.user_follows FOR SELECT TO authenticated USING (true);


--
-- Name: user_place_ratings Authenticated users can read place ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read place ratings" ON public.user_place_ratings FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.user_id = user_place_ratings.user_id) AND (NOT COALESCE(p.is_private, false))))) OR (EXISTS ( SELECT 1
   FROM public.user_follows uf
  WHERE ((uf.follower_id = ( SELECT auth.uid() AS uid)) AND (uf.following_id = user_place_ratings.user_id))))));


--
-- Name: profiles Authenticated users can read profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: profiles Create own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Create own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: places Service role manages fetched places; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role manages fetched places" ON public.places TO service_role USING (true) WITH CHECK (true);


--
-- Name: posts Signed-in users can read posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Signed-in users can read posts" ON public.posts FOR SELECT TO authenticated USING (true);


--
-- Name: profiles Update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: post_comments Users can create their own post comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own post comments" ON public.post_comments FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: posts Users can create their own posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own posts" ON public.posts FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: notifications Users can delete their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_place_ratings Users can delete their own place ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own place ratings" ON public.user_place_ratings FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: post_comments Users can delete their own post comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own post comments" ON public.post_comments FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: posts Users can delete their own posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own posts" ON public.posts FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_follows Users can follow others; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can follow others" ON public.user_follows FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = follower_id));


--
-- Name: user_place_ratings Users can insert their own place ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own place ratings" ON public.user_place_ratings FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: post_likes Users can like posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can like posts" ON public.post_likes FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_activity_category_weights Users can read activity category weights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read activity category weights" ON public.user_activity_category_weights FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.user_id = user_activity_category_weights.user_id) AND (NOT COALESCE(p.is_private, false))))) OR (EXISTS ( SELECT 1
   FROM public.user_follows uf
  WHERE ((uf.follower_id = ( SELECT auth.uid() AS uid)) AND (uf.following_id = user_activity_category_weights.user_id))))));


--
-- Name: user_food_category_weights Users can read food category weights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read food category weights" ON public.user_food_category_weights FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.user_id = user_food_category_weights.user_id) AND (NOT COALESCE(p.is_private, false))))) OR (EXISTS ( SELECT 1
   FROM public.user_follows uf
  WHERE ((uf.follower_id = ( SELECT auth.uid() AS uid)) AND (uf.following_id = user_food_category_weights.user_id))))));


--
-- Name: post_likes Users can read their own post likes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their own post likes" ON public.post_likes FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: post_likes Users can remove their post likes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can remove their post likes" ON public.post_likes FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_follows Users can unfollow or remove followers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can unfollow or remove followers" ON public.user_follows FOR DELETE TO authenticated USING (((( SELECT auth.uid() AS uid) = follower_id) OR (( SELECT auth.uid() AS uid) = following_id)));


--
-- Name: notifications Users can update their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_place_ratings Users can update their own place ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own place ratings" ON public.user_place_ratings FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: notifications Users can view their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_place_ratings Users can view their own place ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own place ratings" ON public.user_place_ratings FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_activity_category_weights Users create their activity category weights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users create their activity category weights" ON public.user_activity_category_weights FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_food_category_weights Users create their food category weights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users create their food category weights" ON public.user_food_category_weights FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: passed_places Users create their passed places; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users create their passed places" ON public.passed_places FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: saved_places Users create their saved places; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users create their saved places" ON public.saved_places FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_activity_category_weights Users delete their activity category weights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete their activity category weights" ON public.user_activity_category_weights FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_food_category_weights Users delete their food category weights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete their food category weights" ON public.user_food_category_weights FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: passed_places Users delete their passed places; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete their passed places" ON public.passed_places FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: saved_places Users delete their saved places; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete their saved places" ON public.saved_places FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_activity_category_weights Users manage their own activity category weights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage their own activity category weights" ON public.user_activity_category_weights TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_food_category_weights Users manage their own food category weights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage their own food category weights" ON public.user_food_category_weights TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_activity_category_weights Users read their activity category weights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read their activity category weights" ON public.user_activity_category_weights FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_food_category_weights Users read their food category weights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read their food category weights" ON public.user_food_category_weights FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: passed_places Users read their passed places; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read their passed places" ON public.passed_places FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: saved_places Users read their saved places; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read their saved places" ON public.saved_places FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_activity_category_weights Users update their activity category weights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update their activity category weights" ON public.user_activity_category_weights FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_food_category_weights Users update their food category weights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update their food category weights" ON public.user_food_category_weights FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: passed_places Users update their passed places; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update their passed places" ON public.passed_places FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: saved_places Users update their saved places; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update their saved places" ON public.saved_places FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: passed_places; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.passed_places ENABLE ROW LEVEL SECURITY;

--
-- Name: places; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

--
-- Name: post_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: post_likes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_places; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.saved_places ENABLE ROW LEVEL SECURITY;

--
-- Name: user_activity_category_weights; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_activity_category_weights ENABLE ROW LEVEL SECURITY;

--
-- Name: user_follows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

--
-- Name: user_food_category_weights; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_food_category_weights ENABLE ROW LEVEL SECURITY;

--
-- Name: user_place_ratings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_place_ratings ENABLE ROW LEVEL SECURITY;

--
-- Name: blocks; Type: ROW SECURITY; Schema: social_private; Owner: -
--

ALTER TABLE social_private.blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: comments; Type: ROW SECURITY; Schema: social_private; Owner: -
--

ALTER TABLE social_private.comments ENABLE ROW LEVEL SECURITY;

--
-- Name: connections; Type: ROW SECURITY; Schema: social_private; Owner: -
--

ALTER TABLE social_private.connections ENABLE ROW LEVEL SECURITY;

--
-- Name: moderation_audit; Type: ROW SECURITY; Schema: social_private; Owner: -
--

ALTER TABLE social_private.moderation_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: social_private; Owner: -
--

ALTER TABLE social_private.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: posts; Type: ROW SECURITY; Schema: social_private; Owner: -
--

ALTER TABLE social_private.posts ENABLE ROW LEVEL SECURITY;

--
-- Name: push_tokens; Type: ROW SECURITY; Schema: social_private; Owner: -
--

ALTER TABLE social_private.push_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: reactions; Type: ROW SECURITY; Schema: social_private; Owner: -
--

ALTER TABLE social_private.reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: reports; Type: ROW SECURITY; Schema: social_private; Owner: -
--

ALTER TABLE social_private.reports ENABLE ROW LEVEL SECURITY;

--
-- Name: settings; Type: ROW SECURITY; Schema: social_private; Owner: -
--

ALTER TABLE social_private.settings ENABLE ROW LEVEL SECURITY;

--
-- Name: user_moderation; Type: ROW SECURITY; Schema: social_private; Owner: -
--

ALTER TABLE social_private.user_moderation ENABLE ROW LEVEL SECURITY;

-- Clear inherited client grants on the new tables/sequences before replaying exported ACLs.
REVOKE ALL ON TABLE discovery_private.allowances FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE discovery_private.swipe_receipts FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.passed_places FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.places FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.post_comments FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.post_likes FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.posts FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.saved_places FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.user_activity_category_weights FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.user_follows FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.user_food_category_weights FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.user_place_ratings FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE social_private.blocks FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE social_private.comments FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE social_private.connections FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE social_private.moderation_audit FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE social_private.notifications FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE social_private.posts FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE social_private.push_tokens FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE social_private.reactions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE social_private.reports FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE social_private.settings FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE social_private.user_moderation FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.notifications_id_seq FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.post_comments_id_seq FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.posts_id_seq FROM PUBLIC, anon, authenticated, service_role;

--
-- Name: SCHEMA discovery_private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA discovery_private TO service_role;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: SCHEMA social_private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA social_private TO authenticated;
GRANT USAGE ON SCHEMA social_private TO service_role;


--
-- Name: FUNCTION adjust_category_weights(p_user_id uuid, p_mode text, p_category_keys text[], p_delta numeric); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.adjust_category_weights(p_user_id uuid, p_mode text, p_category_keys text[], p_delta numeric) TO anon;
GRANT ALL ON FUNCTION public.adjust_category_weights(p_user_id uuid, p_mode text, p_category_keys text[], p_delta numeric) TO authenticated;
GRANT ALL ON FUNCTION public.adjust_category_weights(p_user_id uuid, p_mode text, p_category_keys text[], p_delta numeric) TO service_role;


--
-- Name: FUNCTION cancel_follow_request(p_target_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cancel_follow_request(p_target_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cancel_follow_request(p_target_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_follow_request(p_target_user_id uuid) TO service_role;


--
-- Name: FUNCTION claim_social_push(p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_social_push(p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_social_push(p_actor uuid) TO service_role;


--
-- Name: FUNCTION complete_social_push(p_notification_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.complete_social_push(p_notification_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.complete_social_push(p_notification_ids uuid[]) TO service_role;


--
-- Name: FUNCTION discovery_allowance(p_user_id uuid, p_pro_until timestamp with time zone, p_request_id uuid, p_place_id text, p_mode text, p_choice text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.discovery_allowance(p_user_id uuid, p_pro_until timestamp with time zone, p_request_id uuid, p_place_id text, p_mode text, p_choice text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.discovery_allowance(p_user_id uuid, p_pro_until timestamp with time zone, p_request_id uuid, p_place_id text, p_mode text, p_choice text) TO service_role;


--
-- Name: FUNCTION get_feed_posts(p_before_created_at timestamp with time zone, p_before_id bigint, p_limit integer, p_only_current_user boolean, p_target_user_id uuid, p_feed_scope text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_feed_posts(p_before_created_at timestamp with time zone, p_before_id bigint, p_limit integer, p_only_current_user boolean, p_target_user_id uuid, p_feed_scope text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_feed_posts(p_before_created_at timestamp with time zone, p_before_id bigint, p_limit integer, p_only_current_user boolean, p_target_user_id uuid, p_feed_scope text) TO authenticated;
GRANT ALL ON FUNCTION public.get_feed_posts(p_before_created_at timestamp with time zone, p_before_id bigint, p_limit integer, p_only_current_user boolean, p_target_user_id uuid, p_feed_scope text) TO service_role;


--
-- Name: FUNCTION get_follow_relationship(p_target_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_follow_relationship(p_target_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_follow_relationship(p_target_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_follow_relationship(p_target_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_mutual_followers_saved_place(p_google_place_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_mutual_followers_saved_place(p_google_place_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_mutual_followers_saved_place(p_google_place_id text) TO authenticated;
GRANT ALL ON FUNCTION public.get_mutual_followers_saved_place(p_google_place_id text) TO service_role;


--
-- Name: FUNCTION get_post_comments(p_post_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_post_comments(p_post_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_post_comments(p_post_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.get_post_comments(p_post_id bigint) TO service_role;


--
-- Name: FUNCTION get_post_detail(p_post_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_post_detail(p_post_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_post_detail(p_post_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.get_post_detail(p_post_id bigint) TO service_role;


--
-- Name: FUNCTION get_sent_place_invites(p_google_place_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_sent_place_invites(p_google_place_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_sent_place_invites(p_google_place_id text) TO authenticated;
GRANT ALL ON FUNCTION public.get_sent_place_invites(p_google_place_id text) TO service_role;


--
-- Name: FUNCTION get_unread_notification_count(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_unread_notification_count() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_unread_notification_count() TO authenticated;
GRANT ALL ON FUNCTION public.get_unread_notification_count() TO service_role;


--
-- Name: FUNCTION get_user_notifications(p_limit integer, p_offset integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_user_notifications(p_limit integer, p_offset integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_notifications(p_limit integer, p_offset integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_notifications(p_limit integer, p_offset integer) TO service_role;


--
-- Name: FUNCTION handle_post_comment_notification(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_post_comment_notification() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_post_comment_notification() TO service_role;


--
-- Name: FUNCTION handle_post_like_notification(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_post_like_notification() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_post_like_notification() TO service_role;


--
-- Name: FUNCTION handle_post_unlike_notification(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_post_unlike_notification() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_post_unlike_notification() TO service_role;


--
-- Name: FUNCTION handle_profile_privacy_change(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_profile_privacy_change() TO anon;
GRANT ALL ON FUNCTION public.handle_profile_privacy_change() TO authenticated;
GRANT ALL ON FUNCTION public.handle_profile_privacy_change() TO service_role;


--
-- Name: FUNCTION mark_notifications_read(p_notification_ids bigint[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mark_notifications_read(p_notification_ids bigint[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_notifications_read(p_notification_ids bigint[]) TO authenticated;
GRANT ALL ON FUNCTION public.mark_notifications_read(p_notification_ids bigint[]) TO service_role;


--
-- Name: FUNCTION moderate_social_report(p_report_id uuid, p_resolution text, p_notes text, p_moderator uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.moderate_social_report(p_report_id uuid, p_resolution text, p_notes text, p_moderator uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.moderate_social_report(p_report_id uuid, p_resolution text, p_notes text, p_moderator uuid) TO service_role;


--
-- Name: FUNCTION moderation_queue(p_status text, p_offset integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.moderation_queue(p_status text, p_offset integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.moderation_queue(p_status text, p_offset integer) TO service_role;


--
-- Name: FUNCTION remove_social_push_tokens(p_tokens text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.remove_social_push_tokens(p_tokens text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remove_social_push_tokens(p_tokens text[]) TO service_role;


--
-- Name: FUNCTION replace_user_category_weights(p_mode text, p_weights jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.replace_user_category_weights(p_mode text, p_weights jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.replace_user_category_weights(p_mode text, p_weights jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.replace_user_category_weights(p_mode text, p_weights jsonb) TO service_role;


--
-- Name: FUNCTION respond_to_follow_request(p_notification_id bigint, p_status text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.respond_to_follow_request(p_notification_id bigint, p_status text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.respond_to_follow_request(p_notification_id bigint, p_status text) TO authenticated;
GRANT ALL ON FUNCTION public.respond_to_follow_request(p_notification_id bigint, p_status text) TO service_role;


--
-- Name: FUNCTION respond_to_place_invite(p_notification_id bigint, p_status text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.respond_to_place_invite(p_notification_id bigint, p_status text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.respond_to_place_invite(p_notification_id bigint, p_status text) TO authenticated;
GRANT ALL ON FUNCTION public.respond_to_place_invite(p_notification_id bigint, p_status text) TO service_role;


--
-- Name: FUNCTION search_profiles(search_query text, limit_count integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.search_profiles(search_query text, limit_count integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.search_profiles(search_query text, limit_count integer) TO authenticated;
GRANT ALL ON FUNCTION public.search_profiles(search_query text, limit_count integer) TO service_role;


--
-- Name: FUNCTION send_follow_request(p_target_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.send_follow_request(p_target_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.send_follow_request(p_target_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.send_follow_request(p_target_user_id uuid) TO service_role;


--
-- Name: FUNCTION send_place_invite(p_recipient_id uuid, p_google_place_id text, p_place_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.send_place_invite(p_recipient_id uuid, p_google_place_id text, p_place_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.send_place_invite(p_recipient_id uuid, p_google_place_id text, p_place_name text) TO authenticated;
GRANT ALL ON FUNCTION public.send_place_invite(p_recipient_id uuid, p_google_place_id text, p_place_name text) TO service_role;


--
-- Name: FUNCTION social_api(action text, payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.social_api(action text, payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.social_api(action text, payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.social_api(action text, payload jsonb) TO service_role;


--
-- Name: FUNCTION social_register_push_token(p_token text, p_device_id text, p_platform text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.social_register_push_token(p_token text, p_device_id text, p_platform text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.social_register_push_token(p_token text, p_device_id text, p_platform text) TO authenticated;
GRANT ALL ON FUNCTION public.social_register_push_token(p_token text, p_device_id text, p_platform text) TO service_role;


--
-- Name: FUNCTION social_report(p_target_type text, p_target_id uuid, p_reason text, p_details text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.social_report(p_target_type text, p_target_id uuid, p_reason text, p_details text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.social_report(p_target_type text, p_target_id uuid, p_reason text, p_details text) TO authenticated;
GRANT ALL ON FUNCTION public.social_report(p_target_type text, p_target_id uuid, p_reason text, p_details text) TO service_role;


--
-- Name: FUNCTION social_summary(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.social_summary() FROM PUBLIC;
GRANT ALL ON FUNCTION public.social_summary() TO authenticated;
GRANT ALL ON FUNCTION public.social_summary() TO service_role;


--
-- Name: FUNCTION social_unregister_push_token(p_device_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.social_unregister_push_token(p_device_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.social_unregister_push_token(p_device_id text) TO authenticated;
GRANT ALL ON FUNCTION public.social_unregister_push_token(p_device_id text) TO service_role;


--
-- Name: FUNCTION unfollow_user(p_target_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.unfollow_user(p_target_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.unfollow_user(p_target_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.unfollow_user(p_target_user_id uuid) TO service_role;


--
-- Name: FUNCTION update_profile_version(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_profile_version() FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_profile_version() TO anon;
GRANT ALL ON FUNCTION public.update_profile_version() TO authenticated;
GRANT ALL ON FUNCTION public.update_profile_version() TO service_role;


--
-- Name: FUNCTION active_user(target uuid); Type: ACL; Schema: social_private; Owner: -
--

REVOKE ALL ON FUNCTION social_private.active_user(target uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION social_private.active_user(target uuid) TO authenticated;
GRANT ALL ON FUNCTION social_private.active_user(target uuid) TO service_role;


--
-- Name: FUNCTION api(action text, payload jsonb); Type: ACL; Schema: social_private; Owner: -
--

REVOKE ALL ON FUNCTION social_private.api(action text, payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION social_private.api(action text, payload jsonb) TO authenticated;


--
-- Name: FUNCTION blocked(a uuid, b uuid); Type: ACL; Schema: social_private; Owner: -
--

REVOKE ALL ON FUNCTION social_private.blocked(a uuid, b uuid) FROM PUBLIC;


--
-- Name: FUNCTION can_read_avatar(object_name text); Type: ACL; Schema: social_private; Owner: -
--

REVOKE ALL ON FUNCTION social_private.can_read_avatar(object_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION social_private.can_read_avatar(object_name text) TO authenticated;


--
-- Name: FUNCTION claim_push_notifications(p_actor uuid); Type: ACL; Schema: social_private; Owner: -
--

REVOKE ALL ON FUNCTION social_private.claim_push_notifications(p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION social_private.claim_push_notifications(p_actor uuid) TO service_role;


--
-- Name: FUNCTION friends(a uuid, b uuid); Type: ACL; Schema: social_private; Owner: -
--

REVOKE ALL ON FUNCTION social_private.friends(a uuid, b uuid) FROM PUBLIC;


--
-- Name: FUNCTION moderate_report(p_report_id uuid, p_resolution text, p_notes text, p_moderator uuid); Type: ACL; Schema: social_private; Owner: -
--

REVOKE ALL ON FUNCTION social_private.moderate_report(p_report_id uuid, p_resolution text, p_notes text, p_moderator uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION social_private.moderate_report(p_report_id uuid, p_resolution text, p_notes text, p_moderator uuid) TO service_role;


--
-- Name: FUNCTION person(target uuid); Type: ACL; Schema: social_private; Owner: -
--

REVOKE ALL ON FUNCTION social_private.person(target uuid) FROM PUBLIC;


--
-- Name: FUNCTION post_json(viewer uuid, post uuid); Type: ACL; Schema: social_private; Owner: -
--

REVOKE ALL ON FUNCTION social_private.post_json(viewer uuid, post uuid) FROM PUBLIC;


--
-- Name: FUNCTION sync_rating_post(); Type: ACL; Schema: social_private; Owner: -
--

REVOKE ALL ON FUNCTION social_private.sync_rating_post() FROM PUBLIC;


--
-- Name: FUNCTION visible_post(viewer uuid, post uuid); Type: ACL; Schema: social_private; Owner: -
--

REVOKE ALL ON FUNCTION social_private.visible_post(viewer uuid, post uuid) FROM PUBLIC;


--
-- Name: FUNCTION visible_profile(viewer uuid, target uuid); Type: ACL; Schema: social_private; Owner: -
--

REVOKE ALL ON FUNCTION social_private.visible_profile(viewer uuid, target uuid) FROM PUBLIC;


--
-- Name: TABLE allowances; Type: ACL; Schema: discovery_private; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE discovery_private.allowances TO service_role;


--
-- Name: TABLE swipe_receipts; Type: ACL; Schema: discovery_private; Owner: -
--

GRANT SELECT,INSERT ON TABLE discovery_private.swipe_receipts TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notifications TO service_role;
GRANT SELECT,DELETE,UPDATE ON TABLE public.notifications TO authenticated;


--
-- Name: SEQUENCE notifications_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.notifications_id_seq TO anon;
GRANT ALL ON SEQUENCE public.notifications_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.notifications_id_seq TO service_role;


--
-- Name: TABLE passed_places; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.passed_places TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.passed_places TO authenticated;


--
-- Name: TABLE places; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.places TO service_role;
GRANT SELECT ON TABLE public.places TO anon;
GRANT SELECT ON TABLE public.places TO authenticated;


--
-- Name: TABLE post_comments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.post_comments TO service_role;
GRANT SELECT,INSERT,DELETE ON TABLE public.post_comments TO authenticated;


--
-- Name: SEQUENCE post_comments_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.post_comments_id_seq TO anon;
GRANT ALL ON SEQUENCE public.post_comments_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.post_comments_id_seq TO service_role;


--
-- Name: TABLE post_likes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.post_likes TO service_role;
GRANT SELECT,INSERT,DELETE ON TABLE public.post_likes TO authenticated;


--
-- Name: TABLE posts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.posts TO service_role;
GRANT SELECT,INSERT,DELETE ON TABLE public.posts TO authenticated;


--
-- Name: SEQUENCE posts_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.posts_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.posts_id_seq TO authenticated;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.profiles TO authenticated;


--
-- Name: TABLE saved_places; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.saved_places TO authenticated;
GRANT ALL ON TABLE public.saved_places TO service_role;


--
-- Name: TABLE user_activity_category_weights; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_activity_category_weights TO authenticated;
GRANT ALL ON TABLE public.user_activity_category_weights TO service_role;


--
-- Name: TABLE user_follows; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_follows TO service_role;
GRANT SELECT,INSERT,DELETE ON TABLE public.user_follows TO authenticated;


--
-- Name: TABLE user_food_category_weights; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_food_category_weights TO authenticated;
GRANT ALL ON TABLE public.user_food_category_weights TO service_role;


--
-- Name: TABLE user_place_ratings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_place_ratings TO anon;
GRANT ALL ON TABLE public.user_place_ratings TO authenticated;
GRANT ALL ON TABLE public.user_place_ratings TO service_role;


--
-- Name: TABLE blocks; Type: ACL; Schema: social_private; Owner: -
--

GRANT ALL ON TABLE social_private.blocks TO service_role;


--
-- Name: TABLE comments; Type: ACL; Schema: social_private; Owner: -
--

GRANT ALL ON TABLE social_private.comments TO service_role;


--
-- Name: TABLE connections; Type: ACL; Schema: social_private; Owner: -
--

GRANT ALL ON TABLE social_private.connections TO service_role;


--
-- Name: TABLE moderation_audit; Type: ACL; Schema: social_private; Owner: -
--

GRANT ALL ON TABLE social_private.moderation_audit TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: social_private; Owner: -
--

GRANT ALL ON TABLE social_private.notifications TO service_role;


--
-- Name: TABLE posts; Type: ACL; Schema: social_private; Owner: -
--

GRANT ALL ON TABLE social_private.posts TO service_role;


--
-- Name: TABLE push_tokens; Type: ACL; Schema: social_private; Owner: -
--

GRANT ALL ON TABLE social_private.push_tokens TO service_role;


--
-- Name: TABLE reactions; Type: ACL; Schema: social_private; Owner: -
--

GRANT ALL ON TABLE social_private.reactions TO service_role;


--
-- Name: TABLE reports; Type: ACL; Schema: social_private; Owner: -
--

GRANT ALL ON TABLE social_private.reports TO service_role;


--
-- Name: TABLE settings; Type: ACL; Schema: social_private; Owner: -
--

GRANT ALL ON TABLE social_private.settings TO service_role;


--
-- Name: TABLE user_moderation; Type: ACL; Schema: social_private; Owner: -
--

GRANT ALL ON TABLE social_private.user_moderation TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

-- Omitted managed supabase_admin default privileges; retain destination platform defaults.
-- Omitted managed supabase_admin default privileges; retain destination platform defaults.
-- Omitted managed supabase_admin default privileges; retain destination platform defaults.
-- Omitted managed supabase_admin default privileges; retain destination platform defaults.


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

-- Omitted managed supabase_admin default privileges; retain destination platform defaults.
-- Omitted managed supabase_admin default privileges; retain destination platform defaults.
-- Omitted managed supabase_admin default privileges; retain destination platform defaults.
-- Omitted managed supabase_admin default privileges; retain destination platform defaults.


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

-- Omitted managed supabase_admin default privileges; retain destination platform defaults.
-- Omitted managed supabase_admin default privileges; retain destination platform defaults.
-- Omitted managed supabase_admin default privileges; retain destination platform defaults.
-- Omitted managed supabase_admin default privileges; retain destination platform defaults.


--
-- PostgreSQL database dump complete
--



COMMIT;
