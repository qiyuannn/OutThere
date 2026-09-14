-- Migration: Allow nullable vibe in user_place_ratings so batch rating recalibrations update cleanly
alter table public.user_place_ratings alter column vibe drop not null;
