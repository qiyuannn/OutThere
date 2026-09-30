import { useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

interface AvatarBubbleProps {
  avatarUrl: string | null;
  displayName: string;
  overlap?: boolean;
  size?: number;
  zIndex?: number;
}

export function AvatarBubble({
  avatarUrl,
  displayName,
  overlap = false,
  size = 26,
  zIndex = 1,
}: AvatarBubbleProps) {
  const [failed, setFailed] = useState(false);

  return (
    <View
      style={[
        styles.avatarWrapper,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          zIndex,
        },
        overlap && styles.avatarOverlap,
      ]}
    >
      {avatarUrl && !failed ? (
        <Image
          accessibilityLabel={`${displayName}'s avatar`}
          contentFit="cover"
          onError={() => setFailed(true)}
          source={avatarUrl}
          style={{ width: size, height: size }}
        />
      ) : (
        <ThemedText style={[styles.avatarInitials, { fontSize: Math.max(9, size * 0.38) }]}>
          {displayName.trim().slice(0, 2).toUpperCase() || 'OT'}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatarWrapper: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#E7EDDE',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlap: {
    marginLeft: -8,
  },
  avatarInitials: {
    fontWeight: '700',
    color: '#24331B',
  },
});
