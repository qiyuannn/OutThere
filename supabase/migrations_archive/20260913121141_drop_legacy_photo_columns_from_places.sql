-- Backfill any existing places that have legacy single-photo columns but empty photos jsonb
update public.places
set photos = jsonb_build_array(
  jsonb_build_object(
    'name', photo_name,
    'widthPx', null,
    'heightPx', null,
    'authorAttributions', case
      when photo_attribution_display_name is not null or photo_attribution_uri is not null then
        jsonb_build_array(
          jsonb_build_object(
            'displayName', photo_attribution_display_name,
            'uri', photo_attribution_uri,
            'photoUri', null
          )
        )
      else '[]'::jsonb
    end
  )
)
where (photos is null or photos = '[]'::jsonb)
  and photo_name is not null;

-- Drop obsolete single-photo columns
alter table public.places
  drop column if exists photo_name,
  drop column if exists photo_attribution_display_name,
  drop column if exists photo_attribution_uri;
