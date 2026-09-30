import { useCallback, useEffect, useState } from 'react';

import { getSentPlaceInvites, sendPlaceInvite } from '@/features/notifications/service';
import { getMutualFollowersSavedPlace, type MutualFollowerSavedPlace } from '../service';

interface UseMutualSavesProps {
  placeId?: string;
  placeName?: string;
}

export function useMutualSaves({ placeId, placeName }: UseMutualSavesProps) {
  const [mutualFollowers, setMutualFollowers] = useState<MutualFollowerSavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitedUserIds, setInvitedUserIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!placeId) {
      setMutualFollowers([]);
      setInvitedUserIds(new Set());
      setLoading(false);
      return;
    }

    try {
      const [items, alreadyInvited] = await Promise.all([
        getMutualFollowersSavedPlace(placeId),
        getSentPlaceInvites(placeId).catch(() => new Set<string>()),
      ]);
      setMutualFollowers(items);
      setInvitedUserIds(alreadyInvited);
    } catch {
      setMutualFollowers([]);
      setInvitedUserIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [placeId]);

  useEffect(() => {
    setLoading(true);
    void loadData();
  }, [loadData]);

  const handleInviteSingle = async (friend: MutualFollowerSavedPlace) => {
    if (!placeId) return;
    setInvitedUserIds((prev) => new Set(prev).add(friend.userId));
    try {
      await sendPlaceInvite(friend.userId, placeId, placeName);
    } catch {
      setInvitedUserIds((prev) => {
        const next = new Set(prev);
        next.delete(friend.userId);
        return next;
      });
    }
  };

  const handleInviteAll = async () => {
    if (!placeId) return;
    const uninvited = mutualFollowers.filter((u) => !invitedUserIds.has(u.userId));
    setInvitedUserIds((prev) => new Set([...prev, ...mutualFollowers.map((u) => u.userId)]));
    try {
      await Promise.all(
        uninvited.map((friend) => sendPlaceInvite(friend.userId, placeId, placeName))
      );
    } catch {
      // Ignored
    }
  };

  return {
    mutualFollowers,
    loading,
    invitedUserIds,
    handleInviteSingle,
    handleInviteAll,
  };
}
