// components/CustomSplashScreen.tsx - CORRECTED WITH THEME-AWARE BACKGROUND
import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, Animated, Platform, View, useColorScheme } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

// DEVICE CAPABILITY DETECTION CONSTANTS
const DEVICE_CAPABILITY_THRESHOLDS = {
  TIMEOUT_VIDEO_LOAD: 3000, // 3 seconds max for video to start
  TIMEOUT_VIDEO_TOTAL: 8000, // 8 seconds max total video duration
  FALLBACK_DISPLAY_DURATION: 2500, // 2.5 seconds for background fallback
} as const;

// ENHANCED SPLASH STATE MANAGEMENT
type SplashMode = 'loading' | 'video' | 'fallback' | 'completing';
type VideoState = 'idle' | 'loading' | 'playing' | 'error' | 'completed';

const CustomSplashScreen: React.FC<SplashScreenProps> = ({ 
  onAnimationComplete,
}) => {
  // THEME DETECTION
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  
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

  // SIMPLIFIED DEVICE CAPABILITY DETECTION
  const shouldUseVideoMode = useRef<boolean>(true);

  // METHOD: Initialize device capability detection
  useEffect(() => {
    const detectDeviceCapability = () => {
      try {
        // RULE: Use video mode by default, only fallback on actual errors
        shouldUseVideoMode.current = true;
        
        // RULE: Only disable video for very old Android versions
        if (Platform.OS === 'android' && Platform.Version < 21) {
          shouldUseVideoMode.current = false;
          console.log('[SplashScreen] Very old Android detected (API < 21), using background fallback');
        } else {
          console.log('[SplashScreen] Device supports video mode');
        }
      } catch (error) {
        console.warn('[SplashScreen] Device detection error, using video mode with fallback protection:', error);
        shouldUseVideoMode.current = true;
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

  // METHOD: Handle fallback mode activation (now uses background instead of logo)
  const activateBackgroundFallback = (reason: string) => {
    console.log(`[SplashScreen] Activating background fallback: ${reason}`);
    setSplashMode('fallback');
    setVideoState('error');
    cleanupTimeouts();

    // RULE: Display background fallback for specified duration
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
      
      // RULE: Check if we should use background fallback immediately (very rare cases)
      if (!shouldUseVideoMode.current) {
        console.log('[SplashScreen] Device does not support video, using background fallback');
        activateBackgroundFallback('Device does not support video');
        return;
      }

      // RULE: Attempt video mode for all capable devices
      console.log('[SplashScreen] Attempting video mode');
      setSplashMode('video');
      setVideoState('loading');

      // TIMEOUT PROTECTION: Video load timeout
      videoLoadTimeoutRef.current = setTimeout(() => {
        if (videoState === 'loading') {
          console.warn('[SplashScreen] Video load timeout, switching to background fallback');
          activateBackgroundFallback('Video load timeout');
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
          activateBackgroundFallback(`Video error: ${status.error}`);
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
      activateBackgroundFallback(`Status handler error: ${error}`);
    }
  };

  // METHOD: Handle video loading errors
  const onVideoError = (error: string) => {
    console.error('[SplashScreen] Video component error:', error);
    activateBackgroundFallback(`Video component error: ${error}`);
  };

  // COMPUTED: Dynamic background color based on theme
  const backgroundColor = isDarkMode ? '#000000' : '#FFFFFF';

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
          <View style={[styles.backgroundContainer, { backgroundColor }]} />
        );
    }
  };

  return (
    <Animated.View style={[styles.container, { backgroundColor, opacity: fadeAnim }]}>
      {renderSplashContent()}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default CustomSplashScreen;