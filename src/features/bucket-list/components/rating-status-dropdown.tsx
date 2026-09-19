import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

const caretDown = require('../../../../assets/images/navigation/caret-down.svg');

export type RatingStatus = 'all' | 'rated' | 'unrated';

type RatingStatusDropdownProps = {
  value: RatingStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: RatingStatus) => void;
};

const options: readonly RatingStatus[] = ['all', 'rated', 'unrated'];

function labelFor(value: RatingStatus) {
  if (value === 'all') return 'All';
  return value === 'rated' ? 'Rated' : 'Unrated';
}

export function RatingStatusDropdown({ value, open, onOpenChange, onChange }: RatingStatusDropdownProps) {
  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityLabel={`Show ${value} saved places`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => onOpenChange(!open)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Image source={caretDown} contentFit="contain" style={[styles.caret, open && styles.caretOpen]} />
        <ThemedText style={styles.triggerLabel}>{labelFor(value)}</ThemedText>
      </Pressable>

      {open ? (
        <View accessibilityRole="menu" style={styles.menu}>
          {options.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: value === option }}
              onPress={() => {
                onChange(option);
                onOpenChange(false);
              }}
              style={({ pressed }) => [styles.menuItem, value === option && styles.menuItemSelected, pressed && styles.pressed]}
            >
              <ThemedText style={styles.menuLabel}>{labelFor(option)}</ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', zIndex: 10 },
  trigger: { minHeight: 40, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 4, overflow: 'hidden' },
  pressed: { opacity: 0.55 },
  caret: { width: 16, height: 16 },
  caretOpen: { transform: [{ rotate: '180deg' }] },
  triggerLabel: { color: '#000000', fontSize: 16, fontWeight: '600', lineHeight: 20 },
  menu: { position: 'absolute', top: 40, left: 10, width: 128, padding: 4, borderWidth: 1, borderColor: '#DFE5D9', borderRadius: 12, backgroundColor: '#FFFFFF', shadowColor: '#14221D', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 },
  menuItem: { minHeight: 38, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 8 },
  menuItemSelected: { backgroundColor: '#E7EDDE' },
  menuLabel: { color: '#000000', fontSize: 14, fontWeight: '600', lineHeight: 18 },
});
