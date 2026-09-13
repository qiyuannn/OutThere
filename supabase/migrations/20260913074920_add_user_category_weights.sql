create table if not exists public.user_food_category_weights (
  user_id uuid not null references auth.users(id) on delete cascade,
  category_key text not null check (char_length(category_key) between 1 and 80),
  weight numeric(3, 2) not null default 0.00 check (weight between 0.00 and 1.00),
  updated_at timestamptz not null default now(),
  primary key (user_id, category_key)
);

create table if not exists public.user_activity_category_weights (
  user_id uuid not null references auth.users(id) on delete cascade,
  category_key text not null check (char_length(category_key) between 1 and 80),
  weight numeric(3, 2) not null default 0.00 check (weight between 0.00 and 1.00),
  updated_at timestamptz not null default now(),
  primary key (user_id, category_key)
);

alter table public.user_food_category_weights enable row level security;
alter table public.user_activity_category_weights enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Users read their food category weights') then
    create policy "Users read their food category weights" on public.user_food_category_weights for select to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users create their food category weights') then
    create policy "Users create their food category weights" on public.user_food_category_weights for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users update their food category weights') then
    create policy "Users update their food category weights" on public.user_food_category_weights for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users delete their food category weights') then
    create policy "Users delete their food category weights" on public.user_food_category_weights for delete to authenticated using ((select auth.uid()) = user_id);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Users read their activity category weights') then
    create policy "Users read their activity category weights" on public.user_activity_category_weights for select to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users create their activity category weights') then
    create policy "Users create their activity category weights" on public.user_activity_category_weights for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users update their activity category weights') then
    create policy "Users update their activity category weights" on public.user_activity_category_weights for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users delete their activity category weights') then
    create policy "Users delete their activity category weights" on public.user_activity_category_weights for delete to authenticated using ((select auth.uid()) = user_id);
  end if;
end $$;

revoke all on public.user_food_category_weights from anon;
revoke all on public.user_activity_category_weights from anon;

grant select, insert, update, delete on public.user_food_category_weights to authenticated;
grant select, insert, update, delete on public.user_activity_category_weights to authenticated;
