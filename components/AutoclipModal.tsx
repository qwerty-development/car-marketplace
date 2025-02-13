import { useTheme } from '@/utils/ThemeContext'
import { Ionicons } from '@expo/vector-icons'
import { Video, ResizeMode } from 'expo-av'
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
	useAnimatedGestureHandler,
	useAnimatedStyle,
	withSpring,
	runOnJS,
	useSharedValue
} from 'react-native-reanimated'
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
	const videoRef = useRef<any>(null)

	// UI state management
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
	const { isDarkMode } = useTheme()
	const translateY = useSharedValue(0)
	const likeScale = useSharedValue(1)
	const playPauseOpacity = useSharedValue(0)

	// Like state management with immediate feedback
	const [isLiked, setIsLiked] = useState(isLikedInitial)
	const [localLikeCount, setLocalLikeCount] = useState(clip?.likes || 0)

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (videoRef.current) {
				videoRef.current.unloadAsync()
			}
		}
	}, [])

	// Reset states when clip changes
	useEffect(() => {
		setIsLiked(isLikedInitial)
		setLocalLikeCount(clip?.likes || 0)
	}, [isLikedInitial, clip])

	const handlePlaybackStatusUpdate = useCallback(
		(status: {
			isLoaded: any
			positionMillis: number
			durationMillis: number
			didJustFinish: any
			isLooping: any
		}) => {
			if (status.isLoaded) {
				setPosition(status.positionMillis / 1000)
				setDuration(status.durationMillis / 1000)

				// Handle video completion
				if (status.didJustFinish && !status.isLooping) {
					// The video will automatically loop due to isLooping prop
					setPosition(0)
				}
			}
		},
		[]
	)

	// Video play/pause logic
	const handleVideoPress = useCallback(async () => {
		try {
			if (!videoRef.current) return

			const newPlayingState = !isPlaying
			setIsPlaying(newPlayingState)

			if (newPlayingState) {
				await videoRef.current.playAsync()
			} else {
				await videoRef.current.pauseAsync()
			}

			// Show play/pause icon
			setShowPlayPauseIcon(true)
			setTimeout(() => {
				setShowPlayPauseIcon(false)
			}, 500)
		} catch (error) {
			console.error('Error handling video playback:', error)
		}
	}, [isPlaying])

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
	const panGestureEvent = useAnimatedGestureHandler({
		onActive: event => {
			if (event.translationY > 0) {
				translateY.value = event.translationY
			}
		},
		onEnd: event => {
			if (event.translationY > 100) {
				runOnJS(onClose)()
			}
			translateY.value = withSpring(0)
		}
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
				<Animated.View
					style={[{ flex: 1 }, animatedStyle]}
					className={isDarkMode ? 'bg-black' : 'bg-white'}>
					<StatusBar hidden />

					<Pressable onPress={handleVideoPress} style={StyleSheet.absoluteFill}>
						<Video
							ref={videoRef}
							source={{ uri: clip?.video_url }}
							style={StyleSheet.absoluteFill}
							resizeMode={ResizeMode.COVER}
							shouldPlay={isPlaying}
							isLooping={true}
							isMuted={isMuted}
							onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
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
						onScrub={(_: any, time: number) =>
							videoRef.current?.setPositionAsync(time * 1000)
						}
						videoRef={videoRef}
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
			</LinearGradient>
		</Modal>
	)
}

export default AutoclipModal
