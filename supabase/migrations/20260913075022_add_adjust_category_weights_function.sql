create or replace function public.adjust_category_weights(
  p_user_id uuid,
  p_mode text,
  p_category_keys text[],
  p_delta numeric
) returns void language plpgsql security invoker as $$
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

grant execute on function public.adjust_category_weights(uuid, text, text[], numeric) to authenticated;
