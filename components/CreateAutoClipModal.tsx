import React, { useState, useEffect, useCallback, useRef } from 'react'
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
	Dimensions
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import VideoPickerButton from './VideoPickerComponent'
import CarSelector from './CarSelector'
import { ResizeMode, Video, AVPlaybackStatus } from 'expo-av'
import { BlurView } from 'expo-blur'
import * as FileSystem from 'expo-file-system'

import Animated, {
	FadeIn,
	FadeOut,
	withSpring,
	useAnimatedStyle,
	withTiming,
	useSharedValue,
	withSequence
} from 'react-native-reanimated'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

// SIMPLIFIED CONSTANTS - Reduced complexity for production stability
const MAX_VIDEO_SIZE = 30 * 1024 * 1024 // Reduced to 30MB for Android compatibility
const ALLOWED_VIDEO_EXTENSIONS = ['mp4', 'mov']
const MAX_VIDEO_DURATION = 25 * 1000 // Increased to 30 seconds for flexibility

// SIMPLIFIED VIDEO ASSET INTERFACE
interface SimpleVideoAsset {
	uri: string
	duration?: number
	fileSize?: number
	width?: number
	height?: number
}

// SAFE HAPTIC WRAPPER - Prevents crashes if haptics unavailable
const safeHaptic = async () => {
	try {
		const Haptics = await import('expo-haptics')
		await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
	} catch {
		// Silently fail if haptics unavailable
	}
}

// Enhanced Section Header Component
const SectionHeader = React.memo(({ title, subtitle, isDarkMode }: {
	title: string
	subtitle?: string
	isDarkMode: boolean
}) => {
	const scale = useSharedValue(1)

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.value }]
	}))

	useEffect(() => {
		scale.value = withSequence(withSpring(1.05), withSpring(1))
	}, [])

	return (
		<Animated.View className='mb-4' style={animatedStyle}>
			<LinearGradient
				colors={isDarkMode ? ['#D55004', '#FF6B00'] : ['#000', '#333']}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
				className='w-12 h-1 rounded-full mb-2'
			/>
			<Text
				className={`text-xl font-bold ${
					isDarkMode ? 'text-white' : 'text-black'
				}`}>
				{title}
			</Text>
			{subtitle && (
				<Text
					className={`text-sm mt-1 ${
						isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
					}`}>
					{subtitle}
				</Text>
			)}
		</Animated.View>
	)
})

// SIMPLIFIED INPUT COMPONENT - Removed complex animations that may cause issues
const SimpleInput = React.memo(({
	label,
	value,
	onChangeText,
	placeholder,
	multiline = false,
	required = false,
	error,
	isDarkMode,
	maxLength,
	icon
}: {
	label: string
	value: string
	onChangeText: (text: string) => void
	placeholder: string
	multiline?: boolean
	required?: boolean
	error?: string
	isDarkMode: boolean
	maxLength?: number
	icon?: string
}) => {
	return (
		<View className='mb-6'>
			<Text
				className={`text-sm font-medium mb-2 ${
					isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
				}`}>
				{label} {required && <Text className='text-red-500'>*</Text>}
			</Text>

			<View
				className={`rounded-2xl overflow-hidden ${
					isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'
				}`}>
				<View className='flex-row items-center p-4'>
					{icon && (
						<MaterialCommunityIcons
							name={icon as any}
							size={20}
							color={isDarkMode ? '#D55004' : '#666'}
							style={{ marginRight: 12 }}
						/>
					)}

					<TextInput
						value={value}
						onChangeText={onChangeText}
						placeholder={placeholder}
						placeholderTextColor={isDarkMode ? '#666' : '#999'}
						multiline={multiline}
						numberOfLines={multiline ? 4 : 1}
						maxLength={maxLength}
						className={`flex-1 text-base ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}
						style={{
							height: multiline ? 100 : 50,
							textAlignVertical: multiline ? 'top' : 'center'
						}}
					/>

					{maxLength && (
						<Text
							className={`ml-2 text-xs ${
								isDarkMode ? 'text-neutral-500' : 'text-neutral-400'
							}`}>
							{value.length}/{maxLength}
						</Text>
					)}
				</View>
			</View>

			{error && (
				<Text className='text-red-500 text-xs mt-1 ml-1'>
					{error}
				</Text>
			)}
		</View>
	)
})

// SIMPLIFIED PROGRESS BAR
const SimpleProgressBar = React.memo(({ progress, isDarkMode }: {
	progress: number
	isDarkMode: boolean
}) => {
	return (
		<View className={`rounded-full overflow-hidden h-4 mb-4 ${
			isDarkMode ? 'bg-neutral-800' : 'bg-neutral-200'
		}`}>
			<View
				className='h-full bg-red-500 rounded-full'
				style={{ width: `${progress}%` }}
			/>
			<Text
				className={`absolute w-full text-center text-xs leading-4 ${
					isDarkMode ? 'text-white' : 'text-black'
				}`}>
				{Math.round(progress)}%
			</Text>
		</View>
	)
})

// SIMPLIFIED VIDEO PREVIEW
const SimpleVideoPreview = React.memo(({
	videoUri,
	onPress,
	isDarkMode,
	isPlaying,
	onPlaybackStatusUpdate,
	videoRef
}: {
	videoUri: string
	onPress?: () => void
	isDarkMode: boolean
	isPlaying: boolean
	onPlaybackStatusUpdate: (status: AVPlaybackStatus) => void
	videoRef: React.RefObject<Video>
}) => {
	return (
		<View className={`rounded-2xl overflow-hidden ${
			isDarkMode ? 'bg-neutral-800' : 'bg-neutral-200'
		}`}>
			<TouchableOpacity onPress={onPress} className='relative'>
				<Video
					ref={videoRef}
					source={{ uri: videoUri }}
					style={{ width: '100%', height: 200 }}
					resizeMode={ResizeMode.COVER}
					isLooping
					onPlaybackStatusUpdate={onPlaybackStatusUpdate}
					shouldPlay={isPlaying}
				/>

				<View className='absolute inset-0 justify-center items-center bg-black/30'>
					<MaterialCommunityIcons
						name={isPlaying ? 'pause' : 'play'}
						size={40}
						color='white'
					/>
				</View>
			</TouchableOpacity>
		</View>
	)
})

// SIMPLIFIED GUIDELINES
const SimpleGuidelines = React.memo(({ isDarkMode }: { isDarkMode: boolean }) => {
	const guidelines = [
		'Video must be less than 30MB',
		'Maximum duration: 25 seconds',
		'Supported formats: MP4, MOV',
		'Title must be at least 3 characters'
	]

	return (
		<View className={`p-4 rounded-2xl ${
			isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'
		}`}>
			{guidelines.map((text, index) => (
				<View key={index} className='flex-row items-center mb-3 last:mb-0'>
					<MaterialCommunityIcons
						name='check-circle'
						size={16}
						color='#22c55e'
						style={{ marginRight: 8 }}
					/>
					<Text
						className={`text-sm ${
							isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
						}`}>
						{text}
					</Text>
				</View>
			))}
		</View>
	)
})

// MAIN COMPONENT WITH SIMPLIFIED ERROR HANDLING
export default function CreateAutoClipModal({
	isVisible,
	onClose,
	dealership,
	onSuccess
}: {
	isVisible: boolean
	onClose: () => void
	dealership: { id: number } | null
	onSuccess: () => void
}) {
	const { isDarkMode } = useTheme()
	
	// SIMPLIFIED STATE MANAGEMENT
	const [formData, setFormData] = useState({
		title: '',
		description: '',
		selectedCarId: null as number | null,
		video: null as SimpleVideoAsset | null
	})
	
	const [errors, setErrors] = useState({
		title: '',
		description: '',
		car: '',
		video: ''
	})

	const [isLoading, setIsLoading] = useState(false)
	const [uploadProgress, setUploadProgress] = useState(0)
	const [cars, setCars] = useState<any[]>([])
	const [isVideoPlaying, setIsVideoPlaying] = useState(false)
	const videoRef = useRef<Video>(null)

	// SIMPLIFIED CLEANUP
	const cleanup = useCallback(() => {
		setFormData({
			title: '',
			description: '',
			selectedCarId: null,
			video: null
		})
		setErrors({
			title: '',
			description: '',
			car: '',
			video: ''
		})
		setUploadProgress(0)
		setIsVideoPlaying(false)
		if (videoRef.current) {
			try {
				videoRef.current.unloadAsync()
			} catch {
				// Ignore errors during cleanup
			}
		}
	}, [])

	// FETCH CARS - SIMPLIFIED ERROR HANDLING
	const fetchCars = useCallback(async () => {
		if (!dealership?.id) return

		try {
			setIsLoading(true)
			
			const { data, error } = await supabase
				.from('cars')
				.select('id, make, model, year, price, status')
				.eq('dealership_id', dealership.id)
				.eq('status', 'available')
				.order('listed_at', { ascending: false })

			if (error) throw error

			// SIMPLIFIED: Check for existing autoclips separately
			const carIds = data?.map(car => car.id) || []
			const { data: existingClips } = await supabase
				.from('auto_clips')
				.select('car_id')
				.in('car_id', carIds)

			const usedCarIds = existingClips?.map(clip => clip.car_id) || []
			const availableCars = data?.filter(car => !usedCarIds.includes(car.id)) || []

			setCars(availableCars)
		} catch (error) {
			console.error('Error fetching cars:', error)
			Alert.alert('Error', 'Failed to load cars. Please try again.')
		} finally {
			setIsLoading(false)
		}
	}, [dealership?.id])

	useEffect(() => {
		if (isVisible && dealership?.id) {
			fetchCars()
		}
	}, [isVisible, dealership?.id, fetchCars])

	// SIMPLIFIED FORM VALIDATION
	const validateForm = useCallback(() => {
		const newErrors = {
			title: '',
			description: '',
			car: '',
			video: ''
		}

		if (!formData.title.trim()) {
			newErrors.title = 'Title is required'
		} else if (formData.title.length < 3) {
			newErrors.title = 'Title must be at least 3 characters'
		}

		if (!formData.selectedCarId) {
			newErrors.car = 'Please select a car'
		}

		if (!formData.video) {
			newErrors.video = 'Please select a video'
		}

		setErrors(newErrors)
		return !Object.values(newErrors).some(error => error !== '')
	}, [formData])

	// SIMPLIFIED VIDEO SELECTION
	const handleVideoSelect = useCallback(async (videoAsset: SimpleVideoAsset) => {
		try {
			// BASIC VALIDATION ONLY
			if (videoAsset.fileSize && videoAsset.fileSize > MAX_VIDEO_SIZE) {
				Alert.alert('Error', 'Video size must be less than 30MB')
				return
			}

			// CHECK FILE EXTENSION
			const uri = videoAsset.uri
			const extension = uri.split('.').pop()?.toLowerCase()
			if (!extension || !ALLOWED_VIDEO_EXTENSIONS.includes(extension)) {
				Alert.alert('Error', 'Please select an MP4 or MOV file')
				return
			}

			setFormData(prev => ({ ...prev, video: videoAsset }))
			setErrors(prev => ({ ...prev, video: '' }))
			safeHaptic()
		} catch (error) {
			console.error('Video selection error:', error)
			Alert.alert('Error', 'Failed to select video. Please try again.')
		}
	}, [])

	// SIMPLIFIED FORM SUBMISSION
	const handleSubmit = useCallback(async () => {
		if (!validateForm() || !dealership?.id || !formData.video) return

		try {
			setIsLoading(true)
			safeHaptic()

			// CHECK FOR EXISTING AUTOCLIP
			const { data: existingClip } = await supabase
				.from('auto_clips')
				.select('id')
				.eq('car_id', formData.selectedCarId)
				.single()

			if (existingClip) {
				Alert.alert('Error', 'This car already has an AutoClip')
				return
			}

			// SIMPLIFIED FILE UPLOAD
			const fileUri = formData.video.uri
			const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`
			const filePath = `${dealership.id}/${fileName}`

			// READ FILE AS BASE64 FOR RELIABLE UPLOAD
			const base64Data = await FileSystem.readAsStringAsync(fileUri, {
				encoding: FileSystem.EncodingType.Base64
			})

			// UPLOAD TO SUPABASE
			const { error: uploadError } = await supabase.storage
				.from('autoclips')
				.upload(filePath, decode(base64Data), {
					contentType: 'video/mp4',
					onUploadProgress: (event) => {
						const progress = (event.loaded / event.total) * 100
						setUploadProgress(Math.round(progress))
					}
				})

			if (uploadError) throw uploadError

			// GET PUBLIC URL
			const { data: { publicUrl } } = supabase.storage
				.from('autoclips')
				.getPublicUrl(filePath)

			// CREATE DATABASE ENTRY
			const { error: dbError } = await supabase.from('auto_clips').insert({
				dealership_id: dealership.id,
				car_id: formData.selectedCarId,
				title: formData.title.trim(),
				description: formData.description.trim() || '',
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

			Alert.alert('Success', 'AutoClip created successfully')
			onSuccess()
			handleClose()
		} catch (error) {
			console.error('Submission error:', error)
			Alert.alert('Error', 'Failed to create AutoClip. Please try again.')
		} finally {
			setIsLoading(false)
			setUploadProgress(0)
		}
	}, [formData, dealership, validateForm, onSuccess])

	// SIMPLIFIED CLOSE HANDLER
	const handleClose = useCallback(() => {
		cleanup()
		onClose()
	}, [cleanup, onClose])

	// RENDER
	return (
		<Modal
			visible={isVisible}
			animationType='slide'
			transparent
			statusBarTranslucent>
			<View className='flex-1 bg-black/50'>
				<View className={`flex-1 mt-12 rounded-t-3xl ${
					isDarkMode ? 'bg-black' : 'bg-white'
				}`}>
					{/* HEADER */}
					<View className='px-6 py-4 border-b border-neutral-200/10'>
						<View className='flex-row items-center justify-between'>
							<TouchableOpacity onPress={handleClose} className='p-2'>
								<Ionicons
									name='close'
									size={24}
									color={isDarkMode ? 'white' : 'black'}
								/>
							</TouchableOpacity>

							<Text
								className={`text-xl font-bold ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								Create AutoClip
							</Text>

							<TouchableOpacity
								onPress={handleSubmit}
								disabled={isLoading || cars.length === 0}
								className={`bg-red-500 px-4 py-2 rounded-full ${
									isLoading || cars.length === 0 ? 'opacity-50' : ''
								}`}>
								{isLoading ? (
									<ActivityIndicator color='white' size='small' />
								) : (
									<Text className='text-white font-medium'>Create</Text>
								)}
							</TouchableOpacity>
						</View>
					</View>

					<ScrollView
						className='flex-1 px-6'
						showsVerticalScrollIndicator={false}
						keyboardShouldPersistTaps='handled'>
						
						{/* VIDEO SECTION */}
						<View className='py-4'>
							<SectionHeader
								title='Video Upload'
								subtitle='Select a video to share'
								isDarkMode={isDarkMode}
							/>

							{formData.video ? (
								<SimpleVideoPreview
									videoUri={formData.video.uri}
									onPress={() => setIsVideoPlaying(!isVideoPlaying)}
									isDarkMode={isDarkMode}
									isPlaying={isVideoPlaying}
									onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
										if (!status.isLoaded) return
										setIsVideoPlaying(status.isPlaying || false)
									}}
									videoRef={videoRef}
								/>
							) : (
								<VideoPickerButton
									onVideoSelect={handleVideoSelect}
									isDarkMode={isDarkMode}
								/>
							)}

							{errors.video && (
								<Text className='text-red-500 text-xs mt-2'>
									{errors.video}
								</Text>
							)}
						</View>

						{/* FORM INPUTS */}
						<View className='mb-8'>
							<SectionHeader
								title='Clip Details'
								isDarkMode={isDarkMode}
							/>

							<SimpleInput
								label='Title'
								value={formData.title}
								onChangeText={(text) => {
									setFormData(prev => ({ ...prev, title: text }))
									setErrors(prev => ({ ...prev, title: '' }))
								}}
								placeholder='Enter a catchy title...'
								required
								error={errors.title}
								isDarkMode={isDarkMode}
								maxLength={50}
								icon='format-title'
							/>

							<SimpleInput
								label='Description'
								value={formData.description}
								onChangeText={(text) => {
									setFormData(prev => ({ ...prev, description: text }))
									setErrors(prev => ({ ...prev, description: '' }))
								}}
								placeholder='Describe your video...'
								multiline
								error={errors.description}
								isDarkMode={isDarkMode}
								maxLength={500}
								icon='text-box-outline'
							/>
						</View>

						{/* CAR SELECTION */}
						<View className='mb-8'>
							<SectionHeader
								title='Featured Vehicle'
								subtitle='Select the car featured in this clip'
								isDarkMode={isDarkMode}
							/>

							{cars.length > 0 ? (
								<CarSelector
									cars={cars}
									selectedCarId={formData.selectedCarId}
									onCarSelect={(id) => {
										setFormData(prev => ({ ...prev, selectedCarId: id }))
										setErrors(prev => ({ ...prev, car: '' }))
									}}
									error={errors.car}
									isDarkMode={isDarkMode}
								/>
							) : (
								<View className={`p-4 rounded-2xl ${
									isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'
								}`}>
									<Text
										className={`text-center ${
											isDarkMode ? 'text-white' : 'text-black'
										}`}>
										No cars available for new AutoClips.
										{'\n'}All cars already have associated clips.
									</Text>
								</View>
							)}
						</View>

						{/* UPLOAD PROGRESS */}
						{isLoading && uploadProgress > 0 && (
							<View className='mb-8'>
								<SectionHeader
									title='Uploading'
									subtitle={`Progress: ${uploadProgress}%`}
									isDarkMode={isDarkMode}
								/>
								<SimpleProgressBar
									progress={uploadProgress}
									isDarkMode={isDarkMode}
								/>
							</View>
						)}

						{/* GUIDELINES */}
						<View className='mb-8'>
							<SectionHeader
								title='Guidelines'
								isDarkMode={isDarkMode}
							/>
							<SimpleGuidelines isDarkMode={isDarkMode} />
						</View>

						<View className='h-20' />
					</ScrollView>
				</View>
			</View>
		</Modal>
	)
}

// HELPER FUNCTION FOR BASE64 DECODE
function decode(str: string): Uint8Array {
	const bytes = new Uint8Array(str.length)
	for (let i = 0; i < str.length; i++) {
		bytes[i] = str.charCodeAt(i)
	}
	return bytes
}