import { View, Text } from 'react-native';

import { ImageLimits, InputLimits } from '@/constants/limits';
import { Avatar } from './avatar';
import { EditButton, EditField, PrivacySection } from './profile-form-elements';
import { profileFormStyles as styles } from './profile-form-styles';
import type { AvatarSelection, ProfileDraft } from '../model';

interface ProfileFormFieldsProps {
  draft: ProfileDraft;
  avatar: AvatarSelection | null;
  busy: boolean;
  conflict: boolean;
  error: string;
  isOnboarding: boolean;
  onUpdate: <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => void;
  onPickAvatar: () => void;
  onRemoveAvatar: () => void;
  onReload: () => void;
  onSubmit: () => void;
}

export function ProfileFormFields({
  draft,
  avatar,
  busy,
  conflict,
  error,
  isOnboarding,
  onUpdate,
  onPickAvatar,
  onRemoveAvatar,
  onReload,
  onSubmit,
}: ProfileFormFieldsProps) {
  const submitLabel = busy ? 'Saving…' : isOnboarding ? 'Next' : 'Save Changes';

  return (
    <>
      <View style={styles.avatarArea}>
        <Avatar
          name={draft.display_name}
          path={draft.avatar_path}
          preview={avatar?.uri}
          size={isOnboarding ? 69 : ImageLimits.formAvatarUiSize}
        />
      </View>

      <View style={styles.photoActions}>
        <EditButton disabled={busy} label="Choose Photo" onPress={onPickAvatar} />
        <EditButton disabled={busy} label="Remove Photo" onPress={onRemoveAvatar} />
      </View>

      <EditField
        autoComplete="name"
        editable={!busy}
        label="Name"
        maxLength={InputLimits.maxDisplayNameLength}
        onChangeText={(value) => onUpdate('display_name', value)}
        value={draft.display_name}
      />
      <EditField
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
        label="Username"
        maxLength={InputLimits.maxUsernameLength}
        onChangeText={(value) => onUpdate('username', value.toLowerCase())}
        value={draft.username}
      />
      <EditField
        editable={!busy}
        label="Bio"
        maxLength={InputLimits.maxBioLength}
        multiline
        onChangeText={(value) => onUpdate('bio', value)}
        value={draft.bio}
      />

      <PrivacySection
        busy={busy}
        isEditing={!isOnboarding}
        isPrivate={draft.is_private}
        onToggle={(value) => onUpdate('is_private', value)}
      />

      <View style={isOnboarding ? styles.onboardingSpacer : styles.editSpacer} />
      {!!error && <Text accessibilityRole="alert" style={styles.editError}>{error}</Text>}
      {conflict && <EditButton disabled={busy} label="Reload latest profile" onPress={onReload} />}
      <EditButton disabled={busy || conflict} label={submitLabel} onPress={onSubmit} />
    </>
  );
}
