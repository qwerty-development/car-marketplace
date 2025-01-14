import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	Alert,
	Modal,
	ScrollView,
	TextInput,
	ActivityIndicator,
	Platform,
	KeyboardAvoidingView,
	Dimensions
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FontAwesome, Ionicons } from '@expo/vector-icons'
import VideoPickerButton from './VideoPickerComponent'
import CarSelector from './CarSelector'
import { ResizeMode, Video, AVPlaybackStatus } from 'expo-av'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import * as FileSystem from 'expo-file-system'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const MAX_VIDEO_SIZE = 50 * 1024 * 1024 // 100MB
const ALLOWED_VIDEO_TYPES = ['mp4', 'mov', 'quicktime']
const MAX_VIDEO_DURATION = 20 // seconds

interface CreateAutoClipModalProps {
	isVisible: boolean
	onClose: () => void
	dealership: { id: number } | null
	onSuccess: () => void
}

interface VideoAsset {
	uri: string
	width: number
	height: number
	duration: number
	type?: string
	fileSize?: number
	originalDuration?: number
}

interface Car {
	id: number
	make: string
	model: string
	year: number
	price: number
	status: 'available' | 'pending' | 'sold'
}

export default function CreateAutoClipModal({
	isVisible,
	onClose,
	dealership,
	onSuccess
}: CreateAutoClipModalProps) {
	const { isDarkMode } = useTheme()
	const [title, setTitle] = useState('')
	const [description, setDescription] = useState('')
	const [selectedCarId, setSelectedCarId] = useState<number | null>(null)
	const [video, setVideo] = useState<VideoAsset | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [uploadProgress, setUploadProgress] = useState(0)
	const [cars, setCars] = useState<Car[]>([])
	const [videoError, setVideoError] = useState<string | null>(null)
	const [isVideoPlaying, setIsVideoPlaying] = useState(false)
	const videoRef = React.useRef<Video>(null)

	// Form validation states
	const [titleError, setTitleError] = useState('')
	const [descriptionError, setDescriptionError] = useState('')
	const [carError, setCarError] = useState('')

	useEffect(() => {
		if (dealership && isVisible) {
			fetchCars()
			return () => {
				// Cleanup on modal close
				setVideo(null)
				resetForm()
				if (videoRef.current) {
					videoRef.current.unloadAsync()
				}
			}
		}
	}, [dealership, isVisible])

	const validateForm = useCallback(() => {
		let isValid = true

		if (!title.trim()) {
			setTitleError('Title is required')
			isValid = false
		} else if (title.length < 3) {
			setTitleError('Title must be at least 3 characters')
			isValid = false
		} else {
			setTitleError('')
		}

		if (description && description.length < 10) {
			setDescriptionError('Description must be at least 10 characters')
			isValid = false
		} else {
			setDescriptionError('')
		}

		if (!selectedCarId) {
			setCarError('Please select a car')
			isValid = false
		} else {
			setCarError('')
		}

		if (!video) {
			setVideoError('Please select a video')
			isValid = false
		}

		return isValid
	}, [title, description, selectedCarId, video])

	const fetchCars = async () => {
		try {
			setIsLoading(true)
			const { data, error } = await supabase
				.from('cars')
				.select('id, make, model, year, price, status')
				.eq('dealership_id', dealership!.id)
				.in('status', ['available', 'pending'])
				.order('listed_at', { ascending: false })

			if (error) throw error
			setCars(data || [])
		} catch (error) {
			console.error('Error fetching cars:', error)
			Alert.alert('Error', 'Failed to load cars')
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
		} finally {
			setIsLoading(false)
		}
	}

	const handleVideoSelect = useCallback(async (videoAsset: VideoAsset) => {
		try {
			setVideoError(null)

			// Validate video size
			if (videoAsset.fileSize && videoAsset.fileSize > MAX_VIDEO_SIZE) {
				throw new Error('Video size must be less than 100MB')
			}

			// Validate video type
			const fileExtension = videoAsset.uri.split('.').pop()?.toLowerCase()
			if (!fileExtension || !ALLOWED_VIDEO_TYPES.includes(fileExtension)) {
				throw new Error('Invalid video format. Please use MP4 or MOV files')
			}

			if (
				videoAsset.originalDuration &&
				videoAsset.originalDuration > MAX_VIDEO_DURATION * 1000
			) {
				throw new Error(
					`Video duration must be ${MAX_VIDEO_DURATION} seconds or less`
				)
			}

			setVideo(videoAsset)
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
		} catch (error: any) {
			setVideoError(error.message)
			setVideo(null)
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
			Alert.alert('Video Error', error.message)
		}
	}, [])

	const handleSubmit = async () => {
		try {
			if (!validateForm()) {
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
				return
			}

			setIsLoading(true)
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

			const fileUri = video!.uri
			const isMovFile = fileUri.toLowerCase().endsWith('.mov')
			const fileExtension = isMovFile ? 'mov' : 'mp4'

			const timestamp = Date.now()
			const random = Math.floor(Math.random() * 10000)
			const fileName = `${timestamp}_${random}.${fileExtension}`
			const filePath = `${dealership!.id}/${fileName}`

			// Upload progress handler
			const progressHandler = (progress: number) => {
				setUploadProgress(Math.round(progress * 100))
			}

			// Upload video
			const { error: uploadError } = await supabase.storage
				.from('autoclips')
				.upload(
					filePath,
					{
						uri: fileUri,
						type: isMovFile ? 'video/quicktime' : 'video/mp4',
						name: fileName
					},
					{
						onProgress: progressHandler
					}
				)

			if (uploadError) throw uploadError

			const {
				data: { publicUrl }
			} = supabase.storage.from('autoclips').getPublicUrl(filePath)

			// Create database entry
			const { error: dbError } = await supabase.from('auto_clips').insert({
				dealership_id: dealership!.id,
				car_id: selectedCarId,
				title: title.trim(),
				description: description.trim(),
				video_url: publicUrl,
				thumbnail_url: publicUrl,
				status: 'published',
				views: 0,
				likes: 0,
				viewed_users: [],
				liked_users: [],
				published_at: new Date().toISOString()
			})

			if (dbError) throw dbError

			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
			Alert.alert('Success', 'AutoClip created successfully')
			onSuccess()
			onClose()
			resetForm()
		} catch (error: any) {
			console.error('Error:', error)
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
			Alert.alert('Error', error.message || 'Failed to create AutoClip')
		} finally {
			setIsLoading(false)
			setUploadProgress(0)
		}
	}

	const resetForm = useCallback(() => {
		setTitle('')
		setDescription('')
		setSelectedCarId(null)
		setVideo(null)
		setVideoError(null)
		setTitleError('')
		setDescriptionError('')
		setCarError('')
		setUploadProgress(0)
		if (videoRef.current) {
			videoRef.current.stopAsync()
		}
		setIsVideoPlaying(false)
	}, [])

	const handleVideoPlaybackStatusUpdate = useCallback(
		(status: AVPlaybackStatus) => {
			if (!status.isLoaded) return
			setIsVideoPlaying(status.isPlaying)
		},
		[]
	)

	const toggleVideoPlayback = useCallback(async () => {
		if (!videoRef.current) return

		if (isVideoPlaying) {
			await videoRef.current.pauseAsync()
		} else {
			await videoRef.current.playAsync()
		}
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
	}, [isVideoPlaying])

	const renderVideo = useMemo(() => {
		if (!video) return null
		const displayDuration = video.originalDuration
			? video.originalDuration / 1000
			: video.duration

		return (
			<View className='mt-4 relative'>
				<Video
					ref={videoRef}
					source={{ uri: video.uri }}
					style={{ width: '100%', height: 200 }}
					useNativeControls
					resizeMode={ResizeMode.CONTAIN}
					isLooping
					shouldPlay={false}
					onPlaybackStatusUpdate={handleVideoPlaybackStatusUpdate}
					className='rounded-lg'
				/>
				<TouchableOpacity
					onPress={toggleVideoPlayback}
					className='absolute inset-0 items-center justify-center'>
					<BlurView intensity={30} className='p-4 rounded-full'>
						<Ionicons
							name={isVideoPlaying ? 'pause' : 'play'}
							size={30}
							color='white'
						/>
					</BlurView>
				</TouchableOpacity>
				<View className='mt-2 flex-row justify-between items-center'>
					<Text
						className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray'}`}>
						Size: {(video.fileSize! / (1024 * 1024)).toFixed(2)} MB
					</Text>
					<Text
						className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray'}`}>
						Duration: {Math.round(displayDuration)}s
					</Text>
				</View>
				{videoError && (
					<Text className='text-rose-500 mt-1 text-sm'>{videoError}</Text>
				)}
			</View>
		)
	}, [
		video,
		videoError,
		isVideoPlaying,
		isDarkMode,
		handleVideoPlaybackStatusUpdate,
		toggleVideoPlayback
	])

	return (
		<Modal
			visible={isVisible}
			onRequestClose={onClose}
			animationType='slide'
			presentationStyle='pageSheet'>
			<LinearGradient
				colors={isDarkMode ? ['#000000', '#1A1A1A'] : ['#FFFFFF', '#F0F0F0']}
				className='flex-1'>
				<KeyboardAvoidingView
					behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
					className='flex-1'>
					<SafeAreaView className='flex-1'>
						<View className='flex-row justify-between items-center p-4 border-b border-red'>
							<TouchableOpacity onPress={onClose} className='p-2'>
								<FontAwesome
									name='times'
									size={24}
									color={isDarkMode ? 'white' : 'black'}
								/>
							</TouchableOpacity>
							<Text
								className={`text-lg font-bold ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								Create AutoClip
							</Text>
							<TouchableOpacity
								onPress={handleSubmit}
								disabled={isLoading}
								className={`p-2 ${isLoading ? 'opacity-50' : ''}`}>
								{isLoading ? (
									<ActivityIndicator color='#D55004' />
								) : (
									<Text className='text-red font-bold'>Create</Text>
								)}
							</TouchableOpacity>
						</View>

						<ScrollView
							className='flex-1 p-4'
							keyboardShouldPersistTaps='handled'
							showsVerticalScrollIndicator={false}>
							<View className='mb-4'>
								<Text
									className={`mb-2 font-semibold ${
										isDarkMode ? 'text-white' : 'text-black'
									}`}>
									Title *
								</Text>
								<TextInput
									value={title}
									onChangeText={setTitle}
									placeholder='Enter title'
									placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
									className={`border ${
										titleError ? 'border-rose-500' : 'border-red'
									} rounded-lg p-3 ${
										isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
									}`}
									maxLength={100}
								/>
								{titleError && (
									<Text className='text-rose-500 mt-1 text-sm'>
										{titleError}
									</Text>
								)}
							</View>

							<View className='mb-4'>
								<Text
									className={`mb-2 font-semibold ${
										isDarkMode ? 'text-white' : 'text-black'
									}`}>
									Description
								</Text>
								<TextInput
									value={description}
									onChangeText={setDescription}
									placeholder='Enter description'
									placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
									multiline
									numberOfLines={4}
									maxLength={500}
									className={`border ${
										descriptionError ? 'border-rose-500' : 'border-red'
									} rounded-lg p-3 min-h-[100px] ${
										isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
									}`}
									textAlignVertical='top'
								/>
								{descriptionError && (
									<Text className='text-rose-500 mt-1 text-sm'>
										{descriptionError}
									</Text>
								)}
								<Text
									className={`text-right mt-1 text-xs ${
										isDarkMode ? 'text-gray' : 'text-black'
									}`}>
									{description.length}/500
								</Text>
							</View>

							<View className='mb-4'>
								<CarSelector
									cars={cars}
									selectedCarId={selectedCarId}
									onCarSelect={setSelectedCarId}
									error={carError}
								/>
								{carError && (
									<Text className='text-rose-500 mt-1 text-sm'>{carError}</Text>
								)}
							</View>

							<View className='mb-4'>
								<VideoPickerButton
									onVideoSelect={handleVideoSelect}
									videoUri={video?.uri}
								/>
							</View>

							{renderVideo}

							{isLoading && uploadProgress > 0 && (
								<View className='mt-4'>
									<View className='flex-row justify-between mb-2'>
										<Text
											className={`${isDarkMode ? 'text-white' : 'text-black'}`}>
											Uploading...
										</Text>
										<Text
											className={`${isDarkMode ? 'text-white' : 'text-black'}`}>
											{uploadProgress}%
										</Text>
									</View>
									<View className='h-2 bg-white rounded-full'>
										<View
											className='h-2 bg-red rounded-full'
											style={{ width: `${uploadProgress}%` }}
										/>
									</View>
								</View>
							)}

							<View className='mt-6 mb-8'>
								<Text
									className={`text-sm mb-4 ${
										isDarkMode ? 'text-white' : 'text-gray'
									}`}>
									Guidelines:
								</Text>
								<View className='space-y-2'>
									<Text
										className={`text-xs ${
											isDarkMode ? 'text-gray' : 'text-gray'
										}`}>
										• Video must be less than 50MB
									</Text>
									<Text
										className={`text-xs ${
											isDarkMode ? 'text-gray' : 'text-gray'
										}`}>
										• Maximum duration: 60 seconds
									</Text>
									<Text
										className={`text-xs ${
											isDarkMode ? 'text-gray' : 'text-gray'
										}`}>
										• Supported formats: MP4, MOV
									</Text>
									<Text
										className={`text-xs ${
											isDarkMode ? 'text-gray' : 'text-gray'
										}`}>
										• Title must be at least 3 characters
									</Text>
									<Text
										className={`text-xs ${
											isDarkMode ? 'text-gray' : 'text-gray'
										}`}>
										• Description must be at least 10 characters if provided
									</Text>
								</View>
							</View>

							{Platform.OS === 'ios' && <View className='h-8' />}
						</ScrollView>
					</SafeAreaView>
				</KeyboardAvoidingView>
			</LinearGradient>
		</Modal>
	)
}
