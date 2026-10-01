-- ==============================================================================
-- Domain 4: Taste Profile & Place Ratings (Rankings & Category Weights)
-- Purpose: Stores category weights for food and activities to drive
--          personalized recommendations, and records head-to-head rankings.
-- ==============================================================================

-- 1. User Food Category Weights
create table if not exists public.user_food_category_weights (
  user_id uuid not null references auth.users(id) on delete cascade,
  category_key text not null check (char_length(category_key) between 1 and 64),
  weight numeric(3, 2) not null check (weight between 0.00 and 1.00),
  updated_at timestamptz not null default now(),
  primary key (user_id, category_key)
);

create index if not exists user_food_weights_user_idx
  on public.user_food_category_weights (user_id);

alter table public.user_food_category_weights enable row level security;

revoke all on public.user_food_category_weights from anon;
grant select, insert, update, delete on public.user_food_category_weights to authenticated;

create policy "Users can read food category weights"
  on public.user_food_category_weights
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.user_id = user_food_category_weights.user_id and not coalesce(p.is_private, false)
    )
    or exists (
      select 1 from public.user_follows uf
      where uf.follower_id = (select auth.uid())
        and uf.following_id = user_food_category_weights.user_id
    )
  );

create policy "Users manage their own food category weights"
  on public.user_food_category_weights
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 2. User Activity Category Weights
create table if not exists public.user_activity_category_weights (
  user_id uuid not null references auth.users(id) on delete cascade,
  category_key text not null check (char_length(category_key) between 1 and 64),
  weight numeric(3, 2) not null check (weight between 0.00 and 1.00),
  updated_at timestamptz not null default now(),
  primary key (user_id, category_key)
);

create index if not exists user_activity_weights_user_idx
  on public.user_activity_category_weights (user_id);

alter table public.user_activity_category_weights enable row level security;

revoke all on public.user_activity_category_weights from anon;
grant select, insert, update, delete on public.user_activity_category_weights to authenticated;

create policy "Users can read activity category weights"
  on public.user_activity_category_weights
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.user_id = user_activity_category_weights.user_id and not coalesce(p.is_private, false)
    )
    or exists (
      select 1 from public.user_follows uf
      where uf.follower_id = (select auth.uid())
        and uf.following_id = user_activity_category_weights.user_id
    )
  );

create policy "Users manage their own activity category weights"
  on public.user_activity_category_weights
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 3. User Place Ratings (Rankings Leaderboard)
create table if not exists public.user_place_ratings (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  google_place_id text not null references public.places(google_place_id) on delete cascade,
  mode text not null check (mode in ('activities', 'food')),
  vibe text check (vibe in ('fine', 'liked', 'loved', 'disliked')),
  score numeric(5, 2) check (score >= 0 and score <= 10),
  rank_position integer not null check (rank_position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_place_ratings_user_place_key unique (user_id, google_place_id)
);

create index if not exists user_place_ratings_user_mode_rank_idx
  on public.user_place_ratings (user_id, mode, rank_position asc);

alter table public.user_place_ratings enable row level security;

revoke all on public.user_place_ratings from anon;
grant select, insert, update, delete on public.user_place_ratings to authenticated;

create policy "Authenticated users can read place ratings"
  on public.user_place_ratings
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.user_id = user_place_ratings.user_id and not coalesce(p.is_private, false)
    )
    or exists (
      select 1 from public.user_follows uf
      where uf.follower_id = (select auth.uid())
        and uf.following_id = user_place_ratings.user_id
    )
  );

create policy "Users can insert own ratings"
  on public.user_place_ratings
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own ratings"
  on public.user_place_ratings
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own ratings"
  on public.user_place_ratings
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- 4. RPC: Incremental Weight Adjustment
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

-- 5. RPC: Batch Category Weights Replacement
create or replace function public.replace_user_category_weights(
  p_mode text,
  p_weights jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_mode not in ('food', 'activities') then
    raise exception 'Invalid mode: %', p_mode;
  end if;

  if jsonb_typeof(p_weights) <> 'array' then
    raise exception 'Weights must be a json array';
  end if;

  if p_mode = 'food' then
    delete from public.user_food_category_weights where user_id = v_user_id;
    for v_item in
      select
        (elem->>'category_key')::text as category_key,
        (elem->>'weight')::numeric as weight
      from jsonb_array_elements(p_weights) as elem
    loop
      if v_item.category_key is not null and v_item.weight is not null then
        insert into public.user_food_category_weights (user_id, category_key, weight, updated_at)
        values (v_user_id, v_item.category_key, greatest(0.00, least(1.00, round(v_item.weight, 2))), now());
      end if;
    end loop;
  else
    delete from public.user_activity_category_weights where user_id = v_user_id;
    for v_item in
      select
        (elem->>'category_key')::text as category_key,
        (elem->>'weight')::numeric as weight
      from jsonb_array_elements(p_weights) as elem
    loop
      if v_item.category_key is not null and v_item.weight is not null then
        insert into public.user_activity_category_weights (user_id, category_key, weight, updated_at)
        values (v_user_id, v_item.category_key, greatest(0.00, least(1.00, round(v_item.weight, 2))), now());
      end if;
    end loop;
  end if;
end;
$$;

revoke execute on function public.replace_user_category_weights(text, jsonb) from public, anon;
grant execute on function public.replace_user_category_weights(text, jsonb) to authenticated;
