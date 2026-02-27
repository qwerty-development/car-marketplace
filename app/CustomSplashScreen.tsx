// components/CustomSplashScreen.tsx - UPDATED WITH FADE-IN
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { StyleSheet, Animated, Image, Platform } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

const CustomSplashScreen: React.FC<SplashScreenProps> = ({ 
  onAnimationComplete,
}) => {
  // 1. Opacity now starts at 0 (transparent) for the fade-in effect.
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const hasCompletedRef = useRef(false);
  
  // 2. Use state to control when the video should start playing.
  const [shouldPlayVideo, setShouldPlayVideo] = useState(false);

  const player = useVideoPlayer(require('../assets/splash.mp4'), player => {
    player.muted = true;
    player.loop = false;
  });

  // Ensure we complete at most once (handles errors/timeouts)
  const completeOnce = useCallback(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onAnimationComplete();
    });
  }, [fadeAnim, onAnimationComplete]);

  // Listen for video end to trigger completion
  useEffect(() => {
    const subscription = player.addListener('playToEnd', () => {
      console.log('[CustomSplashScreen] Video finished, completing splash screen');
      completeOnce();
    });
    return () => subscription.remove();
  }, [player, completeOnce]);

  // Play/pause based on shouldPlayVideo state
  useEffect(() => {
    if (shouldPlayVideo) {
      player.play();
    }
  }, [shouldPlayVideo, player]);

  // 3. This useEffect handles the initial fade-in animation.
  useEffect(() => {
    console.log('[CustomSplashScreen] Component mounted, starting fade-in');
    // Fade in the component when it mounts.
    Animated.timing(fadeAnim, {
      toValue: 1, // Animate to fully visible
      duration: 500, // Duration of the fade-in
      useNativeDriver: true,
    }).start(() => {
      // After the fade-in is complete, set the state to allow video playback.
      console.log('[CustomSplashScreen] Fade-in complete, starting video playback');
      setShouldPlayVideo(true);
    });
  }, []); // The empty array ensures this effect runs only once on mount.

  // 3.1 Failsafe: if video cannot play on some devices, auto-complete after timeout
  useEffect(() => {
    // Shorter timeout for Android since we're using image fallback
    const timeoutDuration = Platform.OS === 'android' ? 2500 : 4000;
    const timeoutId = setTimeout(() => {
      console.log(`[CustomSplashScreen] Timeout reached (${timeoutDuration}ms), completing splash screen`);
      completeOnce();
    }, timeoutDuration);

    return () => clearTimeout(timeoutId);
  }, [completeOnce]);

  // For Android, use a more reliable approach with image fallback
  if (Platform.OS === 'android') {
    return (
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* Always show the logo as primary content on Android */}
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.fallbackImage}
          resizeMode="contain"
        />
        
        {/* Optional: Try to play video in background, but don't rely on it */}
        {shouldPlayVideo && (
          <VideoView
            player={player}
            style={[StyleSheet.absoluteFill, { opacity: 0.3 }]}
            contentFit="cover"
            nativeControls={false}
          />
        )}
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000', 
    zIndex: 1000,
    // Android-specific optimizations
    ...(Platform.OS === 'android' && {
      elevation: 1000,
      backgroundColor: '#000000',
    }),
  },
  fallbackImage: {
    width: 200,
    height: 200,
    alignSelf: 'center',
    position: 'absolute',
    top: '50%',
    marginTop: -100,
    // Android-specific optimizations
    ...(Platform.OS === 'android' && {
      elevation: 1001,
    }),
  },
});

export default CustomSplashScreen;