// VideoControls.tsx
import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, Animated, Dimensions } from 'react-native'
import { Volume2, VolumeX, Heart } from 'lucide-react-native'
import AuthRequiredModal from './AuthRequiredModal'
import { useGuestUser } from '@/utils/GuestUserContext'

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
  onLikePress
}: any) => {
  const [showControls, setShowControls] = useState(true)
  const [progressWidth, setProgressWidth] = useState(0)
  const [authModalVisible, setAuthModalVisible] = useState(false)
  const opacity = new Animated.Value(1)
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

  // Get guest status from your auth/guest hook
  const { isGuest } = useGuestUser()

  // Determine if device is small based on height
  const isSmallDevice = screenHeight < 700

  useEffect(() => {
    let timeout: NodeJS.Timeout | number
    if (isPlaying) {
      timeout = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true
        }).start()
        setShowControls(false)
      }, 3000)
    }
    return () => clearTimeout(timeout)
  }, [isPlaying])

  const toggleControls = useCallback(() => {
    setShowControls(prev => !prev)
    Animated.timing(opacity, {
      toValue: showControls ? 0 : 1,
      duration: 300,
      useNativeDriver: true
    }).start()
  }, [showControls])

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = Math.floor(timeInSeconds % 60)
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
  }

  const handleScrubbing = (event: { nativeEvent: { locationX: number } }) => {
    const { locationX } = event.nativeEvent
    const percentage = Math.max(0, Math.min(1, locationX / progressWidth))
    const newTime = percentage * duration
    onScrub(clipId, newTime)
  }

  // Calculate responsive bottom position for side controls
  const sideControlsBottomPosition = isSmallDevice ? 90 : 210

  const handleLikePress = () => {
    if (isGuest) {
      setAuthModalVisible(true)
    } else {
      onLikePress(clipId)
    }
  }

  return (
    <>
      {/* Progress bar at bottom */}
      <Animated.View
        className="absolute left-0 right-0 px-4 bottom-0"
        style={{
          opacity,
          zIndex: 60,
          bottom: isSmallDevice ? 7 : 10
        }}
        onLayout={e => setProgressWidth(e.nativeEvent.layout.width - 32)}>
        <View>
         <TouchableOpacity
  className="h-6 justify-center"
  onPress={handleScrubbing}
  activeOpacity={1}>
  <View className="h-1 w-full bg-neutral-600 rounded-full overflow-hidden">
             <View
      className="h-full bg-red"
      style={{ width: `${(currentTime / duration) * 100}%` }}
    />
    <View
      className="absolute top-1/2 h-4 w-4 bg-red rounded-full shadow-lg"
      style={{
        left: `${(currentTime / duration) * 100}%`,
        transform: [{ translateY: -8 }]
      }}
    />
  </View>
</TouchableOpacity>

<View className="flex-row justify-between mt-[-2]">
  <Text className="text-white text-xs">{formatTime(currentTime)}</Text>
  <Text className="text-white text-xs">{formatTime(duration)}</Text>
</View>
        </View>
      </Animated.View>

      {/* Side controls */}
      <View
        style={{
          position: 'absolute',
          right: 16,
          bottom: sideControlsBottomPosition,
          zIndex: 60
        }}>
        <View style={{ gap: isSmallDevice ? 16 : 24 }}>
          <TouchableOpacity
            onPress={e => onMutePress(clipId, e)}
            className="bg-black/50 p-3 rounded-full">
            {globalMute ? (
              <VolumeX color="white" size={isSmallDevice ? 20 : 24} />
            ) : (
              <Volume2 color="white" size={isSmallDevice ? 20 : 24} />
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleLikePress} className="items-center">
            <View className="bg-black/50 rounded-full p-3 mb-1">
              <Heart
                size={isSmallDevice ? 20 : 24}
                color={isLiked ? '#D55004' : 'white'}
                fill={isLiked ? '#D55004' : 'transparent'}
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
  )
}

export default React.memo(VideoControls)
