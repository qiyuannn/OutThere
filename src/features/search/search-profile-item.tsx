import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/features/profile/components/avatar';
import type { ProfileSearchResult } from './model';

type SearchProfileItemProps = {
  profile: ProfileSearchResult;
  onPress: (profile: ProfileSearchResult) => void;
};

export function SearchProfileItem({ profile, onPress }: SearchProfileItemProps) {
  const bio = profile.bio?.trim();

  return (
    <Pressable
      accessibilityLabel={`Profile: ${profile.display_name}, @${profile.username}`}
      accessibilityRole="button"
      onPress={() => onPress(profile)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Avatar
        name={profile.display_name || profile.username}
        path={profile.avatar_path}
        size={44}
      />

      <View style={styles.details}>
        <ThemedText numberOfLines={1} style={styles.displayName}>
          {profile.display_name}
        </ThemedText>
        <ThemedText numberOfLines={1} style={styles.username}>
          @{profile.username}
        </ThemedText>
        {bio ? (
          <ThemedText numberOfLines={1} style={styles.bio}>
            {bio}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.65,
  },
  details: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 2,
    overflow: 'hidden',
  },
  displayName: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  username: {
    color: '#637068',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 15,
  },
  bio: {
    color: '#8E9B90',
    fontSize: 11,
    fontWeight: '300',
    lineHeight: 14,
  },
});
