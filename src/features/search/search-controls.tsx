import { Image } from 'expo-image';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/themed-text';
import { Shadows } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const searchIcon = require('../../../assets/images/search/field-search.svg');
const filterIcon = require('../../../assets/images/search/filter-menu.svg');

type SearchControlsProps = Pick<TextInputProps,
  'value' | 'onChangeText' | 'onFocus' | 'onSubmitEditing' | 'returnKeyType'> & {
  onOpenFilters: () => void;
  activeFilterCount?: number;
};

export function SearchControls({ onOpenFilters, activeFilterCount = 0, ...inputProps }: SearchControlsProps) {
  const theme = useTheme();

  return (
    <View style={styles.controls}>
      <View style={[styles.field, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Image source={searchIcon} contentFit="contain" style={[styles.searchIcon, { tintColor: theme.textSecondary }]} />
        <TextInput
          accessibilityLabel="Search places, dishes or cuisines"
          autoCorrect={false}
          maxLength={160}
          placeholder="Search places, dishes or cuisines"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }]}
          {...inputProps}
        />
      </View>

      <Pressable
        accessibilityLabel={activeFilterCount ? `Search filters, ${activeFilterCount} active` : 'Search filters'}
        accessibilityRole="button"
        hitSlop={4}
        onPress={() => {
          if (Platform.OS !== 'web') void Haptics.selectionAsync();
          onOpenFilters();
        }}
        style={({ pressed }) => [
          styles.filterButton,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          pressed && styles.pressed,
        ]}
      >
        <Image source={filterIcon} contentFit="contain" style={[styles.filterIcon, { tintColor: theme.text }]} />
        {activeFilterCount > 0 ? (
          <View style={[styles.filterBadge, { backgroundColor: theme.primary }]}>
            <ThemedText style={[styles.filterBadgeLabel, { color: theme.onPrimary }]}>{activeFilterCount}</ThemedText>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  field: {
    flex: 1,
    minWidth: 0,
    height: 56,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    ...Shadows.card,
  },
  searchIcon: { width: 22, height: 22, flexShrink: 0 },
  input: { flex: 1, minWidth: 0, height: '100%', padding: 0, fontSize: 15, fontWeight: '500', lineHeight: 21 },
  filterButton: {
    width: 52,
    height: 52,
    flexShrink: 0,
    borderWidth: 1,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  filterIcon: { width: 22, height: 22 },
  filterBadge: {
    position: 'absolute',
    right: -1,
    top: -1,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeLabel: { fontSize: 10, lineHeight: 12, fontWeight: '800' },
  pressed: { opacity: 0.6, transform: [{ scale: 0.94 }] },
});
