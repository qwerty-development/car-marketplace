// VideoPickerButton.tsx
import React, { useCallback, useState } from 'react'
import {
	TouchableOpacity,
	Text,
	View,
	Alert,
	ActivityIndicator
} from 'react-native'
import { FontAwesome, Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { Video, AVPlaybackStatus } from 'expo-av'
import { useTheme } from '@/utils/ThemeContext'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import * as FileSystem from 'expo-file-system'

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
	videoUri,
	maxSize = 50 * 1024 * 1024, // 100MB
	maxDuration = 20,
	error,
	disabled
}: VideoPickerButtonProps) {
	const { isDarkMode } = useTheme()
	const [isLoading, setIsLoading] = useState(false)
	const [isPlaying, setIsPlaying] = useState(false)
	const [videoRef, setVideoRef] = useState<Video | null>(null)

	const validateVideo = useCallback(
		async (uri: string, duration: number, fileSize?: number) => {
		  if (duration > maxDuration * 1000) {
			throw new Error(`Video must be ${maxDuration} seconds or shorter`)
		  }
	  
		  if (!fileSize) {
			const fileInfo: any = await FileSystem.getInfoAsync(uri)
			fileSize = fileInfo.size
		  }
	  
		  if (fileSize && fileSize > maxSize) {
			throw new Error(`Video must be smaller than ${maxSize / (1024 * 1024)}MB`)
		  }
	  
		  const extension = uri.split('.').pop()?.toLowerCase()
		  if (!extension || !['mp4', 'mov', 'hevc'].includes(extension)) {
			throw new Error('Video must be in MP4, MOV, or HEVC format')
		  }
		},
		[maxDuration, maxSize]
	  )
	  
	  const pickVideo = async () => {
		try {
		  setIsLoading(true)
		  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
		  if (status !== 'granted') throw new Error('Permission required')
	  
		  const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Videos,
			allowsEditing: true,
			videoExportPreset: ImagePicker.VideoExportPreset.HEVC_1920x1080,
			videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
			videoMaxDuration: maxDuration
		  })
	  
		  if (!result?.assets?.[0]?.uri) return
	  
		  const videoAsset = result.assets[0]
		  const videoDuration = videoAsset.duration || 0
		  
		  await validateVideo(videoAsset.uri, videoDuration, videoAsset.fileSize)
	  
		  const type = videoAsset.uri.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 
					   videoAsset.uri.toLowerCase().endsWith('.hevc') ? 'video/hevc' : 'video/mp4'
	  
		  onVideoSelect({
			uri: videoAsset.uri,
			width: videoAsset.width,
			height: videoAsset.height,
			duration: videoDuration,
			type,
			fileSize: videoAsset.fileSize,
			originalDuration: videoDuration
		  })
	  
		} catch (error: any) {
		  Alert.alert('Error', error.message || 'Failed to select video')
		} finally {
		  setIsLoading(false)
		}
	  }

	const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
		if (!status.isLoaded) return
		setIsPlaying(status.isPlaying)
	}

	const togglePlayback = async () => {
		if (!videoRef) return

		try {
			if (isPlaying) {
				await videoRef.pauseAsync()
			} else {
				await videoRef.playAsync()
			}
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
		} catch (error) {
			console.error('Playback error:', error)
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
					disabled={disabled || isLoading}
					className={`
            border-2 border-dashed rounded-xl p-6 items-center justify-center
            ${error ? 'border-rose-500' : 'border-red'}
            ${isDarkMode ? 'bg-neutral-700/50' : 'bg-white/50'}
            ${disabled ? 'opacity-50' : ''}
          `}>
					{isLoading ? (
						<ActivityIndicator color='#D55004' />
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
									isDarkMode ? 'text-neutral-700' : 'text-neutral-700'
								}`}>
								MP4 or MOV • Max {maxSize / (1024 * 1024)}
								MB • Max {maxDuration}s
							</Text>
						</>
					)}
				</TouchableOpacity>

				{error && <Text className='text-rose-500 text-sm mt-1'>{error}</Text>}

				{videoUri && (
					<View className='mt-4 rounded-xl overflow-hidden relative'>
						<Video
							ref={setVideoRef}
							source={{ uri: videoUri }}
							className='w-full h-48 rounded-xl'
							useNativeControls={false}
							isLooping
							onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
						/>
						<TouchableOpacity
							onPress={togglePlayback}
							className='absolute inset-0 items-center justify-center'>
							<BlurView intensity={30} tint='dark' className='p-4 rounded-full'>
								<Ionicons
									name={isPlaying ? 'pause' : 'play'}
									size={30}
									color='white'
								/>
							</BlurView>
						</TouchableOpacity>
					</View>
				)}
			</View>
		</BlurView>
	)
}
