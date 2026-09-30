import { useState } from 'react';
import { getBracketBounds, stepComparison, Vibe } from '../comparison';
import type { RankedPlace } from '../types';

export function useShowdownState(existingRankings: RankedPlace[]) {
  const [lowIdx, setLowIdx] = useState(0);
  const [highIdx, setHighIdx] = useState(-1);
  const [currentMid, setCurrentMid] = useState<number | null>(null);
  const [comparisonCount, setComparisonCount] = useState(1);

  const initShowdown = (vibe: Vibe) => {
    const bounds = getBracketBounds(existingRankings, vibe);
    if (bounds.low <= bounds.high && existingRankings.length > 0) {
      setLowIdx(bounds.low);
      setHighIdx(bounds.high);
      setCurrentMid(Math.floor((bounds.low + bounds.high) / 2));
      setComparisonCount(1);
      return { hasShowdown: true, insertionIndex: bounds.low };
    }
    return { hasShowdown: false, insertionIndex: bounds.low };
  };

  const advanceShowdown = (choice: 'new_better' | 'existing_better' | 'equal') => {
    if (currentMid === null) return { isDone: true, insertionIndex: lowIdx };
    const result = stepComparison(choice, currentMid, lowIdx, highIdx);
    if (!result.isDone) {
      setLowIdx(result.nextLow);
      setHighIdx(result.nextHigh);
      setCurrentMid(result.nextMid);
      setComparisonCount((c) => c + 1);
    }
    return result;
  };

  const resetShowdown = () => {
    setComparisonCount(1);
    setCurrentMid(null);
  };

  return { currentMid, comparisonCount, initShowdown, advanceShowdown, resetShowdown };
}
