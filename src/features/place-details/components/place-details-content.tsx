import { ScrollView, StyleSheet, View } from 'react-native';
import type { PlaceDetails } from '../types';
import { ActionBar } from './action-bar';
import { AttributionFooter } from './attribution-footer';
import { HoursSection } from './hours-section';
import { LocationSection } from './location-section';
import { MutualSavesSection } from './mutual-saves-section';
import { PhotoCarousel } from './photo-carousel';
import { PlaceHeader } from './place-header';
import { RatingsErrorBanner } from './place-details-state-views';

export interface PlaceDetailsContentProps {
  place: PlaceDetails;
  placeId?: string;
  isSaved: boolean;
  onToggleSave: (nextSaved: boolean) => Promise<void>;
  userRating: number | null;
  hasPosted: boolean;
  postStatusReady: boolean;
  rankingsReady: boolean;
  rankingsError: boolean;
  onRate?: () => void;
  onRetryRankings: () => void;
}

export function PlaceDetailsContent({
  place,
  placeId,
  isSaved,
  onToggleSave,
  userRating,
  hasPosted,
  postStatusReady,
  rankingsReady,
  rankingsError,
  onRate,
  onRetryRankings,
}: PlaceDetailsContentProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PhotoCarousel place={place} />
      <View style={styles.body}>
        <View style={styles.summary}>
          <PlaceHeader place={place} />
        </View>
        <MutualSavesSection placeId={placeId ?? place.id} placeName={place?.name} />
        <ActionBar
          place={place}
          isSaved={isSaved}
          onToggleSave={onToggleSave}
          userRating={userRating}
          hasPosted={hasPosted}
          postStatusReady={postStatusReady}
          onRate={rankingsReady ? onRate : undefined}
        />
        {rankingsError && <RatingsErrorBanner onRetry={onRetryRankings} />}
        <HoursSection place={place} />
        <LocationSection place={place} />
        <AttributionFooter place={place} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 402,
    alignSelf: 'center',
    paddingBottom: 24,
  },
  body: {
    width: '100%',
    gap: 10,
    padding: 10,
  },
  summary: { width: '100%', padding: 10, overflow: 'hidden' },
});
