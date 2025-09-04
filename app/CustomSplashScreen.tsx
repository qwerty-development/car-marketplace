// components/CustomSplashScreen.tsx - UPDATED WITH FADE-IN
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { StyleSheet, Animated, Image, Platform } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

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

  // 4. This function handles the fade-out after the video finishes.
  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      console.log('[CustomSplashScreen] Video not loaded yet');
      return;
    }

    console.log('[CustomSplashScreen] Video status:', status);
    
    // When the video finishes, trigger the fade-out animation.
    if (status.didJustFinish) {
      console.log('[CustomSplashScreen] Video finished, completing splash screen');
      completeOnce();
    }
  };

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
          <Video
            style={[StyleSheet.absoluteFill, { opacity: 0.3 }]}
            source={require('../assets/splash.mp4')}
            resizeMode={ResizeMode.COVER} 
            isMuted={true}
            isLooping={false}
            shouldPlay={true}
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            onError={(error) => {
              console.log('[CustomSplashScreen] Video error on Android (expected):', error);
              // Video failed, but we have the logo, so just continue
            }}
            onLoadStart={() => console.log('[CustomSplashScreen] Video load started on Android')}
            onLoad={() => console.log('[CustomSplashScreen] Video loaded on Android')}
            // Android-specific props for better compatibility
            useNativeControls={false}
            shouldCorrectPitch={false}
            progressUpdateInterval={1000}
          />
        )}
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Video
        style={StyleSheet.absoluteFill}
        source={require('../assets/splash.mp4')}
        resizeMode={ResizeMode.COVER} 
        isMuted={true}
        isLooping={false}
        // 5. The video only starts playing AFTER the fade-in is complete.
        shouldPlay={shouldPlayVideo}
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        onError={(error) => {
          console.log('[CustomSplashScreen] Video error:', error);
          completeOnce();
        }}
        onLoadStart={() => console.log('[CustomSplashScreen] Video load started')}
        onLoad={() => console.log('[CustomSplashScreen] Video loaded')}
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