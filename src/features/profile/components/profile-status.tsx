import { ActivityIndicator } from 'react-native';
import { Screen, Button } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useProfile } from '@/providers/profile-provider';
import { SignOutButton } from './sign-out';

export function ProfileStatus() {
  const { loading, reload } = useProfile();
  const theme = useTheme();
  return <Screen title={loading ? 'Getting things ready.' : 'Let’s try that again.'}>
    {loading ? <ActivityIndicator color={theme.primary} accessibilityLabel="Loading your profile" /> : <><ThemedText>We couldn’t load your profile. Check your connection and try again.</ThemedText><Button label="Try again" onPress={() => { void reload(); }} /></>}
    <SignOutButton />
  </Screen>;
}
