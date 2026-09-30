import { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { rowStyles } from './notification-styles';

interface NotificationAvatarProps {
  avatarUrl?: string | null;
  displayName: string;
  onPress: () => void;
}

export function NotificationAvatar({ avatarUrl, displayName, onPress }: NotificationAvatarProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={rowStyles.avatarContainer}>
      {avatarUrl && !avatarFailed ? (
        <Image
          accessibilityLabel={`${displayName}'s avatar`}
          contentFit="cover"
          onError={() => setAvatarFailed(true)}
          source={avatarUrl}
          style={rowStyles.avatarImg}
        />
      ) : (
        <ThemedText style={rowStyles.avatarInitials}>
          {displayName.trim().slice(0, 2).toUpperCase() || 'OT'}
        </ThemedText>
      )}
    </Pressable>
  );
}
