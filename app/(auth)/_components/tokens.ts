import { Platform, TextStyle } from 'react-native';

export type AuthColors = {
  bg: string;
  bgElevated: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentPressed: string;
  accentSoft: string;
  error: string;
  success: string;
  onAccent: string;
  scrim: string;
};

export const getAuthColors = (isDark: boolean): AuthColors => ({
  bg: isDark ? '#0A0A0A' : '#FFFFFF',
  bgElevated: isDark ? '#141414' : '#FAFAFA',
  border: isDark ? '#232323' : '#E5E5E5',
  borderStrong: isDark ? '#353535' : '#CFCFCF',
  textPrimary: isDark ? '#F5F5F5' : '#0A0A0A',
  textSecondary: isDark ? '#A1A1A1' : '#525252',
  textTertiary: isDark ? '#6B6B6B' : '#8A8A8A',
  accent: '#D55004',
  accentPressed: isDark ? '#E45F12' : '#B84403',
  accentSoft: isDark ? 'rgba(213,80,4,0.14)' : 'rgba(213,80,4,0.08)',
  error: isDark ? '#EF4444' : '#DC2626',
  success: isDark ? '#22C55E' : '#15803D',
  onAccent: '#FFFFFF',
  scrim: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.35)',
});

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 56,
  '5xl': 80,
} as const;

export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

const monoFamily = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export const typography = {
  display: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: -1.2,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  button: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0,
  },
  caption: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: 0,
  },
  mono: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    letterSpacing: 0.4,
    fontFamily: monoFamily,
  },
  brand: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: 3,
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

export const motion = {
  short: 180,
  base: 280,
  med: 500,
  long: 800,
  hero: 18000,
  crossfade: 600,
  heroDwell: 8000,
} as const;
