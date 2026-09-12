import { useEffect, useState } from 'react';
import Slider from '@react-native-community/slider';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function FiltersModal({ visible, radiusMeters, onClose, onSave }:
  { visible: boolean; radiusMeters: number; onClose: () => void; onSave: (radiusMeters: number) => Promise<void> }) {
  const theme = useTheme(); const [draftRadius, setDraftRadius] = useState(radiusMeters);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (visible) { setDraftRadius(radiusMeters); setError(null); } }, [radiusMeters, visible]);

  async function save() {
    setSaving(true); setError(null);
    try { await onSave(draftRadius); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update the search range.'); }
    finally { setSaving(false); }
  }

  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.headerCopy}><ThemedText type="smallBold" themeColor="primary">SEARCH RANGE</ThemedText>
          <ThemedText style={styles.title}>How far should we look?</ThemedText></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close range filter" onPress={onClose}
          style={({ pressed }) => [styles.close, { backgroundColor: theme.backgroundSelected, opacity: pressed ? 0.7 : 1 }]}>
          <ThemedText style={styles.closeText}>×</ThemedText>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Distance from your current location">
          <View style={styles.sliderHeader}>
            <ThemedText type="small" themeColor="textSecondary">1 km</ThemedText>
            <ThemedText type="smallBold" themeColor="primary">{draftRadius / 1000} km</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">50 km</ThemedText>
          </View>
          <Slider
            accessibilityLabel="Recommendation distance"
            accessibilityValue={{ min: 1, max: 50, now: draftRadius / 1000, text: `${draftRadius / 1000} kilometres` }}
            minimumValue={1}
            maximumValue={50}
            step={1}
            value={draftRadius / 1000}
            minimumTrackTintColor={theme.primary}
            maximumTrackTintColor={theme.border}
            thumbTintColor={theme.accent}
            onValueChange={(kilometres) => setDraftRadius(kilometres * 1000)}
            style={styles.slider}
          />
        </Section>
        {error ? <ThemedText accessibilityRole="alert" type="small" style={{ color: '#B42318' }}>{error}</ThemedText> : null}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <Pressable accessibilityRole="button" disabled={saving} onPress={save}
          style={({ pressed }) => [styles.save, { backgroundColor: theme.primary, opacity: saving ? 0.45 : pressed ? 0.75 : 1 }]}>
          {saving ? <ActivityIndicator color={theme.onPrimary} /> : <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Apply range</ThemedText>}
        </Pressable>
      </View>
    </SafeAreaView>
  </Modal>;
}

function Section({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return <View style={styles.section}><ThemedText style={styles.sectionTitle}>{title}</ThemedText>{children}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 24, borderBottomWidth: 1 },
  headerCopy: { gap: 5, flex: 1 }, title: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.6 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, closeText: { fontSize: 28, lineHeight: 32 },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 24, gap: 30 }, section: { gap: 12 },
  sectionTitle: { fontSize: 19, lineHeight: 26, fontWeight: '800' },
  sliderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, slider: { width: '100%', height: 44 },
  footer: { borderTopWidth: 1, padding: 20 }, save: { minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
});
