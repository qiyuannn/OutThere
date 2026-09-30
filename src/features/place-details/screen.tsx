import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import { RatePlaceModal } from '@/features/rankings/components/rate-place-modal';
import { PlaceDetailsContent } from './components/place-details-content';
import { PlaceDetailsEmptyView, PlaceDetailsLoadingView } from './components/place-details-state-views';
import { usePlaceDetails } from './hooks/use-place-details';
import type { PlaceDetailsScreenProps } from './types';

export function PlaceDetailsScreen(props: Partial<PlaceDetailsScreenProps>) {
  const controller = usePlaceDetails(props);

  const handleBack = () => {
    if (props.onBack) {
      props.onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(tabs)/bucket-list');
    }
  };

  if (controller.loading) {
    return <PlaceDetailsLoadingView onBack={handleBack} />;
  }

  if (!controller.place) {
    return <PlaceDetailsEmptyView onBack={handleBack} />;
  }

  return (
    <View style={styles.screen}>
      <AppHeader description="Place Details" showBack onBack={handleBack} />
      <PlaceDetailsContent
        place={controller.place}
        placeId={controller.placeId}
        isSaved={controller.isSaved}
        onToggleSave={controller.handleToggleSave}
        userRating={controller.userRating}
        hasPosted={controller.hasPosted}
        postStatusReady={controller.postStatusReady}
        rankingsReady={controller.rankingsReady}
        rankingsError={controller.rankingsError}
        onRate={controller.rankingsReady ? controller.openRateModal : undefined}
        onRetryRankings={controller.retryRankings}
      />
      <RatePlaceModal
        visible={controller.isRateModalVisible}
        onClose={controller.closeRateModal}
        onSave={controller.handleSaveRating}
        existingRankings={controller.existingRankings}
        mode={controller.detectedMode}
        initialPlace={controller.candidateForModal}
      />
    </View>
  );
}

export default PlaceDetailsScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
