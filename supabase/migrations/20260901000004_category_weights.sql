create table public.user_food_category_weights (
  user_id uuid not null references auth.users(id) on delete cascade,
  category_key text not null check (char_length(category_key) between 1 and 64),
  weight numeric(3, 2) not null check (weight between 0.00 and 1.00),
  updated_at timestamptz not null default now(),
  primary key (user_id, category_key)
);

create table public.user_activity_category_weights (
  user_id uuid not null references auth.users(id) on delete cascade,
  category_key text not null check (char_length(category_key) between 1 and 64),
  weight numeric(3, 2) not null check (weight between 0.00 and 1.00),
  updated_at timestamptz not null default now(),
  primary key (user_id, category_key)
);

create index user_food_weights_user_idx on public.user_food_category_weights (user_id);
create index user_activity_weights_user_idx on public.user_activity_category_weights (user_id);

alter table public.user_food_category_weights enable row level security;
alter table public.user_activity_category_weights enable row level security;

revoke all on public.user_food_category_weights from anon;
revoke all on public.user_activity_category_weights from anon;

grant select, insert, update, delete on public.user_food_category_weights to authenticated;
grant select, insert, update, delete on public.user_activity_category_weights to authenticated;

create policy "Users manage their food category weights"
  on public.user_food_category_weights
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their activity category weights"
  on public.user_activity_category_weights
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.adjust_user_category_weight(
  p_mode text,
  p_category_key text,
  p_delta numeric
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_new_weight numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_mode not in ('food', 'activities') then
    raise exception 'Invalid mode: %', p_mode;
  end if;

  if p_mode = 'food' then
    insert into public.user_food_category_weights (user_id, category_key, weight, updated_at)
    values (v_user_id, p_category_key, greatest(0.00, least(1.00, round(0.50 + p_delta, 2))))
    on conflict (user_id, category_key) do update
    set weight = greatest(0.00, least(1.00, round(public.user_food_category_weights.weight + p_delta, 2))),
        updated_at = now()
    returning weight into v_new_weight;
  else
    insert into public.user_activity_category_weights (user_id, category_key, weight, updated_at)
    values (v_user_id, p_category_key, greatest(0.00, least(1.00, round(0.50 + p_delta, 2))))
    on conflict (user_id, category_key) do update
    set weight = greatest(0.00, least(1.00, round(public.user_activity_category_weights.weight + p_delta, 2))),
        updated_at = now()
    returning weight into v_new_weight;
  end if;

  return v_new_weight;
end;
$$;

revoke execute on function public.adjust_user_category_weight(text, text, numeric) from public, anon;
grant execute on function public.adjust_user_category_weight(text, text, numeric) to authenticated;

create or replace function public.replace_user_category_weights(
  p_mode text,
  p_weights jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_mode not in ('food', 'activities') then
    raise exception 'Invalid mode: %', p_mode;
  end if;

  if p_weights is null or jsonb_typeof(p_weights) <> 'object' then
    raise exception 'Weights payload must be a json object';
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
