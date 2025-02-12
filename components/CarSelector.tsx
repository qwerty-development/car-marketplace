import React, { useMemo, useCallback, useState } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	Modal,
	ScrollView,
	TextInput,
	Pressable
} from 'react-native'
import { Car } from '@/types/autoclip'
import { BlurView } from 'expo-blur'
import {
	Ionicons,
	MaterialCommunityIcons,
	FontAwesome
} from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import Animated, {
	FadeIn,
	FadeOut,
	SlideInDown,
	SlideOutDown,
	useAnimatedStyle,
	withSpring,
	useSharedValue
} from 'react-native-reanimated'

interface CarSelectorProps {
	cars: Car[]
	selectedCarId: number | null
	onCarSelect: (carId: number) => void
	error?: string
	disabled?: boolean
	isDarkMode?: boolean
	showUnavailable?: boolean
}

const CarCard = React.memo(
	({
		car,
		isSelected,
		onSelect,
		isDarkMode,
		disabled
	}: {
		car: Car
		isSelected: boolean
		onSelect: () => void
		isDarkMode: boolean
		disabled?: boolean
	}) => {
		const scale = useSharedValue(1)

		const handlePress = useCallback(async () => {
			if (disabled) return
			scale.value = withSpring(0.95)
			await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
			onSelect()
			scale.value = withSpring(1)
		}, [onSelect, disabled])

		const animatedStyle = useAnimatedStyle(() => ({
			transform: [{ scale: scale.value }]
		}))

		return (
			<Animated.View style={animatedStyle}>
				<Pressable
					onPress={handlePress}
					className={`mb-3 ${disabled ? 'opacity-50' : ''}`}>
					<BlurView
						intensity={isDarkMode ? 20 : 40}
						tint={isDarkMode ? 'dark' : 'light'}
						className='rounded-2xl overflow-hidden'>
						<LinearGradient
							colors={
								isSelected
									? ['#D55004', '#FF6B00']
									: isDarkMode
									? ['#1c1c1c', '#2d2d2d']
									: ['#f5f5f5', '#e5e5e5']
							}
							className='p-4'
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 1 }}>
							<View className='flex-row justify-between items-center'>
								<View className='flex-1'>
									<View className='flex-row items-center'>
										<MaterialCommunityIcons
											name='car-sports'
											size={24}
											color={isSelected ? '#fff' : isDarkMode ? '#fff' : '#000'}
										/>
										<Text
											className={`ml-3 text-lg font-medium ${
												isSelected
													? 'text-white'
													: isDarkMode
													? 'text-white'
													: 'text-black'
											}`}>
											{car.year} {car.make} {car.model}
										</Text>
									</View>

									<View className='flex-row mt-2 space-x-4'>
										<View className='flex-row items-center'>
											<MaterialCommunityIcons
												name='cash'
												size={16}
												color={
													isSelected
														? '#fff'
														: isDarkMode
														? '#D55004'
														: '#FF6B00'
												}
											/>
											<Text
												className={`ml-1 ${
													isSelected
														? 'text-white'
														: isDarkMode
														? 'text-neutral-300'
														: 'text-neutral-700'
												}`}>
												${car.price.toLocaleString()}
											</Text>
										</View>

										<View className='flex-row items-center'>
											<MaterialCommunityIcons
												name='tag'
												size={16}
												color={
													isSelected
														? '#fff'
														: isDarkMode
														? '#D55004'
														: '#FF6B00'
												}
											/>
											<Text
												className={`ml-1 ${
													isSelected
														? 'text-white'
														: isDarkMode
														? 'text-neutral-300'
														: 'text-neutral-700'
												}`}>
												{car.status.toUpperCase()}
											</Text>
										</View>
									</View>
								</View>

								{isSelected && (
									<View className='bg-white/20 p-2 rounded-full'>
										<Ionicons name='checkmark' size={24} color='white' />
									</View>
								)}
							</View>
						</LinearGradient>
					</BlurView>
				</Pressable>
			</Animated.View>
		)
	}
)

export default function CarSelector({
	cars,
	selectedCarId,
	onCarSelect,
	error,
	disabled,
	isDarkMode = false,
	showUnavailable = false // Default to false
}: CarSelectorProps) {
	const [isModalVisible, setIsModalVisible] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')

	const filteredCars = useMemo(() => {
		return cars.filter(car => {
			const searchTerm = searchQuery.toLowerCase()
			const matchesSearch =
				car.make.toLowerCase().includes(searchTerm) ||
				car.model.toLowerCase().includes(searchTerm) ||
				car.year.toString().includes(searchTerm)

			if (!showUnavailable && car.auto_clips) {
				return false
			}

			return matchesSearch
		})
	}, [cars, searchQuery, showUnavailable])

	const selectedCar = useMemo(
		() => cars.find(car => car.id === selectedCarId),
		[cars, selectedCarId]
	)

	const handleOpenModal = useCallback(async () => {
		if (disabled) return
		await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
		setIsModalVisible(true)
	}, [disabled])

	const handleSelect = useCallback(
		async (carId: number) => {
			await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
			onCarSelect(carId)
			setIsModalVisible(false)
		},
		[onCarSelect]
	)

	const noResultsMessage = useMemo(() => {
		if (cars.length === 0) {
			return 'No cars available. Please add cars first.'
		}
		if (searchQuery && filteredCars.length === 0) {
			return 'No cars match your search.'
		}
		return 'No cars available for new AutoClips.'
	}, [cars.length, searchQuery, filteredCars.length])

	return (
		<>
			{filteredCars.length === 0 && (
				<View className='flex-1 justify-center items-center py-8'>
					<MaterialCommunityIcons
						name='car-off'
						size={48}
						color={isDarkMode ? '#666' : '#999'}
					/>
					<Text
						className={`mt-4 text-center ${
							isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
						}`}>
						{noResultsMessage}
					</Text>
				</View>
			)}
			<Pressable onPress={handleOpenModal}>
				<BlurView
					intensity={isDarkMode ? 20 : 40}
					tint={isDarkMode ? 'dark' : 'light'}
					className={`rounded-2xl overflow-hidden ${
						error ? 'border border-red' : ''
					}`}>
					<LinearGradient
						colors={
							isDarkMode ? ['#1c1c1c', '#2d2d2d'] : ['#f5f5f5', '#e5e5e5']
						}
						className='p-4'
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}>
						<View className='flex-row justify-between items-center'>
							<View className='flex-1'>
								<Text
									className={`text-sm font-medium mb-1 ${
										isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
									}`}>
									Select Car *
								</Text>
								<Text
									className={`text-base ${
										isDarkMode ? 'text-white' : 'text-black'
									}`}>
									{selectedCar
										? `${selectedCar.year} ${selectedCar.make} ${selectedCar.model}`
										: 'Select a car...'}
								</Text>
							</View>
							<MaterialCommunityIcons
								name='car-sports'
								size={24}
								color={isDarkMode ? '#fff' : '#000'}
							/>
						</View>

						{error && <Text className='text-red text-xs mt-2'>{error}</Text>}

						{selectedCar && (
							<View className='mt-3 bg-red/10 p-2 rounded-lg'>
								<View className='flex-row justify-between'>
									<Text
										className={`text-sm ${
											isDarkMode ? 'text-white' : 'text-black'
										}`}>
										Price: ${selectedCar.price.toLocaleString()}
									</Text>
									<Text
										className={`text-sm ${
											isDarkMode ? 'text-white' : 'text-black'
										}`}>
										Status: {selectedCar.status.toUpperCase()}
									</Text>
								</View>
							</View>
						)}
					</LinearGradient>
				</BlurView>
			</Pressable>

			<Modal
				visible={isModalVisible}
				transparent
				animationType='none'
				statusBarTranslucent>
				<Animated.View
					entering={FadeIn}
					exiting={FadeOut}
					className='flex-1 bg-black/50'>
					<BlurView
						intensity={isDarkMode ? 30 : 20}
						tint={isDarkMode ? 'dark' : 'light'}
						className='flex-1'>
						<Animated.View
							entering={SlideInDown}
							exiting={SlideOutDown}
							className={`flex-1 mt-12 rounded-t-3xl overflow-hidden ${
								isDarkMode ? 'bg-black' : 'bg-white'
							}`}>
							<View className='p-4 border-b border-neutral-200/10'>
								<View className='items-center mb-2'>
									<View className='w-16 h-1 rounded-full bg-neutral-300' />
								</View>

								<View className='flex-row justify-between items-center mb-4'>
									<Text
										className={`text-xl font-bold ${
											isDarkMode ? 'text-white' : 'text-black'
										}`}>
										Select Vehicle
									</Text>
									<TouchableOpacity
										onPress={() => setIsModalVisible(false)}
										className='p-2'>
										<Ionicons
											name='close'
											size={24}
											color={isDarkMode ? 'white' : 'black'}
										/>
									</TouchableOpacity>
								</View>

								<View
									className={`flex-row items-center rounded-full border border-[#ccc] px-4 h-12 ${
										isDarkMode ? 'border-[#555]' : ''
									}`}>
									<FontAwesome
										name='search'
										size={20}
										color={isDarkMode ? 'white' : 'black'}
									/>
									<TextInput
										className={`flex-1 px-3 h-full ${
											isDarkMode ? 'text-white' : 'text-black'
										}`}
										placeholder='Search cars...'
										placeholderTextColor={isDarkMode ? 'lightgray' : 'gray'}
										value={searchQuery}
										onChangeText={setSearchQuery}
									/>
								</View>
							</View>

							<ScrollView className='flex-1 p-4'>
								{filteredCars.length > 0 ? (
									filteredCars.map(car => (
										<CarCard
											key={car.id}
											car={car}
											isSelected={car.id === selectedCarId}
											onSelect={() => handleSelect(car.id)}
											isDarkMode={isDarkMode}
										/>
									))
								) : (
									<View className='flex-1 justify-center items-center py-8'>
										<MaterialCommunityIcons
											name='car-off'
											size={48}
											color={isDarkMode ? '#666' : '#999'}
										/>
										<Text
											className={`mt-4 text-center ${
												isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
											}`}>
											{cars.length === 0
												? 'No cars available. Please add cars first.'
												: 'No cars match your search.'}
										</Text>
									</View>
								)}
								<View className='h-20' />
							</ScrollView>
						</Animated.View>
					</BlurView>
				</Animated.View>
			</Modal>
		</>
	)
}
