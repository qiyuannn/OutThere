-- Social safety controls remain private. Mobile clients can only register their
-- own push token; moderation access is available to the service role through an
-- authenticated Edge Function.
alter table social_private.reports
  add column reviewed_by uuid references auth.users(id) on delete set null,
  add column reviewed_at timestamptz,
  add column resolution text check (resolution in ('dismiss', 'remove_content', 'suspend_user')),
  add column moderator_notes text not null default '' check (char_length(moderator_notes) <= 2000);

create table social_private.user_moderation (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null check (status in ('suspended')),
  reason text not null default '' check (char_length(reason) <= 2000),
  report_id uuid references social_private.reports(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz not null default now()
);

create table social_private.moderation_audit (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references social_private.reports(id) on delete set null,
  moderator_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('dismiss', 'remove_content', 'suspend_user')),
  target_type text not null check (target_type in ('user', 'post', 'comment')),
  target_id uuid not null,
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);

create table social_private.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique check (token ~ '^ExponentPushToken\[[A-Za-z0-9_-]+\]$|^ExpoPushToken\[[A-Za-z0-9_-]+\]$'),
  device_id text not null check (char_length(device_id) between 1 and 128),
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id)
);
create index social_push_tokens_user on social_private.push_tokens(user_id);

alter table social_private.notifications
  add column push_attempted_at timestamptz,
  add column pushed_at timestamptz;

alter table social_private.user_moderation enable row level security;
alter table social_private.moderation_audit enable row level security;
alter table social_private.push_tokens enable row level security;
revoke all on social_private.user_moderation, social_private.moderation_audit, social_private.push_tokens from public, anon, authenticated;
grant all on social_private.user_moderation, social_private.moderation_audit, social_private.push_tokens to service_role;

create or replace function social_private.active_user(target uuid)
returns boolean language sql stable set search_path = '' as $$
  select target is not null and not exists (
    select 1 from social_private.user_moderation where user_id = target and status = 'suspended'
  );
$$;
revoke all on function social_private.active_user(uuid) from public, anon;
grant execute on function social_private.active_user(uuid) to authenticated, service_role;

create or replace function social_private.visible_profile(viewer uuid, target uuid)
returns boolean language sql stable set search_path = '' as $$
  select viewer is not null and social_private.active_user(target) and (
    viewer = target or (
      not social_private.blocked(viewer, target)
      and exists(select 1 from social_private.settings where user_id = target and enabled)
    )
  );
$$;

-- Suspended accounts may still read their data and block someone for safety,
-- but cannot publish or create new social interactions.
create or replace function public.social_api(action text, payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if action in ('settings_update', 'request', 'accept', 'rating_visibility', 'like', 'comment', 'post_visibility')
    and not social_private.active_user(auth.uid()) then
    raise exception 'Your social access has been suspended.' using errcode = '42501';
  end if;
  return social_private.api(action, payload);
end;
$$;
revoke all on function public.social_api(text, jsonb) from public, anon;
grant execute on function public.social_api(text, jsonb) to authenticated;

create or replace function public.social_register_push_token(
  p_token text,
  p_device_id text,
  p_platform text
)
returns void language plpgsql security definer set search_path = '' as $$
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
$$;

create or replace function public.social_unregister_push_token(p_device_id text)
returns void language sql security definer set search_path = '' as $$
  delete from social_private.push_tokens where user_id = auth.uid() and device_id = p_device_id;
$$;
revoke all on function public.social_register_push_token(text, text, text), public.social_unregister_push_token(text) from public, anon;
grant execute on function public.social_register_push_token(text, text, text), public.social_unregister_push_token(text) to authenticated;

create or replace function social_private.moderate_report(
  p_report_id uuid,
  p_resolution text,
  p_notes text,
  p_moderator uuid
)
returns void language plpgsql security definer set search_path = '' as $$
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

create or replace function social_private.claim_push_notifications(p_actor uuid)
returns table(id uuid, recipient_id uuid, kind text, post_id uuid, actor_name text)
language plpgsql security definer set search_path = '' as $$
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

revoke all on function social_private.moderate_report(uuid, text, text, uuid), social_private.claim_push_notifications(uuid) from public, anon, authenticated;
grant execute on function social_private.moderate_report(uuid, text, text, uuid), social_private.claim_push_notifications(uuid) to service_role;

-- PostgREST exposes public RPCs, while execute privileges keep these service-only.
-- The Edge Functions authenticate callers before invoking them.
create or replace function public.moderation_queue(p_status text, p_offset integer default 0)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) from (
    select id, target_type, target_id, target_author_id, reason, details, context,
      status, resolution, moderator_notes, created_at, reviewed_at
    from social_private.reports
    where status = p_status
    order by created_at asc
    limit 21 offset greatest(0, least(p_offset, 5000))
  ) q;
$$;

create or replace function public.moderate_social_report(p_report_id uuid, p_resolution text, p_notes text, p_moderator uuid)
returns void language sql security definer set search_path = '' as $$
  select social_private.moderate_report(p_report_id, p_resolution, p_notes, p_moderator);
$$;

create or replace function public.claim_social_push(p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
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

create or replace function public.complete_social_push(p_notification_ids uuid[])
returns void language sql security definer set search_path = '' as $$
  update social_private.notifications set pushed_at = now()
  where id = any(p_notification_ids) and push_attempted_at is not null;
$$;

create or replace function public.remove_social_push_tokens(p_tokens text[])
returns void language sql security definer set search_path = '' as $$
  delete from social_private.push_tokens where token = any(p_tokens);
$$;

revoke all on function public.moderation_queue(text, integer), public.moderate_social_report(uuid, text, text, uuid),
  public.claim_social_push(uuid), public.complete_social_push(uuid[]), public.remove_social_push_tokens(text[]) from public, anon, authenticated;
grant execute on function public.moderation_queue(text, integer), public.moderate_social_report(uuid, text, text, uuid),
  public.claim_social_push(uuid), public.complete_social_push(uuid[]), public.remove_social_push_tokens(text[]) to service_role;
