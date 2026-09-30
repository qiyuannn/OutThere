import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { hasUserPostedAboutPlace } from '@/features/posts/service';
import { getUserRankings, getUserRatingForPlace, saveUserPlaceRating } from '@/features/rankings/service';
import type { CandidatePlace, RankedPlace, RankingMode, SaveRatingInput } from '@/features/rankings/types';
import { isPlaceSavedByUser, savePlaceForUser, unsavePlaceForUser } from '../service';
import type { PlaceDetails } from '../types';

export interface UsePlaceInteractionsOptions {
  userId?: string;
  place: PlaceDetails | null;
  placeId?: string;
  detectedMode: RankingMode;
  directIsSaved?: boolean;
  directOnToggleSave?: (saved: boolean) => void | Promise<void>;
}

export function usePlaceInteractions({
  userId,
  place,
  placeId,
  detectedMode,
  directIsSaved,
  directOnToggleSave,
}: UsePlaceInteractionsOptions) {
  const [isSaved, setIsSaved] = useState(directIsSaved ?? false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hasPosted, setHasPosted] = useState(false);
  const [postStatusReady, setPostStatusReady] = useState(false);
  const [isRateModalVisible, setIsRateModalVisible] = useState(false);
  const [existingRankings, setExistingRankings] = useState<RankedPlace[]>([]);
  const [rankingsReady, setRankingsReady] = useState(false);
  const [rankingsError, setRankingsError] = useState(false);
  const [rankingsAttempt, setRankingsAttempt] = useState(0);

  useEffect(() => {
    if (!userId || !placeId) return;
    let active = true;
    setRankingsReady(false);
    setRankingsError(false);

    getUserRatingForPlace(userId, placeId)
      .then((res) => { if (active) setUserRating(res?.rating ?? null); })
      .catch(() => {});

    getUserRankings(userId, detectedMode)
      .then((ranks) => {
        if (active) { setExistingRankings(ranks); setRankingsReady(true); }
      })
      .catch(() => { if (active) setRankingsError(true); });

    return () => { active = false; };
  }, [userId, placeId, detectedMode, rankingsAttempt]);

  const handleSaveRating = async (input: SaveRatingInput) => {
    if (!userId) return;
    await saveUserPlaceRating(userId, input);
    setUserRating(input.rating);
    const ranks = await getUserRankings(userId, detectedMode);
    setExistingRankings(ranks);
  };

  const candidateForModal: CandidatePlace | null = place
    ? {
        google_place_id: place.id,
        display_name: place.name,
        formatted_address: place.address ?? null,
        primary_type: place.primaryType ?? place.category ?? null,
        primary_type_display_name: place.category ?? null,
        photo_url: place.photoUrl ?? place.photos?.[0]?.url ?? null,
        mode: detectedMode,
      }
    : null;

  useFocusEffect(
    useCallback(() => {
      if (directIsSaved !== undefined || !userId || !placeId) return;
      let active = true;
      isPlaceSavedByUser(userId, placeId)
        .then((saved) => { if (active) setIsSaved(saved); })
        .catch(() => {});
      return () => { active = false; };
    }, [directIsSaved, placeId, userId])
  );

  useFocusEffect(
    useCallback(() => {
      if (!userId || !placeId) {
        setHasPosted(false);
        setPostStatusReady(true);
        return;
      }
      let active = true;
      setPostStatusReady(false);
      hasUserPostedAboutPlace(userId, placeId)
        .then((posted) => {
          if (active) { setHasPosted(posted); setPostStatusReady(true); }
        })
        .catch(() => {
          if (active) { setHasPosted(false); setPostStatusReady(false); }
        });
      return () => { active = false; };
    }, [placeId, userId])
  );

  const handleToggleSave = useCallback(
    async (nextSaved: boolean) => {
      if (directOnToggleSave) {
        await directOnToggleSave(nextSaved);
        setIsSaved(nextSaved);
        return;
      }
      if (!userId || !placeId) return;
      if (nextSaved) {
        await savePlaceForUser(userId, placeId, detectedMode);
        setIsSaved(true);
      } else {
        await unsavePlaceForUser(userId, placeId);
        setIsSaved(false);
      }
    },
    [directOnToggleSave, placeId, userId, detectedMode]
  );

  return {
    isSaved,
    userRating,
    hasPosted,
    postStatusReady,
    isRateModalVisible,
    existingRankings,
    rankingsReady,
    rankingsError,
    candidateForModal,
    setIsRateModalVisible,
    handleToggleSave,
    handleSaveRating,
    retryRankings: () => setRankingsAttempt((n) => n + 1),
    openRateModal: () => setIsRateModalVisible(true),
    closeRateModal: () => setIsRateModalVisible(false),
  };
}
