import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { supabase } from '@/utils/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/utils/ThemeContext';
import { FontAwesome, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import VideoPickerButton from './VideoPickerComponent';
import CarSelector from './CarSelector';
import { ResizeMode, Video, AVPlaybackStatus } from 'expo-av';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = ['mp4', 'mov', 'quicktime'];
const MAX_VIDEO_DURATION = 20;

// Reusable Section Header Component (matching car listing modal)
const SectionHeader = ({ title, subtitle, isDarkMode }:any) => (
  <View className="mb-4">
    <LinearGradient
      colors={isDarkMode ? ['#D55004', '#FF6B00'] : ['#000', '#333']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      className="w-12 h-1 rounded-full mb-2"
    />
    <Text className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
      {title}
    </Text>
    {subtitle && (
      <Text className={`text-sm mt-1 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
        {subtitle}
      </Text>
    )}
  </View>
);

// Reusable Input Component (matching car listing modal)
const NeumorphicInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  required = false,
  error,
  isDarkMode,
  maxLength,
}:any) => (
  <Animated.View entering={FadeIn.duration(400)} className="mb-6">
    <Text className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
      {label} {required && <Text className="text-red">*</Text>}
    </Text>

    <View className={`rounded-2xl overflow-hidden ${isDarkMode ? 'bg-[#1c1c1c]' : 'bg-[#f5f5f5]'}`}>
      <BlurView
        intensity={isDarkMode ? 20 : 40}
        tint={isDarkMode ? 'dark' : 'light'}
        className="p-2"
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={isDarkMode ? '#666' : '#999'}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          maxLength={maxLength}
          className={`text-base ${isDarkMode ? 'text-white' : 'text-black'}`}
          style={{
            height: multiline ? 100 : 50,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
      </BlurView>
    </View>

    {error && <Text className="text-red text-xs mt-1 ml-1">{error}</Text>}
    {maxLength && (
      <Text className={`text-right mt-1 text-xs ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
        {value.length}/{maxLength}
      </Text>
    )}
  </Animated.View>
);

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

	return (
		<Modal
		  visible={isVisible}
		  animationType="none"
		  transparent
		  statusBarTranslucent
		>
		  <KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			className="flex-1"
			keyboardVerticalOffset={Platform.OS === "ios" ? -64 : 0}
			style={{ zIndex: 999 }}
		  >
			<Animated.View
			  entering={FadeIn}
			  exiting={FadeOut}
			  className="flex-1"
			  style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1000 }}
			>
			  <BlurView
				intensity={isDarkMode ? 30 : 20}
				tint={isDarkMode ? "dark" : "light"}
				className="flex-1"
			  >
				<Animated.View
				  entering={SlideInDown}
				  exiting={SlideOutDown}
				  className={`flex-1 mt-12 rounded-t-3xl overflow-hidden ${
					isDarkMode ? 'bg-black' : 'bg-white'
				  }`}
				>
				  {/* Header */}
				  <View className="flex-row items-center justify-between px-6 py-4">
					<TouchableOpacity onPress={onClose} className="p-2">
					  <Ionicons
						name="close"
						size={24}
						color={isDarkMode ? "white" : "black"}
					  />
					</TouchableOpacity>
					<Text className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
					  Create AutoClip
					</Text>
					<TouchableOpacity
					  onPress={handleSubmit}
					  disabled={isLoading}
					  className="bg-red px-4 py-2 rounded-full"
					>
					  <Text className="text-white font-medium">
						{isLoading ? 'Creating...' : 'Create'}
					  </Text>
					</TouchableOpacity>
				  </View>
	
				  <ScrollView
					className="flex-1 px-6"
					showsVerticalScrollIndicator={false}
					keyboardShouldPersistTaps="handled"
				  >
					{/* Video Section */}
					<View className="py-4">
					  <SectionHeader
						title="Video Upload"
						subtitle="Select a video to share with your audience"
						isDarkMode={isDarkMode}
					  />
					  <VideoPickerButton
						onVideoSelect={handleVideoSelect}
						videoUri={video?.uri}
					  />
					  {videoError && (
						<Text className="text-red text-xs mt-2">{videoError}</Text>
					  )}
					</View>
	
					{/* Basic Information */}
					<View className="mb-8">
					  <SectionHeader
						title="Clip Details"
						subtitle="Add information about your AutoClip"
						isDarkMode={isDarkMode}
					  />
					  
					  <NeumorphicInput
						label="Title"
						value={title}
						onChangeText={setTitle}
						placeholder="Enter title"
						required
						error={titleError}
						isDarkMode={isDarkMode}
						maxLength={50}
					  />
	
					  <NeumorphicInput
						label="Description"
						value={description}
						onChangeText={setDescription}
						placeholder="Enter description"
						multiline
						error={descriptionError}
						isDarkMode={isDarkMode}
						maxLength={500}
					  />
					</View>
	
					{/* Car Selection */}
					<View className="mb-8">
					  <SectionHeader
						title="Featured Vehicle"
						subtitle="Select the car featured in this clip"
						isDarkMode={isDarkMode}
					  />
					  <CarSelector
						cars={cars}
						selectedCarId={selectedCarId}
						onCarSelect={setSelectedCarId}
						error={carError}
					  />
					</View>
	
					{/* Upload Progress */}
					{isLoading && uploadProgress > 0 && (
					  <View className="mb-8">
						<SectionHeader
						  title="Uploading"
						  subtitle={`Progress: ${uploadProgress}%`}
						  isDarkMode={isDarkMode}
						/>
						<View className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
						  <LinearGradient
							colors={['#D55004', '#FF6B00']}
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 0 }}
							className="h-full rounded-full"
							style={{ width: `${uploadProgress}%` }}
						  />
						</View>
					  </View>
					)}
	
					{/* Guidelines */}
					<View className="mb-8">
					  <SectionHeader
						title="Guidelines"
						subtitle="Important information about creating AutoClips"
						isDarkMode={isDarkMode}
					  />
					  <BlurView
						intensity={isDarkMode ? 20 : 40}
						tint={isDarkMode ? "dark" : "light"}
						className="p-4 rounded-2xl"
					  >
						<View className="space-y-2">
						  <Text className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
							• Video must be less than 50MB
						  </Text>
						  <Text className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
							• Maximum duration: 60 seconds
						  </Text>
						  <Text className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
							• Supported formats: MP4, MOV
						  </Text>
						  <Text className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
							• Title must be at least 3 characters
						  </Text>
						  <Text className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
							• Description must be at least 10 characters if provided
						  </Text>
						</View>
					  </BlurView>
					</View>
	
					{/* Bottom Spacing */}
					<View className="h-20" />
				  </ScrollView>
				</Animated.View>
			  </BlurView>
			</Animated.View>
		  </KeyboardAvoidingView>
		</Modal>
	  );
	}