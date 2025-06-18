// components/CustomSplashScreen.tsx - ENHANCED WITH DEVICE COMPATIBILITY
import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, Animated, Image, Platform, View } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

// DEVICE CAPABILITY DETECTION CONSTANTS
const DEVICE_CAPABILITY_THRESHOLDS = {
  LOW_END_MEMORY_MB: 2048, // 2GB RAM threshold
  TIMEOUT_VIDEO_LOAD: 3000, // 3 seconds max for video to start
  TIMEOUT_VIDEO_TOTAL: 8000, // 8 seconds max total video duration
  FALLBACK_DISPLAY_DURATION: 2500, // 2.5 seconds for static fallback
} as const;

// ENHANCED SPLASH STATE MANAGEMENT
type SplashMode = 'loading' | 'video' | 'fallback' | 'completing';
type VideoState = 'idle' | 'loading' | 'playing' | 'error' | 'completed';

const CustomSplashScreen: React.FC<SplashScreenProps> = ({ 
  onAnimationComplete,
}) => {
  // ANIMATION REFS
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // ENHANCED STATE MANAGEMENT
  const [splashMode, setSplashMode] = useState<SplashMode>('loading');
  const [videoState, setVideoState] = useState<VideoState>('idle');
  const [shouldPlayVideo, setShouldPlayVideo] = useState(false);
  
  // TIMEOUT MANAGEMENT REFS
  const videoLoadTimeoutRef = useRef<NodeJS.Timeout>();
  const videoTotalTimeoutRef = useRef<NodeJS.Timeout>();
  const fallbackTimeoutRef = useRef<NodeJS.Timeout>();
  const completionTimeoutRef = useRef<NodeJS.Timeout>();

  // DEVICE CAPABILITY DETECTION
  const isLowEndDevice = useRef<boolean>(false);

  // METHOD: Initialize device capability detection
  useEffect(() => {
    const detectDeviceCapability = async () => {
      try {
        // RULE: Assume low-end for older Android versions
        if (Platform.OS === 'android' && Platform.Version < 26) {
          isLowEndDevice.current = true;
          console.log('[SplashScreen] Low-end device detected: Android API < 26');
          return;
        }

        // RULE: Additional heuristics for low-end detection
        // Note: In a real app, you might use react-native-device-info for more detailed detection
        const isEmulator = __DEV__ && Platform.OS === 'android';
        if (isEmulator) {
          console.log('[SplashScreen] Emulator detected, using video mode');
          isLowEndDevice.current = false;
        } else {
          // RULE: Conservative approach for production
          isLowEndDevice.current = Platform.OS === 'android';
          console.log('[SplashScreen] Production Android detected, enabling fallback protection');
        }
      } catch (error) {
        console.warn('[SplashScreen] Device detection error, defaulting to fallback mode:', error);
        isLowEndDevice.current = true;
      }
    };

    detectDeviceCapability();
  }, []);

  // METHOD: Clean up all timeouts
  const cleanupTimeouts = () => {
    if (videoLoadTimeoutRef.current) {
      clearTimeout(videoLoadTimeoutRef.current);
      videoLoadTimeoutRef.current = undefined;
    }
    if (videoTotalTimeoutRef.current) {
      clearTimeout(videoTotalTimeoutRef.current);
      videoTotalTimeoutRef.current = undefined;
    }
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = undefined;
    }
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = undefined;
    }
  };

  // METHOD: Trigger completion sequence
  const triggerCompletion = () => {
    if (splashMode === 'completing') return; // Prevent duplicate calls
    
    console.log('[SplashScreen] Starting completion sequence');
    setSplashMode('completing');
    cleanupTimeouts();

    // RULE: Fade out animation
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      // RULE: Small delay before calling completion to ensure smooth transition
      completionTimeoutRef.current = setTimeout(() => {
        onAnimationComplete();
      }, 100);
    });
  };

  // METHOD: Handle fallback mode activation
  const activateFallbackMode = (reason: string) => {
    console.log(`[SplashScreen] Activating fallback mode: ${reason}`);
    setSplashMode('fallback');
    setVideoState('error');
    cleanupTimeouts();

    // RULE: Display fallback for specified duration
    fallbackTimeoutRef.current = setTimeout(() => {
      triggerCompletion();
    }, DEVICE_CAPABILITY_THRESHOLDS.FALLBACK_DISPLAY_DURATION);
  };

  // EFFECT: Main initialization sequence
  useEffect(() => {
    console.log('[SplashScreen] Starting initialization sequence');
    
    // RULE: Begin with fade-in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      console.log('[SplashScreen] Fade-in complete, determining splash mode');
      
      // RULE: Check if we should use fallback mode immediately
      if (isLowEndDevice.current) {
        console.log('[SplashScreen] Low-end device detected, using fallback mode');
        activateFallbackMode('Low-end device detected');
        return;
      }

      // RULE: Attempt video mode for capable devices
      console.log('[SplashScreen] Attempting video mode');
      setSplashMode('video');
      setVideoState('loading');

      // TIMEOUT PROTECTION: Video load timeout
      videoLoadTimeoutRef.current = setTimeout(() => {
        if (videoState === 'loading') {
          console.warn('[SplashScreen] Video load timeout, switching to fallback');
          activateFallbackMode('Video load timeout');
        }
      }, DEVICE_CAPABILITY_THRESHOLDS.TIMEOUT_VIDEO_LOAD);

      // TIMEOUT PROTECTION: Total video timeout
      videoTotalTimeoutRef.current = setTimeout(() => {
        if (splashMode !== 'completing') {
          console.warn('[SplashScreen] Total video timeout, forcing completion');
          triggerCompletion();
        }
      }, DEVICE_CAPABILITY_THRESHOLDS.TIMEOUT_VIDEO_TOTAL);

      // RULE: Enable video playback
      setShouldPlayVideo(true);
    });

    // CLEANUP: Clear timeouts on unmount
    return () => {
      cleanupTimeouts();
    };
  }, []); // Empty dependency array for mount-only execution

  // METHOD: Enhanced video status handler with comprehensive error detection
  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    try {
      // RULE: Handle unloaded state
      if (!status.isLoaded) {
        if ('error' in status && status.error) {
          console.error('[SplashScreen] Video loading error:', status.error);
          activateFallbackMode(`Video error: ${status.error}`);
        }
        return;
      }

      // RULE: Video successfully loaded
      if (videoState === 'loading') {
        console.log('[SplashScreen] Video loaded successfully');
        setVideoState('playing');
        
        // RULE: Clear load timeout since video is now working
        if (videoLoadTimeoutRef.current) {
          clearTimeout(videoLoadTimeoutRef.current);
          videoLoadTimeoutRef.current = undefined;
        }
      }

      // RULE: Handle video completion
      if (status.didJustFinish) {
        console.log('[SplashScreen] Video playback completed');
        setVideoState('completed');
        triggerCompletion();
      }
    } catch (error) {
      console.error('[SplashScreen] Playback status handler error:', error);
      activateFallbackMode(`Status handler error: ${error}`);
    }
  };

  // METHOD: Handle video loading errors
  const onVideoError = (error: string) => {
    console.error('[SplashScreen] Video component error:', error);
    activateFallbackMode(`Video component error: ${error}`);
  };

  // RENDER: Conditional splash content based on mode
  const renderSplashContent = () => {
    switch (splashMode) {
      case 'video':
        return (
          <Video
            style={StyleSheet.absoluteFill}
            source={require('../assets/splash.mp4')}
            resizeMode={ResizeMode.COVER}
            isMuted={true}
            isLooping={false}
            shouldPlay={shouldPlayVideo}
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            onError={onVideoError}
            // ADDITIONAL PROPS for compatibility
            useNativeControls={false}
            progressUpdateIntervalMillis={100}
          />
        );
      
      case 'fallback':
      case 'loading':
      default:
        return (
          <View style={styles.fallbackContainer}>
            <Image
              source={require('../assets/images/logo.png')} // Use your app logo
              style={styles.fallbackLogo}
              resizeMode="contain"
            />
          </View>
        );
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {renderSplashContent()}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 1000,
  },
  fallbackContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackLogo: {
    width: 120,
    height: 120,
  },
});

export default CustomSplashScreen;