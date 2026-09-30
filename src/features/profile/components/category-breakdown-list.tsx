import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import type { CategoryGroup } from '@/features/profile/types';
import { useTheme } from '@/hooks/use-theme';

interface CategoryBreakdownListProps {
  groups: readonly CategoryGroup[];
  weights: Record<string, number>;
}

export function CategoryBreakdownList({ groups, weights }: CategoryBreakdownListProps) {
  const theme = useTheme();

  return (
    <View style={styles.categoryList}>
      <ThemedText style={{ marginTop: 8 }} themeColor="textSecondary" type="smallBold">
        CATEGORY BREAKDOWN
      </ThemedText>

      {groups.map((group) => {
        const isRated = group.key in weights && weights[group.key] > 0;
        const currentWeight = weights[group.key] ?? 0.00;
        const scoreTen = (currentWeight * 10).toFixed(1);
        const percent = Math.round(currentWeight * 100);

        return (
          <View
            key={group.key}
            style={[
              styles.categoryItem,
              {
                backgroundColor: theme.background,
                borderColor: isRated ? theme.primary : theme.border,
                borderWidth: 1,
              },
            ]}
          >
            <View style={styles.titleRow}>
              <View style={styles.iconCircle}>
                <ThemedText style={styles.icon}>{group.icon}</ThemedText>
              </View>
              <View style={styles.titleArea}>
                <View style={styles.labelRow}>
                  <ThemedText style={{ fontSize: 15, flex: 1 }} type="smallBold">
                    {group.label}
                  </ThemedText>
                  <ThemedText
                    themeColor={isRated ? 'primary' : 'textSecondary'}
                    type="smallBold"
                  >
                    {isRated ? `${scoreTen} / 10` : 'Unrated'}
                  </ThemedText>
                </View>
                <ThemedText style={styles.groupMeta} themeColor="textSecondary">
                  {group.description}
                </ThemedText>
              </View>
            </View>

            <View style={[styles.barBackground, { backgroundColor: theme.backgroundSelected }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${percent}%`,
                    backgroundColor: isRated ? theme.primary : 'transparent',
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  categoryList: { gap: 10, marginTop: 8 },
  categoryItem: { borderRadius: 16, padding: 12, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 20 },
  titleArea: { flex: 1, minWidth: 0 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupMeta: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  barBackground: { height: 6, borderRadius: 3, width: '100%', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
});
