import { type PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from './app-header';
import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';

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

export function Button({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <ThemedText style={styles.buttonLabel}>{label}</ThemedText>
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
    padding: 16,
    gap: 16,
    flexGrow: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  button: {
    minHeight: 36,
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.55,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonLabel: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  emptyDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
});
