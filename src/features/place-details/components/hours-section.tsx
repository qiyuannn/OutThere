import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { PlaceDetails } from '../types';

interface HoursSectionProps {
  place: PlaceDetails;
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function HoursSection({ place }: HoursSectionProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const hours = place.regularOpeningHours;
  if (!hours || hours.length === 0) return null;

  const currentDayName = dayNames[new Date().getDay()];

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setExpanded((prev) => !prev)}
        style={styles.headerPressable}
      >
        <View style={styles.titleRow}>
          <ThemedText style={styles.sectionIcon}>🕒</ThemedText>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.eyebrow}>
            OPENING HOURS
          </ThemedText>
        </View>
        <ThemedText type="smallBold" themeColor="primary">
          {expanded ? 'Hide schedule' : 'See all days'} {expanded ? '▴' : '▾'}
        </ThemedText>
      </Pressable>

      {/* If collapsed, show today's hours */}
      {!expanded ? (
        <View style={styles.todayRow}>
          <ThemedText type="smallBold">
            {place.openNow !== null && place.openNow !== undefined ? (place.openNow ? 'Open today' : 'Closed now') : 'Hours today'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {hours.find((h) => h.startsWith(currentDayName)) ?? hours[0]}
          </ThemedText>
        </View>
      ) : (
        /* Expanded: Full 7 days */
        <View style={styles.scheduleList}>
          {hours.map((line, idx) => {
            const isToday = line.startsWith(currentDayName);
            const [day, ...rest] = line.split(': ');
            const time = rest.join(': ');

            return (
              <View
                key={idx}
                style={[
                  styles.dayRow,
                  isToday && [styles.todayHighlight, { backgroundColor: theme.backgroundSelected }],
                ]}
              >
                <ThemedText
                  type={isToday ? 'smallBold' : 'small'}
                  themeColor={isToday ? 'primary' : undefined}
                  style={styles.dayName}
                >
                  {day} {isToday ? '· Today' : ''}
                </ThemedText>
                <ThemedText
                  type={isToday ? 'smallBold' : 'small'}
                  themeColor={isToday ? 'text' : 'textSecondary'}
                  style={styles.dayTime}
                >
                  {time || line}
                </ThemedText>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  headerPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIcon: {
    fontSize: 14,
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.2,
  },
  todayRow: {
    gap: 4,
    paddingTop: 2,
  },
  scheduleList: {
    gap: 8,
    paddingTop: 4,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  todayHighlight: {
    borderRadius: 10,
  },
  dayName: {
    flex: 1,
  },
  dayTime: {
    textAlign: 'right',
  },
});
