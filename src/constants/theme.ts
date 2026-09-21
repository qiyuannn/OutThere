/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#FFFFFF',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#F3F4F6',
    textSecondary: '#6B7280',
    primary: '#000000',
    onPrimary: '#FFFFFF',
    accent: '#000000',
    onAccent: '#FFFFFF',
    border: '#E5E7EB',
  },
  dark: {
    text: '#ffffff',
    background: '#111B17',
    backgroundElement: '#1D2A23',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    primary: '#A9BCFF',
    onPrimary: '#142350',
    accent: '#DAF58B',
    onAccent: '#24331B',
    border: '#35433A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 12,
  medium: 18,
  large: 24,
  card: 28,
  pill: 999,
} as const;

export const Typography = {
  pageTitle: { fontSize: 30, lineHeight: 36, fontWeight: '700' as const, letterSpacing: -0.7 },
  sectionTitle: { fontSize: 20, lineHeight: 25, fontWeight: '700' as const, letterSpacing: -0.25 },
  cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
} as const;

export const Motion = {
  quick: 160,
  standard: 240,
  sheet: 320,
} as const;

export const Shadows = {
  floating: {
    shadowColor: '#101820',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 10,
  },
  card: {
    shadowColor: '#101820',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
