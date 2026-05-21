import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/utils/ThemeContext';
import { getAuthColors, motion, spacing, typography } from './tokens';

type Option<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  value: T;
  onChange: (next: T) => void;
  options: Option<T>[];
};

function SegmentedToggle<T extends string>({ value, onChange, options }: Props<T>) {
  const { isDarkMode } = useTheme();
  const colors = getAuthColors(isDarkMode);
  const [width, setWidth] = useState(0);
  const segmentWidth = width / options.length;
  const indicator = useRef(new Animated.Value(0)).current;

  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  useEffect(() => {
    if (!segmentWidth) return;
    Animated.timing(indicator, {
      toValue: activeIndex * segmentWidth,
      duration: motion.base,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, segmentWidth, indicator]);

  const handleLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  return (
    <View style={styles.wrapper} onLayout={handleLayout}>
      <View style={styles.row}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                if (!active) {
                  Haptics.selectionAsync().catch(() => {});
                  onChange(opt.value);
                }
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={styles.segment}
              hitSlop={6}
            >
              <Text
                style={[
                  typography.label,
                  {
                    color: active ? colors.textPrimary : colors.textTertiary,
                    fontWeight: active ? '700' : '500',
                    letterSpacing: 1.4,
                  },
                ]}
              >
                {opt.label.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.trackLine, { backgroundColor: colors.border }]} />

      {!!segmentWidth && (
        <Animated.View
          style={[
            styles.indicator,
            {
              width: segmentWidth,
              backgroundColor: colors.accent,
              transform: [{ translateX: indicator }],
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackLine: {
    height: 1,
    width: '100%',
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2,
    borderRadius: 2,
  },
});

export default SegmentedToggle;
