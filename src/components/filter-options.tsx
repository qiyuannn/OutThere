import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export type FilterOption<Value extends string> = {
  label: string;
  value: Value;
  accessibilityLabel?: string;
};

type FilterOptionsProps<Value extends string> = {
  options: readonly FilterOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  style?: ViewStyle;
};

export function FilterOptions<Value extends string>({
  options,
  value,
  onChange,
  style,
}: FilterOptionsProps<Value>) {
  const theme = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.container, { backgroundColor: theme.backgroundSelected }, style]}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityLabel={option.accessibilityLabel}
          accessibilityRole="tab"
          accessibilityState={{ selected: option.value === value }}
          hitSlop={6}
          onPress={() => { if (Platform.OS !== 'web') void Haptics.selectionAsync(); onChange(option.value); }}
          style={({ pressed }) => [styles.option, option.value === value && styles.selectedOption, pressed && styles.pressed]}
        >
          <ThemedText style={[styles.label, option.value === value && styles.selectedLabel]}>{option.label}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 24,
    overflow: 'hidden',
  },
  option: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  selectedOption: { backgroundColor: '#000000', borderRadius: 20 },
  label: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    letterSpacing: 0.25,
    textAlign: 'center',
  },
  selectedLabel: { color: '#FFFFFF' },
});
