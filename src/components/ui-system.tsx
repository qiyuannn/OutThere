import { useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Radius, Shadows, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

const nativeGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable();

export function GlassSurface({ children, interactive = false, style }: PropsWithChildren<{
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
}>) {
  const theme = useTheme();
  const [reduceTransparency, setReduceTransparency] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => subscription.remove();
  }, []);
  if (nativeGlass && !reduceTransparency) {
    return (
      <GlassView
        colorScheme="light"
        glassEffectStyle="regular"
        isInteractive={interactive}
        style={[styles.glass, style]}
        tintColor="rgba(255,255,255,0.48)"
      >
        {children}
      </GlassView>
    );
  }
  return (
    <View
      style={[
        styles.fallbackGlass,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function PressableScale({ children, haptic = false, style, ...props }: PressableProps & {
  children: ReactNode;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useRef(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { reduceMotion.current = value; });
  }, []);
  const animate = (toValue: number) => {
    if (reduceMotion.current) return;
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 36, bounciness: 3 }).start();
  };
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        {...props}
        onPress={(event) => {
          if (haptic && Platform.OS !== 'web') {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          props.onPress?.(event);
        }}
        onPressIn={(event) => {
          animate(0.96);
          props.onPressIn?.(event);
        }}
        onPressOut={(event) => {
          animate(1);
          props.onPressOut?.(event);
        }}
        style={styles.fill}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function SectionHeading({ action, eyebrow, title }: { action?: ReactNode; eyebrow?: string; title: string }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionCopy}>
        {eyebrow ? <ThemedText themeColor="textSecondary" style={styles.eyebrow}>{eyebrow}</ThemedText> : null}
        <ThemedText accessibilityRole="header" style={styles.sectionTitle}>{title}</ThemedText>
      </View>
      {action}
    </View>
  );
}

export function SkeletonBlock({ height = 18, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.75, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);
  return (
    <Animated.View
      accessibilityElementsHidden
      style={[
        styles.skeleton,
        {
          height,
          backgroundColor: theme.border,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

export function StatusBanner({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: 'neutral' | 'error' }>) {
  const theme = useTheme();
  return (
    <View style={[styles.banner, { backgroundColor: tone === 'error' ? '#FFF4F2' : theme.backgroundSelected }]}>
      <ThemedText accessibilityRole={tone === 'error' ? 'alert' : undefined} style={styles.bannerText}>{children}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glass: { overflow: 'hidden' },
  fallbackGlass: {
    overflow: 'hidden',
    borderWidth: 1,
    ...Shadows.floating,
  },
  sectionHeading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionCopy: { flex: 1, gap: 2 },
  eyebrow: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  sectionTitle: Typography.sectionTitle,
  skeleton: { borderRadius: Radius.small },
  banner: { minHeight: 44, borderRadius: Radius.medium, paddingHorizontal: 16, paddingVertical: 11, justifyContent: 'center' },
  bannerText: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
