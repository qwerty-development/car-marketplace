// VideoPickerButton.tsx - Fixed version to prevent crashes
import React, { useCallback, useState, useRef, useEffect } from 'react'
import {
	TouchableOpacity,
	Text,
	View,
	Alert,
	ActivityIndicator,
	Platform
} from 'react-native'
import { FontAwesome, Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useTheme } from '@/utils/ThemeContext'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import * as FileSystem from 'expo-file-system/legacy'
import { Video as CompressorVideo, getRealPath } from 'react-native-compressor'

interface VideoAsset {
	uri: string
	width: number
	height: number
	duration: number
	type?: string
	fileSize?: number
	originalDuration?: number // Should be in milliseconds
	originalFileSize?: number // Original size before compression
	compressionRatio?: number // Percentage of compression achieved
	originalSize?: number // Track original for simulation
	isSimulated?: boolean // Flag for simulated compression
}

interface VideoPickerButtonProps {
	onVideoSelect: (video: VideoAsset) => void
	videoUri?: string
	maxDuration?: number
	maxSize?: number
	error?: string
	disabled?: boolean
	onCompressionProgress?: (progress: number) => void
}

export default function VideoPickerButton({
	onVideoSelect,
	videoUri,
	maxSize = 50 * 1024 * 1024, // 50MB
	maxDuration = 25,
	error,
	disabled,
	onCompressionProgress
}: VideoPickerButtonProps) {
	const { isDarkMode } = useTheme()
	const [isLoading, setIsLoading] = useState(false)
	const [isCompressing, setIsCompressing] = useState(false)
	const [compressionProgress, setCompressionProgress] = useState(0)
	const [isPlaying, setIsPlaying] = useState(false)
	const [videoError, setVideoError] = useState<string | null>(null)
	const cleanupTimeoutRef = useRef<NodeJS.Timeout>(undefined)

	const player = useVideoPlayer(videoUri ?? null, player => {
		player.loop = true
	})

	// Enhanced video validation with better error handling
	const validateVideo = useCallback(
		async (uri: string, duration: number, fileSize?: number) => {
			try {
				// Validate URI format first
				if (!uri || typeof uri !== 'string') {
					throw new Error('Invalid video file')
				}

				// Convert duration to milliseconds if needed (some devices return seconds)
				let durationMs = duration
				if (duration < 1000 && duration > 0) {
					durationMs = duration * 1000
				}

				// Check duration with more flexible validation
				if (durationMs > maxDuration * 1000) {
					throw new Error(`Video must be ${maxDuration} seconds or shorter`)
				}

				// Enhanced file size check with fallback
				let actualFileSize = fileSize
				if (!actualFileSize || actualFileSize <= 0) {
					try {
						const fileInfo = await FileSystem.getInfoAsync(uri)
						if (fileInfo.exists && 'size' in fileInfo) {
							actualFileSize = fileInfo.size
						}
					} catch (fileError) {
						console.warn('Could not get file size, skipping size validation:', fileError)
						// Continue without file size validation rather than crashing
					}
				}

				// Only validate size if we successfully got it
				if (actualFileSize && actualFileSize > maxSize) {
					throw new Error(
						`Video must be smaller than ${Math.round(maxSize / (1024 * 1024))}MB`
					)
				}

				// Enhanced format validation
				const extension = uri.split('.').pop()?.toLowerCase()
				if (!extension) {
					throw new Error('Could not determine video format')
				}

				const allowedFormats = ['mp4', 'mov', 'm4v']
				if (!allowedFormats.includes(extension)) {
					throw new Error('Video must be in MP4 or MOV format')
				}

				// Test if file is accessible
				try {
					const fileInfo = await FileSystem.getInfoAsync(uri)
					if (!fileInfo.exists) {
						throw new Error('Video file is not accessible')
					}
				} catch (accessError) {
					throw new Error('Cannot access video file')
				}

				return actualFileSize
			} catch (validationError) {
				console.error('Video validation error:', validationError)
				throw validationError
			}
		},
		[maxDuration, maxSize]
	)

	// Compress video using react-native-compressor
	const compressVideo = useCallback(
		async (
			uri: string,
			originalSize: number
		): Promise<{ uri: string; size: number; originalSize: number; isSimulated: boolean }> => {
			try {
				setIsCompressing(true)
				setCompressionProgress(0)
				onCompressionProgress?.(0)

				let knownOriginalSize = originalSize
				if (knownOriginalSize <= 0) {
					try {
						const originalInfo = await FileSystem.getInfoAsync(uri)
						if (originalInfo.exists && typeof originalInfo.size === 'number') {
							knownOriginalSize = originalInfo.size
						}
					} catch (sizeLookupError) {
						console.warn('Could not determine original video size before compression:', sizeLookupError)
					}
				}

				const sizeInMb = knownOriginalSize / (1024 * 1024)
				const shouldSkipCompression = sizeInMb > 0 && sizeInMb <= 2
				if (shouldSkipCompression) {
					setCompressionProgress(100)
					onCompressionProgress?.(100)
					return {
						uri,
						size: knownOriginalSize,
						originalSize: knownOriginalSize,
						isSimulated: true
					}
				}

				console.log('Compressing video with react-native-compressor...')
				let sourceUri = uri
				if (Platform.OS === 'android' && uri.startsWith('content://')) {
					try {
						const realPath = await getRealPath(uri, 'video')
						if (realPath) {
							sourceUri = realPath
						}
					} catch (pathError) {
						console.warn('Failed to resolve real video path, using original URI:', pathError)
					}
				}

				const compressionOptions = {
					compressionMethod: 'auto' as const,
					maxSize: 1280,
					minimumFileSizeForCompress: 2 // MB
				}
				const compressedUri = await CompressorVideo.compress(
					sourceUri,
					compressionOptions,
					(progress) => {
						if (typeof progress === 'number') {
							const percentage = Math.min(100, Math.max(0, Math.round(progress * 100)))
							setCompressionProgress(percentage)
							onCompressionProgress?.(percentage)
						}
					}
				)
				let normalizedUri = compressedUri
				if (Platform.OS === 'android') {
					if (compressedUri.startsWith('content://')) {
						try {
							const realCompressedPath = await getRealPath(compressedUri, 'video')
							if (realCompressedPath) {
								normalizedUri = realCompressedPath.startsWith('file://')
									? realCompressedPath
									: `file://${realCompressedPath}`
							}
						} catch (compressedPathError) {
							console.warn('Failed to resolve real path for compressed video:', compressedPathError)
						}
					} else if (!compressedUri.startsWith('file://')) {
						normalizedUri = `file://${compressedUri}`
					}
				}
				let compressedSize = originalSize
				try {
					const fileInfo = await FileSystem.getInfoAsync(normalizedUri)
					if (fileInfo.exists && typeof fileInfo.size === 'number') {
						compressedSize = fileInfo.size
					}
				} catch (sizeError) {
					console.warn('Failed to determine compressed video size:', sizeError)
				}
				const resolvedOriginalSize =
					knownOriginalSize > 0 ? knownOriginalSize : compressedSize
				setCompressionProgress(100)
				onCompressionProgress?.(100)
				console.log('Video compression completed')
				return {
					uri: normalizedUri,
					size: compressedSize,
					originalSize: resolvedOriginalSize,
					isSimulated: false
				}
			} catch (error) {
				console.error('Video compression failed, using original file:', error)
				let fallbackSize = originalSize
				try {
					const fileInfo = await FileSystem.getInfoAsync(uri)
					if (fileInfo.exists && typeof fileInfo.size === 'number') {
						fallbackSize = fileInfo.size
					}
				} catch (infoError) {
					console.warn('Failed to read original video size:', infoError)
				}
				setCompressionProgress(100)
				onCompressionProgress?.(100)
				return {
					uri,
					size: fallbackSize,
					originalSize: fallbackSize,
					isSimulated: true
				}
			} finally {
				setIsCompressing(false)
			}
		},
		[onCompressionProgress]
	)

	// Enhanced video picker with better error handling
	const pickVideo = async () => {
		try {
			setIsLoading(true)
			setVideoError(null)
			
			// Clear any existing timeouts
			if (cleanupTimeoutRef.current) {
				clearTimeout(cleanupTimeoutRef.current)
			}

			// Trigger haptic feedback
			try {
				await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
			} catch (hapticError) {
				// Haptics might not be available on all devices
				console.warn('Haptics not available:', hapticError)
			}

			// Request permissions with better error handling
			const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
			if (status !== 'granted') {
				throw new Error('Camera roll permission is required to select videos')
			}

			// Safer ImagePicker configuration - removed problematic options
			const pickerOptions: ImagePicker.ImagePickerOptions = {
				mediaTypes: ['videos'],
				allowsEditing: false, // Disabled to prevent crashes
				allowsMultipleSelection: false,
				quality: 0.8, // Increased quality slightly
				videoMaxDuration: maxDuration,
				base64: false,
				exif: false,
				selectionLimit: 1,
				legacy: true, // Allow browsing files outside photo library (includes file managers, cloud storage, etc.)
			}

			// Add platform-specific options carefully
			if (Platform.OS === 'ios') {
				pickerOptions.presentationStyle = ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN
				pickerOptions.preferredAssetRepresentationMode = 
					ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible
			}

			const result = await ImagePicker.launchImageLibraryAsync(pickerOptions)

			if (!result.canceled && result.assets && result.assets.length > 0) {
				const videoAsset = result.assets[0]

				// Enhanced validation with null checks
				if (!videoAsset.uri) {
					throw new Error('No video URI received from picker')
				}

				// Get duration with fallback handling
				let videoDuration = videoAsset.duration ?? 0
				if (videoDuration <= 0) {
					console.warn('Invalid duration received, using default validation')
					videoDuration = maxDuration * 1000 // Assume max duration for safety
				}

				// Validate the video
				const validatedFileSize = await validateVideo(
					videoAsset.uri, 
					videoDuration, 
					videoAsset.fileSize
				)

				// Store original file size
				const originalFileSize = validatedFileSize || videoAsset.fileSize || 0

				// Compress the video
				console.log('Processing video...')
				const compressedResult = await compressVideo(
					videoAsset.uri, 
					originalFileSize
				)

				// Calculate compression ratio
				const compressionRatio = compressedResult.originalSize && compressedResult.originalSize > 0
					? Math.round(((compressedResult.originalSize - compressedResult.size) / compressedResult.originalSize) * 100)
					: 0

				console.log(`Video processing complete`)

				// Create enhanced asset object with compression data
				const enhancedAsset: VideoAsset = {
					uri: compressedResult.uri,
					width: videoAsset.width ?? 1920,
					height: videoAsset.height ?? 1080,
					duration: videoDuration,
					type: videoAsset.uri.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
					fileSize: compressedResult.size,
					originalFileSize: originalFileSize,
					originalSize: compressedResult.originalSize,
					compressionRatio: compressionRatio,
					originalDuration: videoDuration,
					isSimulated: compressedResult.isSimulated || false
				}

				// Success feedback
				try {
					await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
				} catch (hapticError) {
					console.warn('Success haptic not available:', hapticError)
				}

				onVideoSelect(enhancedAsset)
			}
		} catch (error: any) {
			console.error('Video picker error:', error)
			
			// Enhanced error handling
			let errorMessage = 'Failed to select video'
			if (error.message) {
				errorMessage = error.message
			} else if (typeof error === 'string') {
				errorMessage = error
			}

			setVideoError(errorMessage)

			// Error haptic feedback
			try {
				await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
			} catch (hapticError) {
				console.warn('Error haptic not available:', hapticError)
			}

			Alert.alert('Video Selection Error', errorMessage)
		} finally {
			setIsLoading(false)
		}
	}

	// Sync playing state with player
	useEffect(() => {
		const sub = player.addListener('playingChange', ({ isPlaying: playing }) => {
			setIsPlaying(playing)
		})
		return () => sub.remove()
	}, [player])

	// Enhanced video playback toggle with error handling
	const togglePlayback = async () => {
		try {
			if (player.status === 'error') {
				setVideoError('Video not loaded')
				return
			}

			if (isPlaying) {
				player.pause()
			} else {
				player.play()
			}

			try {
				await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
			} catch (hapticError) {
				console.warn('Playback haptic not available:', hapticError)
			}
		} catch (error) {
			console.error('Playback toggle error:', error)
			setVideoError('Playback control error')
		}
	}

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			setIsPlaying(false)
			setVideoError(null)
		}
	}, [])

	return (
		<BlurView
			intensity={isDarkMode ? 30 : 50}
			tint={isDarkMode ? 'dark' : 'light'}
			className='rounded-xl overflow-hidden'>
			<View className='p-4'>
				<Text
					className={`font-semibold mb-2 ${
						isDarkMode ? 'text-white' : 'text-black'
					}`}>
					Video *
				</Text>

				<TouchableOpacity
					onPress={pickVideo}
					disabled={disabled || isLoading}
					className={`
            border-2 border-dashed rounded-xl p-6 items-center justify-center
            ${error || videoError ? 'border-rose-500' : 'border-red'}
            ${isDarkMode ? 'bg-neutral-700/50' : 'bg-white/50'}
            ${disabled || isLoading ? 'opacity-50' : ''}
          `}>
					{isLoading || isCompressing ? (
						<>
							<ActivityIndicator color='#D55004' />
							<Text
								className={`mt-2 font-medium ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								{isCompressing ? `Compressing... ${compressionProgress}%` : 'Selecting Video...'}
							</Text>
						</>
					) : (
						<>
							<FontAwesome
								name={videoUri ? 'play' : 'video-camera'}
								size={32}
								color={isDarkMode ? '#FFFFFF' : '#000000'}
							/>
							<Text
								className={`mt-2 font-medium ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								{videoUri ? 'Change Video' : 'Select Video'}
							</Text>
							<Text
								className={`mt-1 text-xs ${
									isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
								}`}>
								MP4 or MOV • Max {Math.round(maxSize / (1024 * 1024))}MB • Max {maxDuration}s
							</Text>
						</>
					)}
				</TouchableOpacity>

				{/* Enhanced error display */}
				{(error || videoError) && (
					<View className='mt-2 p-2 bg-rose-500/10 rounded-lg'>
						<Text className='text-rose-500 text-sm'>
							{error || videoError}
						</Text>
					</View>
				)}

				{/* Enhanced video preview with error boundaries */}
				{videoUri && !videoError && (
					<View className='mt-4 rounded-xl overflow-hidden relative'>
						<VideoView
							player={player}
							className='w-full h-48 rounded-xl'
							nativeControls={false}
							contentFit="cover"
						/>
						<TouchableOpacity
							onPress={togglePlayback}
							className='absolute inset-0 items-center justify-center'
							disabled={!!videoError}>
							<BlurView intensity={30} tint='dark' className='p-4 rounded-full'>
								<Ionicons
									name={isPlaying ? 'pause' : 'play'}
									size={30}
									color='white'
								/>
							</BlurView>
						</TouchableOpacity>
						
						{/* Video error overlay */}
						{videoError && (
							<View className='absolute inset-0 bg-black/50 items-center justify-center'>
								<BlurView intensity={30} tint='dark' className='p-4 rounded-xl'>
									<Ionicons name='warning' size={24} color='white' />
									<Text className='text-white text-sm mt-2 text-center'>
										Preview Unavailable
									</Text>
								</BlurView>
							</View>
						)}
					</View>
				)}
			</View>
		</BlurView>
	)
}
