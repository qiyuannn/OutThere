import { useState } from 'react';

import { followUser, unfollowUser } from '@/features/profile/service';
import { respondToFollowRequest, respondToPlaceInvite } from './service';
import type { AppNotification } from './types';

export function useNotificationMutations(
  currentUserId: string | undefined,
  setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>
) {
  const [followProcessing, setFollowProcessing] = useState<Set<string>>(new Set());
  const [inviteProcessing, setInviteProcessing] = useState<Set<number>>(new Set());
  const [followRespondProcessing, setFollowRespondProcessing] = useState<Set<number>>(new Set());

  const handleToggleFollow = async (targetUserId: string, currentlyFollowing: boolean) => {
    if (!currentUserId || followProcessing.has(targetUserId)) return;
    setFollowProcessing((prev) => new Set(prev).add(targetUserId));
    const nextFollowing = !currentlyFollowing;

    setNotifications((prev) =>
      prev.map((item) =>
        item.actorId === targetUserId ? { ...item, isFollowingActor: nextFollowing } : item
      )
    );

    try {
      if (nextFollowing) {
        await followUser(currentUserId, targetUserId);
      } else {
        await unfollowUser(currentUserId, targetUserId);
      }
    } catch {
      setNotifications((prev) =>
        prev.map((item) =>
          item.actorId === targetUserId ? { ...item, isFollowingActor: currentlyFollowing } : item
        )
      );
    } finally {
      setFollowProcessing((prev) => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
    }
  };

  const handleRespondInvite = async (notificationId: number, status: 'accepted' | 'declined') => {
    if (inviteProcessing.has(notificationId)) return;
    setInviteProcessing((prev) => new Set(prev).add(notificationId));

    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notificationId ? { ...item, inviteStatus: status } : item
      )
    );

    try {
      await respondToPlaceInvite(notificationId, status);
    } catch {
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId ? { ...item, inviteStatus: 'pending' } : item
        )
      );
    } finally {
      setInviteProcessing((prev) => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    }
  };

  const handleRespondFollow = async (notificationId: number, status: 'accepted' | 'declined') => {
    if (followRespondProcessing.has(notificationId)) return;
    setFollowRespondProcessing((prev) => new Set(prev).add(notificationId));

    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notificationId ? { ...item, followStatus: status } : item
      )
    );

    try {
      await respondToFollowRequest(notificationId, status);
    } catch {
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId ? { ...item, followStatus: 'pending' } : item
        )
      );
    } finally {
      setFollowRespondProcessing((prev) => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    }
  };

  return {
    followProcessing,
    inviteProcessing,
    followRespondProcessing,
    handleToggleFollow,
    handleRespondInvite,
    handleRespondFollow,
  };
}
