-- Bring older installations into agreement with the current app / hosted schema.
-- Keep created_at where present: older SQL readers still depend on it.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'saved_places' and column_name = 'saved_at') then
    alter table public.saved_places add column saved_at timestamptz not null default now();
    update public.saved_places set saved_at = created_at;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'passed_places' and column_name = 'passed_at') then
    alter table public.passed_places add column passed_at timestamptz not null default now();
    update public.passed_places set passed_at = created_at;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.passed_places'::regclass and contype = 'p' and cardinality(conkey) = 2) then
    alter table public.passed_places drop constraint passed_places_pkey;
    alter table public.passed_places add primary key (user_id, google_place_id, mode);
  end if;
end;
$$;

grant delete on public.passed_places to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'passed_places' and policyname = 'Users delete their passed places') then
    create policy "Users delete their passed places" on public.passed_places
      for delete to authenticated using ((select auth.uid()) = user_id);
  end if;
end;
$$;

-- Not exposed through the Data API. Clients cannot change usage or claim Pro.
create schema if not exists discovery_private;
revoke all on schema discovery_private from public, anon, authenticated;
grant usage on schema discovery_private to service_role;

create table if not exists discovery_private.allowances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz,
  used integer not null default 0 check (used between 0 and 50),
  check (window_started_at is not null or used = 0)
);

create table if not exists discovery_private.swipe_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  place_id text not null,
  mode text not null check (mode in ('food', 'activities')),
  choice text not null check (choice in ('pass', 'save', 'details')),
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

alter table discovery_private.allowances enable row level security;
alter table discovery_private.swipe_receipts enable row level security;

revoke all on discovery_private.allowances, discovery_private.swipe_receipts from public, anon, authenticated;
grant select, insert, update on discovery_private.allowances to service_role;
grant select, insert on discovery_private.swipe_receipts to service_role;

-- This invoker function is callable ONLY by the Edge Function's service role.
-- p_pro_until is verified with RevenueCat before acquiring any database lock.
create or replace function public.discovery_allowance(
  p_user_id uuid,
  p_pro_until timestamptz,
  p_request_id uuid default null,
  p_place_id text default null,
  p_mode text default null,
  p_choice text default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
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

revoke all on function public.discovery_allowance(uuid, timestamptz, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.discovery_allowance(uuid, timestamptz, uuid, text, text, text) to service_role;
