import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';

interface StateViewProps {
  onBack: () => void;
}

export function PlaceDetailsLoadingView({ onBack }: StateViewProps) {
  return (
    <View style={styles.screen}>
      <AppHeader description="Place Details" showBack onBack={onBack} />
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color="#000000" />
        <ThemedText>Loading place details…</ThemedText>
      </View>
    </View>
  );
}

export function PlaceDetailsEmptyView({ onBack }: StateViewProps) {
  return (
    <View style={styles.screen}>
      <AppHeader description="Place Details" showBack onBack={onBack} />
      <View style={styles.emptyContainer}>
        <ThemedText type="subtitle">Place not found</ThemedText>
        <ThemedText>We couldn’t find the details for this place.</ThemedText>
      </View>
    </View>
  );
}

export function RatingsErrorBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.errorContainer}>
      <ThemedText style={styles.errorText}>Could not load your ratings for comparison.</ThemedText>
      <Button label="Retry ratings" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorContainer: { paddingVertical: 8, gap: 6, alignItems: 'center' },
  errorText: { color: '#666666', fontSize: 13, textAlign: 'center' },
});
