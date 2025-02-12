import React, {
	useState,
	useEffect,
	useCallback,
	useRef,
	useMemo
} from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	Dimensions,
	FlatList,
	StyleSheet,
	RefreshControl,
	Animated,
	Alert,
	Share,
	Linking
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { useTheme } from '@/utils/ThemeContext'

import VideoControls from '@/components/VideoControls'
import { supabase } from '@/utils/supabase'
import { useIsFocused } from '@react-navigation/native'
import { useUser } from '@clerk/clerk-expo'
import { formatDistanceToNow } from 'date-fns'
import { LinearGradient } from 'expo-linear-gradient'
import { Heart, Pause, Play } from 'lucide-react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as Network from 'expo-network'
import { Image } from 'expo-image'
import { BlurView } from 'expo-blur'
import SplashScreen from '../SplashScreen'

// --- constants ---
const { height, width } = Dimensions.get('window')
const DOUBLE_TAP_DELAY = 300
const TAB_BAR_HEIGHT = 80
const MAX_VIDEO_BUFFER = 3
const AVG_VIDEO_CHUNK_SIZE_BYTES = 5 * 1024 * 1024 // e.g., 5MB

// Adjust these to taste for your "splashes"
const SPLASH_CIRCLE_SIZE = width * 2 // large enough to cover from a corner
const SPLASH_ANIM_DURATION = 500 // each circle's expand duration
const TEXT_FADE_IN_DURATION = 500
const EXIT_FADE_OUT_DURATION = 600

// --- Interfaces ---
interface Car {
	id: string
	year: number
	make: string
	model: string
}

interface Dealership {
	id: number
	name: string
	logo: string
	phone?: string
}

interface AutoClip {
	id: number
	title: string
	description: string
	video_url: string
	status: 'published' | 'draft'
	car_id: number
	dealership_id: number
	car?: Car
	dealership?: Dealership
	created_at: Date
	views?: number
	likes?: number
	liked_users?: string[]
}

interface VideoState {
	[key: number]: boolean
}

export default function AutoClips() {
	const { isDarkMode } = useTheme()
	const isFocused = useIsFocused()
	const { user } = useUser()

	// ****************************
	// SPLASH SCREEN - ANIMATION LOGIC
	// ****************************
	const [showSplash, setShowSplash] = useState(true)
	const [splashPhase, setSplashPhase] = useState<'entrance' | 'holding' | 'exit'>(
		'entrance'
	)

	/**
	 * "isLoading" indicates whether data is still fetching.
	 * We'll only move to "exit" phase after:
	 *   1) The entrance animation is fully done
	 *   2) And isLoading = false
	 */
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	// We’ll have 3 circles animating for a “splash” effect.
	// Each circle has its own scale + opacity.
	const circleScales = [
		useRef(new Animated.Value(0)).current,
		useRef(new Animated.Value(0)).current,
		useRef(new Animated.Value(0)).current
	]
	const circleOpacities = [
		useRef(new Animated.Value(1)).current,
		useRef(new Animated.Value(1)).current,
		useRef(new Animated.Value(1)).current
	]

	// Text fade-in
	const splashTextOpacity = useRef(new Animated.Value(0)).current

	// Overall container fade-out (for the exit)
	const splashContainerOpacity = useRef(new Animated.Value(1)).current

	// Phase 1: Entrance animation
	useEffect(() => {
		if (splashPhase === 'entrance') {
			/**
			 * Animate circles in sequence (or slight overlap):
			 * 1) Circle 1 from scale 0->1
			 * 2) Circle 2 from 0->1
			 * 3) Circle 3 from 0->1
			 * Then fade in the text
			 */
			Animated.sequence([
				Animated.timing(circleScales[0], {
					toValue: 1,
					duration: SPLASH_ANIM_DURATION,
					useNativeDriver: true
				}),
				Animated.timing(circleScales[1], {
					toValue: 1,
					duration: SPLASH_ANIM_DURATION,
					useNativeDriver: true
				}),
				Animated.timing(circleScales[2], {
					toValue: 1,
					duration: SPLASH_ANIM_DURATION,
					useNativeDriver: true
				}),
				Animated.timing(splashTextOpacity, {
					toValue: 1,
					duration: TEXT_FADE_IN_DURATION,
					useNativeDriver: true
				})
			]).start(() => {
				// When entrance finishes, transition to "holding"
				setSplashPhase('holding')
			})
		}
	}, [splashPhase])

	// Phase 2: Exit animation
	// We only start the exit once:
	//   - Phase is "holding" (entrance done)
	//   - AND isLoading is false
	useEffect(() => {
		if (splashPhase === 'holding' && !isLoading) {
			setSplashPhase('exit')

			// Now fade out the entire container
			Animated.timing(splashContainerOpacity, {
				toValue: 0,
				duration: EXIT_FADE_OUT_DURATION,
				useNativeDriver: true
			}).start(() => {
				setShowSplash(false)
			})
		}
	}, [splashPhase, isLoading])

	// ****************************
	// NETWORK, DATA, AND VIDEO STATES
	// ****************************
	const [refreshing, setRefreshing] = useState(false)
	const [networkType, setNetworkType] =
		useState<Network.NetworkStateType | null>(null)

	const [autoClips, setAutoClips] = useState<AutoClip[]>([])
	const viewedClips = useRef<Set<number>>(new Set())

	const [expandedDescriptions, setExpandedDescriptions] = useState<{
		[key: number]: boolean
	}>({})

	// Track which videos are playing
	const [isPlaying, setIsPlaying] = useState<VideoState>({})
	const [globalMute, setGlobalMute] = useState(false)
	const [showPlayPauseIcon, setShowPlayPauseIcon] = useState<VideoState>({})
	const [videoLoading, setVideoLoading] = useState<{ [key: number]: boolean }>(
		{}
	)

	// Timers/refs
	const viewTimers = useRef<{ [key: number]: NodeJS.Timeout }>({})
	const lastTap = useRef<{ [key: number]: number }>({})
	const flatListRef = useRef<FlatList>(null)
	const heartAnimations = useRef<{ [key: number]: Animated.Value }>({})
	const playPauseAnimations = useRef<{ [key: number]: Animated.Value }>({})
	const videoRefs = useRef<{ [key: number]: React.RefObject<Video> }>({})
	const [currentVideoIndex, setCurrentVideoIndex] = useState(0)

	const viewabilityConfig = useRef({
		itemVisiblePercentThreshold: 50,
		waitForInteraction: true,
		minimumViewTime: 500
	}).current

	// Track playback progress/duration
	const [videoProgress, setVideoProgress] = useState<{ [key: number]: number }>(
		{}
	)
	const [videoDuration, setVideoDuration] = useState<{ [key: number]: number }>(
		{}
	)

	// ***************
	// FETCH / DATA LOGIC
	// ***************
	const initializeClipAnimations = useCallback((clipId: number) => {
		heartAnimations.current[clipId] = new Animated.Value(0)
		playPauseAnimations.current[clipId] = new Animated.Value(0)
	}, [])

	const trackClipView = useCallback(
		async (clipId: number) => {
			if (!user || viewedClips.current.has(clipId)) return
			try {
				await supabase.rpc('track_autoclip_view', {
					clip_id: clipId,
					user_id: user.id
				})
				viewedClips.current.add(clipId)

				setAutoClips(prev =>
					prev.map(clip =>
						clip.id === clipId
							? { ...clip, views: (clip.views || 0) + 1 }
							: clip
					)
				)
			} catch (err) {
				console.error('Error tracking view:', err)
			}
		},
		[user]
	)

	const fetchData = useCallback(async () => {
		setIsLoading(true)
		try {
			const { data: clipsData, error: clipsError } = await supabase
				.from('auto_clips')
				.select('*,liked_users')
				.eq('status', 'published')
				.order('created_at', { ascending: false })

			if (clipsError) throw clipsError

			const carIds = clipsData?.map(clip => clip.car_id) || []
			const dealershipIds = clipsData?.map(clip => clip.dealership_id) || []

			const [carsResponse, dealershipsResponse] = await Promise.all([
				supabase.from('cars').select('*').in('id', carIds),
				supabase.from('dealerships').select('*').in('id', dealershipIds)
			])

			const carsById = (carsResponse.data || []).reduce(
				(acc, car) => ({
					...acc,
					[car.id]: car
				}),
				{}
			)

			const dealershipsById = (dealershipsResponse.data || []).reduce(
				(acc, dealer) => ({
					...acc,
					[dealer.id]: dealer
				}),
				{}
			)

			const mergedClips = (clipsData || []).map(clip => {
				initializeClipAnimations(clip.id)
				return {
					...clip,
					car: carsById[clip.car_id],
					dealership: dealershipsById[clip.dealership_id],
					liked_users: clip.liked_users || []
				}
			})

			setAutoClips(mergedClips)
			setIsPlaying(
				mergedClips.reduce(
					(acc, clip, index) => ({
						...acc,
						[clip.id]: index === 0
					}),
					{}
				)
			)
		} catch (err: any) {
			setError(err?.message || 'Failed to load content')
		} finally {
			setIsLoading(false)
		}
	}, [initializeClipAnimations])

	const onRefresh = useCallback(async () => {
		setRefreshing(true)
		await fetchData()
		setRefreshing(false)
	}, [fetchData])

	const handlePlaybackStatusUpdate = useCallback(
		(status: any, clipId: number) => {
			if (status.isLoaded) {
				setVideoProgress(prev => ({
					...prev,
					[clipId]: status.positionMillis / 1000
				}))
				setVideoDuration(prev => ({
					...prev,
					[clipId]: status.durationMillis / 1000
				}))

				if (
					status.didJustFinish &&
					!status.isLooping &&
					currentVideoIndex < autoClips.length - 1
				) {
					flatListRef.current?.scrollToIndex({
						index: currentVideoIndex + 1,
						animated: true
					})
				}
			}
		},
		[currentVideoIndex, autoClips.length]
	)

	const handleVideoScrub = useCallback(
		async (clipId: number, time: number) => {
			const videoRef = videoRefs.current[clipId]?.current
			if (videoRef) {
				try {
					await videoRef.setPositionAsync(time * 1000)
				} catch (err) {
					console.error('Error scrubbing video:', err)
				}
			}
		},
		[]
	)

	// Check network type
	useEffect(() => {
		const getType = async () => {
			const type: any = await Network.getNetworkStateAsync()
			setNetworkType(type.type)
		}
		getType()
	}, [])

	// Cleanup timers on unmount
	useEffect(() => {
		return () => {
			Object.values(viewTimers.current).forEach(timer => clearTimeout(timer))
		}
	}, [])

	// Fetch data on mount
	useEffect(() => {
		fetchData()
	}, [fetchData, user])

	// Pause all videos if the tab is not focused
	useEffect(() => {
		const resetVideoPlayback = async (ref: React.RefObject<Video>) => {
			try {
				await ref?.current?.pauseAsync()
				await ref?.current?.setPositionAsync(0)
			} catch (err) {
				console.error('Error resetting video playback:', err)
			}
		}
		if (!isFocused) {
			Object.values(videoRefs.current).forEach(resetVideoPlayback)
			setVideoProgress({})
			setVideoDuration({})
		}
		return () => {
			Object.values(videoRefs.current).forEach(resetVideoPlayback)
			setVideoProgress({})
			setVideoDuration({})
		}
	}, [isFocused])

	// ****************************
	// VIDEO TAP / LIKE / MUTE LOGIC
	// ****************************
	const handleVideoPress = useCallback(
		async (clipId: number) => {
			const videoRef = videoRefs.current[clipId]?.current
			if (!videoRef) return

			const newPlayingState = !isPlaying[clipId]
			setIsPlaying(prev => ({ ...prev, [clipId]: newPlayingState }))

			try {
				if (newPlayingState) {
					await videoRef.playAsync()
					viewTimers.current[currentVideoIndex] = setTimeout(() => {
						trackClipView(clipId)
					}, 5000)
				} else {
					await videoRef.pauseAsync()
					if (viewTimers.current[currentVideoIndex]) {
						clearTimeout(viewTimers.current[currentVideoIndex])
					}
				}

				const animation = playPauseAnimations.current[clipId]
				setShowPlayPauseIcon(prev => ({ ...prev, [clipId]: true }))

				Animated.sequence([
					Animated.timing(animation, {
						toValue: 1,
						duration: 200,
						useNativeDriver: true
					}),
					Animated.timing(animation, {
						toValue: 0,
						duration: 200,
						delay: 500,
						useNativeDriver: true
					})
				]).start(() => {
					setShowPlayPauseIcon(prev => ({ ...prev, [clipId]: false }))
				})
			} catch (err) {
				console.error('Error handling video playback:', err)
			}
		},
		[currentVideoIndex, isPlaying, trackClipView]
	)

	const handleLikePress = useCallback(
		async (clipId: number) => {
			if (!user) return
			try {
				const { data: newLikesCount, error } = await supabase.rpc(
					'toggle_autoclip_like',
					{
						clip_id: clipId,
						user_id: user.id
					}
				)
				if (error) throw error

				setAutoClips(prev =>
					prev.map(clip => {
						if (clip.id === clipId) {
							const isCurrentlyLiked = clip.liked_users?.includes(user.id)
							const updatedLikedUsers = isCurrentlyLiked
								? clip.liked_users.filter(id => id !== user.id)
								: [...(clip.liked_users || []), user.id]

							return {
								...clip,
								likes: newLikesCount,
								liked_users: updatedLikedUsers
							}
						}
						return clip
					})
				)

				// Heart animation
				const animation = heartAnimations.current[clipId]
				if (animation) {
					animation.setValue(0)
					Animated.sequence([
						Animated.spring(animation, {
							toValue: 1,
							useNativeDriver: true,
							damping: 15
						}),
						Animated.timing(animation, {
							toValue: 0,
							duration: 100,
							delay: 500,
							useNativeDriver: true
						})
					]).start()
				}
			} catch (err) {
				console.error('Error toggling like:', err)
			}
		},
		[user]
	)

	const handleMutePress = useCallback(
		async (clipId: number, event: any) => {
			event.stopPropagation()
			const newMuteState = !globalMute
			setGlobalMute(newMuteState)

			Object.values(videoRefs.current).forEach(ref => {
				ref?.current?.setIsMutedAsync(newMuteState)
			})
		},
		[globalMute]
	)

	const handleDoubleTap = useCallback(
		async (clipId: number) => {
			const now = Date.now()
			const lastTapTime = lastTap.current[clipId] || 0

			if (now - lastTapTime < DOUBLE_TAP_DELAY) {
				const clip = autoClips.find(c => c.id === clipId)
				if (clip && !clip.liked_users?.includes(user?.id || '')) {
					await handleLikePress(clipId)
				}
			}
			lastTap.current[clipId] = now
		},
		[autoClips, handleLikePress, user?.id]
	)

	// ****************************
	// RENDER HELPERS
	// ****************************
	const renderVideoControls = useCallback(
		(clipId: number) => {
			const clip = autoClips.find(c => c.id === clipId)
			const isLiked = clip?.liked_users?.includes(user?.id || '') || false

			return (
				<VideoControls
					clipId={clipId}
					duration={videoDuration[clipId] || 0}
					currentTime={videoProgress[clipId] || 0}
					isPlaying={isPlaying[clipId]}
					globalMute={globalMute}
					onMutePress={handleMutePress}
					onScrub={handleVideoScrub}
					videoRef={videoRefs}
					likes={clip?.likes || 0}
					isLiked={isLiked}
					onLikePress={handleLikePress}
				/>
			)
		},
		[
			autoClips,
			videoDuration,
			videoProgress,
			isPlaying,
			globalMute,
			user?.id,
			handleMutePress,
			handleVideoScrub,
			handleLikePress
		]
	)

	const getFormattedPostDate = useCallback((createdAt: any) => {
		return formatDistanceToNow(new Date(createdAt), { addSuffix: true })
	}, [])

	const [truncatedTextMap, setTruncatedTextMap] = useState<{
		[key: number]: boolean
	}>({})

	const renderClipInfo = useMemo(
		() => (item: AutoClip) => {
			const formattedPostDate = getFormattedPostDate(item.created_at)
			const isDescriptionExpanded = expandedDescriptions[item.id] || false
			const shouldShowExpandOption =
				item.description && item.description.length > 80

			return (
				<View className='absolute bottom-0 left-0 right-0 mb-8'>
					<LinearGradient
						colors={['transparent', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0.9)']}
						className='p-5 rounded-t-3xl pb-16 -mb-8'
						style={{ zIndex: 50 }}>
						<View className='flex-row items-center justify-between mb-1'>
							<View className='flex-row items-center flex-1'>
								{item.dealership?.logo && (
									<Image
										source={{
											uri: item.dealership.logo
										}}
										className='w-12 h-12 rounded-xl mr-3 bg-white/50'
									/>
								)}
								<View className='flex-1'>
									<Text className='text-white text-lg font-bold'>
										{item.dealership?.name}
									</Text>
									<View className='flex-row items-center'>
										<Text className='text-red text-sm'>
											{formattedPostDate}
										</Text>
									</View>
								</View>
							</View>
						</View>

						{item.car && (
							<View className='mb-1 flex'>
								<Text className='text-red text-xl font-bold'>
									{item.car.year} {item.car.make} {item.car.model}
								</Text>
								<View className='flex-row items-center mt-1'></View>
							</View>
						)}

						{item.description && (
							<View className='mb-1'>
								<TouchableOpacity
									onPress={() => {
										setExpandedDescriptions(prev => ({
											...prev,
											[item.id]: !prev[item.id]
										}))
									}}
									activeOpacity={0.9}>
									<Text
										className='text-white/90 text-base leading-6'
										numberOfLines={isDescriptionExpanded ? undefined : 2}>
										{item.description}
										{shouldShowExpandOption && (
											<Text className='text-red'>
												{' '}
												{isDescriptionExpanded ? 'Read less' : '... Read more'}
											</Text>
										)}
									</Text>
								</TouchableOpacity>
							</View>
						)}

						{item.car && (
							<View className='flex-row items-center space-x-3'>
								<TouchableOpacity
									className='flex-1 bg-red py-2 px-4 rounded-xl flex-row items-center justify-center'
									onPress={() => {
										router.push({
											pathname: '/(home)/(user)/CarDetails',
											params: {
												carId: item.car.id
											}
										})
									}}>
									<Text className='text-white font-semibold mr-2'>
										View Details
									</Text>
									<Ionicons name='arrow-forward' size={18} color='white' />
								</TouchableOpacity>

								<TouchableOpacity
									className='bg-white/10 p-2 rounded-xl'
									onPress={async () => {
										try {
											await Share.share({
												message: `Check out this ${item.car.year} ${
													item.car.make
												} ${item.car.model} on [Your App Name]!\n\n${
													item.description || ''
												}`
											})
										} catch (err) {
											console.error('Error sharing:', err)
										}
									}}>
									<Ionicons name='share-social' size={24} color='white' />
								</TouchableOpacity>

								<TouchableOpacity
									className='bg-white/10 p-2 rounded-xl'
									onPress={() => {
										if (item.dealership?.phone) {
											Linking.openURL(`tel:${item.dealership.phone}`)
										} else {
											Alert.alert('Contact', 'Phone number not available')
										}
									}}>
									<Ionicons name='call' size={24} color='white' />
								</TouchableOpacity>
							</View>
						)}
					</LinearGradient>
				</View>
			)
		},
		[getFormattedPostDate, expandedDescriptions]
	)

	const getEstimatedBufferSize = useCallback(
		(networkType: Network.NetworkStateType | null) => {
			switch (networkType) {
				case Network.NetworkStateType.WIFI:
				case Network.NetworkStateType.ETHERNET:
					return 3 * AVG_VIDEO_CHUNK_SIZE_BYTES
				case Network.NetworkStateType.CELLULAR:
					return 1.5 * AVG_VIDEO_CHUNK_SIZE_BYTES
				default:
					return 2 * AVG_VIDEO_CHUNK_SIZE_BYTES
			}
		},
		[]
	)

	// Preload adjacent videos
	useEffect(() => {
		const preloadAdjacentVideos = async () => {
			if (autoClips.length > 0) {
				const visibleIndexes = [
					Math.max(0, currentVideoIndex - 1),
					currentVideoIndex,
					Math.min(autoClips.length - 1, currentVideoIndex + 1)
				]
				const estimatedBufferSize = getEstimatedBufferSize(networkType)

				for (const index of visibleIndexes) {
					const clip = autoClips[index]
					if (clip) {
						const ref = videoRefs.current[clip.id]
						if (ref && ref.current) {
							try {
								const status = await ref.current.getStatusAsync()
								if (!status.isLoaded) {
									await ref.current.loadAsync(
										{ uri: clip.video_url },
										{
											shouldPlay: false,
											isMuted: globalMute,
											progressUpdateIntervalMillis:
												networkType === Network.NetworkStateType.CELLULAR
													? 1000
													: 250
										},
										false
									)
								}
							} catch (err) {
								console.error('Error preloading video:', err)
							}
						}
					}
				}
			}
		}

		preloadAdjacentVideos()
	}, [
		currentVideoIndex,
		autoClips,
		globalMute,
		networkType,
		getEstimatedBufferSize
	])

	const onViewableItemsChanged = useCallback(
		({ viewableItems }: any) => {
			if (viewableItems.length > 0) {
				const visibleClip = viewableItems[0].item
				const newIndex = autoClips.findIndex(clip => clip.id === visibleClip.id)

				if (newIndex !== currentVideoIndex) {
					// Clear any existing view timer for the old index
					if (viewTimers.current[currentVideoIndex]) {
						clearTimeout(viewTimers.current[currentVideoIndex])
					}

					setCurrentVideoIndex(newIndex)

					// Set new view timer for the new index
					viewTimers.current[newIndex] = setTimeout(() => {
						trackClipView(visibleClip.id)
					}, 5000)

					// Handle video transitions
					Object.entries(videoRefs.current).forEach(async ([clipId, ref]) => {
						const shouldPlay = clipId === visibleClip.id.toString()
						try {
							if (shouldPlay) {
								await ref?.current?.setPositionAsync(0)
								await ref?.current?.playAsync()
								setIsPlaying(prev => ({ ...prev, [clipId]: true }))
							} else {
								await ref?.current?.pauseAsync()
								setIsPlaying(prev => ({ ...prev, [clipId]: false }))
							}
						} catch (err) {
							console.error('Error transitioning video:', err)
						}
					})
				}
			}
		},
		[autoClips, currentVideoIndex, trackClipView]
	)

	const handleSplashFinish = () => {
		console.log("Splash has finished!")
		// If you no longer track showSplash, do nothing else
	  }

	const renderClip = useCallback(
		({ item, index }: { item: AutoClip; index: number }) => {
			if (!videoRefs.current[item.id]) {
				videoRefs.current[item.id] = React.createRef()
			}
			return (
				<View className='h-screen w-screen' key={`clip-${item.id}`}>
					<TouchableOpacity
						activeOpacity={1}
						onPress={() => handleVideoPress(item.id)}
						onLongPress={() => handleDoubleTap(item.id)}
						style={{ flex: 1 }}>
						<Video
							ref={videoRefs.current[item.id]}
							source={{ uri: item.video_url }}
							style={{ flex: 1 }}
							resizeMode={ResizeMode.COVER}
							shouldPlay={isPlaying[item.id] && index === currentVideoIndex}
							isLooping
							isMuted={globalMute}
							onPlaybackStatusUpdate={status =>
								handlePlaybackStatusUpdate(status, item.id)
							}
							progressUpdateIntervalMillis={
								networkType === Network.NetworkStateType.CELLULAR ? 1000 : 250
							}
							onLoadStart={() => {
								setVideoLoading(prev => ({ ...prev, [item.id]: true }))
							}}
							onLoad={async () => {
								setVideoLoading(prev => ({ ...prev, [item.id]: false }))
								if (index === currentVideoIndex) {
									try {
										const ref = videoRefs.current[item.id]?.current
										if (ref && isPlaying[item.id]) {
											await ref.playAsync()
										}
									} catch (err) {
										console.error('Error playing video on load:', err)
									}
								}
							}}
							rate={1.0}
							volume={1.0}
						/>

						{/* Blur loader while the video is still loading */}
						{videoLoading[item.id] && (
							<BlurView
								style={StyleSheet.absoluteFill}
								intensity={60}
								tint={isDarkMode ? 'dark' : 'light'}>
								<View className='flex-1 items-center justify-center'>
									<Animated.ActivityIndicator size='small' color='#D55004' />
								</View>
							</BlurView>
						)}

						{/* Play/Pause Icon Animation */}
						{showPlayPauseIcon[item.id] && (
							<Animated.View
								style={[
									styles.playPauseIcon,
									{ opacity: playPauseAnimations.current[item.id] }
								]}>
								{isPlaying[item.id] ? (
									<Play color='white' size={50} />
								) : (
									<Pause color='white' size={50} />
								)}
							</Animated.View>
						)}

						{/* Heart Animation */}
						<Animated.View
							style={[
								styles.heartAnimation,
								{
									opacity: heartAnimations.current[item.id],
									transform: [
										{
											scale: heartAnimations.current[item.id]?.interpolate({
												inputRange: [0, 1],
												outputRange: [0.3, 1.2]
											})
										}
									],
									zIndex: 70
								}
							]}>
							<Heart size={80} color='#D55004' fill='#D55004' />
						</Animated.View>

						{/* Video Controls */}
						{renderVideoControls(item.id)}

						{/* Info Overlay */}
						{renderClipInfo(item)}
					</TouchableOpacity>
				</View>
			)
		},
		[
			handleVideoPress,
			handleDoubleTap,
			isPlaying,
			currentVideoIndex,
			globalMute,
			networkType,
			showPlayPauseIcon,
			videoLoading,
			renderVideoControls,
			renderClipInfo,
			handlePlaybackStatusUpdate,
			isDarkMode
		]
	)

	// *******************
	// ERROR STATE CHECK
	// *******************
	if (error) {
		return (
			<View style={styles.centerContainer}>
				<Text style={styles.errorText}>{error}</Text>
			</View>
		)
	}

	// *******************
	// MAIN RENDER
	// *******************
	return (
		<View className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
			{/**
			 * SPLASH SCREEN: Only render if showSplash = true
			 */}
			      <SplashScreen
        isDarkMode={isDarkMode}
        isLoading={isLoading}
        onSplashFinish={handleSplashFinish}
      />

			{/* Your actual content behind the splash */}
			<TouchableOpacity
				className='absolute top-12 left-4 z-50 bg-black/60 p-2 rounded-full backdrop-blur-md'
				onPress={() => router.back()}
				style={{ elevation: 5 }}>
				<Ionicons name='chevron-back' size={24} color='white' />
			</TouchableOpacity>

			<FlatList
				ref={flatListRef}
				data={autoClips}
				renderItem={renderClip}
				keyExtractor={item => item.id.toString()}
				pagingEnabled
				showsVerticalScrollIndicator={false}
				onViewableItemsChanged={onViewableItemsChanged}
				viewabilityConfig={viewabilityConfig}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						tintColor={isDarkMode ? '#FFFFFF' : '#D55004'}
					/>
				}
				contentContainerStyle={{
					paddingBottom: TAB_BAR_HEIGHT
				}}
				removeClippedSubviews
				maxToRenderPerBatch={MAX_VIDEO_BUFFER}
				windowSize={MAX_VIDEO_BUFFER * 2 + 1}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	centerContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center'
	},
	errorText: {
		color: 'red',
		fontSize: 16,
		textAlign: 'center',
		padding: 16
	},
	playPauseIcon: {
		position: 'absolute',
		top: '50%',
		left: '50%',
		transform: [{ translateX: -25 }, { translateY: -25 }],
		backgroundColor: 'rgba(0,0,0,0.5)',
		borderRadius: 30,
		padding: 10,
		zIndex: 10
	},
	heartAnimation: {
		position: 'absolute',
		top: '50%',
		left: '50%',
		transform: [{ translateX: -40 }, { translateY: -40 }],
		zIndex: 11
	},

	// SPLASH STYLES
	splashContainer: {
		...StyleSheet.absoluteFillObject,
		justifyContent: 'center',
		alignItems: 'center',
		zIndex: 9999,
		backgroundColor: '#fff' // default for light mode
	},
	splashCircle: {
		position: 'absolute',
		width: SPLASH_CIRCLE_SIZE,
		height: SPLASH_CIRCLE_SIZE,
		borderRadius: SPLASH_CIRCLE_SIZE / 2
	},
	splashText: {
		fontSize: 28,
		fontWeight: 'bold'
	}
})
