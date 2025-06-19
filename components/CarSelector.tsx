import React, { useMemo, useCallback, useState, useEffect } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	TextInput,
	Platform,
	Dimensions,
	Modal
} from 'react-native'
import { Car } from '@/types/autoclip'
import {
	Ionicons,
	MaterialCommunityIcons,
	FontAwesome
} from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
	FadeIn,
	FadeOut,
	withSpring,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
	runOnJS
} from 'react-native-reanimated'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.75 // 3/4 of screen height

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

		const handlePress = useCallback(() => {
			if (disabled) return
			
			scale.value = withSpring(0.95, { duration: 100 }, () => {
				scale.value = withSpring(1, { duration: 100 })
			})

			if (Platform.OS === 'ios') {
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
			}
			onSelect()
		}, [onSelect, disabled])

		const animatedStyle = useAnimatedStyle(() => ({
			transform: [{ scale: scale.value }]
		}))

		return (
			<Animated.View style={animatedStyle}>
				<TouchableOpacity
					onPress={handlePress}
					className={`mb-3 ${disabled ? 'opacity-50' : ''}`}
					activeOpacity={0.9}>
					<BlurView
						intensity={isDarkMode ? 20 : 40}
						tint={isDarkMode ? 'dark' : 'light'}
						className="rounded-2xl overflow-hidden">
						<LinearGradient
							colors={
								isSelected 
									? ['#D55004', '#FF6B00']
									: isDarkMode 
									? ['#1c1c1c', '#2d2d2d'] 
									: ['#f5f5f5', '#e5e5e5']
							}
							className="p-4"
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 1 }}>
							<View className='flex-row justify-between items-center'>
								<View className='flex-1'>
									<View className='flex-row items-center'>
										<MaterialCommunityIcons
											name='car-sports'
											size={24}
											color={isSelected ? '#fff' : isDarkMode ? '#D55004' : '#FF6B00'}
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
									<View className='bg-white/20 p-2 rounded-full ml-3'>
										<Ionicons name='checkmark' size={24} color='white' />
									</View>
								)}
							</View>
						</LinearGradient>
					</BlurView>
				</TouchableOpacity>
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
	showUnavailable = false
}: CarSelectorProps) {
	const [isModalVisible, setIsModalVisible] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const slideAnim = useSharedValue(MODAL_HEIGHT)

	// Animation for modal entrance
	useEffect(() => {
		if (isModalVisible) {
			slideAnim.value = withSpring(0, {
				damping: 15,
				stiffness: 90
			})
		} else {
			slideAnim.value = withTiming(MODAL_HEIGHT, { duration: 300 })
		}
	}, [isModalVisible])

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

	const handleOpenModal = useCallback(() => {
		if (disabled) return
		if (Platform.OS === 'ios') {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
		}
		setIsModalVisible(true)
	}, [disabled])

	const handleCloseModal = useCallback(() => {
		setIsModalVisible(false)
		setSearchQuery('')
	}, [])

	const handleSelect = useCallback(
		(carId: number) => {
			if (Platform.OS === 'ios') {
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
			}
			onCarSelect(carId)
			handleCloseModal()
		},
		[onCarSelect, handleCloseModal]
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

	// Animation style for modal
	const modalStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: slideAnim.value }]
	}))

	// Render main selector button
	const renderSelectorButton = () => {
		if (filteredCars.length === 0) {
			return (
				<BlurView
					intensity={isDarkMode ? 20 : 40}
					tint={isDarkMode ? 'dark' : 'light'}
					className="rounded-2xl overflow-hidden">
					<LinearGradient
						colors={isDarkMode ? ['#1c1c1c', '#2d2d2d'] : ['#f5f5f5', '#e5e5e5']}
						className="p-6"
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}>
						<View className='flex-1 justify-center items-center'>
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
					</LinearGradient>
				</BlurView>
			)
		}

		return (
			<TouchableOpacity onPress={handleOpenModal} activeOpacity={0.8}>
				<BlurView
					intensity={isDarkMode ? 20 : 40}
					tint={isDarkMode ? 'dark' : 'light'}
					className={`rounded-2xl overflow-hidden ${error ? 'border border-red' : ''}`}>
					<LinearGradient
						colors={isDarkMode ? ['#1c1c1c', '#2d2d2d'] : ['#f5f5f5', '#e5e5e5']}
						className="p-4"
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
								name='chevron-down'
								size={24}
								color={isDarkMode ? '#D55004' : '#FF6B00'}
							/>
						</View>

						{error && <Text className='text-red text-xs mt-2'>{error}</Text>}

						{selectedCar && (
							<View className='mt-3 bg-red/10 p-3 rounded-lg'>
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
			</TouchableOpacity>
		)
	}

	return (
		<View>
			{renderSelectorButton()}

			{/* Car Selection Modal */}
			<Modal
				visible={isModalVisible}
				animationType="none"
				transparent
				statusBarTranslucent>
				<View className="flex-1">
					{/* Background Overlay */}
					<Animated.View
						entering={FadeIn}
						exiting={FadeOut}
						className="flex-1 bg-black/50">
						<TouchableOpacity 
							className="flex-1"
							onPress={handleCloseModal}
							activeOpacity={1}
						/>
						
						{/* Modal Content */}
						<Animated.View
							style={[modalStyle, { height: MODAL_HEIGHT }]}
							className="absolute bottom-0 left-0 right-0">
							<BlurView
								intensity={isDarkMode ? 30 : 20}
								tint={isDarkMode ? 'dark' : 'light'}
								className="flex-1 rounded-t-3xl overflow-hidden">
								<LinearGradient
									colors={isDarkMode ? ['#000', '#1a1a1a'] : ['#fff', '#f5f5f5']}
									className="flex-1"
									start={{ x: 0, y: 0 }}
									end={{ x: 0, y: 1 }}>
									
									{/* Header */}
									<View className="p-6 border-b border-neutral-200/10">
										{/* Handle Bar */}
										<View className="items-center mb-4">
											<View className="w-12 h-1 rounded-full bg-neutral-300" />
										</View>

										{/* Title and Close */}
										<View className="flex-row justify-between items-center mb-4">
											<Text
												className={`text-xl font-bold ${
													isDarkMode ? 'text-white' : 'text-black'
												}`}>
												Select Vehicle
											</Text>
											<TouchableOpacity
												onPress={handleCloseModal}
												className="p-2 rounded-full bg-neutral-200/20">
												<Ionicons
													name="close"
													size={20}
													color={isDarkMode ? 'white' : 'black'}
												/>
											</TouchableOpacity>
										</View>

										{/* Search Bar */}
										<BlurView
											intensity={isDarkMode ? 15 : 30}
											tint={isDarkMode ? 'dark' : 'light'}
											className="rounded-2xl overflow-hidden">
											<LinearGradient
												colors={
													isDarkMode 
														? ['#2a2a2a', '#1a1a1a'] 
														: ['#f0f0f0', '#e0e0e0']
												}
												className="flex-row items-center px-4 h-12"
												start={{ x: 0, y: 0 }}
												end={{ x: 1, y: 1 }}>
												<FontAwesome
													name="search"
													size={18}
													color={isDarkMode ? '#D55004' : '#FF6B00'}
												/>
												<TextInput
													className={`flex-1 px-3 h-full ${
														isDarkMode ? 'text-white' : 'text-black'
													}`}
													placeholder="Search cars..."
													placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
													value={searchQuery}
													onChangeText={setSearchQuery}
													style={{ textAlignVertical: 'center' }}
												/>
												{searchQuery ? (
													<TouchableOpacity onPress={() => setSearchQuery('')}>
														<Ionicons
															name="close-circle"
															size={20}
															color={isDarkMode ? '#9CA3AF' : '#6B7280'}
														/>
													</TouchableOpacity>
												) : null}
											</LinearGradient>
										</BlurView>
									</View>

									{/* Cars List */}
									<ScrollView 
										className="flex-1 px-6"
										showsVerticalScrollIndicator={false}
										contentContainerStyle={{ paddingBottom: 20 }}>
										{filteredCars.length > 0 ? (
											<>
												{filteredCars.map((car, index) => (
													<Animated.View
														key={car.id}
														entering={FadeIn.delay(index * 50)}>
														<CarCard
															car={car}
															isSelected={car.id === selectedCarId}
															onSelect={() => handleSelect(car.id)}
															isDarkMode={isDarkMode}
														/>
													</Animated.View>
												))}
											</>
										) : (
											<Animated.View 
												entering={FadeIn}
												className="flex-1 justify-center items-center py-12">
												<MaterialCommunityIcons
													name="car-off"
													size={64}
													color={isDarkMode ? '#666' : '#999'}
												/>
												<Text
													className={`mt-4 text-center text-lg ${
														isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
													}`}>
													{cars.length === 0
														? 'No cars available.\nPlease add cars first.'
														: 'No cars match your search.'}
												</Text>
											</Animated.View>
										)}
									</ScrollView>
								</LinearGradient>
							</BlurView>
						</Animated.View>
					</Animated.View>
				</View>
			</Modal>
		</View>
	)
}