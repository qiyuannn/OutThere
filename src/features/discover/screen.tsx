import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { FiltersModal } from './filters-modal';
import { RecommendationCard } from './recommendation-card';
import { useDiscover } from './use-discover';

export default function DiscoverScreen() {
  const theme = useTheme();
  const discover = useDiscover();
  const [filtersOpen, setFiltersOpen] = useState(false);

  return <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: theme.background }]}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <ThemedText type="smallBold" themeColor="primary" style={styles.eyebrow}>OUTTHERE</ThemedText>
        <ThemedText accessibilityRole="header" style={styles.title}>What’s the plan?</ThemedText>
        <ThemedText themeColor="textSecondary">A good match for your kind of day.</ThemedText>
      </View>

      <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: theme.backgroundSelected }]}>
        {(['activities', 'food'] as const).map((mode) => <Pressable key={mode} accessibilityRole="tab"
          accessibilityState={{ selected: discover.mode === mode }} onPress={() => discover.setMode(mode)}
          style={({ pressed }) => [styles.tab, { backgroundColor: discover.mode === mode ? theme.accent : 'transparent', opacity: pressed ? 0.75 : 1 }]}>
          <ThemedText type="smallBold" style={{ color: discover.mode === mode ? theme.onAccent : theme.textSecondary }}>
            {mode === 'activities' ? 'Activities' : 'Food'}
          </ThemedText>
        </Pressable>)}
      </View>

      <Pressable accessibilityRole="button" onPress={() => setFiltersOpen(true)}
        style={({ pressed }) => [styles.filterBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}>
        <ThemedText style={styles.locationIcon}>◎</ThemedText>
        <View style={styles.filterCopy}>
          <ThemedText type="smallBold" numberOfLines={1}>{discover.settings.areaLabel}</ThemedText>
          <ThemedText style={styles.filterMeta} themeColor="textSecondary">Within {discover.settings.radiusMeters / 1000} km</ThemedText>
        </View>
        <ThemedText type="smallBold" themeColor="primary">Tune</ThemedText>
      </Pressable>

      {discover.notice ? <View accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="small" themeColor="textSecondary">{discover.notice}</ThemedText>
      </View> : null}

      {discover.error ? <StateCard icon="↗" title="We lost the trail." description={discover.error}>
        <PrimaryButton label="Try again" onPress={discover.retry} />
      </StateCard> : discover.loading ? <StateCard title="Finding a good match…" description={`Looking around ${discover.settings.areaLabel}.`} loading />
        : discover.current ? <>
          <RecommendationCard place={discover.current} mode={discover.mode} />
          <View style={styles.actions}>{[
            { choice: 'pass' as const, label: 'Pass', icon: '×', primary: false },
            { choice: 'later' as const, label: 'Not now', icon: '◷', primary: false },
            { choice: 'save' as const, label: 'Let’s go', icon: '✓', primary: true },
          ].map((action) => <Pressable key={action.choice} accessibilityRole="button" disabled={discover.acting}
            onPress={() => discover.choose(action.choice)} style={({ pressed }) => [styles.action, {
              backgroundColor: action.primary ? theme.accent : theme.backgroundElement,
              borderColor: action.primary ? theme.accent : theme.border,
              opacity: discover.acting ? 0.45 : pressed ? 0.7 : 1,
            }]}>
            <ThemedText style={[styles.actionIcon, { color: action.primary ? theme.onAccent : theme.textSecondary }]}>{action.icon}</ThemedText>
            <ThemedText type="smallBold" style={{ color: action.primary ? theme.onAccent : theme.text }}>{action.label}</ThemedText>
          </Pressable>)}</View>
        </> : <StateCard icon="✓" title="That’s everything nearby."
          description="Review places you skipped, or change your area and interests for a fresh set." accent>
          <PrimaryButton label="Review skipped places" onPress={discover.startOver} />
          <Pressable accessibilityRole="button" onPress={() => setFiltersOpen(true)}>
            <ThemedText type="smallBold" themeColor="primary">Change preferences</ThemedText>
          </Pressable>
        </StateCard>}
    </ScrollView>
    <FiltersModal visible={filtersOpen} mode={discover.mode} settings={discover.settings}
      onClose={() => setFiltersOpen(false)} onSave={discover.updateSettings} />
  </SafeAreaView>;
}

function StateCard({ icon, title, description, loading, accent, children }:
  React.PropsWithChildren<{ icon?: string; title: string; description: string; loading?: boolean; accent?: boolean }>) {
  const theme = useTheme();
  return <View style={[styles.stateCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
    {loading ? <ActivityIndicator size="large" color={theme.primary} accessibilityLabel="Finding nearby recommendations" />
      : <View style={[styles.stateIcon, { backgroundColor: accent ? theme.accent : theme.backgroundSelected }]}>
        <ThemedText style={[styles.stateIconText, accent ? { color: theme.onAccent } : undefined]}>{icon}</ThemedText>
      </View>}
    <ThemedText accessibilityRole="header" style={styles.stateTitle}>{title}</ThemedText>
    <ThemedText accessibilityRole={loading ? undefined : 'alert'} themeColor="textSecondary" style={styles.center}>{description}</ThemedText>
    {children}
  </View>;
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={({ pressed }) => [styles.primary, { backgroundColor: theme.primary, opacity: pressed ? 0.75 : 1 }]}>
    <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>{label}</ThemedText>
  </Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 20, paddingTop: 28, paddingBottom: 48, gap: 14 },
  header: { gap: 7, marginBottom: 4 }, eyebrow: { letterSpacing: 3, fontSize: 12, marginBottom: 7 }, title: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1.2 },
  tabs: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 28 }, tab: { flex: 1, minHeight: 44, padding: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  filterBar: { minHeight: 58, borderWidth: 1, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 11 },
  locationIcon: { fontSize: 23, lineHeight: 28 }, filterCopy: { flex: 1, minWidth: 0 }, filterMeta: { fontSize: 11, lineHeight: 16 },
  notice: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99 }, actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, minHeight: 62, borderWidth: 1, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', justifyContent: 'center' }, actionIcon: { fontSize: 22, lineHeight: 26 },
  stateCard: { minHeight: 360, borderWidth: 1, borderRadius: 28, padding: 28, gap: 17, alignItems: 'center', justifyContent: 'center' },
  stateIcon: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' }, stateIconText: { fontSize: 30, lineHeight: 38 },
  stateTitle: { fontSize: 25, lineHeight: 31, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 }, center: { textAlign: 'center' },
  primary: { minHeight: 48, borderRadius: 16, paddingHorizontal: 22, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
});
