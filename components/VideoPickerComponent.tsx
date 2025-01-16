import React, { useCallback, useState } from 'react'
import {
	TouchableOpacity,
	Text,
	View,
	Alert,
	ActivityIndicator
} from 'react-native'
import { FontAwesome } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useTheme } from '@/utils/ThemeContext'
import * as Haptics from 'expo-haptics'
import * as FileSystem from 'expo-file-system'
import { Video } from 'react-native-compressor'
import { BlurView } from 'expo-blur'

interface VideoAsset {
	uri: string
	width: number
	height: number
	duration: number
	type?: string
	fileSize?: number
	originalDuration?: number // Should be in milliseconds
}

interface VideoPickerButtonProps {
	onVideoSelect: (video: VideoAsset) => void
	videoUri?: string
	maxDuration?: number
	maxSize?: number
	error?: string
	disabled?: boolean
}

export default function VideoPickerButton({
	onVideoSelect,
	maxSize = 50 * 1024 * 1024, // 50MB
	maxDuration = 20,
	error,
	disabled
}: VideoPickerButtonProps) {
	const { isDarkMode } = useTheme()
	const [isLoading, setIsLoading] = useState(false)
	const [isCompressing, setIsCompressing] = useState(false)

	const validateVideo = useCallback(
		async (uri: string, duration: number, fileSize?: number) => {
			// Check duration
			if (duration > maxDuration * 1000) {
				throw new Error(`Video must be ${maxDuration} seconds or shorter`)
			}

			// Check file size (before compression)
			if (!fileSize) {
				const fileInfo: any = await FileSystem.getInfoAsync(uri)
				fileSize = fileInfo.size
			}

			if (fileSize && fileSize > maxSize) {
				console.warn(
					`Video is larger than ${
						maxSize / (1024 * 1024)
					}MB, compression is recommended.`
				)
			}

			// Validate format
			const extension = uri.split('.').pop()?.toLowerCase()
			if (!extension || !['mp4', 'mov'].includes(extension)) {
				throw new Error('Video must be in MP4 or MOV format')
			}
		},
		[maxDuration, maxSize]
	)

	const pickVideo = async () => {
		try {
			setIsLoading(true)
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

			const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

			if (status !== 'granted') {
				throw new Error('Camera roll permission is required')
			}

			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ImagePicker.MediaTypeOptions.Videos,
				allowsEditing: true,
				quality: 1
			})

			if (!result.canceled && result.assets.length > 0) {
				const videoAsset = result.assets[0]
				const videoDuration = videoAsset.duration ?? 0

				if (!videoAsset.uri) {
					throw new Error('No video URI received')
				}

				await validateVideo(videoAsset.uri, videoDuration, videoAsset.fileSize)

				setIsCompressing(true)

				const compressedUri = await Video.compress(
					videoAsset.uri,
					{
						compressionMethod: 'auto'
					},
					(progress: number) => {
						console.log('Compression Progress:', progress)
						// Update UI with progress (optional)
					}
				)

				console.log('Compressed URI:', compressedUri)

				const fileInfo: any = await FileSystem.getInfoAsync(compressedUri)
				if (!fileInfo.exists) {
					throw new Error('Compression failed: Output file not found')
				}
				const compressedFileSize = fileInfo.size

				if (compressedFileSize && compressedFileSize > maxSize) {
					throw new Error(
						`Compressed video size must be less than ${
							maxSize / (1024 * 1024)
						}MB`
					)
				}

				const isMovFile = compressedUri.toLowerCase().endsWith('.mov')
				const assetWithType: any = {
					...videoAsset,
					uri: compressedUri, // Use compressed URI
					type: isMovFile ? 'video/quicktime' : 'video/mp4',
					originalDuration: videoDuration,
					fileSize: compressedFileSize
				}

				onVideoSelect(assetWithType)
			}
		} catch (error: any) {
			console.error('Error picking video:', error)
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
			Alert.alert('Error', error.message || 'Failed to select video')
		} finally {
			setIsCompressing(false)
			setIsLoading(false)
		}
	}

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
					disabled={disabled || isLoading || isCompressing}
					className={`
            border-2 border-dashed rounded-xl p-6 items-center justify-center
            ${error ? 'border-rose-500' : 'border-red'}
            ${isDarkMode ? 'bg-gray/50' : 'bg-white/50'}
            ${disabled || isCompressing ? 'opacity-50' : ''}
          `}>
					{isLoading ? (
						isCompressing ? (
							<View className='items-center justify-center'>
								<ActivityIndicator color='#D55004' />
								<Text
									className={`mt-2 font-medium ${
										isDarkMode ? 'text-white' : 'text-black'
									}`}>
									Compressing...
								</Text>
							</View>
						) : (
							<ActivityIndicator color='#D55004' />
						)
					) : (
						<>
							<FontAwesome
								name={'video-camera'}
								size={32}
								color={isDarkMode ? '#FFFFFF' : '#000000'}
							/>
							<Text
								className={`mt-2 font-medium ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								Select Video
							</Text>
							<Text
								className={`mt-1 text-xs ${
									isDarkMode ? 'text-gray' : 'text-gray'
								}`}>
								MP4 or MOV • Max {maxSize / (1024 * 1024)}MB • Max {maxDuration}
								s
							</Text>
						</>
					)}
				</TouchableOpacity>

				{error && <Text className='text-rose-500 text-sm mt-1'>{error}</Text>}
			</View>
		</BlurView>
	)
}
