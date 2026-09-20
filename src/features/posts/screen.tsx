import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { getScoreTier } from '@/features/rankings/comparison';
import { useAuth } from '@/providers/auth-provider';
import { createPost } from './service';
import type { SelectedPostPhoto } from './types';

const addPhotoIcon = require('../../../assets/images/posts/add-photo-plus.svg');
const PHOTO_LIMIT = 5;

type PostParams = {
  placeId?: string;
  name?: string;
  category?: string;
  address?: string;
  rating?: string;
};

export default function PostScreen() {
  const params = useLocalSearchParams<PostParams>();
  const { session } = useAuth();
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<SelectedPostPhoto[]>([]);
  const [posting, setPosting] = useState(false);
  const rating = Math.max(0, Math.min(10, Number(params.rating)));
  const valid = !!params.placeId && !!params.name && Number.isFinite(rating);
  const tier = useMemo(() => getScoreTier(rating), [rating]);

  const goBack = () => router.canGoBack() ? router.back() : router.replace('/rankings' as Href);

  const addPhotos = async () => {
    if (photos.length >= PHOTO_LIMIT) {
      Alert.alert('Photo limit reached', `You can add up to ${PHOTO_LIMIT} photos.`);
      return;
    }
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo access needed', 'Allow photo access to add pictures to your post.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: PHOTO_LIMIT - photos.length,
      base64: true,
      quality: 0.85,
    });
    if (result.canceled) return;
    const selected = result.assets.flatMap((asset): SelectedPostPhoto[] => asset.base64 ? [{
      uri: asset.uri,
      base64: asset.base64,
      mimeType: asset.mimeType ?? 'image/jpeg',
    }] : []);
    setPhotos((current) => [...current, ...selected].slice(0, PHOTO_LIMIT));
  };

  const submit = async () => {
    const userId = session?.user.id;
    if (!userId || !params.placeId || !valid || posting) return;
    setPosting(true);
    try {
      await createPost(userId, { googlePlaceId: params.placeId, rating, body, photos });
      router.replace('/rankings' as Href);
    } catch (error) {
      Alert.alert('Could not post', error instanceof Error ? error.message : 'Try again.');
      setPosting(false);
    }
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.screen}>
      <AppHeader description="Post" showBack onBack={goBack} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardArea}>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scroller}
        >
          {!valid ? (
            <View style={styles.invalidState}>
              <ThemedText accessibilityRole="alert">This post could not be opened.</ThemedText>
              <ActionButton label="Back" onPress={goBack} />
            </View>
          ) : (
            <>
              <View style={styles.placeRow}>
                <View style={styles.placeDetails}>
                  <ThemedText numberOfLines={1} style={styles.placeName}>{params.name}</ThemedText>
                  {params.category ? <ThemedText numberOfLines={1} style={styles.placeMeta}>{params.category}</ThemedText> : null}
                  {params.address ? <ThemedText numberOfLines={1} style={styles.placeMeta}>{params.address}</ThemedText> : null}
                </View>
                <View style={styles.ratingSlot}>
                  <View style={[styles.ratingBadge, { backgroundColor: tier.backgroundColor, borderColor: tier.color }]}>
                    <ThemedText style={[styles.ratingText, { color: tier.textColor }]}>{rating.toFixed(1)}</ThemedText>
                  </View>
                </View>
              </View>

              <ThemedText style={styles.label}>Tell others about your visit</ThemedText>
              <TextInput
                accessibilityLabel="Tell others about your visit"
                maxLength={2000}
                multiline
                onChangeText={setBody}
                style={styles.textBox}
                textAlignVertical="top"
                value={body}
              />

              <PhotoGallery photos={photos} onAddPhotos={() => void addPhotos()} />
            </>
          )}
        </ScrollView>
        {valid ? (
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: posting }}
              disabled={posting}
              onPress={() => void submit()}
              style={({ pressed }) => [styles.postButton, (pressed || posting) && styles.pressed]}
            >
              {posting ? <ActivityIndicator size="small" color="#000000" /> : <ThemedText style={styles.postLabel}>Post</ThemedText>}
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PhotoGallery({ photos, onAddPhotos }: { photos: SelectedPostPhoto[]; onAddPhotos: () => void }) {
  const { width: windowWidth } = useWindowDimensions();
  const galleryWidth = Math.min(windowWidth, 402) - 20;
  const tileWidth = (galleryWidth - 12) / 2;

  return (
    <View style={styles.galleryField}>
      <ThemedText style={styles.galleryLabel}>Photo Gallery</ThemedText>
      {photos.length === 0 ? (
        <AddPhotoTile onPress={onAddPhotos} style={styles.emptyGallerySlot} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.galleryGrid}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.galleryScroller}
        >
          {photos.map((photo, index) => (
            <View key={`${photo.uri}-${index}`} style={[styles.gallerySlot, { width: tileWidth }]}>
              <Image source={photo.uri} contentFit="cover" style={styles.photo} />
            </View>
          ))}
          <AddPhotoTile onPress={onAddPhotos} style={{ width: tileWidth }} />
        </ScrollView>
      )}
    </View>
  );
}

function AddPhotoTile({ onPress, style }: { onPress: () => void; style: { width: number | `${number}%` } }) {
  return (
    <Pressable
      accessibilityLabel="Add photos"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.gallerySlot, style, pressed && styles.pressed]}
    >
      <Image source={addPhotoIcon} contentFit="contain" style={styles.addPhotoIcon} />
    </Pressable>
  );
}

function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
      <ThemedText style={styles.actionLabel}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  keyboardArea: { flex: 1 },
  scroller: { flex: 1 },
  content: { width: '100%', maxWidth: 402, minHeight: '100%', alignSelf: 'center', padding: 10, gap: 10 },
  invalidState: { gap: 14 },
  placeRow: { width: '100%', minHeight: 45, flexDirection: 'row', alignItems: 'flex-start', gap: 11, overflow: 'hidden' },
  placeDetails: { flex: 1, minWidth: 0, alignItems: 'flex-start', overflow: 'hidden' },
  placeName: { color: '#000000', fontSize: 16, fontWeight: '600', lineHeight: 15, letterSpacing: 0.25 },
  placeMeta: { color: '#000000', fontSize: 10, fontWeight: '300', lineHeight: 15, letterSpacing: 0.25 },
  ratingSlot: { width: 45, height: 45, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  ratingBadge: { minWidth: 45, height: 30, paddingHorizontal: 10, borderWidth: 1, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  ratingText: { fontSize: 12, fontWeight: '400', lineHeight: 15 },
  label: { width: '100%', color: '#000000', fontSize: 12, fontWeight: '600', lineHeight: 15, letterSpacing: 0.25 },
  textBox: { width: '100%', height: 157, borderWidth: 1, borderColor: '#000000', borderRadius: 8, padding: 10, color: '#000000', fontSize: 14, lineHeight: 19 },
  galleryField: { width: '100%', gap: 12, alignItems: 'flex-start' },
  galleryLabel: { width: '100%', color: '#111827', fontSize: 14, fontWeight: '600', lineHeight: 20, letterSpacing: 0.25 },
  galleryScroller: { width: '100%' },
  galleryGrid: { alignItems: 'flex-start', gap: 12 },
  emptyGallerySlot: { width: '100%' },
  gallerySlot: {
    height: 100,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  addPhotoIcon: { width: 24, height: 24 },
  photo: { width: '100%', height: '100%' },
  actionButton: { width: '100%', minHeight: 38, borderWidth: 1, borderColor: '#000000', padding: 10, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: '#000000', fontSize: 12, fontWeight: '600', lineHeight: 15, letterSpacing: 0.25 },
  footer: { width: '100%', maxWidth: 402, alignSelf: 'center', paddingHorizontal: 10, paddingBottom: 10 },
  postButton: { width: '100%', minHeight: 38, borderWidth: 1, borderColor: '#000000', padding: 10, alignItems: 'center', justifyContent: 'center' },
  postLabel: { color: '#000000', fontSize: 12, fontWeight: '600', lineHeight: 15 },
  pressed: { opacity: 0.55 },
});
