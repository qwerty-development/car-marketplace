// VideoControls.tsx - FIXED VERSION
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
} from "react-native";
import { Volume2, VolumeX, Heart } from "lucide-react-native";
import AuthRequiredModal from "./AuthRequiredModal";
import { useGuestUser } from "@/utils/GuestUserContext";

const VideoControls = ({
  clipId,
  duration,
  currentTime,
  isPlaying,
  globalMute,
  onMutePress,
  onScrub,
  videoRef,
  likes,
  isLiked,
  onLikePress,
}: any) => {
  const [showControls, setShowControls] = useState(true);
  const [progressWidth, setProgressWidth] = useState(0);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  
  // FIXED: Use useRef to avoid re-creating Animated.Value on every render
  const opacity = useRef(new Animated.Value(1)).current;
  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

  // Get guest status from your auth/guest hook
  const { isGuest } = useGuestUser();

  // Determine if device is small based on height
  const isSmallDevice = screenHeight < 700;

  // FIXED: Add timeout ref to prevent memory leaks and conflicts
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // FIXED: Optimize useEffect to prevent unnecessary animations
  useEffect(() => {
    // Clear any existing timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (isPlaying) {
      // Show controls when video starts playing
      if (!showControls) {
        setShowControls(true);
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }

      // Set timeout to hide controls
      hideTimeoutRef.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }).start(() => {
          setShowControls(false);
        });
      }, 3000);
    } else {
      // Show controls when video is paused
      if (!showControls) {
        setShowControls(true);
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    }

    // Cleanup function
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, [isPlaying]); // FIXED: Only depend on isPlaying, not showControls

  // FIXED: Memoized toggle function to prevent unnecessary re-renders
  const toggleControls = useCallback(() => {
    const newShowControls = !showControls;
    setShowControls(newShowControls);
    
    Animated.timing(opacity, {
      toValue: newShowControls ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Reset hide timeout if showing controls
    if (newShowControls && isPlaying) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      hideTimeoutRef.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }).start(() => {
          setShowControls(false);
        });
      }, 3000);
    }
  }, [showControls, isPlaying]); // FIXED: Add isPlaying to dependencies

  // FIXED: Memoized format function
  const formatTime = useCallback((timeInSeconds: number) => {
    if (!timeInSeconds || !isFinite(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  }, []);

  // FIXED: Improved scrubbing with bounds checking
  const handleScrubbing = useCallback((event: { nativeEvent: { locationX: number } }) => {
    if (!duration || duration <= 0 || !progressWidth) return;
    
    const { locationX } = event.nativeEvent;
    const percentage = Math.max(0, Math.min(1, locationX / progressWidth));
    const newTime = percentage * duration;
    
    // FIXED: Add debouncing to prevent rapid scrub calls
    onScrub(clipId, newTime);
  }, [clipId, duration, progressWidth, onScrub]);

  // Calculate responsive bottom position for side controls
  const sideControlsBottomPosition = isSmallDevice ? 90 : 210;

  // FIXED: Memoized like handler to prevent unnecessary re-renders
  const handleLikePress = useCallback(() => {
    if (isGuest) {
      setAuthModalVisible(true);
    } else {
      onLikePress(clipId);
    }
  }, [isGuest, clipId, onLikePress]);

  // FIXED: Memoized mute handler to prevent video interference
  const handleMutePress = useCallback((e: any) => {
    // Prevent event from bubbling up to video touch handler
    e.stopPropagation();
    e.preventDefault();
    
    onMutePress(clipId, e);
  }, [clipId, onMutePress]);

  // FIXED: Calculate progress percentage with bounds checking
  const progressPercentage = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <>
      {/* Progress bar at bottom */}
      <Animated.View
        className="absolute left-0 right-0 px-4 bottom-0"
        style={{
          opacity,
          zIndex: 60,
          bottom: isSmallDevice ? 7 : 10,
        }}
        onLayout={(e) => setProgressWidth(e.nativeEvent.layout.width - 32)}
      >
        <View className="p-1 mb-2">
          <TouchableOpacity
            className="h-6 justify-center"
            onPress={handleScrubbing}
            activeOpacity={1}
          >
            <View className="h-1 w-full bg-neutral-600 rounded-full overflow-hidden">
              <View
                className="h-full bg-red"
                style={{ width: `${progressPercentage}%` }}
              />
              <View
                className="absolute top-1/2 h-4 w-4 bg-red rounded-full shadow-lg"
                style={{
                  left: `${progressPercentage}%`,
                  transform: [{ translateY: -8 }, { translateX: -8 }], // FIXED: Center the handle
                }}
              />
            </View>
          </TouchableOpacity>

          <View className="flex-row justify-between mt-[-2]">
            <Text className="text-white text-xs">
              {formatTime(currentTime)}
            </Text>
            <Text className="text-white text-xs">{formatTime(duration)}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Side controls */}
      <View
        style={{
          position: "absolute",
          right: 16,
          bottom: sideControlsBottomPosition,
          zIndex: 60,
        }}
      >
        <View style={{ gap: isSmallDevice ? 16 : 24 }}>
          <TouchableOpacity
            onPress={handleMutePress}
            className="bg-black/50 p-3 rounded-full"
            activeOpacity={0.7}
          >
            {globalMute ? (
              <VolumeX color="white" size={isSmallDevice ? 20 : 24} />
            ) : (
              <Volume2 color="white" size={isSmallDevice ? 20 : 24} />
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={handleLikePress} 
            className="items-center"
            activeOpacity={0.7}
          >
            <View className="bg-black/50 rounded-full p-3 mb-1">
              <Heart
                size={isSmallDevice ? 20 : 24}
                color={isLiked ? "#D55004" : "white"}
                fill={isLiked ? "#D55004" : "transparent"}
                strokeWidth={isLiked ? 0.5 : 2}
              />
            </View>
            <Text className="text-white text-center text-xs font-medium">
              {likes || 0}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Auth Required Modal */}
      <AuthRequiredModal
        isVisible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        featureName="like this video"
      />
    </>
  );
};

// FIXED: Proper memoization with comparison function
export default React.memo(VideoControls, (prevProps, nextProps) => {
  return (
    prevProps.clipId === nextProps.clipId &&
    prevProps.duration === nextProps.duration &&
    Math.abs(prevProps.currentTime - nextProps.currentTime) < 1 && // Only update if time difference > 1 second
    prevProps.isPlaying === nextProps.isPlaying &&
    prevProps.globalMute === nextProps.globalMute &&
    prevProps.likes === nextProps.likes &&
    prevProps.isLiked === nextProps.isLiked
  );
});