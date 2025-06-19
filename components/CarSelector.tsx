import React, { useMemo, useCallback, useState } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	TextInput,
	Pressable,
	Platform,
	Dimensions
} from 'react-native'
import { Car } from '@/types/autoclip'
import {
	Ionicons,
	MaterialCommunityIcons,
	FontAwesome
} from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

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
		const handlePress = useCallback(() => {
			if (disabled) return
			if (Platform.OS === 'ios') {
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
			}
			onSelect()
		}, [onSelect, disabled])

		return (
			<TouchableOpacity
				onPress={handlePress}
				className={`mb-3 ${disabled ? 'opacity-50' : ''}`}
				activeOpacity={0.7}>
				<View
					className={`rounded-2xl p-4 ${
						isSelected 
							? 'bg-red' 
							: isDarkMode 
							? 'bg-neutral-800' 
							: 'bg-neutral-100'
					}`}>
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
				</View>
			</TouchableOpacity>
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
	const [isOverlayVisible, setIsOverlayVisible] = useState(false)
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

	const handleOpenOverlay = useCallback(() => {
		if (disabled) return
		if (Platform.OS === 'ios') {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
		}
		setIsOverlayVisible(true)
	}, [disabled])

	const handleCloseOverlay = useCallback(() => {
		setIsOverlayVisible(false)
		setSearchQuery('')
	}, [])

	const handleSelect = useCallback(
		(carId: number) => {
			if (Platform.OS === 'ios') {
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
			}
			onCarSelect(carId)
			handleCloseOverlay()
		},
		[onCarSelect, handleCloseOverlay]
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

	// Render main selector button
	const renderSelectorButton = () => {
		if (filteredCars.length === 0) {
			return (
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
			)
		}

		return (
			<TouchableOpacity onPress={handleOpenOverlay} activeOpacity={0.7}>
				<View
					className={`rounded-2xl p-4 ${
						isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'
					} ${error ? 'border border-red' : ''}`}>
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
				</View>
			</TouchableOpacity>
		)
	}

	return (
		<View>
			{renderSelectorButton()}

			{/* Full Screen Overlay - No Modal */}
			{isOverlayVisible && (
				<View
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						height: SCREEN_HEIGHT,
						zIndex: 9999,
					}}
					className="bg-black/50">
					
					{/* Background Touchable */}
					<TouchableOpacity 
						style={{ flex: 1 }}
						onPress={handleCloseOverlay}
						activeOpacity={1}
					/>
					
					{/* Content Container */}
					<View
						style={{ height: SCREEN_HEIGHT*0.98  }}
						className={`rounded-t-3xl ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
						
						{/* Header */}
						<View className="p-4 border-b border-neutral-200/10">
							<View className="items-center mb-2">
								<View className="w-16 h-1 rounded-full bg-neutral-300" />
							</View>

							<View className="flex-row justify-between items-center mb-4">
								<Text
									className={`text-xl font-bold ${
										isDarkMode ? 'text-white' : 'text-black'
									}`}>
									Select Vehicle
								</Text>
								<TouchableOpacity
									onPress={handleCloseOverlay}
									className="p-2">
									<Ionicons
										name="close"
										size={24}
										color={isDarkMode ? 'white' : 'black'}
									/>
								</TouchableOpacity>
							</View>

							{/* Search Bar */}
							<View
								className={`flex-row items-center rounded-full border px-4 h-12 ${
									isDarkMode ? 'border-neutral-600 bg-neutral-800' : 'border-neutral-300 bg-neutral-50'
								}`}>
								<FontAwesome
									name="search"
									size={20}
									color={isDarkMode ? 'white' : 'black'}
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
							</View>
						</View>

						{/* Cars List */}
						<ScrollView 
							className="flex-1 p-4"
							showsVerticalScrollIndicator={false}>
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
								<View className="flex-1 justify-center items-center py-8">
									<MaterialCommunityIcons
										name="car-off"
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
							<View className="h-20" />
						</ScrollView>
					</View>
				</View>
			)}
		</View>
	)
}