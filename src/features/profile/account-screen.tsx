import { Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/hooks/use-theme';

interface SettingTopicProps {
  title: string;
  subtitle: string;
  onPress: () => void;
}

function SettingTopic({ title, subtitle, onPress }: SettingTopicProps) {
  const theme = useTheme();
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (Platform.OS !== 'web') void Haptics.selectionAsync();
          onPress();
        }}
        style={({ pressed }) => [
          styles.row,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.textContainer}>
          <ThemedText type="subtitle" style={styles.title}>{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{subtitle}</ThemedText>
        </View>
        <View style={[styles.accessory, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText style={styles.chevron}>›</ThemedText>
        </View>
      </Pressable>
    </Card>
  );
}

export default function AccountScreen() {
  const { session } = useAuth();
  const isModerator = session?.user.app_metadata?.role === 'moderator' || session?.user.app_metadata?.is_moderator === true;

  return (
    <Screen
      title="Settings"
      headerDescription="Settings"
      showBack
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
    >
      <SettingTopic
        title="Privacy & Sharing"
        subtitle="Profile discovery & default rating audience"
        onPress={() => router.push('/profile/privacy')}
      />

      <SettingTopic
        title="Notifications"
        subtitle="Push alerts for friend requests & comments"
        onPress={() => router.push('/profile/notifications')}
      />

      <SettingTopic
        title="Legal"
        subtitle="Terms of use and privacy policy"
        onPress={() => router.push('/profile/legal')}
      />

      <SettingTopic
        title="Membership"
        subtitle="OutThere Pro status and subscription plans"
        onPress={() => router.push('/profile/subscription')}
      />

      <SettingTopic
        title="Account"
        subtitle="Add another account, sign out and delete account"
        onPress={() => router.push('/profile/manage-account')}
      />

      {isModerator && (
        <SettingTopic
          title="Safety Team"
          subtitle="Moderation review queue and incident reports"
          onPress={() => router.push('/profile/moderation')}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pressed: {
    opacity: 0.68,
  },
  textContainer: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 16,
    lineHeight: 20,
  },
  accessory: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '600',
  },
});
