import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { routes } from '@/lib/routes';
import { Avatar } from './avatar';
import { FollowButton } from './follow-button';
import type { Profile } from '../model';
import type { UserFollowRelationship } from '../service';

interface UserProfileHeaderProps {
  profile: Profile;
  followCounts: { followers: number; following: number };
  isOwnProfile: boolean;
  followRelationship: UserFollowRelationship;
  togglingFollow: boolean;
  currentUserId?: string;
  onToggleFollow: () => void;
}

export function UserProfileHeader({
  profile,
  followCounts,
  isOwnProfile,
  followRelationship,
  togglingFollow,
  currentUserId,
  onToggleFollow,
}: UserProfileHeaderProps) {
  return (
    <>
      <View style={styles.profileDescription}>
        <Avatar name={profile.display_name} path={profile.avatar_path} size={69} />
        <View style={styles.identity}>
          <Text style={styles.name}>{profile.display_name}</Text>
          <Text style={styles.username}>@{profile.username}</Text>
          <Text style={styles.following}>
            {followCounts.followers} Followers · {followCounts.following} Following
          </Text>
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
        </View>
      </View>

      {isOwnProfile ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(routes.editProfile)}
          style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>Edit Profile</Text>
        </Pressable>
      ) : (
        <FollowButton
          disabled={!currentUserId}
          onPress={onToggleFollow}
          relationship={followRelationship}
          toggling={togglingFollow}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  profileDescription: {
    minHeight: 101,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  identity: {
    flex: 1,
    minHeight: 81,
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 2,
  },
  name: { color: '#000000', fontSize: 20, lineHeight: 24, fontWeight: '700' },
  username: { color: '#637068', fontSize: 13, lineHeight: 17, fontWeight: '500' },
  following: {
    color: '#000000',
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '300',
    letterSpacing: 0.25,
  },
  bio: { color: '#14221D', fontSize: 13, lineHeight: 17, marginTop: 4 },
  outlineButton: {
    minHeight: 37,
    borderWidth: 1,
    borderColor: '#000000',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.55 },
  buttonLabel: {
    color: '#000000',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
