import React, { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, Platform } from 'react-native'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'

interface PickerOption {
	label: string
	value: string
}

interface ModernPickerProps {
	label: string
	value: string
	options: PickerOption[]
	onChange: (value: string) => void
	isDarkMode: boolean
}

const ModernPicker: React.FC<ModernPickerProps> = ({
	label,
	value,
	options,
	onChange,
	isDarkMode
}) => {
	const [isVisible, setIsVisible] = useState(false)

	const selectedLabel =
		options.find(opt => opt.value === value)?.label || 'Select'

	const handleSelect = (newValue: string) => {
		onChange(newValue)
		setIsVisible(false)
	}

	return (
		<View>
			<Text
				className={`text-sm font-medium mb-2 ${
					isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
				}`}>
				{label}
			</Text>

			<TouchableOpacity
				onPress={() => setIsVisible(true)}
				className={`px-4 py-3 mb-3 rounded-xl border flex-row justify-between items-center ${
					isDarkMode
						? 'border-neutral-700 bg-neutral-800'
						: 'border-neutral-200 bg-neutral-50'
				}`}>
				<Text className={isDarkMode ? 'text-white' : 'text-black'}>
					{selectedLabel}
				</Text>
				<Ionicons
					name='chevron-down'
					size={20}
					color={isDarkMode ? '#FFFFFF' : '#000000'}
				/>
			</TouchableOpacity>

			<Modal
				visible={isVisible}
				transparent
				animationType='slide'
				onRequestClose={() => setIsVisible(false)}>
				<View className='flex-1 justify-end'>
					<BlurView
						intensity={isDarkMode ? 30 : 20}
						tint={isDarkMode ? 'dark' : 'light'}
						className='absolute inset-0'>
						<TouchableOpacity
							className='flex-1'
							onPress={() => setIsVisible(false)}
						/>
					</BlurView>

					<View
						className={`rounded-t-3xl ${
							isDarkMode ? 'bg-neutral-900' : 'bg-white'
						}`}>
						<View className='p-4 border-b border-neutral-200 dark:border-neutral-800 flex-row justify-between items-center'>
							<TouchableOpacity
								onPress={() => setIsVisible(false)}
								className='p-2'>
								<Text className='text-red'>Cancel</Text>
							</TouchableOpacity>
							<Text
								className={`text-lg font-semibold ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								Select {label}
							</Text>
							<View style={{ width: 70 }} />
						</View>

						<View className='p-2'>
							{options.map(option => (
								<TouchableOpacity
									key={option.value}
									onPress={() => handleSelect(option.value)}
									className='p-4 border-b border-neutral-200 dark:border-neutral-800 flex-row justify-between items-center'>
									<Text className={isDarkMode ? 'text-white' : 'text-black'}>
										{option.label}
									</Text>
									{value === option.value && (
										<Ionicons name='checkmark' size={24} color='#D55004' />
									)}
								</TouchableOpacity>
							))}
						</View>
					</View>
				</View>
			</Modal>
		</View>
	)
}

export default ModernPicker
