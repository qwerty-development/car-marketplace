import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	Alert,
	Modal,
	ScrollView,
	TextInput
} from 'react-native'
import {
	GestureHandlerRootView,
	PanGestureHandler
} from 'react-native-gesture-handler'
import Animated, {
	useAnimatedGestureHandler,
	useAnimatedStyle,
	withSpring,
	runOnJS,
	useSharedValue
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { FontAwesome } from '@expo/vector-icons'
import { Video, ResizeMode } from 'expo-av'
import { useTheme } from '@/utils/ThemeContext'
import { supabase } from '@/utils/supabase'
import VideoPickerButton from '@/components/VideoPickerComponent'
import CarSelector from '@/components/CarSelector'
import { useUser } from '@clerk/clerk-expo'
import { AutoClip, Car } from '@/types/autoclip'

interface PreviewAutoClipModalProps {
	clip: AutoClip | null
	isVisible: boolean
	onClose: () => void
	onDelete: (id: number) => void
	onToggleStatus: (clip: AutoClip) => void
	onEdit?: (clip: AutoClip) => void
}

export default function PreviewAutoClipModal({
	clip,
	isVisible,
	onClose,
	onDelete,
	onToggleStatus,
	onEdit
}: PreviewAutoClipModalProps) {
	const { isDarkMode } = useTheme()
	const { user } = useUser()
	const [videoRef, setVideoRef] = useState<Video | null>(null)
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
	const translateX = useSharedValue(0)
	const [isEditing, setIsEditing] = useState(false)
	const [isStatusLoading, setIsStatusLoading] = useState(false)
	const [currentClip, setCurrentClip] = useState<AutoClip | null>(null)
	const [cars, setCars] = useState<Car[]>([])

	// Edit form state
	const [editTitle, setEditTitle] = useState('')
	const [editDescription, setEditDescription] = useState('')
	const [editCarId, setEditCarId] = useState<number | null>(null)
	const [editVideoUri, setEditVideoUri] = useState('')
	const [isLoading, setIsLoading] = useState(false)

	useEffect(() => {
		if (clip) {
			setCurrentClip(clip)
			setEditTitle(clip.title)
			setEditDescription(clip.description || '')
			setEditCarId(clip.car?.id || null)
			setEditVideoUri(clip.video_url)
		}
	}, [clip])

	useEffect(() => {
		if (isEditing && user) {
			fetchCars()
		}
	}, [isEditing, user])

	useEffect(() => {
		if (!isVisible) {
			setIsEditing(false)
			if (videoRef) {
				videoRef.stopAsync()
			}
		}
	}, [isVisible])

	const fetchCars = async () => {
		if (!user) return
		try {
			const { data: dealershipData, error: dealershipError } = await supabase
				.from('dealerships')
				.select('id')
				.eq('user_id', user.id)
				.single()

			if (dealershipError) throw dealershipError

			const { data: carsData, error: carsError } = await supabase
				.from('cars')
				.select('*')
				.eq('dealership_id', dealershipData.id)
				.in('status', ['available', 'pending'])

			if (carsError) throw carsError
			if (carsData) {
				setCars(carsData)
			}
		} catch (error) {
			console.error('Error fetching cars:', error)
			Alert.alert('Error', 'Failed to load cars')
		}
	}

	const handleToggleStatus = async () => {
		if (!currentClip || isStatusLoading) return
		setIsStatusLoading(true)
		try {
			const newStatus =
				currentClip.status === 'published' ? 'draft' : 'published'
			const { error } = await supabase
				.from('auto_clips')
				.update({ status: newStatus })
				.eq('id', currentClip.id)

			if (error) throw error

			const updatedClip = { ...currentClip, status: newStatus }
			setCurrentClip(updatedClip)
		} catch (error) {
			console.error('Error:', error)
			Alert.alert('Error', 'Failed to update status')
		} finally {
			setIsStatusLoading(false)
		}
	}

	const handleSaveEdit = async () => {
		if (!currentClip) return
		if (!editTitle.trim()) {
			Alert.alert('Error', 'Title is required')
			return
		}

		setIsLoading(true)
		try {
			const updates: Partial<AutoClip> = {}

			// Only include changed fields
			if (editTitle.trim() !== currentClip.title) {
				updates.title = editTitle.trim()
			}
			if (editDescription.trim() !== (currentClip.description || '')) {
				updates.description = editDescription.trim()
			}
			if (editCarId && editCarId !== currentClip.car?.id) {
				updates.car_id = editCarId
			}
			if (editVideoUri !== currentClip.video_url) {
				updates.video_url = editVideoUri
			}

			// Only make the update if there are changes
			if (Object.keys(updates).length > 0) {
				const { error } = await supabase
					.from('auto_clips')
					.update(updates)
					.eq('id', currentClip.id)

				if (error) throw error

				// Fetch updated clip data
				const { data: updatedClip, error: fetchError } = await supabase
					.from('auto_clips')
					.select(
						`
                        *,
                        car:cars(id, year, make, model)
                    `
					)
					.eq('id', currentClip.id)
					.single()

				if (fetchError) throw fetchError

				setCurrentClip(updatedClip)
				if (onEdit) {
					onEdit(updatedClip)
				}
				Alert.alert('Success', 'AutoClip updated successfully')
			}

			setIsEditing(false)
		} catch (error) {
			console.error('Error:', error)
			Alert.alert('Error', 'Failed to update AutoClip')
		} finally {
			setIsLoading(false)
		}
	}

	const panGestureEvent = useAnimatedGestureHandler({
		onActive: event => {
			if (event.translationY > 0) {
				translateX.value = event.translationY
			}
		},
		onEnd: event => {
			if (event.translationY > 100) {
				runOnJS(onClose)()
			}
			translateX.value = withSpring(0)
		}
	})

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: translateX.value }]
	}))

	if (!currentClip) return null

	const renderPreviewMode = () => (
		<>
			<Video
				ref={ref => setVideoRef(ref)}
				source={{ uri: currentClip.video_url }}
				className='absolute inset-0 w-full h-full'
				resizeMode={ResizeMode.COVER}
				useNativeControls
				isLooping
				shouldPlay
			/>

			<TouchableOpacity
				onPress={onClose}
				className='absolute top-12 left-4 bg-black/50 p-2 rounded-full'>
				<FontAwesome name='chevron-down' size={20} color='white' />
			</TouchableOpacity>

			<View className='absolute right-4 bottom-32'>
				<TouchableOpacity className='bg-black/50 p-3 rounded-full mb-4 items-center'>
					<FontAwesome name='heart' size={25} color='white' />
					<Text className='text-white text-center mt-1 text-sm'>
						{currentClip.likes}
					</Text>
				</TouchableOpacity>

				<TouchableOpacity className='bg-black/50 p-3 rounded-full items-center'>
					<FontAwesome name='eye' size={25} color='white' />
					<Text className='text-white text-center mt-1 text-sm'>
						{currentClip.views}
					</Text>
				</TouchableOpacity>
			</View>

			<LinearGradient
				colors={['transparent', 'rgba(0,0,0,0.9)']}
				className='absolute bottom-0 left-0 right-0 pb-8 pt-16'>
				<View className='px-4'>
					<Text className='text-white text-base mb-2'>
						{currentClip.car?.year} {currentClip.car?.make}{' '}
						{currentClip.car?.model}
					</Text>

					<TouchableOpacity
						onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
						activeOpacity={0.9}>
						<Text className='text-white text-lg font-bold mb-1'>
							{currentClip.title}
						</Text>
						{currentClip.description && (
							<Text
								className='text-neutral-300'
								numberOfLines={isDescriptionExpanded ? undefined : 2}>
								{currentClip.description}
							</Text>
						)}
					</TouchableOpacity>

					<View className='flex-row mt-4'>
						<TouchableOpacity
							onPress={handleToggleStatus}
							disabled={isStatusLoading}
							className={`bg-black/50 p-2 px-4 rounded-full mr-3 flex-row items-center ${
								isStatusLoading ? 'opacity-50' : ''
							}`}>
							<FontAwesome
								name={currentClip.status === 'published' ? 'eye' : 'eye-slash'}
								size={16}
								color='white'
							/>
							<Text className='text-white ml-2'>
								{isStatusLoading
									? 'Updating...'
									: currentClip.status === 'published'
									? 'Published'
									: 'Draft'}
							</Text>
						</TouchableOpacity>

						<TouchableOpacity
							onPress={() => setIsEditing(true)}
							className='bg-black/50 p-2 px-4 rounded-full mr-3 flex-row items-center'>
							<FontAwesome name='edit' size={16} color='white' />
							<Text className='text-white ml-2'>Edit</Text>
						</TouchableOpacity>

						<TouchableOpacity
							onPress={() => {
								Alert.alert(
									'Delete AutoClip',
									'Are you sure you want to delete this clip?',
									[
										{ text: 'Cancel', style: 'cancel' },
										{
											text: 'Delete',
											style: 'destructive',
											onPress: () => {
												onDelete(currentClip.id)
												onClose()
											}
										}
									]
								)
							}}
							className='bg-red/50 p-2 px-4 rounded-full flex-row items-center'>
							<FontAwesome name='trash' size={16} color='white' />
							<Text className='text-white ml-2'>Delete</Text>
						</TouchableOpacity>
					</View>
				</View>
			</LinearGradient>
		</>
	)

	const renderEditMode = () => (
		<ScrollView className='flex-1'>
			<View
				className={`flex-row justify-between items-center p-4 mt-12 border-b border-red ${
					isDarkMode ? 'bg-black' : 'bg-white'
				}`}>
				<TouchableOpacity onPress={() => setIsEditing(false)}>
					<FontAwesome
						name='arrow-left'
						size={24}
						color={isDarkMode ? 'white' : 'black'}
					/>
				</TouchableOpacity>
				<Text
					className={`text-lg font-bold ${
						isDarkMode ? 'text-white' : 'text-black'
					}`}>
					Edit AutoClip
				</Text>
				<TouchableOpacity onPress={handleSaveEdit} disabled={isLoading}>
					<Text className={`text-red ${isLoading ? 'opacity-50' : ''}`}>
						{isLoading ? 'Saving...' : 'Save'}
					</Text>
				</TouchableOpacity>
			</View>

			<View className='p-4'>
				<View className='mb-4'>
					<Text className={`mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
						Title
					</Text>
					<TextInput
						value={editTitle}
						onChangeText={setEditTitle}
						className={`p-3 rounded-lg ${
							isDarkMode
								? 'bg-neutral-800 text-white'
								: 'bg-neutral-100 text-black'
						}`}
						placeholderTextColor={isDarkMode ? '#666' : '#999'}
					/>
				</View>

				<View className='mb-4'>
					<Text className={`mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
						Description
					</Text>
					<TextInput
						value={editDescription}
						onChangeText={setEditDescription}
						multiline
						numberOfLines={4}
						className={`p-3 rounded-lg ${
							isDarkMode
								? 'bg-neutral-800 text-white'
								: 'bg-neutral-100 text-black'
						}`}
						placeholderTextColor={isDarkMode ? '#666' : '#999'}
						textAlignVertical='top'
						style={{ minHeight: 100 }}
					/>
				</View>

				<View className='mb-4'>
					<Text className={`mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
						Car
					</Text>
					<CarSelector
						cars={cars}
						selectedCarId={editCarId}
						onCarSelect={setEditCarId}
					/>
				</View>

				<View className='mb-4'>
					<Text className={`mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
						Video
					</Text>
					<Video
						source={{ uri: editVideoUri }}
						style={{ width: '100%', height: 200 }}
						resizeMode={ResizeMode.COVER}
						useNativeControls
						className='rounded-lg mb-2'
					/>
					<VideoPickerButton
						onVideoSelected={(uri: React.SetStateAction<string>) =>
							setEditVideoUri(uri)
						}
					/>
				</View>
			</View>
		</ScrollView>
	)

	return (
		<Modal
			visible={isVisible}
			onRequestClose={onClose}
			animationType='slide'
			presentationStyle='fullScreen'
			statusBarTranslucent>
			<GestureHandlerRootView style={{ flex: 1 }}>
				<LinearGradient
					colors={isDarkMode ? ['#000000', '#1A1A1A'] : ['#FFFFFF', '#F0F0F0']}
					className='flex-1'>
					<PanGestureHandler onGestureEvent={panGestureEvent}>
						<Animated.View
							style={[{ flex: 1 }, animatedStyle]}
							className={isDarkMode ? 'bg-black' : 'bg-white'}>
							{!isEditing ? renderPreviewMode() : renderEditMode()}
						</Animated.View>
					</PanGestureHandler>
				</LinearGradient>
			</GestureHandlerRootView>
		</Modal>
	)
}
