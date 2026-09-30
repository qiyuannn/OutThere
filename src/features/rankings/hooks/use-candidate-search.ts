import { useEffect, useMemo, useState } from 'react';

import { getCandidatePlaces } from '../service';
import type { CandidatePlace, RankingMode } from '../types';

export function useCandidateSearch(
  visible: boolean,
  step: string,
  userId?: string,
  mode?: RankingMode
) {
  const [candidates, setCandidates] = useState<CandidatePlace[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (visible && step === 'select_place' && userId && mode) {
      setLoadingCandidates(true);
      getCandidatePlaces(userId, mode)
        .then((data) => setCandidates(data))
        .catch(() => setCandidates([]))
        .finally(() => setLoadingCandidates(false));
    }
  }, [visible, step, userId, mode]);

  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) return candidates;
    const q = searchQuery.toLowerCase();
    return candidates.filter(
      (c) =>
        c.display_name.toLowerCase().includes(q) ||
        c.formatted_address?.toLowerCase().includes(q) ||
        c.primary_type_display_name?.toLowerCase().includes(q),
    );
  }, [candidates, searchQuery]);

  return {
    candidates,
    loadingCandidates,
    searchQuery,
    setSearchQuery,
    filteredCandidates,
  };
}
