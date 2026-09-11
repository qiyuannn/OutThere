import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export default function DiscoverScreen() {
  const theme = useTheme();
  return <Screen title={'A little curiosity.\nA new adventure.'}>
    <View style={{ backgroundColor: theme.accent, borderRadius: 28, padding: 28, gap: 16 }}>
      <ThemedText style={{ color: theme.onAccent, fontSize: 64, lineHeight: 72 }}>↗</ThemedText>
      <ThemedText type="subtitle" style={{ color: theme.onAccent, fontWeight: '800' }}>Go somewhere new.</ThemedText>
      <ThemedText style={{ color: theme.onAccent }}>Turn the places around you into stories worth telling.</ThemedText>
    </View>
    <Card><ThemedText type="smallBold" themeColor="primary">YOUR NEXT CHAPTER</ThemedText>
      <ThemedText type="subtitle" style={{ fontSize: 24 }}>Every adventure starts here</ThemedText>
      <ThemedText themeColor="textSecondary">Nearby places and personalised quests are coming soon. Your saved places will have a home of their own.</ThemedText>
      <Button label="Explore your bucket list" onPress={() => router.navigate('/bucket-list')} />
    </Card>
    <ThemedText type="small" themeColor="textSecondary">Discover. Experience. Make it a memory.</ThemedText>
  </Screen>;
}
