import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, Modal, Platform, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AnchorRect } from '@/utils/OnboardingRegistry';
import { useTheme } from '@/utils/ThemeContext';

interface OnboardingOverlayProps {
  visible: boolean;
  anchor: AnchorRect | null;
  title: string;
  description?: string;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
}

export default function OnboardingOverlay({
  visible,
  anchor,
  title,
  description,
  stepIndex,
  totalSteps,
  onNext,
  onSkip,
}: OnboardingOverlayProps) {
  const { isDarkMode } = useTheme();
  const [anim] = useState(new Animated.Value(0));
  const [rectAnim] = useState(new Animated.Value(0));
  const prevAnchorRef = useRef<AnchorRect | null>(null);
  const [introScale] = useState(new Animated.Value(1));
  const isIntro = !anchor && stepIndex === 0;
  const window = Dimensions.get('window');

  useEffect(() => {
    if (visible) {
      Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: false, easing: Easing.out(Easing.cubic) }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: false, easing: Easing.in(Easing.cubic) }).start();
    }
  }, [visible]);

  // Smoothly animate highlight rectangle position/size between steps
  useEffect(() => {
    if (!visible) return;
    if (!anchor) {
      prevAnchorRef.current = null;
      return;
    }
    rectAnim.setValue(0);
    Animated.timing(rectAnim, { toValue: 1, duration: 220, useNativeDriver: false, easing: Easing.out(Easing.cubic) }).start(() => {
      prevAnchorRef.current = anchor;
    });
  }, [anchor, visible]);

  // Intro pulse animation
  useEffect(() => {
    if (visible && isIntro) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(introScale, { toValue: 1.07, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(introScale, { toValue: 1.0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [visible, isIntro]);

  const maskStyle = useMemo(() => {
    const padding = 8;
    const from = prevAnchorRef.current || anchor;
    const to = anchor || prevAnchorRef.current;
    if (!from && !to) return {};
    const ix = from ? from.x - padding : (to!.x - padding);
    const iy = from ? from.y - padding : (to!.y - padding);
    const iw = from ? from.width + padding * 2 : (to!.width + padding * 2);
    const ih = from ? from.height + padding * 2 : (to!.height + padding * 2);
    const tx = to ? to.x - padding : ix;
    const ty = to ? to.y - padding : iy;
    const tw = to ? to.width + padding * 2 : iw;
    const th = to ? to.height + padding * 2 : ih;
    return {
      left: rectAnim.interpolate({ inputRange: [0, 1], outputRange: [ix, tx] }),
      top: rectAnim.interpolate({ inputRange: [0, 1], outputRange: [iy, ty] }),
      width: rectAnim.interpolate({ inputRange: [0, 1], outputRange: [iw, tw] }),
      height: rectAnim.interpolate({ inputRange: [0, 1], outputRange: [ih, th] }),
      borderRadius: 12,
    } as any;
  }, [anchor, rectAnim]);

  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onSkip}>
      <View style={{ flex: 1 }}>
        {/* Dim background with rounded hole using SVG even-odd path */}
        {(() => {
          const bg = isDarkMode ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.85)';
          const { width, height } = window;
          const padding = 8;
          const r = 12;
          const rect = anchor
            ? {
                x: (anchor.x - padding),
                y: (anchor.y - padding),
                w: (anchor.width + padding * 2),
                h: (anchor.height + padding * 2),
              }
            : { x: 0, y: 0, w: 0, h: 0 };

          const outer = `M0 0 H${width} V${height} H0 V0 Z`;
          const inner = `M${rect.x + r} ${rect.y}
            H${rect.x + rect.w - r}
            A${r} ${r} 0 0 1 ${rect.x + rect.w} ${rect.y + r}
            V${rect.y + rect.h - r}
            A${r} ${r} 0 0 1 ${rect.x + rect.w - r} ${rect.y + rect.h}
            H${rect.x + r}
            A${r} ${r} 0 0 1 ${rect.x} ${rect.y + rect.h - r}
            V${rect.y + r}
            A${r} ${r} 0 0 1 ${rect.x + r} ${rect.y}
            Z`;

          return (
            <Animated.View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: anim }} pointerEvents="none">
              <Svg width={width} height={height}>
                <Path d={`${outer} ${inner}`} fill={bg} fillRule="evenodd" />
              </Svg>
            </Animated.View>
          );
        })()}

        {/* Highlight hole */}
        {anchor && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              borderWidth: 2,
              borderColor: '#D55004',
              ...maskStyle,
              opacity: anim,
              borderRadius: 12,
            }}
          />
        )}

        {/* Tooltip card centered on screen to avoid overlapping the bottom controls */}
        <Animated.View
          style={{
            position: 'absolute',
            left: 24,
            right: 24,
            top: window.height * 0.25,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            opacity: anim,
          }}
        >
          <LinearGradient
            colors={[isDarkMode ? '#1A1A1A' : '#FFFFFF', isDarkMode ? '#111111' : '#F8F8F8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 16, padding: 16, borderWidth: 1, borderColor: isDarkMode ? '#333' : '#e5e7eb' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="sparkles-outline" size={20} color="#D55004" />
              <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '800', color: isDarkMode ? '#FFFFFF' : '#000000' }}>
                {title}
              </Text>
            </View>
            {isIntro && (
              <View style={{ alignItems: 'center', marginBottom: 12 }}>
                <Animated.View style={{ transform: [{ scale: introScale }], width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#1f2937' : '#f3f4f6', borderWidth: 1, borderColor: isDarkMode ? '#374151' : '#e5e7eb' }}>
                  <Image source={require('@/assets/images/logo.png')} style={{ width: 64, height: 64 }} resizeMode="contain" />
                </Animated.View>
              </View>
            )}
            {!!description && (
              <Text style={{ fontSize: 14, color: isDarkMode ? '#E5E7EB' : '#111827', marginBottom: 12 }}>
                {description}
              </Text>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: 12 }}>
                Step {stepIndex + 1} of {totalSteps}
              </Text>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable onPress={onSkip} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: isDarkMode ? '#2A2A2A' : '#F3F4F6' }}>
                  <Text style={{ color: isDarkMode ? '#FFFFFF' : '#111827', fontWeight: '700' }}>Skip</Text>
                </Pressable>
                <Pressable onPress={onNext} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#D55004' }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{stepIndex + 1 === totalSteps ? 'Finish' : 'Next'}</Text>
                </Pressable>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const StyleSheetSheetless = {
  overlay: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
};


