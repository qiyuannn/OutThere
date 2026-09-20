create table social_private.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('user', 'post', 'comment')),
  target_id uuid not null,
  target_author_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'misinformation', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  context jsonb not null default '{}',
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'actioned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index social_reports_reporter_target
  on social_private.reports (reporter_id, target_type, target_id)
  where reporter_id is not null;
create index social_reports_review_queue
  on social_private.reports (status, created_at asc);
create index social_reports_target
  on social_private.reports (target_type, target_id);

alter table social_private.reports enable row level security;
revoke all on social_private.reports from public, anon, authenticated;
grant all on social_private.reports to service_role;

create or replace function public.social_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_details text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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

revoke all on function public.social_report(text, uuid, text, text) from public, anon;
grant execute on function public.social_report(text, uuid, text, text) to authenticated;
