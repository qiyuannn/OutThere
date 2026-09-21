import { Image } from 'expo-image';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Shadows } from '@/constants/theme';

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
        {activeFilterCount > 0 ? <View style={styles.filterBadge}><ThemedText style={styles.filterBadgeLabel}>{activeFilterCount}</ThemedText></View> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  field: { flex: 1, minWidth: 0, height: 56, paddingHorizontal: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.10)', borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.94)', flexDirection: 'row', alignItems: 'center', gap: 11, ...Shadows.card },
  searchIcon: { width: 22, height: 22, flexShrink: 0 },
  input: { flex: 1, minWidth: 0, height: '100%', padding: 0, color: '#14221D', fontSize: 15, fontWeight: '400', lineHeight: 21 },
  filterButton: { width: 52, height: 52, flexShrink: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.10)', borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center', ...Shadows.card },
  filterIcon: { width: 22, height: 22 },
  filterBadge: { position: 'absolute', right: -1, top: -1, minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' },
  filterBadgeLabel: { color: '#FFFFFF', fontSize: 10, lineHeight: 12, fontWeight: '800' },
  pressed: { opacity: 0.55 },
});
