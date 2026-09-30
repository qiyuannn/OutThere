import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { routes } from '@/lib/routes';
import type { ProfileVisitSummary } from '../service';

interface UserStatsSectionProps {
  summary: ProfileVisitSummary;
  isOwnProfile: boolean;
  targetUserId?: string;
  displayName: string;
}

export function UserStatsSection({
  summary,
  isOwnProfile,
  targetUserId,
  displayName,
}: UserStatsSectionProps) {
  const navigateToStats = () => {
    if (isOwnProfile) {
      router.push(routes.profileStatistics);
    } else if (targetUserId) {
      router.push(routes.userStatistics(targetUserId, displayName));
    }
  };

  const navigateToActivities = () => {
    if (isOwnProfile) {
      router.push(routes.profileActivities);
    } else if (targetUserId) {
      router.push(routes.userActivities(targetUserId, displayName));
    }
  };

  return (
    <>
      <View style={styles.statistics}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Places Visited:</Text>
          <Text style={styles.statValue}>{summary.visitedCount}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Average Rating:</Text>
          <Text style={styles.statValue}>
            {summary.averageRating === null ? '—' : summary.averageRating.toFixed(1)}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={navigateToStats}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>View Statistics</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={navigateToActivities}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>View Past Activities</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  statistics: { padding: 10, gap: 10 },
  statRow: { flexDirection: 'row', gap: 10 },
  statLabel: { flex: 1, color: '#000000', fontSize: 12, lineHeight: 15, fontWeight: '600' },
  statValue: { flex: 1, color: '#000000', fontSize: 12, lineHeight: 15, fontWeight: '400' },
  actions: { minHeight: 37, flexDirection: 'row', gap: 10 },
  actionButton: {
    flex: 1,
    minHeight: 37,
    borderWidth: 1,
    borderColor: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: '#000000',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: { opacity: 0.55 },
});
