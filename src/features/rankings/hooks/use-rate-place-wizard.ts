import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';

import { routes } from '@/lib/routes';
import { useAuth } from '@/providers/auth-provider';
import { calculateListRecalibration, RecalibratedPlace, Vibe } from '../comparison';
import type { CandidatePlace, RankedPlace, RankingMode, SaveRatingInput } from '../types';
import { useCandidateSearch } from './use-candidate-search';
import { useShowdownState } from './use-showdown-state';

export type ModalStep = 'select_place' | 'vibe_check' | 'showdown' | 'score_reveal';

interface UseRatePlaceWizardOptions {
  visible: boolean;
  onClose: () => void;
  onSave: (input: SaveRatingInput) => Promise<void>;
  existingRankings: RankedPlace[];
  mode: RankingMode;
  initialPlace?: CandidatePlace | null;
}

export function useRatePlaceWizard({
  visible,
  onClose,
  onSave,
  existingRankings,
  mode,
  initialPlace = null,
}: UseRatePlaceWizardOptions) {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [step, setStep] = useState<ModalStep>('select_place');
  const [selectedPlace, setSelectedPlace] = useState<CandidatePlace | null>(initialPlace);
  const [selectedVibe, setSelectedVibe] = useState<Vibe>('liked');

  const { loadingCandidates, searchQuery, setSearchQuery, filteredCandidates } =
    useCandidateSearch(visible, step, userId, mode);

  const { currentMid, comparisonCount, initShowdown, advanceShowdown, resetShowdown } =
    useShowdownState(existingRankings);

  const [finalScore, setFinalScore] = useState<number>(7.8);
  const [recalibratedPlaces, setRecalibratedPlaces] = useState<RecalibratedPlace[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedPlace(initialPlace);
      setStep(initialPlace ? 'vibe_check' : 'select_place');
      setSelectedVibe('liked');
      setSaving(false);
      resetShowdown();
      setRecalibratedPlaces([]);
    }
  }, [visible, initialPlace, resetShowdown]);

  const handleSelectPlace = (place: CandidatePlace) => {
    setSelectedPlace(place);
    setStep('vibe_check');
  };

  const finalizeRating = (insertionIndex: number, vibe: Vibe) => {
    const recalib = calculateListRecalibration(
      selectedPlace?.google_place_id ?? 'new_place',
      insertionIndex,
      existingRankings,
      vibe,
    );
    setFinalScore(recalib.newScore);
    setRecalibratedPlaces(recalib.updatedPlaces);
    setStep('score_reveal');
  };

  const handleSelectVibe = (vibe: Vibe) => {
    setSelectedVibe(vibe);
    const { hasShowdown, insertionIndex } = initShowdown(vibe);
    if (hasShowdown) {
      setStep('showdown');
    } else {
      finalizeRating(insertionIndex, vibe);
    }
  };

  const handleShowdownChoice = (choice: 'new_better' | 'existing_better' | 'equal') => {
    const result = advanceShowdown(choice);
    if (result.isDone) {
      finalizeRating(result.insertionIndex, selectedVibe);
    }
  };

  const projectedRank = useMemo(() => {
    let rank = 1;
    for (const r of existingRankings) {
      if (r.rating > finalScore) rank++;
    }
    return rank;
  }, [existingRankings, finalScore]);

  const handleSave = async (openPost = false) => {
    if (!selectedPlace || saving) return;
    setSaving(true);
    try {
      await onSave({
        google_place_id: selectedPlace.google_place_id,
        mode,
        rating: finalScore,
        vibe: selectedVibe,
        recommend: true,
        notes: '',
        recalibratedPlaces,
      });
      onClose();
      if (openPost) {
        router.push(
          routes.postRating({
            placeId: selectedPlace.google_place_id,
            name: selectedPlace.display_name,
            category: selectedPlace.primary_type_display_name ?? '',
            address: selectedPlace.formatted_address ?? '',
            rating: finalScore.toFixed(1),
          })
        );
      }
    } catch {
      setSaving(false);
    }
  };

  return {
    step,
    selectedPlace,
    selectedVibe,
    searchQuery,
    setSearchQuery,
    loadingCandidates,
    filteredCandidates,
    comparisonCount,
    currentMid,
    finalScore,
    projectedRank,
    saving,
    handleSelectPlace,
    handleSelectVibe,
    handleShowdownChoice,
    handleSave,
  };
}
