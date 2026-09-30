import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { useProfileForm } from '../hooks/use-profile-form';
import { OnboardingHeader } from './profile-form-elements';
import { ProfileFormFields } from './profile-form-fields';
import { profileFormStyles as styles } from './profile-form-styles';

export function ProfileForm({
  onboarding = false,
  onDone,
  onCancel,
}: {
  onboarding?: boolean;
  onDone: () => void;
  onCancel: () => void | Promise<void>;
}) {
  const {
    draft,
    avatar,
    setAvatar,
    busy,
    error,
    conflict,
    update,
    pickAvatar,
    submit,
    cancel,
    reload,
  } = useProfileForm(onDone, onCancel);

  const formFields = (
    <ProfileFormFields
      avatar={avatar}
      busy={busy}
      conflict={conflict}
      draft={draft}
      error={error}
      isOnboarding={onboarding}
      onPickAvatar={() => void pickAvatar()}
      onReload={() => void reload()}
      onRemoveAvatar={() => {
        setAvatar(null);
        update('avatar_path', null);
      }}
      onSubmit={() => void submit()}
      onUpdate={update}
    />
  );

  if (!onboarding) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.editScreen}
      >
        <AppHeader description="Make this yours" onBack={() => void cancel()} showBack />
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.editContent}
          keyboardShouldPersistTaps="handled"
        >
          {formFields}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.onboardingScreen}
    >
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.onboardingSafeArea}>
        <StatusBar style="dark" />
        <OnboardingHeader disabled={busy} onBack={() => void cancel()} />
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.onboardingContent}
          keyboardShouldPersistTaps="handled"
        >
          {formFields}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
