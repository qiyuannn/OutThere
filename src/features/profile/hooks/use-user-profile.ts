import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import type { Profile } from '../model';
import {
  cancelFollowRequest,
  getFollowCounts,
  getFollowRelationship,
  loadProfile,
  loadProfileVisitSummary,
  sendFollowRequest,
  unfollowUser,
  type ProfileVisitSummary,
  type UserFollowRelationship,
} from '../service';

const EMPTY_SUMMARY: ProfileVisitSummary = { averageRating: null, places: [], visitedCount: 0 };

export function useUserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const currentUserId = session?.user.id;
  const isOwnProfile = !id || id === currentUserId;
  const targetUserId = id || currentUserId;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [summary, setSummary] = useState<ProfileVisitSummary>(EMPTY_SUMMARY);
  const [followRelationship, setFollowRelationship] = useState<UserFollowRelationship>('none');
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [togglingFollow, setTogglingFollow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestCount = useRef(0);

  const loadData = useCallback(async () => {
    if (!targetUserId) {
      setLoading(false);
      setError('User not found.');
      return;
    }
    const currentReq = ++requestCount.current;
    try {
      const [fetchedProfile, fetchedRel, fetchedCounts] = await Promise.all([
        loadProfile(targetUserId),
        currentUserId && !isOwnProfile
          ? getFollowRelationship(targetUserId).catch(() => 'none' as const)
          : ('none' as const),
        getFollowCounts(targetUserId).catch(() => ({ followers: 0, following: 0 })),
      ]);
      let fetchedSummary = EMPTY_SUMMARY;
      const isPublic = !fetchedProfile?.is_private;
      if (isOwnProfile || fetchedRel === 'following' || isPublic) {
        fetchedSummary = await loadProfileVisitSummary(targetUserId).catch(() => EMPTY_SUMMARY);
      }
      if (currentReq !== requestCount.current) return;
      if (!fetchedProfile) {
        setError('Profile not found.');
        return;
      }
      setProfile(fetchedProfile);
      setSummary(fetchedSummary);
      setFollowRelationship(fetchedRel);
      setFollowCounts(fetchedCounts);
      setError(null);
    } catch (e) {
      if (currentReq === requestCount.current) {
        setError(e instanceof Error ? e.message : 'Could not load profile.');
      }
    } finally {
      if (currentReq === requestCount.current) setLoading(false);
    }
  }, [targetUserId, currentUserId, isOwnProfile]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void loadData();
  }, [loadData]);

  const executeFollow = async () => {
    if (!targetUserId) return;
    const isTargetPublic = !profile?.is_private;
    setFollowRelationship(isTargetPublic ? 'following' : 'requested');
    if (isTargetPublic) {
      setFollowCounts((prev) => ({ ...prev, followers: prev.followers + 1 }));
    }
    const nextRel = await sendFollowRequest(targetUserId);
    setFollowRelationship(nextRel);
    if (nextRel === 'following' && !isTargetPublic) {
      setFollowCounts((prev) => ({ ...prev, followers: prev.followers + 1 }));
      const nextSummary = await loadProfileVisitSummary(targetUserId).catch(() => EMPTY_SUMMARY);
      setSummary(nextSummary);
    }
  };

  const handleToggleFollow = async () => {
    if (!currentUserId || !targetUserId || isOwnProfile || togglingFollow) return;
    const prevRel = followRelationship;
    setTogglingFollow(true);
    try {
      if (prevRel === 'following') {
        setFollowRelationship('none');
        setFollowCounts((prev) => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
        await unfollowUser(currentUserId, targetUserId);
      } else if (prevRel === 'requested') {
        setFollowRelationship('none');
        await cancelFollowRequest(targetUserId);
      } else {
        await executeFollow();
      }
    } catch {
      setFollowRelationship(prevRel);
    } finally {
      setTogglingFollow(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, loadData]);

  return {
    profile,
    summary,
    followRelationship,
    followCounts,
    togglingFollow,
    loading,
    refreshing,
    error,
    isOwnProfile,
    targetUserId,
    currentUserId,
    handleToggleFollow,
    handleRefresh,
  };
}
