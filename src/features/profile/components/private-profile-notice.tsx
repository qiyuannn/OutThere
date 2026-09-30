import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';

interface PrivateProfileNoticeProps {
  displayName: string;
}

export function PrivateProfileNotice({ displayName }: PrivateProfileNoticeProps) {
  return (
    <View style={styles.privateAccountSection}>
      <View style={styles.lockIconContainer}>
        <ThemedText style={styles.lockIcon}>🔒</ThemedText>
      </View>
      <ThemedText style={styles.privateTitle}>This account is private</ThemedText>
      <ThemedText style={styles.privateDescription}>
        Follow {displayName} to see their visited places, average rating, and map.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  privateAccountSection: {
    width: '100%',
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F2ED',
  },
  lockIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F6F1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DFE5D9',
    marginBottom: 4,
  },
  lockIcon: {
    fontSize: 28,
  },
  privateTitle: {
    color: '#14221D',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  privateDescription: {
    color: '#637068',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 280,
  },
});
