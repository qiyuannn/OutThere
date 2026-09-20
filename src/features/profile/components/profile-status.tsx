import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProfile } from '@/providers/profile-provider';
import { SignOutButton } from './sign-out';

export function ProfileStatus() {
  const { loading, reload } = useProfile();

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.container}>
        <ActivityIndicator color="#000000" size="small" accessibilityLabel="Loading your profile" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.container}>
      <View style={styles.errorBox}>
        <Text style={styles.errorTitle}>Let’s try that again.</Text>
        <Text style={styles.errorMessage}>We couldn’t load your profile. Check your connection and try again.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => { void reload(); }}
          style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>Try again</Text>
        </Pressable>
        <SignOutButton />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    gap: 12,
    alignItems: 'center',
  },
  errorTitle: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorMessage: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
  outlineButton: {
    width: '100%',
    height: 36,
    borderColor: '#000000',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginTop: 8,
  },
  buttonLabel: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.55,
  },
});
