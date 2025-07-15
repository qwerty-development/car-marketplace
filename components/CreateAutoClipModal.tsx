import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import VideoPickerButton from './VideoPickerComponent'
import CarSelector from './CarSelector'
import { ResizeMode, Video, AVPlaybackStatus } from 'expo-av'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'

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
const MAX_VIDEO_SIZE = 50 * 1024 * 1024
const ALLOWED_VIDEO_TYPES = ['mp4', 'mov', 'quicktime']
const MAX_VIDEO_DURATION = 25 * 1000

// Utility function for haptic feedback
const triggerHaptic = async (style = 'light') => {
	try {
		switch (style) {
			case 'light':
				await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
				break
			case 'medium':
				await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
				break
			case 'heavy':
				await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
				break
			default:
				await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
		}
	} catch (error) {
		console.error('Haptic error:', error)
	}
}

// Enhanced Section Header Component
const SectionHeader = React.memo(({ title, subtitle, isDarkMode }) => {
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

// Enhanced Input Component
const NeumorphicInput = React.memo(
	({
		label,
		value,
		onChangeText,
		placeholder,
		multiline = false,
		required = false,
		error,
		isDarkMode,
		maxLength,
		icon,
		onFocus,
		onBlur
	}) => {
		const scale = useSharedValue(1)
		const [isFocused, setIsFocused] = useState(false)

		const handleFocus = useCallback(() => {
			setIsFocused(true)
			scale.value = withSpring(0.98)
			triggerHaptic('light')
			onFocus?.()
		}, [onFocus])

		const handleBlur = useCallback(() => {
			setIsFocused(false)
			scale.value = withSpring(1)
			onBlur?.()
		}, [onBlur])

		const animatedStyle = useAnimatedStyle(() => ({
			transform: [{ scale: scale.value }]
		}))

		return (
			<Animated.View
				entering={FadeIn.duration(400)}
				className='mb-6'
				style={animatedStyle}>
				<Text
					className={`text-sm font-medium mb-2 ${
						isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
					}`}>
					{label} {required && <Text className='text-red'>*</Text>}
				</Text>

				<BlurView
					intensity={isDarkMode ? 20 : 40}
					tint={isDarkMode ? 'dark' : 'light'}
					className={`rounded-2xl overflow-hidden ${
						isFocused ? 'border border-red' : ''
					}`}>
					<LinearGradient
						colors={
							isDarkMode ? ['#1c1c1c', '#2d2d2d'] : ['#f5f5f5', '#e5e5e5']
						}
						className='p-1 rounded-xl'
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}>
						<View className='flex-row items-center p-2'>
							{icon && (
								<View
									className={`p-3 rounded-xl mr-2 ${
										isDarkMode ? 'bg-black/30' : 'bg-white/30'
									}`}>
									<MaterialCommunityIcons
										name={icon}
										size={20}
										color={isFocused ? '#D55004' : isDarkMode ? '#fff' : '#000'}
									/>
								</View>
							)}

							<TextInput
               textAlignVertical="center"
								value={value}
								onChangeText={onChangeText}
								placeholder={placeholder}
								placeholderTextColor={isDarkMode ? '#666' : '#999'}
								multiline={multiline}
								numberOfLines={multiline ? 4 : 1}
								maxLength={maxLength}
								onFocus={handleFocus}
								onBlur={handleBlur}
								className={`flex-1 text-base px-2 ${
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
					</LinearGradient>
				</BlurView>

				{error && (
					<Animated.Text
						entering={FadeIn}
						className='text-red text-xs mt-1 ml-1'>
						{error}
					</Animated.Text>
				)}
			</Animated.View>
		)
	}
)

// Enhanced Progress Bar Component
const ProgressBar = React.memo(({ progress, isDarkMode }) => {
	const progressAnim = useSharedValue(0)
	const scale = useSharedValue(1)

	useEffect(() => {
		progressAnim.value = withTiming(progress, { duration: 500 })
		scale.value = withSequence(withSpring(1.05), withSpring(1))
	}, [progress])

	const progressStyle = useAnimatedStyle(() => ({
		width: `${progressAnim.value}%`,
		transform: [{ scale: scale.value }]
	}))

	return (
		<BlurView
			intensity={isDarkMode ? 20 : 40}
			tint={isDarkMode ? 'dark' : 'light'}
			className='rounded-full overflow-hidden h-4 mb-4'>
			<LinearGradient
				colors={isDarkMode ? ['#1c1c1c', '#2d2d2d'] : ['#f5f5f5', '#e5e5e5']}
				className='w-full h-full'>
				<Animated.View style={progressStyle}>
					<LinearGradient
						colors={['#D55004', '#FF6B00']}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 0 }}
						className='h-full rounded-full'
					/>
				</Animated.View>

				<Text
					className={`absolute w-full text-center text-xs ${
						isDarkMode ? 'text-white' : 'text-black'
					}`}>
					{Math.round(progress)}%
				</Text>
			</LinearGradient>
		</BlurView>
	)
})

// Enhanced Video Preview Component
const VideoPreview = React.memo(
	({
		videoUri,
		onPress,
		isDarkMode,
		isPlaying,
		onPlaybackStatusUpdate,
		videoRef
	}) => {
		const scale = useSharedValue(1)
		const [previewError, setPreviewError] = useState<string | null>(null)

		const handlePress = useCallback(() => {
			try {
				scale.value = withSequence(withSpring(0.95), withSpring(1))
				triggerHaptic()
				onPress?.()
			} catch (pressError) {
				console.error('Video preview press error:', pressError)
			}
		}, [onPress])

		const handleVideoError = useCallback((error: any) => {
			console.error('Video preview error:', error)
			setPreviewError('Preview unavailable')
		}, [])

		const animatedStyle = useAnimatedStyle(() => ({
			transform: [{ scale: scale.value }]
		}))

		if (previewError) {
			return (
				<Animated.View style={animatedStyle}>
					<BlurView
						intensity={isDarkMode ? 20 : 40}
						tint={isDarkMode ? 'dark' : 'light'}
						className='rounded-2xl overflow-hidden'>
						<View className='h-48 justify-center items-center bg-neutral-500/20'>
							<MaterialCommunityIcons
								name='video-off'
								size={48}
								color={isDarkMode ? '#666' : '#999'}
							/>
							<Text className={`mt-2 text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
								{previewError}
							</Text>
						</View>
					</BlurView>
				</Animated.View>
			)
		}

		return (
			<Animated.View style={animatedStyle}>
				<BlurView
					intensity={isDarkMode ? 20 : 40}
					tint={isDarkMode ? 'dark' : 'light'}
					className='rounded-2xl overflow-hidden'>
					<TouchableOpacity onPress={handlePress} className='relative'>
						<Video
							ref={videoRef}
							source={{ uri: videoUri }}
							style={{ width: '100%', height: 200 }}
							resizeMode={ResizeMode.COVER}
							isLooping
							onPlaybackStatusUpdate={onPlaybackStatusUpdate}
							shouldPlay={isPlaying}
							onError={handleVideoError}
							useNativeControls={false}
							isMuted={true}
						/>

						<LinearGradient
							colors={['transparent', 'rgba(0,0,0,0.5)']}
							className='absolute inset-0 justify-center items-center'>
							<MaterialCommunityIcons
								name={isPlaying ? 'pause' : 'play'}
								size={40}
								color='white'
							/>
						</LinearGradient>
					</TouchableOpacity>
				</BlurView>
			</Animated.View>
		)
	}
)

// Enhanced Guidelines Component with Review Information
const Guidelines = React.memo(({ isDarkMode }) => {
	const guidelines = [
		{ icon: 'file-video', text: 'Video must be less than 50MB' },
		{ icon: 'clock-outline', text: 'Maximum duration: 25 seconds' },
		{ icon: 'file-document', text: 'Supported formats: MP4, MOV' },
		{ icon: 'text', text: 'Title must be at least 3 characters' },
		{ icon: 'text-box', text: 'Description must be at least 10 characters' },
		{ icon: 'clock-check-outline', text: 'Video will be submitted for admin review' },
		{ icon: 'shield-check', text: 'Approval required before publication' }
	]

	return (
		<BlurView
			intensity={isDarkMode ? 20 : 40}
			tint={isDarkMode ? 'dark' : 'light'}
			className='p-4 rounded-2xl'>
			<LinearGradient
				colors={isDarkMode ? ['#1c1c1c', '#2d2d2d'] : ['#f5f5f5', '#e5e5e5']}
				className='p-4 rounded-xl'
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}>
				{guidelines.map((item, index) => (
					<Animated.View
						key={index}
						entering={FadeIn.delay(index * 100)}
						className='flex-row items-center mb-3 last:mb-0'>
						<MaterialCommunityIcons
							name={item.icon}
							size={20}
							color={isDarkMode ? '#D55004' : '#FF6B00'}
							className='mr-3'
						/>
						<Text
							className={`text-sm flex-1 ${
								isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
							}`}>
							{item.text}
						</Text>
					</Animated.View>
				))}
			</LinearGradient>
		</BlurView>
	)
})

// Main Component
export default function CreateAutoClipModal({
	isVisible,
	onClose,
	dealership,
	onSuccess
}) {
	const { isDarkMode } = useTheme()
	const [formState, setFormState] = useState({
		title: '',
		description: '',
		selectedCarId: null,
		video: null,
		titleError: '',
		descriptionError: '',
		carError: '',
		videoError: null
	})

	const [isLoading, setIsLoading] = useState(false)
	const [uploadProgress, setUploadProgress] = useState(0)
	const [cars, setCars] = useState([])
	const [isVideoPlaying, setIsVideoPlaying] = useState(false)
	const videoRef = useRef(null)
	const modalScale = useSharedValue(1)

	// Animation setup for modal entrance
	const slideAnim = useSharedValue(SCREEN_HEIGHT)

	useEffect(() => {
		if (isVisible) {
			slideAnim.value = withSpring(0, {
				damping: 15,
				stiffness: 90
			})
		}
	}, [isVisible])

	// Cleanup function
	const cleanup = useCallback(() => {
		setFormState({
			title: '',
			description: '',
			selectedCarId: null,
			video: null,
			titleError: '',
			descriptionError: '',
			carError: '',
			videoError: null
		})
		setUploadProgress(0)
		if (videoRef.current) {
			videoRef.current.unloadAsync()
		}
		setIsVideoPlaying(false)
	}, [])

	useEffect(() => {
		if (isVisible) {
			fetchCars()
		}
	}, [isVisible])

	// CRITICAL UPDATE: Fetch cars excluding those with non-rejected autoclips
// Fixed fetchCars function - replace the existing one
const fetchCars = async () => {
	try {
		setIsLoading(true)
		triggerHaptic('light')

		const { data, error } = await supabase
			.from('cars')
			.select(`
				id,
				make,
				model,
				year,
				price,
				status,
				auto_clips(id, status)
			`)
			.eq('dealership_id', dealership!.id)
			.eq('status', 'available')
			.order('listed_at', { ascending: false })

		if (error) throw error

		// FIXED: More robust handling of auto_clips array
		const availableCars = data?.filter(car => {
			// Ensure auto_clips is always treated as an array
			const autoClips = Array.isArray(car.auto_clips) ? car.auto_clips : []
			
			if (autoClips.length === 0) {
				return true // No autoclips, available
			}
			
			// Only allow if all existing autoclips are rejected
			return autoClips.every(clip => clip && clip.status === 'rejected')
		}).map(({ auto_clips, ...car }) => car) || []

		setCars(availableCars)
	} catch (error) {
		console.error('Error fetching cars:', error)
		Alert.alert('Error', 'Failed to load cars')
		triggerHaptic('heavy')
	} finally {
		setIsLoading(false)
	}
}

	// Form validation
	const validateForm = useCallback(() => {
		let isValid = true
		const newState = { ...formState }
	
		try {
			// Title validation with enhanced checks
			const trimmedTitle = formState.title?.trim() || ''
			if (!trimmedTitle) {
				newState.titleError = 'Title is required'
				isValid = false
			} else if (trimmedTitle.length < 3) {
				newState.titleError = 'Title must be at least 3 characters'
				isValid = false
			} else if (trimmedTitle.length > 100) {
				newState.titleError = 'Title must be less than 100 characters'
				isValid = false
			} else {
				newState.titleError = ''
			}
	
			// Description validation with enhanced checks
			const trimmedDescription = formState.description?.trim() || ''
			if (trimmedDescription && trimmedDescription.length > 0 && trimmedDescription.length < 10) {
				newState.descriptionError = 'Description must be at least 10 characters if provided'
				isValid = false
			} else if (trimmedDescription.length > 500) {
				newState.descriptionError = 'Description must be less than 500 characters'
				isValid = false
			} else {
				newState.descriptionError = ''
			}
	
			// Car selection validation
			if (!formState.selectedCarId || formState.selectedCarId <= 0) {
				newState.carError = 'Please select a car'
				isValid = false
			} else {
				newState.carError = ''
			}
	
			// Enhanced video validation
			if (!formState.video) {
				newState.videoError = 'Please select a video'
				isValid = false
			} else {
				// Additional video validation
				try {
					if (!formState.video.uri || typeof formState.video.uri !== 'string') {
						newState.videoError = 'Invalid video file'
						isValid = false
					} else if (formState.video.duration && formState.video.duration > MAX_VIDEO_DURATION) {
						newState.videoError = `Video is too long (max ${MAX_VIDEO_DURATION / 1000}s)`
						isValid = false
					} else {
						newState.videoError = null
					}
				} catch (videoValidationError) {
					console.error('Video validation error:', videoValidationError)
					newState.videoError = 'Video validation failed'
					isValid = false
				}
			}
	
			setFormState(newState)
			
			if (!isValid) {
				try {
					triggerHaptic('heavy')
				} catch (hapticError) {
					console.warn('Validation haptic not available:', hapticError)
				}
			}
	
			return isValid
		} catch (validationError) {
			console.error('Form validation error:', validationError)
			Alert.alert('Validation Error', 'Unable to validate form. Please try again.')
			return false
		}
	}, [formState])
	
	const handleVideoSelect = useCallback(async (videoAsset: any) => {
		try {
			// Clear any existing video errors
			setFormState(prev => ({ ...prev, videoError: null }))
			
			// Trigger haptic feedback safely
			try {
				await triggerHaptic('medium')
			} catch (hapticError) {
				console.warn('Haptic feedback not available:', hapticError)
			}
	
			// Enhanced validation with null checks
			if (!videoAsset || !videoAsset.uri) {
				throw new Error('Invalid video asset received')
			}
	
			// Validate video size with better error handling
			if (videoAsset.fileSize && videoAsset.fileSize > MAX_VIDEO_SIZE) {
				throw new Error(`Video size (${Math.round(videoAsset.fileSize / (1024 * 1024))}MB) must be less than ${Math.round(MAX_VIDEO_SIZE / (1024 * 1024))}MB`)
			}
	
			// Enhanced file extension validation
			let fileExtension: string | undefined
			try {
				const uriParts = videoAsset.uri.split('.')
				fileExtension = uriParts[uriParts.length - 1]?.toLowerCase()
			} catch (extensionError) {
				console.error('Error parsing file extension:', extensionError)
				throw new Error('Could not determine video file format')
			}
	
			if (!fileExtension) {
				throw new Error('Could not determine video file format')
			}
	
			// More comprehensive format validation
			const allowedExtensions = ['mp4', 'mov', 'm4v']
			if (!allowedExtensions.includes(fileExtension)) {
				throw new Error(`Invalid video format (.${fileExtension}). Please use MP4 or MOV files`)
			}
	
			// Enhanced duration validation with fallback handling
			let videoDuration = videoAsset.duration || videoAsset.originalDuration || 0
			
			// Handle duration format inconsistencies across devices
			if (videoDuration < 1000 && videoDuration > 0) {
				// Some devices return duration in seconds, convert to milliseconds
				videoDuration = videoDuration * 1000
			}
	
			if (videoDuration > MAX_VIDEO_DURATION) {
				const maxSeconds = Math.round(MAX_VIDEO_DURATION / 1000)
				const actualSeconds = Math.round(videoDuration / 1000)
				throw new Error(`Video duration (${actualSeconds}s) must be ${maxSeconds} seconds or less`)
			}
	
			// Additional safety checks
			try {
				// Verify the URI is accessible (basic check)
				if (!videoAsset.uri.startsWith('file://') && 
					!videoAsset.uri.startsWith('content://') && 
					!videoAsset.uri.startsWith('ph://')) {
					console.warn('Unusual video URI format:', videoAsset.uri.substring(0, 50))
				}
	
				// Create enhanced video asset with safer defaults
				const enhancedVideoAsset = {
					...videoAsset,
					duration: videoDuration,
					width: videoAsset.width || 1920,
					height: videoAsset.height || 1080,
					type: fileExtension === 'mov' ? 'video/quicktime' : 'video/mp4'
				}
	
				// Update form state with enhanced asset
				setFormState(prev => ({ 
					...prev, 
					video: enhancedVideoAsset,
					videoError: null 
				}))
	
				// Success haptic feedback
				try {
					await triggerHaptic('light')
				} catch (hapticError) {
					console.warn('Success haptic not available:', hapticError)
				}
	
			} catch (processingError) {
				console.error('Video processing error:', processingError)
				throw new Error('Error processing selected video')
			}
	
		} catch (error: any) {
			console.error('Video selection error:', error)
			
			// Enhanced error message handling
			let errorMessage = 'Failed to select video'
			if (error && typeof error.message === 'string') {
				errorMessage = error.message
			} else if (typeof error === 'string') {
				errorMessage = error
			}
	
			// Update form state with error
			setFormState((prev:any) => ({
				...prev,
				video: null,
				videoError: errorMessage
			}))
	
			// Error haptic feedback
			try {
				await triggerHaptic('heavy')
			} catch (hapticError) {
				console.warn('Error haptic not available:', hapticError)
			}
	
			// Show user-friendly error
			Alert.alert(
				'Video Selection Error', 
				errorMessage,
				[{ text: 'OK', style: 'default' }]
			)
		}
	}, [])

	// CRITICAL UPDATE: Handle form submission with review process
	const handleSubmit = async () => {
		try {
			if (!validateForm()) return

			// RULE: Check if car already has a non-rejected autoclip
			const { data: existingClip, error: checkError } = await supabase
				.from('auto_clips')
				.select('id, status')
				.eq('car_id', formState.selectedCarId)
				.neq('status', 'rejected') // Exclude rejected clips
				.single()

			if (checkError && checkError.code !== 'PGRST116') {
				throw checkError
			}

			if (existingClip) {
				triggerHaptic('heavy')
				let message = 'This car already has an AutoClip'
				if (existingClip.status === 'under_review') {
					message = 'This car has an AutoClip pending review'
				} else if (existingClip.status === 'published') {
					message = 'This car already has a published AutoClip'
				}
				Alert.alert('Cannot Submit', message)
				return
			}

			setIsLoading(true)
			triggerHaptic('medium')

			// File naming and path setup
			const fileUri = formState.video!.uri
			const isMovFile = fileUri.toLowerCase().endsWith('.mov')
			const fileExtension = isMovFile ? 'mov' : 'mp4'
			const fileName = `${Date.now()}_${Math.random()
				.toString(36)
				.substring(7)}.${fileExtension}`
			const filePath = `${dealership!.id}/${fileName}`

			// Progress handler
			const progressHandler = (progress: number) => {
				setUploadProgress(Math.round(progress * 100))
				if (progress === 1) triggerHaptic('light')
			}

			// Upload video to Supabase storage
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
						onUploadProgress: event =>
							progressHandler(event.loaded / event.total)
					}
				)

			if (uploadError) throw uploadError

			// Get public URL
			const {
				data: { publicUrl }
			} = supabase.storage.from('autoclips').getPublicUrl(filePath)

			// CRITICAL UPDATE: Create database entry with 'under_review' status
			const { error: dbError } = await supabase.from('auto_clips').insert({
				dealership_id: dealership!.id,
				car_id: formState.selectedCarId,
				title: formState.title.trim(),
				description: formState.description.trim(),
				video_url: publicUrl,
				thumbnail_url: publicUrl,
				status: 'under_review', // CHANGED: Set to under_review instead of published
				views: 0,
				likes: 0,
				viewed_users: [],
				liked_users: [],
				submitted_at: new Date().toISOString(), // NEW: Track submission time
				published_at: null // Will be set when approved
			})

			if (dbError) throw dbError

			triggerHaptic('success')
			Alert.alert(
				'Submitted for Review', 
				'Your AutoClip has been submitted for admin review. You will be notified once it is approved.',
				[{ text: 'OK', style: 'default' }]
			)
			onSuccess()
			handleClose()
		} catch (error) {
			console.error('Error:', error)
			triggerHaptic('error')
			Alert.alert('Error', error.message || 'Failed to submit AutoClip')
		} finally {
			setIsLoading(false)
			setUploadProgress(0)
		}
	}

	// Handle modal close
	const handleClose = useCallback(() => {
		slideAnim.value = withSpring(SCREEN_HEIGHT, {
			damping: 15,
			stiffness: 90
		})

		setTimeout(() => {
			cleanup()
			onClose()
		}, 300)

		triggerHaptic('light')
	}, [cleanup, onClose])

	// Animation styles
	const modalStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: slideAnim.value }, { scale: modalScale.value }]
	}))

	// Render component
	return (
		<Modal
			visible={isVisible}
			animationType='none'
			transparent
			statusBarTranslucent>
			<View className='flex-1' style={{ zIndex: 99999 }}>
				<Animated.View
					entering={FadeIn}
					exiting={FadeOut}
					className='flex-1 bg-black/50'>
					<BlurView
						intensity={isDarkMode ? 30 : 20}
						tint={isDarkMode ? 'dark' : 'light'}
						className='flex-1'>
						<Animated.View
							style={modalStyle}
							className={`flex-1 mt-12 rounded-t-3xl overflow-hidden ${
								isDarkMode ? 'bg-black' : 'bg-white'
							}`}>
							{/* Header */}
							<BlurView
								intensity={isDarkMode ? 20 : 40}
								tint={isDarkMode ? 'dark' : 'light'}
								className='px-6 py-4 border-b border-neutral-200/10'>
								<View className='flex-row items-center justify-between'>
									<TouchableOpacity onPress={handleClose} className='p-2 -ml-2'>
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
										className={`bg-red px-4 py-2 rounded-full ${
											isLoading || cars.length === 0 ? 'opacity-50' : ''
										}`}>
										{isLoading ? (
											<ActivityIndicator color='white' size='small' />
										) : (
											<Text className='text-white font-medium'>Submit</Text>
										)}
									</TouchableOpacity>
								</View>
							</BlurView>

							<ScrollView
								className='flex-1 px-6'
								showsVerticalScrollIndicator={false}
								keyboardShouldPersistTaps='handled'>
								
								{/* Guidelines Section */}
								<View className='mb-6 pt-4'>
									<SectionHeader
										title='Review Process'
										subtitle='Important information about AutoClip submission and review'
										isDarkMode={isDarkMode}
									/>
									<Guidelines isDarkMode={isDarkMode} />
								</View>

								{/* Video Section */}
								<View className='py-4'>
									<SectionHeader
										title='Video Upload'
										subtitle='Select a video to submit for review'
										isDarkMode={isDarkMode}
									/>

									{formState.video ? (
										<VideoPreview
											videoUri={formState.video.uri}
											onPress={() => setIsVideoPlaying(!isVideoPlaying)}
											isDarkMode={isDarkMode}
											isPlaying={isVideoPlaying}
											onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
												if (!status.isLoaded) return
												setIsVideoPlaying(status.isPlaying)
											}}
											videoRef={videoRef}
										/>
									) : (
										<VideoPickerButton
											onVideoSelect={handleVideoSelect}
											isDarkMode={isDarkMode}
										/>
									)}

									{formState.videoError && (
										<Animated.Text
											entering={FadeIn}
											className='text-red text-xs mt-2'>
											{formState.videoError}
										</Animated.Text>
									)}
								</View>

								{/* Clip Details */}
								<View className='mb-8'>
									<SectionHeader
										title='Clip Details'
										subtitle='Add information about your AutoClip'
										isDarkMode={isDarkMode}
									/>

									<NeumorphicInput
										label='Title'
										value={formState.title}
										onChangeText={text =>
											setFormState(prev => ({
												...prev,
												title: text,
												titleError: ''
											}))
										}
										placeholder='Enter a catchy title...'
										required
										error={formState.titleError}
										isDarkMode={isDarkMode}
										maxLength={50}
										icon='format-title'
									/>

									<NeumorphicInput
										label='Description'
										value={formState.description}
										onChangeText={text =>
											setFormState(prev => ({
												...prev,
												description: text,
												descriptionError: ''
											}))
										}
										placeholder='Describe your video...'
										multiline
										error={formState.descriptionError}
										isDarkMode={isDarkMode}
										maxLength={500}
										icon='text-box-outline'
									/>
								</View>

								{/* Car Selection */}
								<View className='mb-8'>
									<SectionHeader
										title='Featured Vehicle'
										subtitle='Select the car featured in this clip'
										isDarkMode={isDarkMode}
									/>

									{cars.length > 0 ? (
										<CarSelector
											cars={cars}
											selectedCarId={formState.selectedCarId}
											onCarSelect={id =>
												setFormState(prev => ({
													...prev,
													selectedCarId: id,
													carError: ''
												}))
											}
											error={formState.carError}
											isDarkMode={isDarkMode}
										/>
									) : (
										<BlurView
											intensity={isDarkMode ? 20 : 40}
											tint={isDarkMode ? 'dark' : 'light'}
											className='p-4 rounded-2xl'>
											<Text
												className={`text-center ${
													isDarkMode ? 'text-white' : 'text-black'
												}`}>
												No cars available for new AutoClips.
												{'\n'}
												All cars either have existing clips or clips pending review.
											</Text>
										</BlurView>
									)}
								</View>

								{/* Upload Progress */}
								{isLoading && uploadProgress > 0 && (
									<View className='mb-8'>
										<SectionHeader
											title='Uploading'
											subtitle={`Progress: ${uploadProgress}%`}
											isDarkMode={isDarkMode}
										/>
										<ProgressBar
											progress={uploadProgress}
											isDarkMode={isDarkMode}
										/>
									</View>
								)}

								{/* Bottom Spacing */}
								<View className='h-20' />
							</ScrollView>
						</Animated.View>
					</BlurView>
				</Animated.View>
			</View>
		</Modal>
	)
}