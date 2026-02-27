import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	Modal,
	TouchableOpacity,
	TextInput,
	Alert,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	ActivityIndicator,
	Image
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { BlurView } from 'expo-blur'
import { useTheme } from '@/utils/ThemeContext'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Ionicons } from '@expo/vector-icons'

interface Car {
	id: number
	make: string
	model: string
	year: number
	images: string[]
	status: string
}

interface AutoClip {
	id: number
	dealership_id: number
	car_id: number
	title: string
	description: string
	video_url: string
	thumbnail_url: string
	views: number
	likes: number
	status: 'published' | 'draft'
	created_at: string
	published_at: string | null
	viewed_users: string[]
	liked_users: string[]
}

interface EditAutoClipModalProps {
	isVisible: boolean
	onClose: () => void
	clip: AutoClip
	onSuccess: () => void
}

const EditAutoClipModal: React.FC<EditAutoClipModalProps> = ({
	isVisible,
	onClose,
	clip,
	onSuccess
}) => {
	const { isDarkMode } = useTheme()
	const [title, setTitle] = useState('')
	const [description, setDescription] = useState('')
	const [loading, setLoading] = useState(false)
	const [dealershipCars, setDealershipCars] = useState<Car[]>([])
	const [selectedCar, setSelectedCar] = useState<Car | null>(null)
	const [loadingCars, setLoadingCars] = useState(false)

	const player = useVideoPlayer(clip?.video_url ?? null, player => {
		player.muted = true
		player.loop = false
	})

	useEffect(() => {
		if (clip) {
			setTitle(clip.title || '')
			setDescription(clip.description || '')
			fetchCarDetails()
			fetchDealershipCars()
		}
	}, [clip])

	const fetchCarDetails = async () => {
		if (!clip?.car_id) return

		try {
			const { data, error } = await supabase
				.from('cars')
				.select('*')
				.eq('id', clip.car_id)
				.single()

			if (error) throw error
			if (data) setSelectedCar(data)
		} catch (error) {
			console.error('Error fetching car details:', error)
		}
	}

	const fetchDealershipCars = async () => {
		if (!clip?.dealership_id) return

		setLoadingCars(true)
		try {
			const { data, error } = await supabase
				.from('cars')
				.select(
					`
                id,
                make,
                model,
                year,
                images,
                status,
                auto_clips!left(id)
            `
				)
				.eq('dealership_id', clip.dealership_id)
				.eq('status', 'available')
				.order('listed_at', { ascending: false })

			if (error) throw error

			// Filter cars:
			// 1. Include currently associated car
			// 2. Include cars with no autoclips
			const availableCars = data
				?.filter(
					car =>
						car.id === clip.car_id ||
						!car.auto_clips ||
						car.auto_clips.length === 0
				)
				.map(({ auto_clips, ...carData }) => carData)

			setDealershipCars(availableCars || [])
		} catch (error) {
			console.error('Error fetching dealership cars:', error)
			Alert.alert('Error', 'Failed to load cars')
		} finally {
			setLoadingCars(false)
		}
	}

	const handleUpdate = async () => {
		if (!title.trim()) {
			Alert.alert('Error', 'Please enter a title')
			return
		}

		setLoading(true)
		try {
			// Only check for existing autoclip if changing the car
			if (selectedCar && selectedCar.id !== clip.car_id) {
				// Check if selected car already has an autoclip
				const { data: existingClip, error: checkError } = await supabase
					.from('auto_clips')
					.select('id')
					.eq('car_id', selectedCar.id)
					.neq('id', clip.id) // Exclude current clip
					.single()

				if (checkError && checkError.code !== 'PGRST116') {
					throw checkError
				}

				if (existingClip) {
					Alert.alert('Error', 'Selected car already has an AutoClip')
					return
				}
			}

			const updateData: Partial<AutoClip> = {
				title: title.trim(),
				description: description.trim()
			}

			if (selectedCar && selectedCar.id !== clip.car_id) {
				updateData.car_id = selectedCar.id
			}

			const { error } = await supabase
				.from('auto_clips')
				.update(updateData)
				.eq('id', clip.id)

			if (error) throw error

			Alert.alert('Success', 'AutoClip updated successfully')
			onSuccess()
			onClose()
		} catch (error) {
			console.error('Error updating autoclip:', error)
			Alert.alert('Error', 'Failed to update AutoClip')
		} finally {
			setLoading(false)
		}
	}

	const renderCarSelection = () => (
		<View className='mb-6'>
			<Text
				className={`text-sm mb-2 ${
					isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
				}`}>
				Associated Car (Optional)
			</Text>

			{loadingCars ? (
				<ActivityIndicator size='small' color='#D55004' />
			) : dealershipCars.length === 0 ? (
				<View className='p-4 rounded-xl bg-neutral-900/5 dark:bg-white/5'>
					<Text
						className={`text-sm text-center ${
							isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
						}`}>
						No cars available for selection.
						{'\n'}All cars already have associated clips.
					</Text>
				</View>
			) : (
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					className='space-x-2'>
					{dealershipCars.map(car => (
						<TouchableOpacity
							key={car.id}
							onPress={() => setSelectedCar(car)}
							className={`p-3 rounded-xl border ${
								selectedCar?.id === car.id
									? 'border-red bg-red/10'
									: isDarkMode
									? 'border-neutral-700 bg-[#2A2A2A]'
									: 'border-neutral-200 bg-neutral-50'
							}`}>
							<View className='w-32'>
								{car.images?.[0] && (
									<View className='h-20 rounded-lg overflow-hidden mb-2'>
										<Image
											source={{ uri: car.images[0] }}
											className='w-full h-full'
										/>
									</View>
								)}
								<Text
									className={`text-sm font-medium ${
										isDarkMode ? 'text-white' : 'text-black'
									}`}>
									{car.year} {car.make}
								</Text>
								<Text
									className={`text-xs ${
										isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
									}`}>
									{car.model}
								</Text>
							</View>
						</TouchableOpacity>
					))}
				</ScrollView>
			)}
		</View>
	)

	return (
		<Modal
			visible={isVisible}
			animationType='slide'
			transparent={true}
			onRequestClose={onClose}>
			<KeyboardAvoidingView
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				style={{ flex: 1 }}>
				<BlurView
					intensity={95}
					tint={isDarkMode ? 'dark' : 'light'}
					style={{ flex: 1 }}>
					<View className='flex-1 mt-16'>
						<View
							className={`flex-1 mx-4 rounded-3xl ${
								isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white'
							} shadow-xl overflow-hidden`}>
							{/* Header */}
							<View className='p-4 border-b border-neutral-200 dark:border-neutral-800 flex-row justify-between items-center'>
								<TouchableOpacity onPress={onClose} className='p-2 -ml-2'>
									<Ionicons
										name='close'
										size={24}
										color={isDarkMode ? '#FFFFFF' : '#000000'}
									/>
								</TouchableOpacity>
								<Text
									className={`text-lg font-semibold ${
										isDarkMode ? 'text-white' : 'text-black'
									}`}>
									Edit AutoClip
								</Text>
								<TouchableOpacity
									onPress={handleUpdate}
									disabled={loading}
									className='p-2 -mr-2'>
									<Text
										className={`font-semibold ${
											loading ? 'text-neutral-400' : 'text-red'
										}`}>
										{loading ? 'Saving...' : 'Save'}
									</Text>
								</TouchableOpacity>
							</View>

							<ScrollView className='flex-1 p-4 mb-10'>
								{/* Video Preview */}
								{clip?.video_url && (
									<View className='mb-6 rounded-xl overflow-hidden shadow-lg'>
										<VideoView
											player={player}
											style={{ height: 200 }}
											nativeControls={false}
											contentFit="cover"
										/>
									</View>
								)}

								{/* Car Selection */}
								{renderCarSelection()}

								{/* Title Input */}
								<View className='mb-4'>
									<Text
										className={`text-sm mb-2 ${
											isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
										}`}>
										Title
									</Text>
									<TextInput
                   textAlignVertical="center"
										value={title}
										onChangeText={setTitle}
										placeholder='Enter title'
										placeholderTextColor={isDarkMode ? '#666' : '#999'}
										className={`p-3 rounded-xl border ${
											isDarkMode
												? 'bg-[#2A2A2A] border-neutral-700 text-white'
												: 'bg-neutral-50 border-neutral-200 text-black'
										}`}
									/>
								</View>

								{/* Description Input */}
								<View className='mb-4'>
									<Text
										className={`text-sm mb-2 ${
											isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
										}`}>
										Description
									</Text>
									<TextInput
										value={description}
										onChangeText={setDescription}
										placeholder='Enter description'
										placeholderTextColor={isDarkMode ? '#666' : '#999'}
										multiline
										numberOfLines={4}
										className={`p-3 rounded-xl border ${
											isDarkMode
												? 'bg-[#2A2A2A] border-neutral-700 text-white'
												: 'bg-neutral-50 border-neutral-200 text-black'
										}`}
										textAlignVertical='top'
									/>
								</View>

								{/* Status Info */}
								<View className='mb-4 p-4 rounded-xl bg-neutral-900/5 dark:bg-white/5'>
									<Text
										className={`text-sm ${
											isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
										}`}>
										Status:{' '}
										<Text className='font-medium capitalize'>
											{clip?.status}
										</Text>
									</Text>
									<Text
										className={`text-xs mt-1 ${
											isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
										}`}>
										Created: {new Date(clip?.created_at).toLocaleDateString()}
									</Text>
									{clip?.published_at && (
										<Text
											className={`text-xs mt-1 ${
												isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
											}`}>
											Published:{' '}
											{new Date(clip.published_at).toLocaleDateString()}
										</Text>
									)}
								</View>

								{/* Stats */}
								<View className='flex-row justify-around p-4 bg-neutral-900/5 dark:bg-white/5 rounded-xl'>
									<View className='items-center'>
										<Text
											className={`text-2xl font-bold ${
												isDarkMode ? 'text-white' : 'text-black'
											}`}>
											{clip?.views || 0}
										</Text>
										<Text
											className={`text-xs ${
												isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
											}`}>
											Views
										</Text>
									</View>
									<View className='items-center'>
										<Text
											className={`text-2xl font-bold ${
												isDarkMode ? 'text-white' : 'text-black'
											}`}>
											{clip?.likes || 0}
										</Text>
										<Text
											className={`text-xs ${
												isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
											}`}>
											Likes
										</Text>
									</View>
									<View className='items-center'>
										<Text
											className={`text-2xl font-bold ${
												isDarkMode ? 'text-white' : 'text-black'
											}`}>
											{clip?.liked_users?.length || 0}
										</Text>
										<Text
											className={`text-xs ${
												isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
											}`}>
											Unique Likes
										</Text>
									</View>
								</View>
							</ScrollView>
						</View>
					</View>
				</BlurView>
			</KeyboardAvoidingView>
		</Modal>
	)
}

export default EditAutoClipModal
