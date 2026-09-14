import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PropsWithChildren } from 'react';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function Chip({ label, selected, onPress, disabled }: { label: string; selected?: boolean; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected, disabled: !!disabled }}
    onPress={onPress} disabled={disabled} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, paddingVertical: 12,
      borderRadius: 24, borderWidth: 1, borderColor: selected ? theme.primary : theme.border,
      backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 })}>
    <ThemedText type="smallBold" themeColor={selected ? 'primary' : undefined}>{label}</ThemedText>
  </Pressable>;
}
export function SearchInput(props: TextInputProps) {
  const theme = useTheme();
  return <TextInput placeholderTextColor={theme.textSecondary} maxLength={160} autoCorrect={false} {...props}
    style={[{ color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border,
      borderWidth: 1, borderRadius: 16, padding: 16, fontSize: 16, minHeight: 52 }, props.style]} />;
}
export function SearchSheet({ title, onClose, children }: PropsWithChildren<{ title: string; onClose: () => void }>) {
  const theme = useTheme();
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[searchStyles.row, { padding: 20, justifyContent: 'space-between' }]}>
        <ThemedText type="subtitle" accessibilityRole="header">{title}</ThemedText>
        <Chip label="Close" onPress={onClose} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }}>{children}</ScrollView>
    </SafeAreaView>
  </Modal>;
}
export const searchStyles = StyleSheet.create({ row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' } });
