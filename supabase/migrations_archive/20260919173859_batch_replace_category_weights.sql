create or replace function public.replace_user_category_weights(
  p_mode text,
  p_weights jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
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

revoke execute on function public.replace_user_category_weights(text, jsonb) from public, anon;
grant execute on function public.replace_user_category_weights(text, jsonb) to authenticated;

comment on function public.replace_user_category_weights(text, jsonb) is
  'Atomically replaces the authenticated user category weights for one ranking mode.';
