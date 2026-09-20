import { Alert, View } from 'react-native';
import { Button } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import type { RankedPlace } from '@/features/rankings/types';
import { useSocialMutation } from './hooks';

export function RatingSharing({ rating, onChanged }: { rating: RankedPlace; onChanged: () => void }) {
  const mutation = useSocialMutation();
  const shared = rating.social_visibility === 'friends';
  const change = () => {
    const apply = async () => {
      if (await mutation.run('rating_visibility', { id: rating.id, visibility: shared ? 'private' : 'friends' })) onChanged();
    };
    if (shared) void apply();
    else Alert.alert('Share this rating with friends?', `Accepted friends will see your score and review of ${rating.display_name}.`, [
      { text: 'Cancel', style: 'cancel' }, { text: 'Share', onPress: () => void apply() },
    ]);
  };
  return <View style={{ gap: 6, paddingHorizontal: 4, paddingBottom: 6 }}>
    <Button disabled={mutation.busy} label={shared ? 'Shared with friends · Make private' : 'Private · Share with friends'} onPress={change} />
    {!!mutation.error && <ThemedText accessibilityRole="alert" style={{ color: '#9A3412', fontSize: 12 }}>{mutation.error}</ThemedText>}
  </View>;
}
