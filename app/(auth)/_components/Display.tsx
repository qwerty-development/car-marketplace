import React from 'react';
import { Text, TextProps, TextStyle, StyleSheet } from 'react-native';
import { useTheme } from '@/utils/ThemeContext';
import { getAuthColors, typography, TypographyVariant } from './tokens';

type Tone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'error' | 'success' | 'onAccent';

type TypographyProps = TextProps & {
  variant?: TypographyVariant;
  tone?: Tone;
  align?: 'left' | 'center' | 'right';
  style?: TextStyle | TextStyle[];
};

const toneToColor = (tone: Tone, isDark: boolean) => {
  const c = getAuthColors(isDark);
  switch (tone) {
    case 'primary':
      return c.textPrimary;
    case 'secondary':
      return c.textSecondary;
    case 'tertiary':
      return c.textTertiary;
    case 'accent':
      return c.accent;
    case 'error':
      return c.error;
    case 'success':
      return c.success;
    case 'onAccent':
      return c.onAccent;
    default:
      return c.textPrimary;
  }
};

const TypographyBase: React.FC<TypographyProps> = ({
  variant = 'body',
  tone = 'primary',
  align,
  style,
  children,
  ...rest
}) => {
  const { isDarkMode } = useTheme();
  const composed = StyleSheet.flatten([
    typography[variant] as TextStyle,
    { color: toneToColor(tone, isDarkMode) },
    align ? { textAlign: align } : null,
    style,
  ]) as TextStyle;

  return (
    <Text {...rest} style={composed} allowFontScaling>
      {children}
    </Text>
  );
};

export const Display: React.FC<Omit<TypographyProps, 'variant'>> = (props) => (
  <TypographyBase variant="display" {...props} />
);

export const Title: React.FC<Omit<TypographyProps, 'variant'>> = (props) => (
  <TypographyBase variant="title" {...props} />
);

export const Subtitle: React.FC<Omit<TypographyProps, 'variant'>> = (props) => (
  <TypographyBase variant="subtitle" tone="secondary" {...props} />
);

export const Body: React.FC<Omit<TypographyProps, 'variant'>> = (props) => (
  <TypographyBase variant="body" {...props} />
);

export const Caption: React.FC<Omit<TypographyProps, 'variant'>> = (props) => (
  <TypographyBase variant="caption" tone="tertiary" {...props} />
);

export const Mono: React.FC<Omit<TypographyProps, 'variant'>> = (props) => (
  <TypographyBase variant="mono" tone="tertiary" {...props}>
    {typeof props.children === 'string' ? props.children.toUpperCase() : props.children}
  </TypographyBase>
);

export const Brand: React.FC<Omit<TypographyProps, 'variant'>> = (props) => (
  <TypographyBase variant="brand" {...props}>
    {typeof props.children === 'string' ? props.children.toUpperCase() : props.children}
  </TypographyBase>
);
