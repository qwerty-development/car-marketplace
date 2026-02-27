import { useTheme } from '@/utils/ThemeContext'
import { Ionicons } from '@expo/vector-icons'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useRef, useState, useEffect, useCallback } from 'react'
import {
	Modal,
	View,
	StatusBar,
	TouchableOpacity,
	Text,
	StyleSheet,
	Platform,
	Pressable
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import VideoControls from '@/components/VideoControls'
import Animated, {
	useAnimatedStyle,
	withSpring,
	runOnJS,
	useSharedValue
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { FontAwesome } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Play, Pause } from 'lucide-react-native'

const AutoclipModal = ({
	isVisible,
	onClose,
	clip,
	onLikePress: onLikePressParent,
	isLiked: isLikedInitial
}: any) => {
	// Video state management
	const [isPlaying, setIsPlaying] = useState(true)
	const [isMuted, setIsMuted] = useState(true)
	const [duration, setDuration] = useState(0)
	const [position, setPosition] = useState(0)
	const [showPlayPauseIcon, setShowPlayPauseIcon] = useState(false)

	const player = useVideoPlayer(clip?.video_url ?? null, player => {
		player.muted = true
		player.loop = true
	})

	// UI state management
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
	const { isDarkMode } = useTheme()
	const translateY = useSharedValue(0)
	const likeScale = useSharedValue(1)
	const playPauseOpacity = useSharedValue(0)

	// Like state management with immediate feedback
	const [isLiked, setIsLiked] = useState(isLikedInitial)
	const [localLikeCount, setLocalLikeCount] = useState(clip?.likes || 0)

	// Sync muted state with player
	useEffect(() => {
		player.muted = isMuted
	}, [isMuted, player])

	// Poll position/duration for progress tracking
	useEffect(() => {
		if (!isVisible) return
		const interval = setInterval(() => {
			if (player.status === 'readyToPlay') {
				setPosition(player.currentTime)
				setDuration(player.duration)
			}
		}, 250)
		return () => clearInterval(interval)
	}, [isVisible, player])

	// Auto-play when visible
	useEffect(() => {
		if (isVisible && clip?.video_url) {
			player.play()
			setIsPlaying(true)
		} else {
			player.pause()
			setIsPlaying(false)
		}
	}, [isVisible, clip?.video_url, player])

	// Reset states when clip changes
	useEffect(() => {
		setIsLiked(isLikedInitial)
		setLocalLikeCount(clip?.likes || 0)
	}, [isLikedInitial, clip])

	// Video play/pause logic
	const handleVideoPress = useCallback(async () => {
		try {
			const newPlayingState = !isPlaying
			setIsPlaying(newPlayingState)

			if (newPlayingState) {
				player.play()
			} else {
				player.pause()
			}

			// Show play/pause icon
			setShowPlayPauseIcon(true)
			setTimeout(() => {
				setShowPlayPauseIcon(false)
			}, 500)
		} catch (error) {
			console.error('Error handling video playback:', error)
		}
	}, [isPlaying, player])

	// Enhanced like button handler
	const onLikePress = useCallback(async () => {
		// Haptic feedback
		if (Platform.OS === 'ios') {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
		}

		// Animate like button
		likeScale.value = withSpring(0.8, { damping: 2 })
		await new Promise(resolve => setTimeout(resolve, 50))
		likeScale.value = withSpring(1.2, { damping: 2 })
		await new Promise(resolve => setTimeout(resolve, 50))
		likeScale.value = withSpring(1, { damping: 2 })

		// Update local state immediately
		const newLikedState = !isLiked
		setIsLiked(newLikedState)
		setLocalLikeCount((prev: number) => prev + (newLikedState ? 1 : -1))

		// Call parent handler
		onLikePressParent && onLikePressParent(clip?.id)
	}, [isLiked, clip?.id, onLikePressParent])

	// Gesture handling for modal dismissal
	const panGesture = Gesture.Pan()
		.onUpdate(event => {
			if (event.translationY > 0) {
				translateY.value = event.translationY
			}
		})
		.onEnd(event => {
			if (event.translationY > 100) {
				runOnJS(onClose)()
			}
			translateY.value = withSpring(0)
		})

	// Animated styles
	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: translateY.value }]
	}))

	const likeAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: likeScale.value }]
	}))

	return (
		<Modal
			visible={isVisible}
			onRequestClose={onClose}
			animationType='slide'
			presentationStyle='fullScreen'
			statusBarTranslucent>
			<LinearGradient
				colors={isDarkMode ? ['#000000', '#1A1A1A'] : ['#FFFFFF', '#F0F0F0']}
				className='flex-1'>
			<GestureDetector gesture={panGesture}>
				<Animated.View
					style={[{ flex: 1 }, animatedStyle]}
					className={isDarkMode ? 'bg-black' : 'bg-white'}>
					<StatusBar hidden />

					<Pressable onPress={handleVideoPress} style={StyleSheet.absoluteFill}>
						<VideoView
							player={player}
							style={StyleSheet.absoluteFill}
							contentFit="cover"
							nativeControls={false}
						/>

						{/* Play/Pause Icon Overlay */}
						{showPlayPauseIcon && (
							<View className='absolute top-1/2 left-1/2 -translate-x-6 -translate-y-6 bg-black/50 rounded-full p-3'>
								{isPlaying ? (
									<Pause color='white' size={24} />
								) : (
									<Play color='white' size={24} />
								)}
							</View>
						)}
					</Pressable>

					<TouchableOpacity
						onPress={onClose}
						className='absolute top-12 left-4 bg-black/50 p-2 rounded-full'>
						<FontAwesome name='chevron-down' size={20} color='white' />
					</TouchableOpacity>

					<VideoControls
						clipId={clip?.id}
						duration={duration}
						currentTime={position}
						isPlaying={isPlaying}
						globalMute={isMuted}
						onMutePress={() => setIsMuted(!isMuted)}
						onScrub={(_: any, time: number) => {
							player.currentTime = time
						}}

						likes={localLikeCount}
						isLiked={isLiked}
						onLikePress={onLikePress}
					/>

					<LinearGradient
						colors={['transparent', 'rgba(0,0,0,0.9)']}
						className='absolute bottom-0 left-0 right-0 pb-8 pt-16'>
						<View className='px-4'>
							{clip?.car && (
								<Text className='text-white text-base mb-2'>
									{clip.car.year} {clip.car.make} {clip.car.model}
								</Text>
							)}

							<TouchableOpacity
								onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
								activeOpacity={0.9}>
								<Text className='text-white text-lg font-bold mb-5'>
									{clip?.title}
								</Text>
							</TouchableOpacity>
						</View>
					</LinearGradient>
				</Animated.View>
			</GestureDetector>
			</LinearGradient>
		</Modal>
	)
}

export default AutoclipModal
