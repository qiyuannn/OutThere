import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/app-header';
import { Fonts } from '@/constants/theme';
import { useProfile } from '@/providers/profile-provider';
import { Avatar } from './avatar';
import { profileError, toDraft, validateProfile, type AvatarSelection, type ProfileDraft } from '../model';

const backIcon = require('../../../../assets/images/navigation/back.svg');

export function ProfileForm({ onboarding = false, onDone, onCancel }: { onboarding?: boolean; onDone: () => void; onCancel: () => void | Promise<void> }) {
  const { profile, save, reload } = useProfile();
  const [draft, setDraft] = useState(() => toDraft(profile));
  const [avatar, setAvatar] = useState<AvatarSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  function update<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) { setDraft(current => ({ ...current, [key]: value })); setError(''); }
  async function pickAvatar() {
    if (working.current) return;
    working.current = true; setBusy(true); setError('');
    try {
      // The system picker grants access to the chosen image; no broad library permission is requested.
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset || asset.width < 1 || asset.height < 1) throw new Error('Invalid image');
      const side = Math.min(asset.width, asset.height);
      const context = ImageManipulator.manipulate(asset.uri);
      context.crop({ originX: (asset.width - side) / 2, originY: (asset.height - side) / 2, width: side, height: side }).resize({ width: 512, height: 512 });
      const rendered = await context.renderAsync();
      const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
      if (!image.base64 || image.base64.length > 2796200) throw new Error('Image too large');
      setAvatar({ uri: image.uri, base64: image.base64 });
    } catch { setError('We couldn’t open that photo. Try another image, or continue without a photo.'); }
    finally { working.current = false; setBusy(false); }
  }
  async function submit() {
    if (working.current) return;
    const validation = validateProfile(draft);
    if (validation) { setError(validation); return; }
    working.current = true; setBusy(true); setError(''); setConflict(false);
    try {
      const saved = await save(draft, true, avatar);
      setDraft(toDraft(saved)); setAvatar(null);
      onDone();
    } catch (reason) {
      setError(profileError(reason));
      setConflict(reason instanceof Error && reason.message.startsWith('Your profile changed'));
    } finally { working.current = false; setBusy(false); }
  }
  async function cancel() {
    if (working.current) return;
    working.current = true; setBusy(true); setError('');
    try { await onCancel(); }
    catch { setError('We couldn’t sign you out. Check your connection and try again.'); }
    finally { working.current = false; setBusy(false); }
  }
  if (!onboarding) {
    return <KeyboardAvoidingView style={styles.editScreen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader description="Make this yours" showBack onBack={() => { void cancel(); }} />
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.editContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.avatarArea}>
          <Avatar name={draft.display_name} path={draft.avatar_path} preview={avatar?.uri} size={69} />
        </View>

        <View style={styles.photoActions}>
          <EditButton disabled={busy} label="Choose Photo" onPress={() => { void pickAvatar(); }} />
          <EditButton
            disabled={busy}
            label="Remove Photo"
            onPress={() => { setAvatar(null); update('avatar_path', null); }}
          />
        </View>

        <EditField
          autoComplete="name"
          editable={!busy}
          label="Name"
          maxLength={60}
          onChangeText={value => update('display_name', value)}
          value={draft.display_name}
        />
        <EditField
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          label="Username"
          maxLength={24}
          onChangeText={value => update('username', value.toLowerCase())}
          value={draft.username}
        />
        <EditField
          editable={!busy}
          label="Bio"
          maxLength={240}
          multiline
          onChangeText={value => update('bio', value)}
          value={draft.bio}
        />

        <View style={styles.editSpacer} />
        {!!error && <Text accessibilityRole="alert" style={styles.editError}>{error}</Text>}
        {conflict && <EditButton disabled={busy} label="Reload latest profile" onPress={() => { void reload(); }} />}
        <EditButton disabled={busy || conflict} label={busy ? 'Saving…' : 'Save Changes'} onPress={() => { void submit(); }} />
      </ScrollView>
    </KeyboardAvoidingView>;
  }
  if (onboarding) {
    return <KeyboardAvoidingView style={styles.onboardingScreen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.onboardingSafeArea}>
        <StatusBar style="dark" />
        <OnboardingHeader disabled={busy} onBack={() => { void cancel(); }} />
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.onboardingContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.avatarArea}>
            <Avatar name={draft.display_name} path={draft.avatar_path} preview={avatar?.uri} size={69} />
          </View>

          <View style={styles.photoActions}>
            <EditButton disabled={busy} label="Choose Photo" onPress={() => { void pickAvatar(); }} />
            <EditButton
              disabled={busy}
              label="Remove Photo"
              onPress={() => { setAvatar(null); update('avatar_path', null); }}
            />
          </View>

          <EditField
            autoComplete="name"
            editable={!busy}
            label="Name"
            maxLength={60}
            onChangeText={value => update('display_name', value)}
            value={draft.display_name}
          />
          <EditField
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            label="Username"
            maxLength={24}
            onChangeText={value => update('username', value.toLowerCase())}
            value={draft.username}
          />
          <EditField
            editable={!busy}
            label="Bio"
            maxLength={240}
            multiline
            onChangeText={value => update('bio', value)}
            value={draft.bio}
          />

          <View style={styles.onboardingSpacer} />
          {!!error && <Text accessibilityRole="alert" style={styles.editError}>{error}</Text>}
          {conflict && <EditButton disabled={busy} label="Reload latest profile" onPress={() => { void reload(); }} />}
          <EditButton disabled={busy || conflict} label={busy ? 'Saving…' : 'Next'} onPress={() => { void submit(); }} />
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>;
  }
  return null;
}

function OnboardingHeader({ disabled, onBack }: { disabled: boolean; onBack: () => void }) {
  return <View style={styles.onboardingHeader}>
    <View style={styles.onboardingHeaderRow}>
      <Pressable
        accessibilityLabel="Go back"
        accessibilityRole="button"
        disabled={disabled}
        hitSlop={10}
        onPress={onBack}
        style={({ pressed }) => [styles.onboardingBackButton, disabled && styles.disabled, pressed && styles.pressed]}
      >
        <Image contentFit="contain" source={backIcon} style={styles.onboardingBackIcon} />
      </Pressable>
      <Text accessibilityRole="header" style={styles.onboardingBrand}>OutThere</Text>
    </View>
    <Text style={styles.onboardingDescription}>Getting Started</Text>
  </View>;
}

function EditButton({ disabled, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) {
  return <Pressable
    accessibilityRole="button"
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.editButton, disabled && styles.disabled, pressed && styles.pressed]}
  >
    <Text style={styles.editButtonLabel}>{label}</Text>
  </Pressable>;
}

type EditFieldProps = {
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

function EditField({ label, multiline = false, ...inputProps }: EditFieldProps) {
  return <View style={styles.editField}>
    <Text style={styles.editLabel}>{label}</Text>
    <TextInput
      accessibilityLabel={label}
      multiline={multiline}
      selectionColor="#000000"
      style={[styles.editInput, multiline && styles.editBio]}
      textAlignVertical={multiline ? 'top' : 'center'}
      {...inputProps}
    />
  </View>;
}

const styles = StyleSheet.create({
  onboardingScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  onboardingSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  onboardingHeader: {
    width: '100%',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  onboardingHeaderRow: {
    width: '100%',
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingBackButton: {
    position: 'absolute',
    top: 4,
    left: 0,
    width: 24,
    height: 24,
  },
  onboardingBackIcon: {
    width: 24,
    height: 24,
  },
  onboardingBrand: {
    color: '#000000',
    fontFamily: Fonts.mono,
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 24,
    textAlign: 'center',
  },
  onboardingDescription: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 12,
    textAlign: 'center',
  },
  onboardingContent: {
    width: '100%',
    maxWidth: 402,
    flexGrow: 1,
    alignSelf: 'center',
    gap: 10,
    padding: 10,
  },
  onboardingSpacer: {
    minHeight: 24,
    flexGrow: 1,
  },
  editScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  editContent: {
    width: '100%',
    maxWidth: 720,
    flexGrow: 1,
    alignSelf: 'center',
    gap: 10,
    padding: 10,
  },
  avatarArea: {
    minHeight: 89,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 10,
  },
  editButton: {
    minHeight: 37,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editButtonLabel: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 15,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.55,
  },
  disabled: {
    opacity: 0.45,
  },
  editField: {
    gap: 10,
  },
  editLabel: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 15,
  },
  editInput: {
    height: 42,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F3F4F6',
    color: '#000000',
    fontSize: 16,
    lineHeight: 20,
    paddingHorizontal: 10,
    paddingVertical: 0,
  },
  editBio: {
    height: 84,
    paddingTop: 10,
    paddingBottom: 10,
  },
  editSpacer: {
    minHeight: 24,
    flexGrow: 1,
  },
  editError: {
    color: '#B42318',
    fontSize: 12,
    lineHeight: 17,
  },
});
