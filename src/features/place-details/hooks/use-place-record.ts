import { useEffect, useState } from 'react';
import { computeIsOpenNow } from '@/lib/opening-hours';
import { getCategoryGroupKey } from '@/features/categories/catalog';
import type { RankingMode } from '@/features/rankings/types';
import { fetchPlaceDetailsById, resolvePlacePhotos } from '../service';
import type { PlaceDetails } from '../types';

export interface UsePlaceRecordOptions {
  directPlace?: PlaceDetails;
  idParam?: string;
  placeJsonParam?: string;
  modeParam?: 'food' | 'activities';
}

export function usePlaceRecord({
  directPlace,
  idParam,
  placeJsonParam,
  modeParam,
}: UsePlaceRecordOptions) {
  const [place, setPlace] = useState<PlaceDetails | null>(() => {
    if (directPlace) {
      return {
        ...directPlace,
        openNow: directPlace.liveDetails
          ? directPlace.openNow
          : directPlace.openNow ?? computeIsOpenNow(directPlace.regularOpeningHours),
      };
    }
    if (placeJsonParam) {
      try {
        const parsed = JSON.parse(placeJsonParam) as PlaceDetails;
        return {
          ...parsed,
          openNow: parsed.openNow ?? computeIsOpenNow(parsed.regularOpeningHours),
        };
      } catch {
        return null;
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(!place && !!idParam);
  const placeId = place?.id ?? (typeof idParam === 'string' ? idParam : undefined);

  const detectedMode: RankingMode =
    (modeParam === 'food' || modeParam === 'activities' ? modeParam : place?.mode) ??
    (place?.category && getCategoryGroupKey('activities', place.category)
      ? 'activities'
      : 'food');

  // Hydrate place from database if needed
  useEffect(() => {
    if (place || !placeId) return;
    let active = true;
    setLoading(true);

    fetchPlaceDetailsById(placeId)
      .then((fresh) => {
        if (active && fresh) setPlace(fresh);
      })
      .catch(() => {
        // Silently handle error
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [place, placeId]);

  // Resolve photo media URLs from edge function if missing
  const currentPhotos = place?.photos;
  useEffect(() => {
    if (!placeId || !currentPhotos) return;
    const needsPhotoResolution = currentPhotos.some((p) => p.name && !p.url);
    if (!needsPhotoResolution) return;

    let active = true;
    resolvePlacePhotos(placeId, currentPhotos)
      .then((data) => {
        if (!active || !data?.photos?.length) return;
        setPlace((prev) => {
          if (!prev || prev.id !== placeId) return prev;
          return {
            ...prev,
            photos: data.photos,
            photoUrl: data.photoUrl ?? data.photos.find((p) => p.url)?.url ?? prev.photoUrl,
          };
        });
      })
      .catch(() => {
        // Silently ignore photo resolution error
      });

    return () => {
      active = false;
    };
  }, [placeId, currentPhotos]);

  return {
    place,
    setPlace,
    loading,
    placeId,
    detectedMode,
  };
}
