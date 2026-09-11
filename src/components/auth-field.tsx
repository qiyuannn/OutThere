import { useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';

export function AuthField({ label, password = false, ...props }: TextInputProps & { label: string; password?: boolean }) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  return <View style={{ gap: 8 }}>
    <ThemedText type="smallBold">{label}</ThemedText>
    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.border, borderRadius: 14, backgroundColor: theme.background }}>
      <TextInput {...props} accessibilityLabel={label} autoCapitalize="none" autoCorrect={false} secureTextEntry={password && !visible}
        placeholderTextColor={theme.textSecondary} style={{ flex: 1, minWidth: 0, minHeight: 52, padding: 14, fontSize: 16, color: theme.text }} />
      {password && <Pressable accessibilityRole="button" accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} onPress={() => setVisible(!visible)} style={{ padding: 14, minHeight: 48 }}>
        <ThemedText type="smallBold" themeColor="primary">{visible ? 'Hide' : 'Show'}</ThemedText>
      </Pressable>}
    </View>
  </View>;
}
