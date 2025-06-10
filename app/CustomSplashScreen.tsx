// app/CustomSplashScreen.tsx - IMMEDIATE CONTROL VERSION
import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, Animated, View } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import * as SplashScreen from 'expo-splash-screen';

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

const CustomSplashScreen: React.FC<SplashScreenProps> = ({ 
  onAnimationComplete,
}) => {
  // IMMEDIATE VISIBILITY: Component starts completely opaque
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  // VIDEO CONTROL: Start video immediately upon mount
  const [shouldPlayVideo, setShouldPlayVideo] = useState(true);
  const [videoError, setVideoError] = useState(false);
  
  // AGGRESSIVE SPLASH HIDING: Hide built-in splash immediately upon mount
  useEffect(() => {
    const immediateHideSplash = () => {
      // SYNCHRONOUS OPERATION: Hide splash without await to prevent delays
      SplashScreen.hideAsync().catch((error) => {
        console.warn('[CustomSplash] Non-critical splash hide error:', error);
      });
      console.log('[CustomSplash] Built-in splash hide initiated immediately');
    };

    // ZERO DELAY: Execute immediately
    immediateHideSplash();
  }, []);

  // VIDEO LIFECYCLE MANAGEMENT
  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    // COMPLETION DETECTION: Video finished successfully
    if (status.didJustFinish) {
      console.log('[CustomSplash] Video playback completed');
      initiateCompletion();
    }
  };

  // ERROR HANDLING: Video load/playback failures
  const onVideoError = (error: string) => {
    console.error('[CustomSplash] Video error detected:', error);
    setVideoError(true);
    
    // FALLBACK COMPLETION: 1.5 second delay for graceful failure
    setTimeout(() => {
      initiateCompletion();
    }, 1500);
  };

  // COMPLETION INITIATION: Fade out and signal completion
  const initiateCompletion = () => {
    console.log('[CustomSplash] Initiating completion sequence');
    
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300, // Faster fade-out for immediate response
      useNativeDriver: true,
    }).start(() => {
      console.log('[CustomSplash] Fade-out completed');
      onAnimationComplete();
    });
  };

  // ERROR FALLBACK: Complete after timeout if video fails to load
  useEffect(() => {
    const errorTimeout = setTimeout(() => {
      if (videoError) {
        console.warn('[CustomSplash] Video error timeout - forcing completion');
        initiateCompletion();
      }
    }, 3000);

    return () => clearTimeout(errorTimeout);
  }, [videoError]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* BACKGROUND LAYER: Solid black to prevent any underlying content visibility */}
      <View style={styles.backgroundLayer} />
      
      {/* VIDEO LAYER: Immediate playback */}
      <Video
        style={StyleSheet.absoluteFill}
        source={require('../assets/splash.mp4')}
        resizeMode={ResizeMode.COVER} 
        isMuted={true}
        isLooping={false}
        shouldPlay={shouldPlayVideo}
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        onError={onVideoError}
        useNativeControls={false}
        progressUpdateIntervalMillis={50} // Faster status updates
        positionMillis={0} // Start from beginning
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999, // MAXIMUM z-index to ensure top layer
    backgroundColor: '#000000', // Solid black background
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000', // Double-layer black to prevent flicker
    zIndex: 1,
  },
});

export default CustomSplashScreen;