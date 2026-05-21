import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, ImageSourcePropType, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/utils/ThemeContext';
import { getAuthColors, motion } from './tokens';

const HERO_IMAGES: ImageSourcePropType[] = [
  require('@/assets/cars/car5.jpg'),
  require('@/assets/cars/car8.jpg'),
  require('@/assets/cars/car12.jpg'),
];

type Props = {
  height: number;
  enableKenBurns?: boolean;
};

const HeroBackdrop: React.FC<Props> = ({ height, enableKenBurns = true }) => {
  const { isDarkMode } = useTheme();
  const colors = getAuthColors(isDarkMode);
  const screenWidth = Dimensions.get('window').width;

  const opacities = useRef(HERO_IMAGES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const kenburns = useRef(new Animated.Value(0)).current;
  const indexRef = useRef(0);

  useEffect(() => {
    let activeAnimations: Animated.CompositeAnimation[] = [];

    if (enableKenBurns) {
      const kenburnsLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(kenburns, {
            toValue: 1,
            duration: motion.hero,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(kenburns, {
            toValue: 0,
            duration: motion.hero,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      kenburnsLoop.start();
      activeAnimations.push(kenburnsLoop);
    }

    const crossfade = () => {
      const next = (indexRef.current + 1) % HERO_IMAGES.length;
      const fadeOutCurrent = Animated.timing(opacities[indexRef.current], {
        toValue: 0,
        duration: motion.crossfade,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      });
      const fadeInNext = Animated.timing(opacities[next], {
        toValue: 1,
        duration: motion.crossfade,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      });
      Animated.parallel([fadeOutCurrent, fadeInNext]).start(() => {
        indexRef.current = next;
      });
    };

    const interval = setInterval(crossfade, motion.heroDwell);

    return () => {
      clearInterval(interval);
      activeAnimations.forEach((a) => a.stop());
    };
  }, [enableKenBurns, kenburns, opacities]);

  const scale = enableKenBurns
    ? kenburns.interpolate({
        inputRange: [0, 1],
        outputRange: [1.0, 1.06],
      })
    : 1;

  const translateY = enableKenBurns
    ? kenburns.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -10],
      })
    : 0;

  return (
    <View style={[styles.container, { height, width: screenWidth, backgroundColor: colors.bg }]} pointerEvents="none">
      {HERO_IMAGES.map((src, i) => (
        <Animated.Image
          key={i}
          source={src}
          resizeMode="cover"
          style={[
            styles.image,
            {
              width: screenWidth,
              height,
              opacity: opacities[i],
              transform: [{ scale }, { translateY }],
            },
          ]}
        />
      ))}

      {/* Top vignette — always darkens slightly so the brand wordmark stays readable across photos */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
        style={[styles.topMask, { height: height * 0.26 }]}
      />

      {/* Bottom mask — hands off to the content panel below */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(0,0,0,0)',
          isDarkMode ? 'rgba(10,10,10,0.55)' : 'rgba(255,255,255,0.55)',
          colors.bg,
        ]}
        locations={[0, 0.55, 1]}
        style={[styles.bottomMask, { height: height * 0.45 }]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  topMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottomMask: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});

export default HeroBackdrop;
