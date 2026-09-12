import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { AREAS, INTERESTS, RADIUS_OPTIONS } from './constants';
import { getRoundedDeviceLocation } from './service';
import type { DiscoverMode, DiscoverSettings } from './types';

export function FiltersModal({ visible, mode, settings, onClose, onSave }:
  { visible: boolean; mode: DiscoverMode; settings: DiscoverSettings; onClose: () => void; onSave: (settings: DiscoverSettings) => Promise<void> }) {
  const theme = useTheme(); const [draft, setDraft] = useState(settings);
  const [locating, setLocating] = useState(false); const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (visible) { setDraft(settings); setError(null); } }, [settings, visible]);
  const selectedInterests = mode === 'activities' ? draft.activityInterests : draft.foodInterests;

  function toggleInterest(key: string) {
    const next = selectedInterests.includes(key) ? selectedInterests.filter((value) => value !== key) : [...selectedInterests, key];
    setDraft((value) => mode === 'activities' ? { ...value, activityInterests: next } : { ...value, foodInterests: next });
  }

  async function useDeviceLocation() {
    setLocating(true); setError(null);
    try { const location = await getRoundedDeviceLocation(); setDraft((value) => ({ ...value, ...location })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not get your location.'); }
    finally { setLocating(false); }
  }

  async function save() {
    setSaving(true); setError(null);
    try { await onSave(draft); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save these preferences.'); }
    finally { setSaving(false); }
  }

  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.headerCopy}><ThemedText type="smallBold" themeColor="primary">TUNE YOUR PICKS</ThemedText>
          <ThemedText style={styles.title}>What sounds good?</ThemedText></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close preferences" onPress={onClose}
          style={({ pressed }) => [styles.close, { backgroundColor: theme.backgroundSelected, opacity: pressed ? 0.7 : 1 }]}>
          <ThemedText style={styles.closeText}>×</ThemedText>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Where should we look?">
          <Pressable accessibilityRole="button" onPress={useDeviceLocation} disabled={locating}
            style={({ pressed }) => [styles.locationButton, { backgroundColor: draft.areaKey === 'current' ? theme.accent : theme.backgroundElement, borderColor: draft.areaKey === 'current' ? theme.accent : theme.border, opacity: pressed ? 0.75 : 1 }]}>
            {locating ? <ActivityIndicator color={theme.primary} /> : <ThemedText style={{ color: draft.areaKey === 'current' ? theme.onAccent : theme.text }}>◎</ThemedText>}
            <ThemedText type="smallBold" style={{ color: draft.areaKey === 'current' ? theme.onAccent : theme.text }}>{locating ? 'Finding you…' : 'Use my current location'}</ThemedText>
          </Pressable>
          <View style={styles.chips}>{AREAS.map((area) => <Chip key={area.key} label={area.label} selected={draft.areaKey === area.key}
            onPress={() => setDraft((value) => ({ ...value, areaKey: area.key, areaLabel: area.label, latitude: area.latitude, longitude: area.longitude }))} />)}</View>
        </Section>
        <Section title="How far would you go?">
          <View style={styles.chips}>{RADIUS_OPTIONS.map((radius) => <Chip key={radius} label={`${radius / 1000} km`} selected={draft.radiusMeters === radius}
            onPress={() => setDraft((value) => ({ ...value, radiusMeters: radius }))} />)}</View>
        </Section>
        <Section title={mode === 'activities' ? 'What are you into?' : 'What are you craving?'}>
          <ThemedText type="small" themeColor="textSecondary">Choose any that fit. Leaving this blank keeps your picks varied.</ThemedText>
          <View style={styles.chips}>{INTERESTS[mode].map((interest) => <Chip key={interest.key} label={interest.label}
            selected={selectedInterests.includes(interest.key)} onPress={() => toggleInterest(interest.key)} />)}</View>
        </Section>
        {error ? <ThemedText accessibilityRole="alert" type="small" style={{ color: '#B42318' }}>{error}</ThemedText> : null}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <Pressable accessibilityRole="button" disabled={saving || locating} onPress={save}
          style={({ pressed }) => [styles.save, { backgroundColor: theme.primary, opacity: saving || locating ? 0.45 : pressed ? 0.75 : 1 }]}>
          {saving ? <ActivityIndicator color={theme.onPrimary} /> : <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Show my recommendations</ThemedText>}
        </Pressable>
      </View>
    </SafeAreaView>
  </Modal>;
}

function Section({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return <View style={styles.section}><ThemedText style={styles.sectionTitle}>{title}</ThemedText>{children}</View>;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
    style={({ pressed }) => [styles.chip, { backgroundColor: selected ? theme.accent : theme.backgroundElement, borderColor: selected ? theme.accent : theme.border, opacity: pressed ? 0.7 : 1 }]}>
    <ThemedText type="smallBold" style={{ color: selected ? theme.onAccent : theme.text }}>{selected ? '✓ ' : ''}{label}</ThemedText>
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 24, borderBottomWidth: 1 },
  headerCopy: { gap: 5, flex: 1 }, title: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.6 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, closeText: { fontSize: 28, lineHeight: 32 },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 24, gap: 30 }, section: { gap: 12 },
  sectionTitle: { fontSize: 19, lineHeight: 26, fontWeight: '800' }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 10 },
  locationButton: { minHeight: 50, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  footer: { borderTopWidth: 1, padding: 20 }, save: { minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
});
