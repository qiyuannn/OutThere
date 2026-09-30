import { Linking, Pressable, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { searchStyles } from './controls';

export function GoogleAttribution({ attributions = [], providersOnly = false }: { attributions?: { provider?: string; providerUri?: string }[]; providersOnly?: boolean }) {
  return <View style={searchStyles.row}>
    {!providersOnly && <ThemedText themeColor="textSecondary" style={{ fontSize: 12, fontWeight: '400', letterSpacing: 0 }}>Google Maps</ThemedText>}
    {attributions.map((a, i) => <Pressable key={i} accessibilityRole="link" disabled={!a.providerUri} onPress={() => a.providerUri && void Linking.openURL(a.providerUri).catch(() => {})}><ThemedText type="small">{a.provider}</ThemedText></Pressable>)}
  </View>;
}

