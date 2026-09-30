import { StyleSheet, Text, TextInput, View } from 'react-native';

export type AuthInputProps = {
  autoComplete: 'email' | 'current-password' | 'new-password';
  editable: boolean;
  keyboardType?: 'email-address';
  label: string;
  onChangeText: (value: string) => void;
  password?: boolean;
  textContentType: 'emailAddress' | 'password' | 'newPassword';
  value: string;
};

export function AuthInput({ label, password = false, ...props }: AuthInputProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={password}
        selectionColor="#000000"
        style={styles.field}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    gap: 10,
  },
  fieldLabel: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
  },
  field: {
    width: '100%',
    height: 42,
    borderColor: '#D1D5DB',
    borderWidth: 1,
    backgroundColor: '#F3F4F6',
    color: '#000000',
    fontSize: 16,
    paddingHorizontal: 10,
    paddingVertical: 0,
  },
});
