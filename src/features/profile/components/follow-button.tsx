import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import type { UserFollowRelationship } from '../service';

interface FollowButtonProps {
  relationship: UserFollowRelationship;
  toggling: boolean;
  disabled: boolean;
  onPress: () => void;
}

export function FollowButton({
  relationship,
  toggling,
  disabled,
  onPress,
}: FollowButtonProps) {
  const label =
    relationship === 'following'
      ? 'Unfollow'
      : relationship === 'requested'
        ? 'Requested'
        : 'Follow';

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled || toggling}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        relationship === 'following'
          ? styles.unfollow
          : relationship === 'requested'
            ? styles.requested
            : styles.follow,
        pressed && styles.pressed,
      ]}
    >
      {toggling ? (
        <ActivityIndicator
          color={relationship === 'none' ? '#FFFFFF' : '#000000'}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.label,
            relationship === 'following'
              ? styles.unfollowLabel
              : relationship === 'requested'
                ? styles.requestedLabel
                : styles.followLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 38,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  follow: { backgroundColor: '#14221D', borderColor: '#14221D' },
  followLabel: { color: '#FFFFFF', fontSize: 12, lineHeight: 15, fontWeight: '600' },
  unfollow: { backgroundColor: '#FFFFFF', borderColor: '#000000' },
  unfollowLabel: { color: '#000000', fontSize: 12, lineHeight: 15, fontWeight: '600' },
  requested: { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' },
  requestedLabel: { color: '#4B5563', fontSize: 12, lineHeight: 15, fontWeight: '600' },
  label: { fontSize: 12, lineHeight: 15, fontWeight: '600', textAlign: 'center' },
  pressed: { opacity: 0.55 },
});
