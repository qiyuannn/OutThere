import { router } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { routes } from '@/lib/routes';
import { PrivateProfileNotice } from './components/private-profile-notice';
import { UserProfileHeader } from './components/user-profile-header';
import { userScreenStyles as styles } from './components/user-screen-styles';
import { UserStatsSection } from './components/user-stats-section';
import { VisitedPlacesMap } from './components/visited-places-map';
import { useUserProfile } from './hooks/use-user-profile';

export function UserProfileScreen() {
  const {
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
  } = useUserProfile();

  const isFollowing = followRelationship === 'following';
  const isProfilePublic = !profile?.is_private;
  const canViewDetails = isOwnProfile || isFollowing || isProfilePublic;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace(routes.search));

  if (loading) {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
        <AppHeader description="Profile" onBack={goBack} showBack />
        <View style={styles.centered}>
          <ActivityIndicator color="#000000" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
        <AppHeader description="Profile" onBack={goBack} showBack />
        <View style={styles.centered}>
          <ThemedText accessibilityRole="alert" style={styles.errorMessage}>
            {error ?? 'Profile not found.'}
          </ThemedText>
          <Button label="Back" onPress={goBack} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <AppHeader
        description={profile.display_name || 'Profile'}
        onBack={goBack}
        showBack
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={['#000000']}
            onRefresh={() => void handleRefresh()}
            refreshing={refreshing}
            tintColor="#000000"
          />
        }
      >
        <UserProfileHeader
          currentUserId={currentUserId}
          followCounts={followCounts}
          followRelationship={followRelationship}
          isOwnProfile={isOwnProfile}
          onToggleFollow={handleToggleFollow}
          profile={profile}
          togglingFollow={togglingFollow}
        />

        {canViewDetails ? (
          <>
            <UserStatsSection
              displayName={profile.display_name}
              isOwnProfile={isOwnProfile}
              summary={summary}
              targetUserId={targetUserId}
            />

            <View style={styles.mapSection}>
              <Text style={styles.mapHeading}>Map</Text>
              {summary.places.length > 0 ? (
                <VisitedPlacesMap places={summary.places} />
              ) : (
                <View style={styles.mapEmpty}>
                  <ThemedText style={styles.emptyMapText}>No visited places recorded yet.</ThemedText>
                </View>
              )}
            </View>
          </>
        ) : (
          <PrivateProfileNotice displayName={profile.display_name} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default UserProfileScreen;
