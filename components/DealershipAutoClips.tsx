import { supabase } from '@/utils/supabase'
import { useTheme } from '@/utils/ThemeContext'
import { useAuth } from '@/utils/AuthContext'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { formatDistanceToNow } from 'date-fns'
import { VideoState, Video, ResizeMode } from 'expo-av'
import { useLocalSearchParams } from 'expo-router'
import { Play, Pause, Heart, Volume2, VolumeX } from 'lucide-react-native'
import { useState, useRef, useCallback, useEffect } from 'react'
import {
	Animated,
	TouchableOpacity,
	View,
	ActivityIndicator,
	FlatList,
	Modal,
	Text,
	Dimensions,
	StyleSheet
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Image } from 'expo-image'

interface Car {
	id: number
	make: string
	model: string
	year: number
	price: number
	images: string[]
	description: string
	condition: 'New' | 'Used'
	mileage: number
	color: string
	transmission: 'Manual' | 'Automatic'
	drivetrain: 'FWD' | 'RWD' | 'AWD' | '4WD' | '4x4'
}

interface AutoClip {
	id: number
	title: string
	description: string
	video_url: string
	status: 'published' | 'draft'
	car_id: number
	dealership_id: number
	created_at: Date
	car: Car
	views?: number
	likes?: number
	liked_users?: string[]
}

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
	const opacity = new Animated.Value(1)

	useEffect(() => {
		let timeout: string | number | NodeJS.Timeout | undefined
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

	const handleScrubbing = (event: { nativeEvent: { locationX: any } }) => {
		const { locationX } = event.nativeEvent
		const percentage = Math.max(0, Math.min(1, locationX / progressWidth))
		const newTime = percentage * duration
		onScrub(clipId, newTime)
	}

	return (
		<>
			{/* Progress bar at bottom */}
			<Animated.View
				className='absolute bottom-0 left-0 right-0 p-4' // Increased bottom value
				style={{
					opacity,
					zIndex: 60
				}}
				onLayout={e => setProgressWidth(e.nativeEvent.layout.width - 32)}>
				<View className='mb-2'>
					<TouchableOpacity
						className='h-8 justify-center -mt-2'
						onPress={handleScrubbing}
						activeOpacity={1}>
						<View className='h-1 w-full bg-gray-600 rounded-full overflow-hidden'>
							<View
								className='h-full bg-red'
								style={{ width: `${(currentTime / duration) * 100}%` }}
							/>
							<View
								className='absolute top-1/2 -mt-2 h-4 w-4 bg-red rounded-full shadow-lg'
								style={{ left: `${(currentTime / duration) * 100}%` }}
							/>
						</View>
					</TouchableOpacity>

					<View className='flex-row justify-between -mt-3'>
						<Text className='text-white text-xs'>
							{formatTime(currentTime)}
						</Text>
						<Text className='text-white text-xs'>{formatTime(duration)}</Text>
					</View>
				</View>
			</Animated.View>

			{/* Side controls */}
			<View
				className='absolute right-4 bottom-40' // Increased bottom value
				style={{ zIndex: 60 }}>
				<View className='space-y-6'>
					<TouchableOpacity
						onPress={e => onMutePress(clipId, e)}
						className='bg-black/50 p-3 rounded-full'>
						{globalMute ? (
							<VolumeX color='white' size={24} />
						) : (
							<Volume2 color='white' size={24} />
						)}
					</TouchableOpacity>

					<TouchableOpacity
						onPress={() => onLikePress(clipId)}
						className='items-center'>
						<View className='bg-black/50 rounded-full p-3 mb-1'>
							<Heart
								size={24}
								color={isLiked ? '#D55004' : 'white'}
								fill={isLiked ? '#D55004' : 'transparent'}
								strokeWidth={isLiked ? 0.5 : 2}
							/>
						</View>
						<Text className='text-white text-center text-sm font-medium'>
							{likes || 0}
						</Text>
					</TouchableOpacity>
				</View>
			</View>
		</>
	)
}

const { width, height } = Dimensions.get('window')
const DealershipAutoClips = ({ dealershipId }: { dealershipId: number }) => {
	const { t } = useTranslation()
	const [autoClips, setAutoClips] = useState<AutoClip[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [selectedClip, setSelectedClip] = useState<AutoClip | null>(null)
	const [isModalVisible, setIsModalVisible] = useState(false)
	const { isDarkMode } = useTheme()
	const [isPlaying, setIsPlaying] = useState<{ [key: number]: boolean }>({})
	const videoRefs = useRef<{ [key: number]: any }>({})
	const isFocused = useLocalSearchParams()
	const [globalMute, setGlobalMute] = useState(false)
	const { user } = useAuth()
	const [isLiked, setIsLiked] = useState<any>({})
	const [videoProgress, setVideoProgress] = useState<{ [key: number]: number }>(
		{}
	)
	const [videoDuration, setVideoDuration] = useState<{ [key: number]: number }>(
		{}
	)
	const [showPlayPauseIcon, setShowPlayPauseIcon] = useState<any>({})
	const playPauseAnimations = useRef<{ [key: number]: Animated.Value }>({})
	const heartAnimations = useRef<{ [key: number]: Animated.Value }>({})

	const initializeClipAnimations = (clipId: number) => {
		heartAnimations.current[clipId] = new Animated.Value(0)
		playPauseAnimations.current[clipId] = new Animated.Value(0)
	}

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
			setShowPlayPauseIcon((prev: VideoState) => ({ ...prev, [clipId]: true }))

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
				setShowPlayPauseIcon((prev: any) => ({ ...prev, [clipId]: false }))
			})
		} catch (error) {
			console.error('Error handling video playback:', error)
		}
	}

	const handleLikePress = async (clipId: number) => {
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

			// Update local state
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

			// Trigger heart animation
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

	useEffect(() => {
		const fetchDealershipClips = async () => {
			setIsLoading(true)
			try {
				const { data: clipsData, error: clipsError } = await supabase
					.from('auto_clips')
					.select('*,cars(year,make,model,images)')
					.eq('dealership_id', dealershipId)
					.eq('status', 'published')
					.limit(5)

				if (clipsError) throw clipsError
				const processedClips = (clipsData || []).map(clip => {
					initializeClipAnimations(clip.id)
					return {
						...clip,
						car: clip.cars, // Assuming car details are directly included
						liked_users: clip.liked_users || []
					}
				})

				setAutoClips(processedClips)
				console.log(processedClips)
			} catch (error) {
				console.error('Error fetching dealership clips:', error)
			} finally {
				setIsLoading(false)
			}
		}

		if (dealershipId) {
			fetchDealershipClips()
		}
	}, [dealershipId])

	useEffect(() => {
		// Pause all videos when the screen is not focused
		if (!isFocused) {
			Object.values(videoRefs.current).forEach(async ref => {
				try {
					await ref?.pauseAsync()
				} catch (error) {
					console.error('Error pausing video:', error)
				}
			})
		}
	}, [isFocused])

	// Add effect to handle playback when modal visibility changes
	useEffect(() => {
		if (isModalVisible && selectedClip) {
			// Set the clip to play when modal opens
			setIsPlaying(prev => ({ ...prev, [selectedClip.id]: true }))
			
			// Small delay to ensure video ref is established
			const timer = setTimeout(() => {
				const videoRef = videoRefs.current[selectedClip.id]
				if (videoRef) {
					videoRef.playAsync().catch(error => {
						console.error('Error auto-playing video in modal:', error)
					})
				}
			}, 300)
			
			return () => clearTimeout(timer)
		} else if (!isModalVisible) {
			// Pause all videos when modal closes
			Object.entries(isPlaying).forEach(async ([clipId, playing]) => {
				if (playing) {
					const videoRef = videoRefs.current[parseInt(clipId)]
					if (videoRef) {
						try {
							await videoRef.pauseAsync()
							setIsPlaying(prev => ({ ...prev, [parseInt(clipId)]: false }))
						} catch (error) {
							console.error('Error pausing video on modal close:', error)
						}
					}
				}
			})
		}
	}, [isModalVisible, selectedClip])

	const handleClipPress = (clip: AutoClip) => {
		setSelectedClip(clip)
		setIsModalVisible(true)
	}

	const renderItem = ({ item, index }: { item: AutoClip; index: number }) => {
		console.log('ITEM')
		console.log(item)
		return (
			<TouchableOpacity
				onPress={() => handleClipPress(item)}
				style={{
					width: width * 0.45,
					height: 240,
					marginRight: 10,
					borderRadius: 10,
					overflow: 'hidden',
					backgroundColor: isDarkMode ? '#222' : '#f0f0f0'
				}}>
				<Image
					source={{ uri: item.car.images[0] }}
					style={{ width: '100%', height: '100%' }}
					resizeMode='cover'
				/>
				<LinearGradient
					colors={['transparent', 'rgba(0,0,0,0.6)']}
					style={{
						position: 'absolute',
						bottom: 0,
						left: 0,
						right: 0,
						padding: 10,
						zIndex: 1
					}}>
					<Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>
						{item?.car?.year} {item?.car?.make} {item?.car?.model}
					</Text>
				</LinearGradient>
			</TouchableOpacity>
		)
	}

	const renderFullClip = ({ item }: { item: AutoClip }) => (
		<View style={{ height: height, width: width }}>
			<TouchableOpacity
				activeOpacity={1}
				onPress={() => handleVideoPress(item.id)}
				style={{ flex: 1 }}>
				<Video
					ref={ref => (videoRefs.current[item.id] = ref)}
					source={{ uri: item.video_url }}
					style={{ flex: 1 }}
					resizeMode={ResizeMode.COVER}
					shouldPlay={isPlaying[item.id]}
					isLooping
					isMuted={globalMute}
					onPlaybackStatusUpdate={status =>
						handlePlaybackStatusUpdate(status, item.id)
					}
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
				{renderVideoControls(item.id)}
				<View style={styles.modalClipInfoContainer}>
					<LinearGradient
						colors={['transparent', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0.9)']}
						style={{
							position: 'absolute',
							bottom: 0,
							left: 0,
							right: 0,
							padding: 20,
							borderTopLeftRadius: 20,
							borderTopRightRadius: 20
						}}>
						<View style={{ flexDirection: 'row', alignItems: 'center' }}>
							<View style={{ flex: 1 }} className='mb-9'>
								<Text
									style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
									{item?.car?.year} {item?.car?.make} {item?.car?.model}
								</Text>
								<Text style={{ color: 'white', fontSize: 16 }}>
									{item?.description}
								</Text>
								<Text style={{ color: 'white', fontSize: 14, marginTop: 5 }}>
									{getFormattedPostDate(item?.created_at)}
								</Text>
							</View>
						</View>
					</LinearGradient>
				</View>
			</TouchableOpacity>
		</View>
	)

	return (
		<View style={{ marginTop: 20 }}>
			<View className='px-6 mb-4 flex-row items-center justify-between'>
					<Text
						className={`text-xl font-bold ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
						{t('autoclips.auto_clips')}
					</Text>
					</View>
			{isLoading ? (
				<ActivityIndicator
					size='small'
					color={isDarkMode ? 'white' : '#D55004'}
					style={{ marginTop: 20 }}
				/>
			) : autoClips.length > 0 ? (
				<FlatList
					data={autoClips}
					renderItem={renderItem}
					keyExtractor={item => item.id.toString()}
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={{ paddingLeft: 15 }}
				/>
			) : (
				<View className='px-6 mb-4 flex-row items-center justify-between'>
				<Text
					style={{
						color: isDarkMode ? '#E0E0E0' : '#555',
						fontStyle: 'italic'
					}}>
					{t('autoclips.no_clips_available')}
				</Text>
				</View>
			)}

			<Modal
				visible={isModalVisible}
				animationType='slide'
				transparent={false}
				onRequestClose={() => setIsModalVisible(false)}>
				<View
					style={{
						flex: 1,
						backgroundColor: isDarkMode ? '#121212' : 'white'
					}}>
					<TouchableOpacity
						style={{
							position: 'absolute',
							top: 60,
							left: 20,
							zIndex: 10,
							backgroundColor: 'rgba(0, 0, 0, 0.5)',
							padding: 10,
							borderRadius: 20
						}}
						onPress={() => setIsModalVisible(false)}>
						<Ionicons name='close' size={24} color='white' />
					</TouchableOpacity>

					{selectedClip && renderFullClip({ item: selectedClip })}
				</View>
			</Modal>
		</View>
	)
}

export default DealershipAutoClips

const styles = StyleSheet.create({
	container: {
		borderRadius: 16,
		overflow: 'hidden',
		marginBottom: 16
	},
	searchContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 12
	},
	searchInput: {
		flex: 1,
		height: 40,
		backgroundColor: 'rgba(255, 255, 255, 0.2)',
		borderRadius: 20,
		paddingHorizontal: 16,
		paddingRight: 40, // Add space for the cancel button
		marginRight: 8,
		color: '#000'
	},
	cancelButton: {
		position: 'absolute',
		right: 110, // Adjust this value to position the cancel button correctly
		top: 20,
		zIndex: 1
	},
	searchButton: {
		backgroundColor: '#D55004',
		borderRadius: 20,
		padding: 8,
		marginRight: 8
	},
	expandButton: {
		backgroundColor: '#D55004',
		borderRadius: 20,
		padding: 8
	},
	filtersContainer: {
		padding: 12
	},
	filterRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 12
	},
	pickerContainer: {
		flex: 1,
		marginHorizontal: 4
	},
	pickerLabel: {
		fontSize: 14,
		marginBottom: 4,
		color: '#000'
	},
	darkText: {
		color: '#fff'
	},
	clipContainer: {
		width: width * 0.45,
		height: 240,
		marginRight: 10,
		borderRadius: 10,
		overflow: 'hidden',
		backgroundColor: '#f0f0f0'
	},
	video: {
		width: '100%',
		height: '100%'
	},
	clipInfoContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		padding: 10,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		borderBottomLeftRadius: 10,
		borderBottomRightRadius: 10
	},
	clipTitle: {
		color: 'white',
		fontSize: 14,
		fontWeight: 'bold'
	},
	clipDescription: {
		color: '#E0E0E0',
		fontSize: 12
	},
	clipPostDate: {
		color: '#E0E0E0',
		fontSize: 10,
		marginTop: 5
	},
	controlsContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 5
	},
	modalClipInfoContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		padding: 20,
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20
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
	}
})