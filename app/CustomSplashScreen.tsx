// components/CustomSplashScreen.tsx - UPDATED WITH FADE-IN
import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, Animated } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

const CustomSplashScreen: React.FC<SplashScreenProps> = ({ 
  onAnimationComplete,
}) => {
  // 1. Opacity now starts at 0 (transparent) for the fade-in effect.
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // 2. Use state to control when the video should start playing.
  const [shouldPlayVideo, setShouldPlayVideo] = useState(false);

  // 3. This useEffect handles the initial fade-in animation.
  useEffect(() => {
    // Fade in the component when it mounts.
    Animated.timing(fadeAnim, {
      toValue: 1, // Animate to fully visible
      duration: 500, // Duration of the fade-in
      useNativeDriver: true,
    }).start(() => {
      // After the fade-in is complete, set the state to allow video playback.
      setShouldPlayVideo(true);
    });
  }, []); // The empty array ensures this effect runs only once on mount.

  // 4. This function handles the fade-out after the video finishes.
  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      return;
    }

    // When the video finishes, trigger the fade-out animation.
    if (status.didJustFinish) {
      Animated.timing(fadeAnim, {
        toValue: 0, // Animate to fully transparent
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        // After the fade-out, notify the parent component.
        onAnimationComplete();
      });
    }
  };

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
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000', 
    zIndex: 1000, 
  },
});

export default CustomSplashScreen;