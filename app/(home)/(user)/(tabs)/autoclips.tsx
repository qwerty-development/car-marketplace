import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	Dimensions,
	FlatList,
	Platform,
	Image,
	StyleSheet,
	ActivityIndicator,
	RefreshControl,
	Animated
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import CarDetailsModalOSclip from '../CarDetailsModalOSclip'
import VideoControls from '@/components/VideoControls'
import CarDetailsModalclip from '../CarDetailsModalclip'
import { supabase } from '@/utils/supabase'
import { useIsFocused } from '@react-navigation/native'
import { formatDistanceToNow } from 'date-fns'
import {
	Volume2,
	VolumeX,
	Heart,
	Pause,
	Play,
	ChevronUp,
	SkipBack,
	SkipForward
} from 'lucide-react-native'
import { Ionicons } from '@expo/vector-icons'

const { height, width } = Dimensions.get('window')
const DOUBLE_TAP_DELAY = 300
const PAUSE_DELAY = 200
const SEEK_INTERVAL = 10000

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
}

interface VideoState {
	[key: number]: boolean
}

export default function AutoClips() {
	const { isDarkMode } = useTheme()
	const isFocused = useIsFocused()

	// Data states
	const [autoClips, setAutoClips] = useState<AutoClip[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [refreshing, setRefreshing] = useState(false)

	const [videoProgress, setVideoProgress] = useState<{ [key: number]: number }>(
		{}
	)
	const [videoDuration, setVideoDuration] = useState<{ [key: number]: number }>(
		{}
	)
	// UI states
	const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
	const [isModalVisible, setIsModalVisible] = useState(false)
	const [selectedCar, setSelectedCar] = useState<Car | null>(null)
	const [expandedInfo, setExpandedInfo] = useState<VideoState>({})

	// Video control states
	const [isPlaying, setIsPlaying] = useState<VideoState>({})
	const [isMuted, setIsMuted] = useState<VideoState>({})
	const [globalMute, setGlobalMute] = useState(false)
	const [isLiked, setIsLiked] = useState<VideoState>({})
	const [showPlayPauseIcon, setShowPlayPauseIcon] = useState<VideoState>({})

	// Refs and animations
	const videoRefs = useRef<{ [key: number]: any }>({})
	const lastTap = useRef<{ [key: number]: number }>({})
	const flatListRef = useRef<FlatList>(null)
	const heartAnimations = useRef<{ [key: number]: Animated.Value }>({})
	const playPauseAnimations = useRef<{ [key: number]: Animated.Value }>({})
	const infoExpandAnimations = useRef<{ [key: number]: Animated.Value }>({})

	const viewabilityConfig = useRef({
		itemVisiblePercentThreshold: 50
	}).current

	const onRefresh = useCallback(async () => {
		setRefreshing(true)
		await fetchData()
		setRefreshing(false)
	}, [])

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
			}
		},
		[]
	)

	const handleVideoScrub = useCallback(async (clipId: number, time: number) => {
		const videoRef = videoRefs.current[clipId]
		if (videoRef) {
			try {
				await videoRef.setPositionAsync(time * 1000)
			} catch (error) {
				console.error('Error scrubbing video:', error)
			}
		}
	}, [])

	// Initialize animations
	const initializeClipAnimations = (clipId: number) => {
		heartAnimations.current[clipId] = new Animated.Value(0)
		playPauseAnimations.current[clipId] = new Animated.Value(0)
		infoExpandAnimations.current[clipId] = new Animated.Value(0)
	}

	// Handle info expand toggle
	const toggleInfoExpand = (clipId: number) => {
		const newState = !expandedInfo[clipId]
		setExpandedInfo(prev => ({ ...prev, [clipId]: newState }))

		Animated.timing(infoExpandAnimations.current[clipId], {
			toValue: newState ? 1 : 0,
			duration: 300,
			useNativeDriver: true
		}).start()
	}

	// Fetch data
	const fetchData = async () => {
		try {
			const { data: clipsData, error: clipsError } = await supabase
				.from('auto_clips')
				.select('*')
				.eq('status', 'published')

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
					dealership: dealershipsById[clip.dealership_id]
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
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load content')
		} finally {
			setIsLoading(false)
		}
	}
	const [videoPositions, setVideoPositions] = useState<{
		[key: number]: number
	}>({})

	const onViewableItemsChanged = useCallback(
		async ({ viewableItems }: any) => {
			if (viewableItems.length > 0) {
				const visibleClip = viewableItems[0].item
				const newIndex = autoClips.findIndex(clip => clip.id === visibleClip.id)

				// Only proceed if we're actually changing videos
				if (newIndex !== currentVideoIndex) {
					setCurrentVideoIndex(newIndex)

					// Handle video transitions
					await Promise.all(
						Object.entries(videoRefs.current).map(async ([clipId, ref]) => {
							const shouldPlay = clipId === visibleClip.id.toString()

							try {
								if (shouldPlay) {
									// For the new video
									await ref?.setPositionAsync(0)
									await ref?.playAsync()
									setIsPlaying(prev => ({ ...prev, [clipId]: true }))
								} else {
									// For other videos
									await ref?.pauseAsync()
									setIsPlaying(prev => ({ ...prev, [clipId]: false }))
								}
							} catch (error) {
								console.error('Error transitioning video:', error)
							}
						})
					)
				}
			}
		},
		[autoClips, currentVideoIndex]
	)

	useEffect(() => {
		fetchData()
	}, [])

	// Video playback management
	useEffect(() => {
		if (!isFocused) {
			Object.entries(videoRefs.current).forEach(async ([clipId, ref]) => {
				try {
					await ref?.pauseAsync()
					await ref?.setPositionAsync(0)
					setVideoPositions(prev => ({ ...prev, [clipId]: 0 }))
				} catch (error) {
					console.error('Error cleaning up video:', error)
				}
			})
		}

		return () => {
			Object.entries(videoRefs.current).forEach(async ([clipId, ref]) => {
				try {
					await ref?.pauseAsync()
					await ref?.setPositionAsync(0)
					setVideoPositions(prev => ({ ...prev, [clipId]: 0 }))
				} catch (error) {
					console.error('Error cleaning up video:', error)
				}
			})
		}
	}, [isFocused])

	// Video interactions
	const handleVideoPress = async (clipId: number) => {
		const videoRef = videoRefs.current[clipId]
		if (!videoRef) return

		const newPlayingState = !isPlaying[clipId]
		setIsPlaying(prev => ({ ...prev, [clipId]: newPlayingState }))

		try {
			if (newPlayingState) {
				await videoRef.playAsync()
			} else {
				await videoRef.pauseAsync()
			}

			// Animate play/pause icon
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
		} catch (error) {
			console.error('Error handling video playback:', error)
		}
	}

	const handleSeek = async (
		clipId: number,
		direction: 'forward' | 'backward'
	) => {
		const videoRef = videoRefs.current[clipId]
		if (!videoRef) return

		try {
			const status: any = await videoRef.getStatusAsync()
			if (!status.isLoaded) return

			const newPosition =
				status.positionMillis +
				(direction === 'forward' ? SEEK_INTERVAL : -SEEK_INTERVAL)
			await videoRef.setPositionAsync(
				Math.max(0, Math.min(newPosition, status.durationMillis))
			)
		} catch (error) {
			console.error('Error seeking video:', error)
		}
	}

	const handleMutePress = async (clipId: number, event: any) => {
		event.stopPropagation()
		const newMuteState = !globalMute
		setGlobalMute(newMuteState)

		// Update all videos' mute state
		Object.values(videoRefs.current).forEach(ref => {
			ref?.setIsMutedAsync(newMuteState)
		})
	}

	const handleDoubleTap = (clipId: number) => {
		const now = Date.now()
		const lastTapTime = lastTap.current[clipId] || 0

		if (now - lastTapTime < DOUBLE_TAP_DELAY) {
			setIsLiked(prev => ({ ...prev, [clipId]: !prev[clipId] }))

			// Heart animation
			const animation = heartAnimations.current[clipId]
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

		lastTap.current[clipId] = now
	}

	const renderVideoControls = useCallback(
		(clipId: number) => (
			<VideoControls
				clipId={clipId}
				duration={videoDuration[clipId] || 0}
				currentTime={videoProgress[clipId] || 0}
				isPlaying={isPlaying[clipId]}
				globalMute={globalMute}
				onMutePress={handleMutePress}
				onScrub={handleVideoScrub}
				videoRef={videoRefs}
			/>
		),
		[videoDuration, videoProgress, isPlaying, globalMute]
	)

	// First, create a memoized function at the component level
	const getFormattedPostDate = useCallback((createdAt: any) => {
		return formatDistanceToNow(new Date(createdAt), { addSuffix: true })
	}, [])

	// Then modify the renderClipInfo function
	const renderClipInfo = (item: AutoClip) => {
		const animation = infoExpandAnimations.current[item.id]
		const translateY = animation.interpolate({
			inputRange: [0, 1],
			outputRange: [0, -150]
		})

		const formattedPostDate = getFormattedPostDate(item.created_at)

		return (
			<Animated.View
				style={[{ transform: [{ translateY }] }]}
				className='absolute bottom-0 left-0 right-0 bg-black/30'>
				{/* Top Bar with Dealership Info and Time */}
				<View className='flex-row items-center justify-between p-4'>
					<View className='flex-row items-center flex-1'>
						{item.dealership?.logo && (
							<Image
								source={{ uri: item.dealership.logo }}
								className='w-10 h-10 rounded-xl mr-3 bg-white/50'
							/>
						)}
						<Text className='text-white text-xl font-semibold flex-1'>
							{item.dealership?.name}
						</Text>
					</View>

					<View className='bg-red/60 rounded-full px-3 py-1 mr-3'>
						<Text className='text-white text-xs font-medium'>
							{formattedPostDate}
						</Text>
					</View>

					<TouchableOpacity
						onPress={() => toggleInfoExpand(item.id)}
						className='w-8 h-8 justify-center items-center bg-black/30 rounded-full'>
						<ChevronUp
							color='white'
							size={24}
							style={{
								transform: [
									{
										rotate: expandedInfo[item.id] ? '180deg' : '0deg'
									}
								]
							}}
						/>
					</TouchableOpacity>
				</View>

				{/* Expandable Content */}
				<Animated.View
					style={{ opacity: animation }}
					className='px-4 pb-4 space-y-3'>
					<Text className='text-white text-lg font-bold'>{item.title}</Text>

					<Text className='text-white text-base' numberOfLines={2}>
						{item.description}
					</Text>

					{item.car && (
						<View className='space-y-2'>
							<Text className='text-red text-lg font-semibold'>
								{item.car.year} {item.car.make} {item.car.model}
							</Text>

							<TouchableOpacity
								className='bg-red self-start rounded-lg px-5 py-2.5 flex-row items-center space-x-2'
								onPress={() => {
									setSelectedCar(item.car!)
									setIsModalVisible(true)
								}}>
								<Text className='text-white font-semibold'>View Details</Text>
								<Ionicons name='arrow-forward' size={18} color='white' />
							</TouchableOpacity>
						</View>
					)}
				</Animated.View>
			</Animated.View>
		)
	}

	useEffect(() => {
		const preloadAdjacentVideos = async () => {
			if (autoClips.length > 0) {
				const prevIndex = Math.max(0, currentVideoIndex - 1)
				const nextIndex = Math.min(autoClips.length - 1, currentVideoIndex + 1)

				for (const index of [prevIndex, nextIndex]) {
					if (index !== currentVideoIndex) {
						const clip = autoClips[index]
						if (clip) {
							try {
								const ref = videoRefs.current[clip.id]
								if (ref) {
									await ref.loadAsync({ uri: clip.video_url }, {}, false)
								}
							} catch (error) {
								console.error('Error preloading video:', error)
							}
						}
					}
				}
			}
		}

		preloadAdjacentVideos()
	}, [currentVideoIndex, autoClips])

	const renderClip = ({ item, index }: { item: AutoClip; index: number }) => (
		<View style={styles.clipContainer}>
			<TouchableOpacity
				activeOpacity={1}
				onPress={() => handleVideoPress(item.id)}
				onLongPress={() => handleDoubleTap(item.id)}
				style={styles.videoContainer}>
				<Video
					ref={ref => (videoRefs.current[item.id] = ref)}
					source={{ uri: item.video_url }}
					style={styles.video}
					resizeMode={ResizeMode.COVER}
					shouldPlay={isPlaying[item.id] && index === currentVideoIndex}
					isLooping
					isMuted={globalMute}
					onPlaybackStatusUpdate={status =>
						handlePlaybackStatusUpdate(status, item.id)
					}
					progressUpdateIntervalMillis={500} // Reduce update frequency
					onLoad={async () => {
						if (index === currentVideoIndex) {
							try {
								const ref = videoRefs.current[item.id]
								if (ref) {
									await ref.setPositionAsync(0)
									if (isPlaying[item.id]) {
										await ref.playAsync()
									}
								}
							} catch (error) {
								console.error('Error loading video:', error)
							}
						}
					}}
				/>

				{renderVideoControls(item.id)}

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
									scale: heartAnimations.current[item.id].interpolate({
										inputRange: [0, 1],
										outputRange: [0.3, 1.2]
									})
								}
							]
						}
					]}>
					<Heart size={80} color='#D55004' fill='#D55004' />
				</Animated.View>
			</TouchableOpacity>

			{renderClipInfo(item)}
		</View>
	)

	// Loading and error states
	if (isLoading) {
		return (
			<View style={styles.centerContainer}>
				<ActivityIndicator size='large' color='#D55004' />
			</View>
		)
	}

	if (error) {
		return (
			<View style={styles.centerContainer}>
				<Text style={styles.errorText}>{error}</Text>
			</View>
		)
	}

	// Main render
	return (
		<View className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
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
			/>

			{Platform.OS === 'ios' ? (
				<CarDetailsModalOSclip
					isVisible={isModalVisible}
					car={selectedCar}
					onClose={() => {
						setIsModalVisible(false)
						setSelectedCar(null)
					}}
					setSelectedCar={setSelectedCar}
					setIsModalVisible={setIsModalVisible}
				/>
			) : (
				<CarDetailsModalclip
					isVisible={isModalVisible}
					car={selectedCar}
					onClose={() => {
						setIsModalVisible(false)
						setSelectedCar(null)
					}}
					setSelectedCar={setSelectedCar}
					setIsModalVisible={setIsModalVisible}
				/>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1
	},
	centerContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center'
	},
	clipContainer: {
		height,
		width
	},
	videoContainer: {
		flex: 1
	},
	video: {
		height: '100%',
		width: '100%'
	},
	controlsContainer: {
		position: 'absolute',
		right: 16,
		bottom: 160,
		alignItems: 'center',
		zIndex: 10
	},
	controlButton: {
		backgroundColor: 'rgba(0,0,0,0.5)',
		padding: 8,
		borderRadius: 20,
		marginVertical: 8
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

	infoContainer: {
		position: 'absolute',
		bottom: -80, // Changed from 0 to TAB_BAR_HEIGHT
		paddingBottom: 0,
		left: 0,
		right: 0,
		backgroundColor: 'rgba(0,0,0,0.3)'
	},
	infoGradient: {
		justifyContent: 'flex-end', // Align content to bottom
		paddingBottom: 10 // Reduced padding
	},
	dealershipBar: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 16,
		marginTop: 16
	},
	dealershipInfo: {
		flexDirection: 'row',
		alignItems: 'center'
	},
	dealershipLogo: {
		width: 40,
		height: 40,
		borderRadius: 16,
		marginRight: 8,
		backgroundColor: 'rgba(255,255,255,0.5)'
	},
	dealershipName: {
		color: 'white',
		fontSize: 20,
		fontWeight: '600'
	},
	expandButton: {
		width: 32,
		height: 32,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: 'rgba(0,0,0,0.3)',
		borderRadius: 16
	},
	expandableContent: {
		marginHorizontal: 20,
		marginTop: 20
	},
	title: {
		color: 'white',
		fontSize: 18,
		fontWeight: 'bold',
		marginBottom: 8
	},
	description: {
		color: '#E0E0E0',
		fontSize: 14,
		marginBottom: 12,
		lineHeight: 20
	},
	carInfo: {
		marginTop: 12
	},
	carName: {
		color: '#D55004',
		fontSize: 16,
		fontWeight: '600',
		marginBottom: 8
	},
	visitButton: {
		backgroundColor: '#D55004',
		paddingHorizontal: 20,
		paddingVertical: 10,
		borderRadius: 8,
		alignSelf: 'flex-start'
	},
	visitButtonText: {
		color: 'white',
		fontSize: 14,
		fontWeight: '600'
	},
	errorText: {
		color: 'red',
		fontSize: 16,
		textAlign: 'center',
		padding: 16
	}
})
