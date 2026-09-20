create or replace function public.social_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
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

revoke all on function public.social_summary() from public, anon;
grant execute on function public.social_summary() to authenticated;
