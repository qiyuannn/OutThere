-- Add invite_accepted and invite_declined to notifications type constraint
-- and update respond_to_place_invite to trigger a notification to the inviter

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('follow', 'like', 'comment', 'invite', 'invite_accepted', 'invite_declined'));

-- Unique index for invite responses
create unique index if not exists notifications_invite_response_unique
  on public.notifications (user_id, actor_id, google_place_id, type)
  where type in ('invite_accepted', 'invite_declined');

-- Update respond_to_place_invite to notify the original inviter
create or replace function public.respond_to_place_invite(
  p_notification_id bigint,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

revoke all on function public.respond_to_place_invite(bigint, text) from public, anon;
grant execute on function public.respond_to_place_invite(bigint, text) to authenticated;
