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

export function Screen({ children, title, eyebrow = 'OUTTHERE', headerDescription, showBack, onBack }: ScreenProps) {
  const theme = useTheme();
  return <SafeAreaView edges={headerDescription ? ['left', 'right'] : ['top', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
    {headerDescription ? <AppHeader description={headerDescription} showBack={showBack} onBack={onBack} /> : null}
    <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content}>
      {!headerDescription ? <>
        <ThemedText type="smallBold" themeColor="primary" style={styles.eyebrow}>{eyebrow}</ThemedText>
        <ThemedText accessibilityRole="header" type="title" style={styles.title}>{title}</ThemedText>
      </> : null}
      {children}
    </ScrollView>
  </SafeAreaView>;
}

export function Card({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>{children}</View>;
}

export function Button({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, { backgroundColor: theme.primary, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }]}>
    <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>{label}</ThemedText>
  </Pressable>;
}

export function EmptyState({ title, description, children }: PropsWithChildren<{ title: string; description: string }>) {
  return <Card><ThemedText type="subtitle" style={{ fontSize: 24 }}>{title}</ThemedText>
    <ThemedText themeColor="textSecondary">{description}</ThemedText>{children}</Card>;
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 24, paddingTop: 36, paddingBottom: 48, gap: 20, flexGrow: 1 },
  eyebrow: { letterSpacing: 3 },
  title: { fontSize: 40, lineHeight: 46, fontWeight: '800', letterSpacing: -1.5, marginBottom: 12 },
  card: { borderWidth: 1, borderRadius: 24, padding: 24, gap: 14 },
  button: { minHeight: 48, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
});
