import React, { useState, useCallback } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	Modal,
	ScrollView,
	Animated,
	Dimensions
} from 'react-native'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

export interface SortOption {
	label: string
	value: string
	icon: string
}

interface ModernSortPickerProps {
	value: string
	onChange: (value: string) => void
	options: SortOption[]
	isDarkMode: boolean
}

const ModernSortPicker: React.FC<ModernSortPickerProps> = ({
	value,
	onChange,
	options,
	isDarkMode
}) => {
	const [isModalVisible, setIsModalVisible] = useState(false)
	const [animation] = useState(new Animated.Value(0))

	const selectedOption =
		options.find(option => option.value === value) || options[0]

	const openModal = useCallback(() => {
		setIsModalVisible(true)
		Animated.spring(animation, {
			toValue: 1,
			useNativeDriver: true,
			tension: 65,
			friction: 8
		}).start()
	}, [animation])

	const closeModal = useCallback(() => {
		Animated.timing(animation, {
			toValue: 0,
			duration: 200,
			useNativeDriver: true
		}).start(() => setIsModalVisible(false))
	}, [animation])

	const handleSelect = useCallback(
		(option: SortOption) => {
			onChange(option.value)
			closeModal()
		},
		[onChange, closeModal]
	)

	const modalTranslateY = animation.interpolate({
		inputRange: [0, 1],
		outputRange: [SCREEN_HEIGHT, 0]
	})

	const backdropOpacity = animation.interpolate({
		inputRange: [0, 1],
		outputRange: [0, 0.5]
	})

	return (
		<>
			<TouchableOpacity
				onPress={openModal}
				className={`flex-row items-center px-3 py-2 rounded-xl
                    ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
				<Ionicons
					name={selectedOption.icon as any}
					size={18}
					color={isDarkMode ? '#FFFFFF' : '#000000'}
					className='mr-2'
				/>
				<Text
					className={`text-sm font-medium mr-2
                        ${isDarkMode ? 'text-white' : 'text-black'}`}>
					{selectedOption.label}
				</Text>
				<Ionicons
					name='chevron-down'
					size={16}
					color={isDarkMode ? '#FFFFFF' : '#000000'}
				/>
			</TouchableOpacity>

			<Modal
				visible={isModalVisible}
				transparent
				animationType='none'
				onRequestClose={closeModal}>
				<View className='flex-1'>
					<BlurView
						intensity={isDarkMode ? 30 : 50}
						tint={isDarkMode ? 'dark' : 'light'}
						style={{
							position: 'absolute',
							width: '100%',
							height: '100%',
							backgroundColor: `rgba(0,0,0,${backdropOpacity})`
						}}>
						<TouchableOpacity
							className='flex-1'
							activeOpacity={1}
							onPress={closeModal}
						/>
					</BlurView>

					<Animated.View
						className={`absolute bottom-0 w-full rounded-t-3xl
                            ${isDarkMode ? 'bg-neutral-900' : 'bg-white'}`}
						style={{
							transform: [{ translateY: modalTranslateY }],
							maxHeight: SCREEN_HEIGHT * 0.7
						}}>
						<View className='p-4 border-b border-neutral-200 dark:border-neutral-800'>
							<Text
								className={`text-lg font-semibold text-center
                                    ${
																			isDarkMode ? 'text-white' : 'text-black'
																		}`}>
								Sort By
							</Text>
						</View>

						<ScrollView className='p-4'>
							{options.map(option => (
								<TouchableOpacity
									key={option.value}
									onPress={() => handleSelect(option)}
									className={`flex-row items-center p-4 mb-2 rounded-xl
                                        ${
																					option.value === value
																						? 'bg-red'
																						: isDarkMode
																						? 'bg-neutral-800'
																						: 'bg-neutral-100'
																				}`}>
									<Ionicons
										name={option.icon as any}
										size={24}
										color={
											option.value === value
												? '#FFFFFF'
												: isDarkMode
												? '#FFFFFF'
												: '#000000'
										}
										className='mr-3'
									/>
									<Text
										className={`flex-1 font-medium
                                            ${
																							option.value === value
																								? 'text-white'
																								: isDarkMode
																								? 'text-white'
																								: 'text-black'
																						}`}>
										{option.label}
									</Text>
									{option.value === value && (
										<Ionicons name='checkmark' size={24} color='#FFFFFF' />
									)}
								</TouchableOpacity>
							))}
						</ScrollView>
					</Animated.View>
				</View>
			</Modal>
		</>
	)
}

export default React.memo(ModernSortPicker)
