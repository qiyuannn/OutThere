import { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type Mode = 'activities' | 'food';
type Choice = 'pass' | 'later' | 'save';

// Layout fixtures only. Live places and preference scores will come from the backend.
const previews = {
  activities: {
    headline: 'Take the scenic route.',
    name: 'A little time by the water',
    details: 'Outdoors · Nature · A slower afternoon',
    reason: 'Fresh air, a quiet path, and room to wander.',
    image: 'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1200&q=85',
    imageLabel: 'Sunlight falling through a green forest',
  },
  food: {
    headline: 'Find your new favourite.',
    name: 'A cosy café kind of day',
    details: 'Café · Coffee & bites · Take your time',
    reason: 'A good coffee and a little change of scenery.',
    image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=85',
    imageLabel: 'A warm café interior with tables and chairs',
  },
} satisfies Record<Mode, { headline: string; name: string; details: string; reason: string; image: string; imageLabel: string }>;

export default function DiscoverScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('activities');
  const [choices, setChoices] = useState<Partial<Record<Mode, Choice>>>({});
  const [failedImages, setFailedImages] = useState<Partial<Record<Mode, boolean>>>({});
  const place = previews[mode];
  const choice = choices[mode];

  function resetPreview() {
    setChoices((current) => ({ ...current, [mode]: undefined }));
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <ThemedText type="smallBold" themeColor="primary" style={styles.eyebrow}>OUTTHERE</ThemedText>
            <View style={[styles.previewBadge, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText style={styles.previewLabel} themeColor="textSecondary">LAYOUT PREVIEW</ThemedText>
            </View>
          </View>
          <ThemedText accessibilityRole="header" style={styles.title}>What’s the plan?</ThemedText>
          <ThemedText themeColor="textSecondary">A good match for your kind of day.</ThemedText>
        </View>

        <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: theme.backgroundSelected }]}>
          {(['activities', 'food'] as const).map((item) => (
            <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: mode === item }}
              onPress={() => setMode(item)}
              style={({ pressed }) => [styles.tab, { backgroundColor: mode === item ? theme.accent : 'transparent', opacity: pressed ? 0.75 : 1 }]}>
              <ThemedText type="smallBold" style={{ color: mode === item ? theme.onAccent : theme.textSecondary }}>
                {item === 'activities' ? 'Activities' : 'Food'}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {!choice ? (
          <>
            <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <View style={[styles.imageFrame, { backgroundColor: theme.backgroundSelected }]}>
                {!failedImages[mode] ? (
                  <Image key={mode} source={{ uri: place.image }} accessibilityLabel={place.imageLabel}
                    style={styles.image} contentFit="cover" transition={200}
                    onError={() => setFailedImages((current) => ({ ...current, [mode]: true }))} />
                ) : (
                  <View style={styles.imageFallback}>
                    <ThemedText style={[styles.fallbackArrow, { color: theme.primary }]}>↗</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">A little inspiration for your day</ThemedText>
                  </View>
                )}
                <View style={[styles.photoBadge, { backgroundColor: theme.accent }]}>
                  <ThemedText style={[styles.photoBadgeText, { color: theme.onAccent }]}>↗  {mode === 'activities' ? 'A LITTLE ADVENTURE' : 'SOMETHING DELICIOUS'}</ThemedText>
                </View>
              </View>
              <View style={styles.cardBody}>
                <ThemedText type="smallBold" themeColor="primary" style={styles.kicker}>A LITTLE INSPIRATION</ThemedText>
                <ThemedText accessibilityRole="header" style={styles.headline}>{place.headline}</ThemedText>
                <ThemedText style={styles.placeName}>{place.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{place.details}</ThemedText>
                <View style={[styles.reason, { borderTopColor: theme.border }]}>
                  <ThemedText type="small" themeColor="textSecondary">{place.reason}</ThemedText>
                </View>
              </View>
            </View>

            <View style={styles.actions}>
              {([
                { action: 'pass', label: 'Pass', icon: '×' },
                { action: 'later', label: 'Not now', icon: '◷' },
                { action: 'save', label: 'Let’s go', icon: '✓' },
              ] as const).map(({ action, label, icon }) => (
                <Pressable key={action} accessibilityRole="button" accessibilityLabel={`${label}, preview`}
                  onPress={() => setChoices((current) => ({ ...current, [mode]: action }))}
                  style={({ pressed }) => [styles.action, {
                    backgroundColor: action === 'save' ? theme.accent : theme.backgroundElement,
                    borderColor: action === 'save' ? theme.accent : theme.border,
                    opacity: pressed ? 0.7 : 1,
                  }]}>
                  <ThemedText accessible={false} style={[styles.actionIcon, { color: action === 'save' ? theme.onAccent : theme.textSecondary }]}>{icon}</ThemedText>
                  <ThemedText type="smallBold" style={{ color: action === 'save' ? theme.onAccent : theme.text }}>{label}</ThemedText>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <View accessibilityLiveRegion="polite" style={[styles.emptyCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <View style={[styles.completionIcon, { backgroundColor: theme.accent }]}>
              <ThemedText style={{ color: theme.onAccent, fontSize: 32, lineHeight: 40 }}>{choice === 'save' ? '✓' : choice === 'later' ? '◷' : '↗'}</ThemedText>
            </View>
            <ThemedText accessibilityRole="header" style={styles.emptyTitle}>
              {choice === 'save' ? 'One for your someday.' : choice === 'later' ? 'Another time, then.' : 'On to something new.'}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              {choice === 'save' ? 'In the live version, Let’s go will save this place to your bucket list.' : choice === 'later' ? 'In the live version, this skips a place just for this session.' : 'In the live version, Pass hides this place until you restore it.'}
            </ThemedText>
            <Pressable accessibilityRole="button" onPress={resetPreview}
              style={({ pressed }) => [styles.reset, { backgroundColor: theme.primary, opacity: pressed ? 0.75 : 1 }]}>
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Show preview again</ThemedText>
            </Pressable>
          </View>
        )}
        <ThemedText type="small" themeColor="textSecondary" style={styles.previewNote}>Sample content · Live nearby places coming next.</ThemedText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 20, paddingTop: 28, paddingBottom: 48, gap: 16 },
  header: { gap: 8, marginBottom: 4 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  eyebrow: { letterSpacing: 3, fontSize: 12 },
  previewBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  previewLabel: { fontSize: 9, lineHeight: 14, letterSpacing: 1, fontWeight: '700' },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1.2 },
  tabs: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 28 },
  tab: { flex: 1, minHeight: 44, padding: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  card: { borderWidth: 1, borderRadius: 28, padding: 12, overflow: 'hidden' },
  imageFrame: { aspectRatio: 1.65, borderRadius: 20, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  imageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 8 },
  fallbackArrow: { fontSize: 48, lineHeight: 56 },
  photoBadge: { position: 'absolute', bottom: 12, left: 12, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  photoBadgeText: { fontSize: 9, lineHeight: 14, letterSpacing: 0.8, fontWeight: '800' },
  cardBody: { paddingHorizontal: 6, paddingTop: 18, paddingBottom: 10, gap: 8 },
  kicker: { fontSize: 10, lineHeight: 16, letterSpacing: 1.1 },
  headline: { fontSize: 28, lineHeight: 34, letterSpacing: -0.7, fontWeight: '800' },
  placeName: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  reason: { borderTopWidth: 1, marginTop: 6, paddingTop: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, minHeight: 62, borderWidth: 1, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', justifyContent: 'center' },
  actionIcon: { fontSize: 22, lineHeight: 26 },
  emptyCard: { minHeight: 350, borderWidth: 1, borderRadius: 28, padding: 28, gap: 20, alignItems: 'center', justifyContent: 'center' },
  completionIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 26, lineHeight: 32, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  centerText: { textAlign: 'center' },
  reset: { minHeight: 48, borderRadius: 16, padding: 14, paddingHorizontal: 20, justifyContent: 'center' },
  previewNote: { textAlign: 'center', fontSize: 11, lineHeight: 18 },
});
