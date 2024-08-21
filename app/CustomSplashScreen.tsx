import React, { useEffect, useRef } from 'react';
import { View, Animated, Dimensions, StyleSheet } from 'react-native';

const { width, height } = Dimensions.get('window');

const AnimatedLine: React.FC<{ startPos: { x: number; y: number }; duration: number }> = ({ startPos, duration }) => {
  const position = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(position, {
        toValue: 1,
        duration: duration,
        useNativeDriver: true,
      })
    ).start();
  }, [duration]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startPos.x,
        top: startPos.y,
        width: 1,
        height: 100,
        backgroundColor: '#D55004',
        transform: [
          {
            translateY: position.interpolate({
              inputRange: [0, 1],
              outputRange: [0, height + 100],
            }),
          },
        ],
      }}
    />
  );
};

const Logo: React.FC = () => (
  <View style={styles.logo}>
    {/* Replace this with your actual logo or use an image */}
    <View style={styles.logoCircle} />
    <View style={styles.logoRect} />
  </View>
);

const CustomSplashScreen: React.FC<{ onAnimationComplete: () => void }> = ({ onAnimationComplete }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 1500,
        useNativeDriver: true,
      })
    ]).start(onAnimationComplete);
  }, []);

  return (
    <View style={styles.container}>
      <AnimatedLine startPos={{ x: width * 0.2, y: -100 }} duration={15000} />
      <AnimatedLine startPos={{ x: width * 0.5, y: -100 }} duration={20000} />
      <AnimatedLine startPos={{ x: width * 0.8, y: -100 }} duration={18000} />
      
      <Animated.View style={{ opacity: fadeAnim }}>
        <Logo />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#D55004',
  },
  logoRect: {
    width: 120,
    height: 20,
    backgroundColor: '#D55004',
    marginTop: 10,
  },
});

export default CustomSplashScreen;