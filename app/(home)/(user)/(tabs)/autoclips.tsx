import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	Dimensions,
	FlatList,
	Platform,
	StyleSheet,
	ActivityIndicator,
	RefreshControl,
	Animated,
	Alert
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { useTheme } from '@/utils/ThemeContext'

import VideoControls from '@/components/VideoControls'

import { supabase } from '@/utils/supabase'
import { useIsFocused } from '@react-navigation/native'
import { useUser } from '@clerk/clerk-expo'
import { Share, Linking } from 'react-native'
import { formatDistanceToNow } from 'date-fns'
import { LinearGradient } from 'expo-linear-gradient'
import { Heart, Pause, Play } from 'lucide-react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as Network from 'expo-network'
import { Image } from 'expo-image'

const { height, width } = Dimensions.get('window')
const DOUBLE_TAP_DELAY = 300
const TAB_BAR_HEIGHT = 80
const MAX_VIDEO_BUFFER = 3
// Estimated average video chunk size (adjust based on your video data)
const AVG_VIDEO_CHUNK_SIZE_BYTES = 5 * 1024 * 1024 // e.g., 5MB

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

	// Data states
	const [autoClips, setAutoClips] = useState<AutoClip[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [refreshing, setRefreshing] = useState(false)
	const [networkType, setNetworkType] =
		useState<Network.NetworkStateType | null>(null)
	const { user } = useUser()
	const viewTimers = useRef<{ [key: number]: NodeJS.Timeout }>({})
	const viewedClips = useRef<Set<number>>(new Set())

	// UI states
	const [currentVideoIndex, setCurrentVideoIndex] = useState(0)

	// Video control states
	const [isPlaying, setIsPlaying] = useState<VideoState>({})
	const [globalMute, setGlobalMute] = useState(false)
	const [showPlayPauseIcon, setShowPlayPauseIcon] = useState<VideoState>({})

	// Refs and animations
	const videoRefs = useRef<{ [key: number]: React.RefObject<Video> }>({})
	const lastTap = useRef<{ [key: number]: number }>({})
	const flatListRef = useRef<FlatList>(null)
	const heartAnimations = useRef<{ [key: number]: Animated.Value }>({})
	const playPauseAnimations = useRef<{ [key: number]: Animated.Value }>({})

	const viewabilityConfig = useRef({
		itemVisiblePercentThreshold: 50,
		waitForInteraction: true,
		minimumViewTime: 500
	}).current

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
			} catch (error) {
				console.error('Error tracking view:', error)
			}
		},
		[user]
	)

	const initializeClipAnimations = useCallback((clipId: number) => {
		heartAnimations.current[clipId] = new Animated.Value(0)
		playPauseAnimations.current[clipId] = new Animated.Value(0)
	}, [])

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
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load content')
		} finally {
			setIsLoading(false)
		}
	}, [initializeClipAnimations])

	const onRefresh = useCallback(async () => {
		setRefreshing(true)
		await fetchData()
		setRefreshing(false)
	}, [fetchData])

	const [videoProgress, setVideoProgress] = useState<{
		[key: number]: number
	}>({})
	const [videoDuration, setVideoDuration] = useState<{
		[key: number]: number
	}>({})

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

	const handleVideoScrub = useCallback(async (clipId: number, time: number) => {
		const videoRef = videoRefs.current[clipId]?.current
		if (videoRef) {
			try {
				await videoRef.setPositionAsync(time * 1000)
			} catch (error) {
				console.error('Error scrubbing video:', error)
			}
		}
	}, [])

	useEffect(() => {
		const getType = async () => {
			const type: any = await Network.getNetworkStateAsync()
			setNetworkType(type.type)
		}
		getType()
	}, [])

	useEffect(() => {
		return () => {
			Object.values(viewTimers.current).forEach(timer => clearTimeout(timer))
		}
	}, [])

	useEffect(() => {
		fetchData()
	}, [fetchData, user])

	useEffect(() => {
		const resetVideoPlayback = async (ref: React.RefObject<Video>) => {
			try {
				await ref?.current?.pauseAsync()
				await ref?.current?.setPositionAsync(0)
			} catch (error) {
				console.error('Error resetting video playback:', error)
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
			} catch (error) {
				console.error('Error handling video playback:', error)
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
					prev.map((clip: any) => {
						if (clip.id === clipId) {
							const isCurrentlyLiked = clip.liked_users?.includes(user.id)
							const updatedLikedUsers = isCurrentlyLiked
								? clip.liked_users.filter((id: any) => id !== user.id)
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
			} catch (error) {
				console.error('Error toggling like:', error)
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

	const renderClipInfo = useMemo(
		() => (item: any) => {
			const formattedPostDate = getFormattedPostDate(item.created_at)

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
								<Text
									className='text-white/90 text-base leading-6'
									numberOfLines={2}>
									{item.description}
								</Text>
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
										} catch (error) {
											console.error('Error sharing:', error)
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
		[getFormattedPostDate]
	)
	// Function to estimate buffer size based on network type
	const getEstimatedBufferSize = useCallback(
		(networkType: Network.NetworkStateType | null) => {
			switch (networkType) {
				case Network.NetworkStateType.WIFI:
				case Network.NetworkStateType.ETHERNET:
					return 3 * AVG_VIDEO_CHUNK_SIZE_BYTES // Buffer more on fast connections
				case Network.NetworkStateType.CELLULAR:
					return 1.5 * AVG_VIDEO_CHUNK_SIZE_BYTES // Buffer less on cellular
				default:
					return 2 * AVG_VIDEO_CHUNK_SIZE_BYTES // Default buffer size
			}
		},
		[]
	)
	// Preload adjacent videos (optimized with useEffect)
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
									console.log(
										`Preloading video ${clip.id} with estimated buffer size: ${estimatedBufferSize}`
									)
									await ref.current.loadAsync(
										{ uri: clip.video_url },
										{
											shouldPlay: false,
											isMuted: globalMute,
											progressUpdateIntervalMillis:
												networkType === Network.NetworkStateType.CELLULAR
													? 1000
													: 250
											// Add a buffer configuration here if `expo-av` supports it in the future
										},
										false
									)
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
						} catch (error) {
							console.error('Error transitioning video:', error)
						}
					})
				}
			}
		},
		[autoClips, currentVideoIndex, trackClipView]
	)

	// Render clip item (optimized with useCallback)
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
							onLoadStart={async () => {
								if (index === currentVideoIndex) {
									try {
										const ref = videoRefs.current[item.id]?.current
										if (ref) {
											await ref.setPositionAsync(0)
										}
									} catch (error) {
										console.error(
											'Error setting video position on load start:',
											error
										)
									}
								}
							}}
							onLoad={async () => {
								if (index === currentVideoIndex) {
									try {
										const ref = videoRefs.current[item.id]?.current
										if (ref && isPlaying[item.id]) {
											await ref.playAsync()
										}
									} catch (error) {
										console.error('Error playing video on load:', error)
									}
								}
							}}
							rate={1.0}
							volume={1.0}
						/>

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

						{renderVideoControls(item.id)}
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
			renderVideoControls,
			renderClipInfo,
			handlePlaybackStatusUpdate
		]
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

	return (
		<View className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
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
				removeClippedSubviews={true}
				maxToRenderPerBatch={MAX_VIDEO_BUFFER}
				windowSize={MAX_VIDEO_BUFFER * 2 + 1}
			/>
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
		bottom: -80,
		paddingBottom: 0,
		left: 0,
		right: 0,
		backgroundColor: 'rgba(0,0,0,0.3)'
	},
	infoGradient: {
		justifyContent: 'flex-end',
		paddingBottom: 10
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
		marginBottom: 10
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
