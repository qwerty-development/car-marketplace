import React, { useState, useRef } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	Modal,
	FlatList,
	StyleSheet,
	TouchableWithoutFeedback,
	Animated,
	Easing,
	Dimensions
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { BlurView } from 'expo-blur'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

const sortOptions = [
	{ label: 'Latest Listed', value: 'date_listed_desc', icon: 'time' },
	{ label: 'Price: Low to High', value: 'price_asc', icon: 'trending-up' },
	{ label: 'Price: High to Low', value: 'price_desc', icon: 'trending-down' },
	{ label: 'Year: New to Old', value: 'year_desc', icon: 'calendar' },
	{ label: 'Year: Old to New', value: 'year_asc', icon: 'calendar-outline' },
	{ label: 'Mileage: Low to High', value: 'mileage_asc', icon: 'speedometer' },
	{
		label: 'Mileage: High to Low',
		value: 'mileage_desc',
		icon: 'speedometer-outline'
	}
]

const SortPicker = ({ onValueChange, initialValue }: any) => {
	const { isDarkMode } = useTheme()
	const [modalVisible, setModalVisible] = useState(false)
	const [selectedOption, setSelectedOption] = useState(
		initialValue &&
			sortOptions.find(option => option.value === initialValue.value)
			? initialValue
			: sortOptions[0]
	)

	const animation = useRef(new Animated.Value(0)).current

	const handleSelect = (option: { value: any }) => {
		setSelectedOption(option)
		closeModal()
		onValueChange(option.value)
	}

	const openModal = () => {
		setModalVisible(true)
		Animated.timing(animation, {
			toValue: 1,
			duration: 300,
			easing: Easing.bezier(0.33, 1, 0.68, 1),
			useNativeDriver: true
		}).start()
	}

	const closeModal = () => {
		Animated.timing(animation, {
			toValue: 0,
			duration: 200,
			easing: Easing.bezier(0.33, 1, 0.68, 1),
			useNativeDriver: true
		}).start(() => setModalVisible(false))
	}

	const modalTranslateY = animation.interpolate({
		inputRange: [0, 1],
		outputRange: [SCREEN_HEIGHT, 0]
	})

	const backdropOpacity = animation.interpolate({
		inputRange: [0, 1],
		outputRange: [0, 0.5]
	})

	const renderOption = ({ item }: any) => (
		<Animated.View
			style={{
				opacity: animation,
				transform: [
					{
						translateY: animation.interpolate({
							inputRange: [0, 1],
							outputRange: [50, 0]
						})
					}
				]
			}}>
			<TouchableOpacity
				style={[
					styles.option,
					selectedOption.value === item.value && styles.selectedOption
				]}
				onPress={() => handleSelect(item)}>
				<Ionicons
					name={item.icon}
					size={20}
					color={
						selectedOption.value === item.value
							? '#D55004'
							: isDarkMode
							? '#FFFFFF'
							: '#333333'
					}
				/>
				<Text
					style={[
						styles.optionText,
						selectedOption.value === item.value && styles.selectedOptionText,
						isDarkMode && { color: '#FFFFFF' }
					]}>
					{item.label}
				</Text>
				{selectedOption.value === item.value && (
					<Ionicons
						name='checkmark'
						size={20}
						color='#D55004'
						style={styles.checkmark}
					/>
				)}
			</TouchableOpacity>
		</Animated.View>
	)

	return (
		<View style={styles.container}>
			<TouchableOpacity
				onPress={openModal}
				style={[styles.picker, isDarkMode && styles.pickerDark]}>
				<Ionicons
					name='funnel-outline'
					size={16}
					color={isDarkMode ? '#FFFFFF' : '#D55004'}
					style={styles.pickerIcon}
				/>
				<Text
					style={[styles.pickerText, isDarkMode && { color: '#FFFFFF' }]}
					numberOfLines={1}>
					{selectedOption.label}
				</Text>
				<Ionicons
					name='chevron-down'
					size={16}
					color={isDarkMode ? '#FFFFFF' : '#D55004'}
				/>
			</TouchableOpacity>

			<Modal
				animationType='none'
				transparent={true}
				visible={modalVisible}
				onRequestClose={closeModal}>
				<View style={styles.modalOverlay}>
					<TouchableWithoutFeedback onPress={closeModal}>
						<BlurView
							intensity={100}
							style={[
								StyleSheet.absoluteFill,
								{ backgroundColor: `rgba(0, 0, 0, ${backdropOpacity})` }
							]}
						/>
					</TouchableWithoutFeedback>
					<Animated.View
						style={[
							styles.modalContent,
							{
								transform: [{ translateY: modalTranslateY }],
								backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF'
							}
						]}>
						<View style={styles.modalHeader}>
							<Text
								style={[styles.modalTitle, isDarkMode && { color: '#FFFFFF' }]}>
								Sort By
							</Text>
							<TouchableOpacity
								onPress={closeModal}
								hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
								<Ionicons
									name='close'
									size={24}
									color={isDarkMode ? '#FFFFFF' : '#333333'}
								/>
							</TouchableOpacity>
						</View>
						<FlatList
							data={sortOptions}
							renderItem={renderOption}
							keyExtractor={item => item.value}
							showsVerticalScrollIndicator={false}
							style={styles.flatList}
						/>
					</Animated.View>
				</View>
			</Modal>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		alignItems: 'flex-start' // Aligns the picker to the left
	},
	picker: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: 'rgba(213, 80, 4, 0.1)',
		paddingHorizontal: 12,
		paddingVertical: 8, // Reduced vertical padding
		borderRadius: 8,
		borderWidth: 1,
		borderColor: 'rgba(213, 80, 4, 0.2)',
		maxHeight: 36 // Fixed height
	},
	pickerDark: {
		backgroundColor: 'rgba(255, 255, 255, 0.1)',
		borderColor: 'rgba(255, 255, 255, 0.2)'
	},
	pickerIcon: {
		marginRight: 8
	},
	pickerText: {
		flex: 1,
		fontSize: 14, // Reduced font size
		fontWeight: '500',
		color: '#333333',
		marginRight: 8
	},
	modalOverlay: {
		flex: 1,
		justifyContent: 'flex-end', // This ensures the modal stays at the bottom
		backgroundColor: 'transparent'
	},
	modalContent: {
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		padding: 20,
		maxHeight: '80%',
		backgroundColor: '#FFFFFF',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: -2
		},
		shadowOpacity: 0.25,
		shadowRadius: 8,
		elevation: 5
	},
	flatList: {
		maxHeight: SCREEN_HEIGHT * 0.6 // Limits the height of the list to 60% of screen height
	},
	modalHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 12
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#333333'
	},
	option: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 12, // Reduced padding
		paddingHorizontal: 12,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(0, 0, 0, 0.1)'
	},
	optionText: {
		marginLeft: 12,
		fontSize: 15, // Reduced font size
		color: '#333333',
		flex: 1
	},
	selectedOption: {
		backgroundColor: 'rgba(213, 80, 4, 0.1)',
		borderRadius: 8
	},
	selectedOptionText: {
		color: '#D55004',
		fontWeight: '600'
	},
	checkmark: {
		marginLeft: 8
	}
})

export default SortPicker
