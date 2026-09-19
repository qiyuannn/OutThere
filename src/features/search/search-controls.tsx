import { Image } from 'expo-image';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

const searchIcon = require('../../../assets/images/search/field-search.svg');
const filterIcon = require('../../../assets/images/search/filter-menu.svg');

type SearchControlsProps = Pick<TextInputProps,
  'value' | 'onChangeText' | 'onFocus' | 'onSubmitEditing' | 'returnKeyType'> & {
  onOpenFilters: () => void;
  activeFilterCount?: number;
};

export function SearchControls({ onOpenFilters, activeFilterCount = 0, ...inputProps }: SearchControlsProps) {
  return (
    <View style={styles.controls}>
      <View style={styles.field}>
        <Image source={searchIcon} contentFit="contain" style={styles.searchIcon} />
        <TextInput
          accessibilityLabel="Search places, dishes or cuisines"
          autoCorrect={false}
          maxLength={160}
          placeholder="Search places, dishes or cuisines"
          placeholderTextColor="#637068"
          style={styles.input}
          {...inputProps}
        />
      </View>

      <Pressable
        accessibilityLabel={activeFilterCount ? `Search filters, ${activeFilterCount} active` : 'Search filters'}
        accessibilityRole="button"
        hitSlop={4}
        onPress={onOpenFilters}
        style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
      >
        <Image source={filterIcon} contentFit="contain" style={styles.filterIcon} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { width: '100%', padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
  field: { flex: 1, minWidth: 0, height: 58, paddingHorizontal: 16, borderWidth: 1, borderColor: '#DFE5D9', borderRadius: 18, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 11 },
  searchIcon: { width: 22, height: 22, flexShrink: 0 },
  input: { flex: 1, minWidth: 0, height: '100%', padding: 0, color: '#14221D', fontSize: 15, fontWeight: '400', lineHeight: 21 },
  filterButton: { width: 50, height: 50, flexShrink: 0, borderWidth: 1, borderColor: '#DFE5D9', borderRadius: 25, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#14221D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 5, elevation: 4 },
  filterIcon: { width: 22, height: 22 },
  pressed: { opacity: 0.55 },
});
