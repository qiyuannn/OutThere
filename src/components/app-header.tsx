import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { GlassSurface } from './ui-system';

const backIcon = require('../../assets/images/navigation/back.svg');
const bellIcon = require('../../assets/images/navigation/bell.svg');
const plusIcon = require('../../assets/images/navigation/plus.svg');

type AppHeaderProps = {
  brandLeading?: boolean;
  description: string;
  onBack?: () => void;
  onFindPeople?: () => void;
  onNotifications?: () => void;
  notificationsCount?: number;
  showBack?: boolean;
  onMore?: () => void;
  rightAction?: React.ReactNode;
};

export function AppHeader({
  brandLeading = false,
  description,
  onBack,
  onFindPeople,
  onNotifications,
  notificationsCount,
  showBack = false,
  onMore,
  rightAction,
}: AppHeaderProps) {
  const theme = useTheme();
  const handleBack = onBack ?? (() => {
    if (router.canGoBack()) router.back();
  });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeArea, { backgroundColor: theme.backgroundElement }]}>
      <GlassSurface style={[styles.container, { borderBottomColor: theme.border }]}>
        <View style={styles.row}>
          <View style={[styles.actionSlot, brandLeading && styles.hiddenSlot, onFindPeople && styles.expandedSlot]}>
            {showBack ? (
              <Pressable
                accessibilityLabel="Go back"
                accessibilityRole="button"
                hitSlop={10}
                onPress={handleBack}
                style={({ pressed }) => [styles.action, { backgroundColor: theme.backgroundSelected }, pressed && styles.pressed]}
              >
                <Image source={backIcon} style={[styles.icon, { tintColor: theme.text }]} contentFit="contain" />
              </Pressable>
            ) : null}
          </View>

          <Text accessibilityRole="header" style={[styles.brand, { color: theme.text }, brandLeading && styles.leadingBrand]}>
            OutThere
          </Text>

          <View style={[styles.actionSlot, styles.trailingSlot, onFindPeople && styles.expandedSlot]}>
            {onFindPeople ? (
              <Pressable
                accessibilityLabel="Find people"
                accessibilityRole="button"
                hitSlop={10}
                onPress={onFindPeople}
                style={({ pressed }) => [styles.action, { backgroundColor: theme.backgroundSelected }, pressed && styles.pressed]}
              >
                <Image source={plusIcon} style={[styles.icon, { tintColor: theme.text }]} contentFit="contain" />
              </Pressable>
            ) : null}
            {onNotifications ? (
              <Pressable
                accessibilityLabel={
                  notificationsCount && notificationsCount > 0
                    ? `Notifications, ${notificationsCount} unread`
                    : 'Notifications'
                }
                accessibilityRole="button"
                hitSlop={10}
                onPress={onNotifications}
                style={({ pressed }) => [styles.action, { backgroundColor: theme.backgroundSelected }, pressed && styles.pressed]}
              >
                <Image source={bellIcon} style={[styles.icon, { tintColor: theme.text }]} contentFit="contain" />
                {notificationsCount && notificationsCount > 0 ? (
                  <View style={[styles.badge, { backgroundColor: theme.like ?? '#EF4444', borderColor: theme.backgroundElement }]}>
                    <Text style={styles.badgeText}>
                      {notificationsCount > 99 ? '99+' : String(notificationsCount)}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
            {onMore ? (
              <Pressable
                accessibilityLabel="More options"
                accessibilityRole="button"
                hitSlop={10}
                onPress={onMore}
                style={({ pressed }) => [styles.action, { backgroundColor: theme.backgroundSelected }, pressed && styles.pressed]}
              >
                <View style={styles.dotsRow}>
                  <View style={[styles.dot, { backgroundColor: theme.text }]} />
                  <View style={[styles.dot, { backgroundColor: theme.text }]} />
                  <View style={[styles.dot, { backgroundColor: theme.text }]} />
                </View>
              </Pressable>
            ) : null}
            {rightAction}
          </View>
        </View>

        <Text numberOfLines={1} style={[styles.description, { color: theme.textSecondary }]}>
          {description}
        </Text>
      </GlassSurface>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    zIndex: 20,
  },
  container: {
    gap: 4,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionSlot: {
    width: 44,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  trailingSlot: {
    justifyContent: 'flex-end',
  },
  expandedSlot: {
    width: 84,
  },
  hiddenSlot: {
    display: 'none',
  },
  action: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    zIndex: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.94 }],
  },
  icon: {
    width: 20,
    height: 20,
  },
  brand: {
    fontFamily: Fonts.mono,
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 24,
    textAlign: 'center',
  },
  leadingBrand: {
    textAlign: 'left',
  },
  description: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3.5,
  },
  dot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
  },
});
