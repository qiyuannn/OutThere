import { type PropsWithChildren } from 'react';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from './app-header';
import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Shadows, Typography } from '@/constants/theme';

type ScreenProps = PropsWithChildren<{
  title: string;
  eyebrow?: string;
  headerDescription?: string;
  showBack?: boolean;
  onBack?: () => void;
}>;

export function Screen({ children, title, eyebrow, headerDescription, showBack, onBack }: ScreenProps) {
  const theme = useTheme();
  const description = headerDescription ?? title;

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: theme.background }]}>
      <AppHeader description={description} showBack={showBack} onBack={onBack} />
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>{children}</View>;
}

export function Button({ label, onPress, disabled = false, variant = 'secondary' }: { label: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => { if (Platform.OS !== 'web') void Haptics.selectionAsync(); onPress(); }}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        pressed && !disabled && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <ThemedText style={[styles.buttonLabel, variant === 'primary' && styles.buttonPrimaryLabel]}>{label}</ThemedText>
    </Pressable>
  );
}

export function EmptyState({ title, description, children }: PropsWithChildren<{ title: string; description: string }>) {
  return (
    <Card>
      <ThemedText style={styles.emptyTitle}>{title}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.emptyDescription}>{description}</ThemedText>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 120,
    gap: 20,
    flexGrow: 1,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.large,
    padding: 18,
    gap: 14,
    ...Shadows.card,
  },
  button: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: Radius.medium,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: '#000000', borderColor: '#000000' },
  buttonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonLabel: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonPrimaryLabel: { color: '#FFFFFF' },
  emptyTitle: {
    ...Typography.sectionTitle,
    color: '#000000',
  },
  emptyDescription: {
    ...Typography.body,
  },
});
