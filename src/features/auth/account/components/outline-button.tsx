import { Pressable, StyleSheet, Text } from 'react-native';

export type OutlineButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
};

export function OutlineButton({ disabled = false, label, onPress }: OutlineButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.outlineButton,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outlineButton: {
    width: '100%',
    height: 36,
    borderColor: '#000000',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  buttonLabel: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.55,
  },
  disabled: {
    opacity: 0.45,
  },
});
