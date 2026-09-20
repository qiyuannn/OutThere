alter table public.profiles
  drop constraint if exists completed_profile_required_fields,
  drop column if exists city,
  drop column if exists interests,
  drop column if exists budget,
  drop column if exists travel_radius_meters,
  drop column if exists exploration_style,
  drop column if exists onboarding_step;

alter table public.profiles
  add constraint completed_profile_required_fields check (
    not onboarding_completed or (
      username is not null and char_length(btrim(display_name)) > 0
    )
  );
