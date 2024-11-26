// CarSelector.tsx
import React, { useMemo } from 'react'
import { View, Text, Platform } from 'react-native'
import RNPickerSelect from 'react-native-picker-select'
import { useTheme } from '@/utils/ThemeContext'
import { Car } from '@/types/autoclip'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'

interface CarSelectorProps {
	cars: Car[]
	selectedCarId: number | null
	onCarSelect: (carId: number) => void
	error?: string
	disabled?: boolean
}

export default function CarSelector({
	cars,
	selectedCarId,
	onCarSelect,
	error,
	disabled
}: CarSelectorProps) {
	const { isDarkMode } = useTheme()

	const carOptions = useMemo(
		() =>
			cars.map(car => ({
				label: `${car.year} ${car.make} ${car.model}`,
				value: car.id,
				key: car.id.toString()
			})),
		[cars]
	)

	const selectedCar = useMemo(
		() => cars.find(car => car.id === selectedCarId),
		[cars, selectedCarId]
	)

	const pickerStyles = {
		inputIOS: {
			fontSize: 16,
			paddingVertical: 12,
			paddingHorizontal: 10,
			borderWidth: 1,
			borderColor: error ? '#EF4444' : '#D55004',
			borderRadius: 12,
			color: isDarkMode ? 'white' : 'black',
			paddingRight: 30,
			backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF',
			opacity: disabled ? 0.5 : 1
		},
		inputAndroid: {
			fontSize: 16,
			paddingHorizontal: 10,
			paddingVertical: 8,
			borderWidth: 1,
			borderColor: error ? '#EF4444' : '#D55004',
			borderRadius: 12,
			color: isDarkMode ? 'white' : 'black',
			paddingRight: 30,
			backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF',
			opacity: disabled ? 0.5 : 1
		},
		placeholder: {
			color: isDarkMode ? '#A0AEC0' : '#718096'
		},
		iconContainer: {
			top: Platform.OS === 'ios' ? 20 : 25,
			right: 15
		}
	}

	return (
		<BlurView
			intensity={isDarkMode ? 30 : 50}
			tint={isDarkMode ? 'dark' : 'light'}
			className='rounded-xl overflow-hidden'>
			<View className='p-4'>
				<View className='flex-row justify-between items-center mb-2'>
					<Text
						className={`font-semibold ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
						Select Car *
					</Text>
					{selectedCar && (
						<Text className='text-red text-sm'>
							Price: ${selectedCar.price.toLocaleString()}
						</Text>
					)}
				</View>

				<RNPickerSelect
					onValueChange={value => onCarSelect(value)}
					items={carOptions}
					value={selectedCarId}
					style={pickerStyles}
					placeholder={{
						label: 'Select a car...',
						value: null
					}}
					disabled={disabled}
					Icon={() => (
						<Ionicons
							name='chevron-down'
							size={24}
							color={isDarkMode ? '#FFFFFF' : '#000000'}
						/>
					)}
				/>

				{error && <Text className='text-rose-500 text-sm mt-1'>{error}</Text>}

				{cars.length === 0 && (
					<Text
						className={`text-sm mt-2 ${
							isDarkMode ? 'text-gray' : 'text-gray'
						}`}>
						No cars available. Please add cars first.
					</Text>
				)}

				{selectedCar && (
					<View className='mt-2 bg-red/10 p-2 rounded-lg'>
						<Text
							className={`text-xs ${isDarkMode ? 'text-white' : 'text-gray'}`}>
							Status: {selectedCar.status.toUpperCase()}
						</Text>
					</View>
				)}
			</View>
		</BlurView>
	)
}
