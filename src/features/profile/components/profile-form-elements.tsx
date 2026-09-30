import { Image } from 'expo-image';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Fonts } from '@/constants/theme';

const backIcon = require('../../../../assets/images/navigation/back.svg');

export function OnboardingHeader({ disabled, onBack }: { disabled: boolean; onBack: () => void }) {
  return (
    <View style={styles.onboardingHeader}>
      <View style={styles.onboardingHeaderRow}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          disabled={disabled}
          hitSlop={10}
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, disabled && styles.disabled, pressed && styles.pressed]}
        >
          <Image contentFit="contain" source={backIcon} style={styles.backIcon} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.brand}>OutThere</Text>
      </View>
      <Text style={styles.description}>Getting Started</Text>
    </View>
  );
}

export function EditButton({ disabled, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.editButton, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Text style={styles.editButtonLabel}>{label}</Text>
    </Pressable>
  );
}

export type EditFieldProps = {
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: 'name';
  autoCorrect?: boolean;
  editable: boolean;
  label: string;
  maxLength: number;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  value: string;
};

export function EditField({ label, multiline = false, ...inputProps }: EditFieldProps) {
  return (
    <View style={styles.editField}>
      <Text style={styles.editLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        multiline={multiline}
        selectionColor="#000000"
        style={[styles.editInput, multiline && styles.editBio]}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...inputProps}
      />
    </View>
  );
}

export function PrivacySection({ isPrivate, busy, onToggle, isEditing = false }: {
  isPrivate: boolean;
  busy: boolean;
  onToggle: (val: boolean) => void;
  isEditing?: boolean;
}) {
  return (
    <View style={styles.privacySection}>
      <View style={styles.privacyRow}>
        <View style={styles.privacyInfo}>
          <Text style={styles.editLabel}>Profile Privacy</Text>
          <Text style={styles.privacyStatus}>{isPrivate ? 'Private Account' : 'Public Account'}</Text>
        </View>
        <Switch
          accessibilityLabel="Toggle profile privacy"
          disabled={busy}
          onValueChange={onToggle}
          thumbColor="#FFFFFF"
          trackColor={{ false: '#D1D5DB', true: '#000000' }}
          value={isPrivate}
        />
      </View>
      <Text style={styles.privacyDescription}>
        {isPrivate
          ? `Only approved followers can view your visited places, past activities, and statistics. Follow requests require ${isEditing ? 'your ' : ''}approval.`
          : 'Anyone can view your visited places, past activities, and statistics. Follow requests are automatically accepted.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  onboardingHeader: { width: '100%', gap: 10, alignItems: 'center', justifyContent: 'center', padding: 10, backgroundColor: '#FFFFFF' },
  onboardingHeaderRow: { width: '100%', height: 28, alignItems: 'center', justifyContent: 'center' },
  backButton: { position: 'absolute', top: 4, left: 0, width: 24, height: 24 },
  backIcon: { width: 24, height: 24 },
  brand: { color: '#000000', fontFamily: Fonts.mono, fontSize: 20, fontWeight: '400', lineHeight: 24, textAlign: 'center' },
  description: { color: '#000000', fontSize: 10, fontWeight: '600', lineHeight: 12, textAlign: 'center' },
  editButton: { minHeight: 37, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#000000', backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 8 },
  editButtonLabel: { color: '#000000', fontSize: 12, fontWeight: '600', lineHeight: 15, textAlign: 'center' },
  pressed: { opacity: 0.55 },
  disabled: { opacity: 0.45 },
  editField: { gap: 10 },
  editLabel: { color: '#000000', fontSize: 12, fontWeight: '600', lineHeight: 15 },
  editInput: { height: 42, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#F3F4F6', color: '#000000', fontSize: 16, lineHeight: 20, paddingHorizontal: 10, paddingVertical: 0 },
  editBio: { height: 84, paddingTop: 10, paddingBottom: 10 },
  privacySection: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', padding: 12, gap: 8, marginTop: 4 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  privacyInfo: { flex: 1, paddingRight: 10, gap: 2 },
  privacyStatus: { color: '#374151', fontSize: 13, fontWeight: '600' },
  privacyDescription: { color: '#6B7280', fontSize: 11, lineHeight: 15 },
});
