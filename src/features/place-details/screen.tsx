import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { computeIsOpenNow } from '@/lib/opening-hours';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { ActionBar } from './components/action-bar';
import { AmenitiesSection } from './components/amenities-section';
import { AttributionFooter } from './components/attribution-footer';
import { HoursSection } from './components/hours-section';
import { LocationSection } from './components/location-section';
import { PhotoCarousel } from './components/photo-carousel';
import { PlaceHeader } from './components/place-header';
import { RecommendationNote } from './components/recommendation-note';
import type { PlaceDetails, PlaceDetailsScreenProps } from './types';

export function PlaceDetailsScreen({
  place: directPlace,
  onBack,
  isSaved: directIsSaved,
  onToggleSave: directOnToggleSave,
}: Partial<PlaceDetailsScreenProps>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id;
  const searchParams = useLocalSearchParams<{ id?: string; placeJson?: string }>();

  const [place, setPlace] = useState<PlaceDetails | null>(() => {
    if (directPlace) {
      return {
        ...directPlace,
        openNow: directPlace.openNow ?? computeIsOpenNow(directPlace.regularOpeningHours),
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

  const placeId = place?.id ?? (typeof searchParams.id === 'string' ? searchParams.id : undefined);

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
  useEffect(() => {
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
  }, [directIsSaved, placeId, userId]);

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
          mode: 'food',
          saved_at: new Date().toISOString(),
        }, { onConflict: 'user_id,google_place_id' });
        if (!error) setIsSaved(true);
      } else {
        const { error } = await supabase
          .from('saved_places')
          .delete()
          .eq('user_id', userId)
          .eq('google_place_id', placeId);
        if (!error) setIsSaved(false);
      }
    },
    [directOnToggleSave, placeId, userId]
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
      <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            onPress={handleBack}
            style={[styles.floatingButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
          >
            <ThemedText style={styles.backIcon}>←</ThemedText>
          </Pressable>
        </View>
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText themeColor="textSecondary">Loading place details…</ThemedText>
        </View>
      </View>
    );
  }

  if (!place) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            onPress={handleBack}
            style={[styles.floatingButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
          >
            <ThemedText style={styles.backIcon}>←</ThemedText>
          </Pressable>
        </View>
        <View style={styles.emptyContainer}>
          <ThemedText type="subtitle">Place not found</ThemedText>
          <ThemedText themeColor="textSecondary">
            We couldn’t find the details for this place.
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Photo Carousel */}
        <PhotoCarousel place={place} />

        {/* Floating Top Nav Button */}
        <View style={[styles.floatingNav, { top: insets.top + 8 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={handleBack}
            style={[
              styles.floatingButton,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          >
            <ThemedText style={styles.backIcon}>←</ThemedText>
          </Pressable>
        </View>

        {/* Content Body */}
        <View style={styles.body}>
          {/* Main Title & Status Badges */}
          <PlaceHeader place={place} />

          {/* Quick Action Buttons */}
          <ActionBar place={place} isSaved={isSaved} onToggleSave={handleToggleSave} />

          {/* Editorial / Recommendation Note */}
          <RecommendationNote place={place} />

          {/* 7-Day Operating Hours */}
          <HoursSection place={place} />

          {/* Amenities & Highlights */}
          <AmenitiesSection place={place} />

          {/* Location & Map Shortcut */}
          <LocationSection place={place} />

          {/* Compliance & Contributor Attribution */}
          <AttributionFooter place={place} />
        </View>
      </ScrollView>
    </View>
  );
}

export default PlaceDetailsScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  floatingNav: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  floatingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  backIcon: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
  },
  body: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: 20,
    paddingTop: 24,
    gap: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
});
