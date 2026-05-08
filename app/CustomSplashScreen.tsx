import React, { useRef, useEffect, useCallback } from 'react';
import { StyleSheet, Animated, Platform } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

const CustomSplashScreen: React.FC<SplashScreenProps> = ({ onAnimationComplete }) => {
  // Android: native splash hides to reveal this at full opacity — no gap.
  // iOS: fades in from 0 before the video starts.
  const fadeAnim = useRef(new Animated.Value(Platform.OS === 'android' ? 1 : 0)).current;
  const hasCompletedRef = useRef(false);

  // Two conditions must both be true before we call player.play():
  //   1. Player has reported readyToPlay (isPlayerReadyRef)
  //   2. Component is fully visible — instant on Android, after fade on iOS (isVisibleRef)
  // Whichever arrives second calls tryPlay() and starts the video.
  // This prevents the premature playToEnd that happened when play() was called
  // before the player had loaded the asset.
  const isPlayerReadyRef = useRef(false);
  const isVisibleRef = useRef(Platform.OS === 'android');

  const player = useVideoPlayer(require('../assets/splash.mp4'), p => {
    p.muted = true;
    p.loop = false;
  });

  const completeOnce = useCallback(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => onAnimationComplete());
  }, [fadeAnim, onAnimationComplete]);

  const tryPlay = useCallback(() => {
    if (isPlayerReadyRef.current && isVisibleRef.current && !hasCompletedRef.current) {
      player.play();
    }
  }, [player]);

  // Condition 1: wait for the player to be ready
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') {
        isPlayerReadyRef.current = true;
        tryPlay();
      }
    });
    return () => sub.remove();
  }, [player, tryPlay]);

  // Complete when video finishes naturally
  useEffect(() => {
    const sub = player.addListener('playToEnd', () => completeOnce());
    return () => sub.remove();
  }, [player, completeOnce]);

  // Condition 2: become visible
  // Android — already at opacity 1, just call tryPlay in case player is already ready
  // iOS — fade in over 500ms, then call tryPlay
  useEffect(() => {
    if (Platform.OS === 'android') {
      tryPlay();
      return;
    }
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      isVisibleRef.current = true;
      tryPlay();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fallback: complete if the video never loads or playToEnd never fires
  useEffect(() => {
    const id = setTimeout(completeOnce, 4500);
    return () => clearTimeout(id);
  }, [completeOnce]);

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
    backgroundColor: '#000000',
    zIndex: 1000,
    elevation: 1000,
  },
});

export default React.memo(CustomSplashScreen);
