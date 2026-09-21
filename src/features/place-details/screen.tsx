import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { computeIsOpenNow } from '@/lib/opening-hours';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { getCategoryGroupKey } from '@/features/categories/catalog';
import { getLivePlaceDetails } from '@/features/search/service';
import { Button } from '@/components/foundation';
import { GlassSurface } from '@/components/ui-system';
import { RatePlaceModal } from '@/features/rankings/components/rate-place-modal';
import { getUserRankings, getUserRatingForPlace, saveUserPlaceRating } from '@/features/rankings/service';
import type { CandidatePlace, RankedPlace, RankingMode, SaveRatingInput } from '@/features/rankings/types';
import { ActionBar } from './components/action-bar';
import { AttributionFooter } from './components/attribution-footer';
import { HoursSection } from './components/hours-section';
import { LocationSection } from './components/location-section';
import { PhotoCarousel } from './components/photo-carousel';
import { PlaceHeader } from './components/place-header';
import type { PlaceDetails, PlaceDetailsScreenProps } from './types';

export function PlaceDetailsScreen({
  place: directPlace,
  onBack,
  isSaved: directIsSaved,
  onToggleSave: directOnToggleSave,
}: Partial<PlaceDetailsScreenProps>) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const searchParams = useLocalSearchParams<{ id?: string; placeJson?: string; mode?: 'food' | 'activities' }>();

  const [place, setPlace] = useState<PlaceDetails | null>(() => {
    if (directPlace) {
      return {
        ...directPlace,
        openNow: directPlace.liveDetails ? directPlace.openNow : directPlace.openNow ?? computeIsOpenNow(directPlace.regularOpeningHours),
      };
    }
    if (searchParams.placeJson) {
      try {
        const parsed = JSON.parse(searchParams.placeJson) as PlaceDetails;
        return {
          ...parsed,
          openNow: parsed.openNow ?? computeIsOpenNow(parsed.regularOpeningHours),
        };
      } catch {
        return null;
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(!place && !!searchParams.id);
  const [isSaved, setIsSaved] = useState(directIsSaved ?? false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [isRateModalVisible, setIsRateModalVisible] = useState(false);
  const [existingRankings, setExistingRankings] = useState<RankedPlace[]>([]);
  const [rankingsReady, setRankingsReady] = useState(false);
  const [rankingsError, setRankingsError] = useState(false);
  const [rankingsAttempt, setRankingsAttempt] = useState(0);

  const placeId = place?.id ?? (typeof searchParams.id === 'string' ? searchParams.id : undefined);

  const detectedMode: RankingMode = (searchParams.mode === 'food' || searchParams.mode === 'activities' ? searchParams.mode : place?.mode) ?? ((place?.category && getCategoryGroupKey('activities', place.category))
    ? 'activities'
    : 'food');

  // Fetch user rating and rankings for comparison
  useEffect(() => {
    if (!userId || !placeId) return;
    let active = true;
    setRankingsReady(false); setRankingsError(false);

    getUserRatingForPlace(userId, placeId).then((res) => {
      if (active) setUserRating(res?.rating ?? null);
    }).catch(() => { /* Rating state can be retried by reopening the place. */ });

    getUserRankings(userId, detectedMode).then((ranks) => {
      if (active) { setExistingRankings(ranks); setRankingsReady(true); }
    }).catch(() => { if (active) setRankingsError(true); });

    return () => {
      active = false;
    };
  }, [userId, placeId, detectedMode, rankingsAttempt]);

  const handleSaveRating = async (input: SaveRatingInput) => {
    if (!userId) return;
    await saveUserPlaceRating(userId, input);
    setUserRating(input.rating);
    const ranks = await getUserRankings(userId, detectedMode);
    setExistingRankings(ranks);
  };

  const candidateForModal: CandidatePlace | null = place
    ? {
        google_place_id: place.id,
        display_name: place.name,
        formatted_address: place.address ?? null,
        primary_type: place.primaryType ?? place.category ?? null,
        primary_type_display_name: place.category ?? null,
        photo_url: place.photoUrl ?? place.photos?.[0]?.url ?? null,
        mode: detectedMode,
      }
    : null;

  // Fetch place from Supabase by ID if needed
  useEffect(() => {
    if (place || !placeId || !supabase) return;

    let active = true;
    setLoading(true);

    async function loadPlace() {
      try {
        const { data, error } = await supabase!
          .from('places')
          .select('*')
          .eq('google_place_id', placeId)
          .maybeSingle();

        if (error || !data) {
          if (active) setLoading(false);
          return;
        }

        if (!data.display_name) {
          const fresh = (await getLivePlaceDetails([placeId!])).get(placeId!);
          if (active && fresh) setPlace(fresh);
          return;
        }

        if (active) {
          const regularHours = Array.isArray(data.regular_opening_hours) ? data.regular_opening_hours : [];
          const rawPhotos = (data.photos ?? []) as PlaceDetails['photos'];
          const primaryPhoto = rawPhotos?.find((p) => p.url);
          const firstAttribution = rawPhotos?.[0]?.authorAttributions?.[0];
          setPlace({
            id: data.google_place_id,
            name: data.display_name ?? 'Saved Place',
            category: data.primary_type_display_name,
            address: data.formatted_address,
            latitude: data.latitude,
            longitude: data.longitude,
            rating: data.rating,
            ratingCount: data.user_rating_count,
            priceLevel: data.price_level,
            openNow: computeIsOpenNow(regularHours),
            mapsUrl: data.google_maps_uri,
            websiteUri: data.website_uri,
            phoneNumber: data.phone_number,
            regularOpeningHours: regularHours,
            amenities: data.amenities,
            photos: rawPhotos,
            photoUrl: primaryPhoto?.url ?? null,
            photoAttribution: firstAttribution?.displayName ? {
              displayName: firstAttribution.displayName,
              uri: firstAttribution.uri ?? null,
            } : null,
          });
        }
      } catch {
        // Handled via loading false
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPlace();

    return () => {
      active = false;
    };
  }, [place, placeId]);

  // Fetch photo media URLs from edge function if missing
  useEffect(() => {
    if (!place || !placeId || !supabase) return;
    const currentPhotos = place.photos;
    const needsPhotoResolution = currentPhotos?.some((p) => p.name && !p.url);
    if (!needsPhotoResolution) return;

    let active = true;

    async function loadPhotoUrls() {
      try {
        const { data, error } = await supabase!.functions.invoke('place-recommendations', {
          body: {
            action: 'get-place-photos',
            placeId,
            photos: currentPhotos,
          },
        });

        if (error || !data || !active) return;

        if (Array.isArray(data.photos) && data.photos.length > 0) {
          setPlace((prev) => {
            if (!prev || prev.id !== placeId) return prev;
            return {
              ...prev,
              photos: data.photos,
              photoUrl: data.photoUrl ?? data.photos.find((p: { url?: string }) => p.url)?.url ?? prev.photoUrl,
            };
          });
        }
      } catch {
        // Silently ignore photo resolution error
      }
    }

    void loadPhotoUrls();

    return () => {
      active = false;
    };
  }, [place?.photos, placeId]);

  // Check saved state in database if not provided
  useFocusEffect(useCallback(() => {
    if (directIsSaved !== undefined || !userId || !placeId || !supabase) return;

    let active = true;

    async function checkSaved() {
      try {
        const { data } = await supabase!
          .from('saved_places')
          .select('google_place_id')
          .eq('user_id', userId)
          .eq('google_place_id', placeId)
          .maybeSingle();

        if (active) {
          setIsSaved(!!data);
        }
      } catch {
        // Ignore check error
      }
    }

    void checkSaved();

    return () => {
      active = false;
    };
  }, [directIsSaved, placeId, userId]));

  // Handle Save / Unsave toggle
  const handleToggleSave = useCallback(
    async (nextSaved: boolean) => {
      if (directOnToggleSave) {
        await directOnToggleSave(nextSaved);
        setIsSaved(nextSaved);
        return;
      }

      if (!userId || !placeId || !supabase) return;

      if (nextSaved) {
        const { error } = await supabase.from('saved_places').upsert({
          user_id: userId,
          google_place_id: placeId,
          mode: detectedMode,
          saved_at: new Date().toISOString(),
        }, { onConflict: 'user_id,google_place_id' });
        if (error) throw error;
        setIsSaved(true);
      } else {
        const { error } = await supabase
          .from('saved_places')
          .delete()
          .eq('user_id', userId)
          .eq('google_place_id', placeId);
        if (error) throw error;
        setIsSaved(false);
      }
    },
    [directOnToggleSave, placeId, userId, detectedMode]
  );

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(tabs)/bucket-list');
    }
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <AppHeader description="Place Details" showBack onBack={handleBack} />
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#000000" />
          <ThemedText>Loading place details…</ThemedText>
        </View>
      </View>
    );
  }

  if (!place) {
    return (
      <View style={styles.screen}>
        <AppHeader description="Place Details" showBack onBack={handleBack} />
        <View style={styles.emptyContainer}>
          <ThemedText type="subtitle">Place not found</ThemedText>
          <ThemedText>We couldn’t find the details for this place.</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.floatingHeader}><AppHeader description="Place Details" showBack onBack={handleBack} /></View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PhotoCarousel place={place} />
        <View style={styles.body}>
          <View style={styles.summary}>
            <PlaceHeader place={place} />
          </View>
          {rankingsError && <><ThemedText>Could not load your ratings for comparison.</ThemedText><Button label="Retry ratings" onPress={() => setRankingsAttempt(n => n + 1)} /></>}
          <HoursSection place={place} />
          <LocationSection place={place} />
          <AttributionFooter place={place} />
        </View>
      </ScrollView>
      <GlassSurface style={styles.stickyActions} interactive>
        <ActionBar
          place={place}
          isSaved={isSaved}
          onToggleSave={handleToggleSave}
          userRating={userRating}
          onRate={rankingsReady ? () => setIsRateModalVisible(true) : undefined}
        />
      </GlassSurface>

      <RatePlaceModal
        visible={isRateModalVisible}
        onClose={() => setIsRateModalVisible(false)}
        onSave={handleSaveRating}
        existingRankings={existingRankings}
        mode={detectedMode}
        initialPlace={candidateForModal}
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
  floatingHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 402,
    alignSelf: 'center',
    paddingBottom: 122,
  },
  body: {
    width: '100%',
    gap: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  summary: { width: '100%', overflow: 'hidden' },
  stickyActions: { position: 'absolute', left: 16, right: 16, bottom: 14, minHeight: 78, borderRadius: 28, paddingHorizontal: 6, justifyContent: 'center' },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
});
