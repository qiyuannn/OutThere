import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { FilterOptions } from '@/components/filter-options';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { SwipeableRecommendation } from './swipeable-recommendation';
import { useDiscover } from './use-discover';
import type { DiscoverMode } from './types';

const discoveryFilters = [
  { label: 'Activities', value: 'activities' },
  { label: 'Food', value: 'food' },
] as const satisfies readonly { label: string; value: DiscoverMode }[];

export default function DiscoverScreen() {
  const theme = useTheme();
  const discover = useDiscover();

  return <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: theme.backgroundElement }]}>
    <AppHeader description="What's Out There?" />
    <View style={styles.content}>
      <FilterOptions options={discoveryFilters} value={discover.mode} onChange={discover.setMode} />

      <View style={styles.recommendationArea}>
        {discover.error ? <StateCard icon="↗" title="We lost the trail." description={discover.error}>
          <PrimaryButton label="Try again" onPress={discover.retry} />
        </StateCard> : discover.loading ? <StateCard title="Finding a good match…" description="Looking around your current location." loading />
          : discover.current ?
          <SwipeableRecommendation key={`${discover.mode}:${discover.current.id}`} place={discover.current}
            disabled={discover.acting} onChoice={discover.choose} />
          : <StateCard icon="↻" title="You’ve seen everything we found in this range."
            description={discover.passedCount > 0 ? 'Review your passed places, or increase the range to explore somewhere new.' : 'Increase the range or try searching again for a fresh set.'} accent>
            {discover.exhausted && discover.passedCount > 0 ? <PrimaryButton label="Review passed places" onPress={discover.reviewPassed} disabled={discover.acting} /> : null}
            {discover.exhausted && discover.passedCount === 0 ? <PrimaryButton label="Search again" onPress={discover.retry} /> : null}
          </StateCard>}
      </View>
    </View>
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

function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.primary, { backgroundColor: theme.primary, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}>
    <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>{label}</ThemedText>
  </Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  content: { flex: 1, width: '100%', maxWidth: 402, alignSelf: 'center', padding: 10, gap: 10, overflow: 'hidden' },
  recommendationArea: { flex: 1, minHeight: 0 },
  stateCard: { flex: 1, minHeight: 0, borderWidth: 1, borderRadius: 28, padding: 28, gap: 17, alignItems: 'center', justifyContent: 'center' },
  stateIcon: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' }, stateIconText: { fontSize: 30, lineHeight: 38 },
  stateTitle: { fontSize: 25, lineHeight: 31, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 }, center: { textAlign: 'center' },
  primary: { minHeight: 48, borderRadius: 16, paddingHorizontal: 22, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
});
