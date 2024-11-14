import React, { useState, useEffect, useCallback, useRef } from 'react'
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

	const onViewableItemsChanged = useCallback(
		({ viewableItems }: any) => {
			if (viewableItems.length > 0) {
				const visibleClip = viewableItems[0].item
				setCurrentVideoIndex(
					autoClips.findIndex(clip => clip.id === visibleClip.id)
				)

				// Auto-play visible video
				Object.entries(videoRefs.current).forEach(([clipId, ref]) => {
					const shouldPlay = clipId === visibleClip.id.toString()
					if (shouldPlay) {
						ref?.playAsync()
						setIsPlaying(prev => ({ ...prev, [clipId]: true }))
					} else {
						ref?.pauseAsync()
						setIsPlaying(prev => ({ ...prev, [clipId]: false }))
					}
				})
			}
		},
		[autoClips]
	)

	useEffect(() => {
		fetchData()
	}, [])

	// Video playback management
	useEffect(() => {
		if (!isFocused) {
			Object.values(videoRefs.current).forEach(ref => {
				ref?.pauseAsync().catch(console.error)
			})
		} else if (autoClips[currentVideoIndex]) {
			const currentClipId = autoClips[currentVideoIndex].id
			const videoRef = videoRefs.current[currentClipId]
			if (videoRef && isPlaying[currentClipId]) {
				videoRef.playAsync().catch(console.error)
			}
		}

		return () => {
			Object.values(videoRefs.current).forEach(ref => {
				ref?.pauseAsync().catch(console.error)
			})
		}
	}, [isFocused, currentVideoIndex, isPlaying])

	// Video interactions
	const handleVideoPress = async (clipId: number) => {
		const videoRef = videoRefs.current[clipId]
		if (!videoRef) return

		const newPlayingState = !isPlaying[clipId]
		setIsPlaying(prev => ({ ...prev, [clipId]: newPlayingState }))

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

		setTimeout(() => {
			if (newPlayingState) {
				videoRef.playAsync()
			} else {
				videoRef.pauseAsync()
			}
		}, PAUSE_DELAY)
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

	const renderClipInfo = (item: AutoClip) => {
		const animation = infoExpandAnimations.current[item.id]
		const translateY = animation.interpolate({
			inputRange: [0, 1],
			outputRange: [0, -150]
		})

		return (
			<Animated.View
				style={[styles.infoContainer, { transform: [{ translateY }] }]}>
				<View style={styles.dealershipBar}>
					<View style={styles.dealershipInfo}>
						{item.dealership?.logo && (
							<Image
								source={{ uri: item.dealership.logo }}
								style={styles.dealershipLogo}
							/>
						)}
						<Text style={styles.dealershipName}>{item.dealership?.name}</Text>
					</View>
					<TouchableOpacity
						onPress={() => toggleInfoExpand(item.id)}
						style={styles.expandButton}>
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

				<Animated.View
					style={[
						styles.expandableContent,
						{
							opacity: animation
						}
					]}>
					<Text style={styles.title}>{item.title}</Text>
					<Text style={styles.description} numberOfLines={2}>
						{item.description}
					</Text>
					{item.car && (
						<View style={styles.carInfo}>
							<Text style={styles.carName}>
								{item.car.year} {item.car.make} {item.car.model}
							</Text>
							<TouchableOpacity
								style={styles.visitButton}
								onPress={() => {
									setSelectedCar(item.car!)
									setIsModalVisible(true)
								}}>
								<Text style={styles.visitButtonText}>Visit Car</Text>
							</TouchableOpacity>
						</View>
					)}
				</Animated.View>
			</Animated.View>
		)
	}

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
