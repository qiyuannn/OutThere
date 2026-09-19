import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';

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
  return (
    <View accessibilityRole="tablist" style={[styles.container, style]}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityLabel={option.accessibilityLabel}
          accessibilityRole="tab"
          accessibilityState={{ selected: option.value === value }}
          hitSlop={6}
          onPress={() => onChange(option.value)}
          style={({ pressed }) => [styles.option, pressed && styles.pressed]}
        >
          <ThemedText style={styles.label}>{option.label}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    overflow: 'hidden',
  },
  option: {
    flex: 1,
    minWidth: 0,
    minHeight: 35,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.5,
  },
  label: {
    color: '#000000',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 24,
    letterSpacing: 0.25,
    textAlign: 'center',
  },
});
