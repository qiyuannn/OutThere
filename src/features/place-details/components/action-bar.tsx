import { Image, type ImageSource } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { PlaceDetails } from '../types';

const actionIcons = {
  call: require('../../../../assets/images/place-details/call.svg'),
  website: require('../../../../assets/images/place-details/website.svg'),
  save: require('../../../../assets/images/place-details/save.svg'),
  rate: require('../../../../assets/images/place-details/rate.svg'),
} as const;

interface ActionBarProps {
  place: PlaceDetails;
  isSaved?: boolean;
  onToggleSave?: (saved: boolean) => void | Promise<void>;
  userRating?: number | null;
  onRate?: () => void;
}

export function ActionBar({ place, isSaved = false, onToggleSave, userRating, onRate }: ActionBarProps) {
  const [saving, setSaving] = useState(false);

  const toggleSave = async () => {
    if (!onToggleSave || saving) return;
    try {
      setSaving(true);
      await onToggleSave(!isSaved);
    } catch (error) {
      Alert.alert('Could not update saved places', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.row}>
      <QuickAction
        disabled={!place.phoneNumber}
        icon={actionIcons.call}
        label="Call"
        onPress={() => place.phoneNumber && void Linking.openURL(`tel:${place.phoneNumber.replace(/[^\d+]/g, '')}`)}
      />
      <QuickAction
        disabled={!place.websiteUri}
        icon={actionIcons.website}
        label="Website"
        onPress={() => place.websiteUri && void Linking.openURL(place.websiteUri)}
      />
      <QuickAction
        busy={saving}
        disabled={!onToggleSave}
        icon={actionIcons.save}
        label={isSaved ? 'Saved' : 'Save'}
        onPress={() => void toggleSave()}
        selected={isSaved}
      />
      <QuickAction
        disabled={!onRate}
        icon={actionIcons.rate}
        label="Rate"
        onPress={() => onRate?.()}
        selected={userRating !== null && userRating !== undefined}
        value={userRating === null || userRating === undefined ? undefined : userRating.toFixed(1)}
      />
    </View>
  );
}

function QuickAction({
  busy = false,
  disabled = false,
  icon,
  label,
  onPress,
  selected = false,
  value,
}: {
  busy?: boolean;
  disabled?: boolean;
  icon: ImageSource;
  label: string;
  onPress: () => void;
  selected?: boolean;
  value?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [styles.action, (disabled || busy) && styles.disabled, pressed && styles.pressed]}
    >
      <View style={[styles.iconCircle, selected && styles.selectedCircle]}>
        {busy ? (
          <ActivityIndicator color="#000000" size="small" />
        ) : value ? (
          <ThemedText style={styles.value}>{value}</ThemedText>
        ) : (
          <Image source={icon} contentFit="contain" style={styles.icon} />
        )}
      </View>
      <ThemedText numberOfLines={1} style={styles.label}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', flexDirection: 'row', alignItems: 'flex-start' },
  action: { flex: 1, minWidth: 0, gap: 10, padding: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  iconCircle: { width: 46, height: 46, borderWidth: 1, borderColor: '#000000', borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  selectedCircle: { backgroundColor: '#F3F4F6' },
  icon: { width: 24, height: 24 },
  label: { width: '100%', color: '#000000', fontSize: 10, fontWeight: '600', lineHeight: 12, textAlign: 'center' },
  value: { color: '#000000', fontSize: 12, fontWeight: '600', lineHeight: 15, textAlign: 'center' },
  disabled: { opacity: 0.3 },
  pressed: { opacity: 0.5 },
});
