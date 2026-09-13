import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
export function Field({ label, help, ...props }: TextInputProps & { label: string; help?: string }) {
  const theme = useTheme();
  return <View style={{ gap: 7 }}><ThemedText type="smallBold">{label}</ThemedText>
    <TextInput {...props} accessibilityLabel={label} placeholderTextColor={theme.textSecondary} style={{ color: theme.text, fontSize: 16, padding: 14, minHeight: props.multiline ? 92 : 50, textAlignVertical: props.multiline ? 'top' : 'center', borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background }} />
    {help && <ThemedText type="small" themeColor="textSecondary">{help}</ThemedText>}
  </View>;
}
export function Choice({ label, description, selected, onPress, disabled }: { label: string; description?: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled }} onPress={onPress} disabled={disabled}
    style={({ pressed }) => ({ padding: 14, minHeight: 48, gap: 4, borderRadius: 16, borderWidth: 1, borderColor: selected ? theme.primary : theme.border,
      backgroundColor: selected ? theme.accent : theme.backgroundElement, opacity: pressed ? 0.7 : 1, flexGrow: 1 })}>
    <ThemedText type="smallBold" style={{ color: selected ? theme.onAccent : theme.text }}>{selected ? '✓  ' : ''}{label}</ThemedText>
    {description && <ThemedText type="small" style={{ color: selected ? theme.onAccent : theme.textSecondary }}>{description}</ThemedText>}
  </Pressable>;
}
