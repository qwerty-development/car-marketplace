import React, { useState, useRef, useEffect } from 'react'
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
import { FontAwesome, Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { BlurView } from 'expo-blur'
import { useLanguage } from '@/utils/LanguageContext'
import i18n from '@/utils/i18n'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

const getSortOptions = (t: any) => [
	{ label: t('filters.newest_listings'), value: 'date_listed_desc', icon: 'time' },
	{ label: t('filters.price_low_to_high'), value: 'price_asc', icon: 'trending-up' },
	{ label: t('filters.price_high_to_low'), value: 'price_desc', icon: 'trending-down' },
	{ label: t('filters.year_newest_first'), value: 'year_desc', icon: 'calendar' },
	{ label: t('filters.year_oldest_first'), value: 'year_asc', icon: 'calendar-outline' },
	{ label: t('filters.mileage_low_to_high'), value: 'mileage_asc', icon: 'speedometer' },
	{
		label: t('filters.mileage_high_to_low'),
		value: 'mileage_desc',
		icon: 'speedometer-outline'
	}
]

const SortPicker = ({ onValueChange, initialValue }: any) => {
	const { isDarkMode } = useTheme()
	const { language } = useLanguage()
	const [modalVisible, setModalVisible] = useState(false)
	const sortOptions = getSortOptions(i18n.t)
	const [selectedOption, setSelectedOption] = useState<any>(() => {
		if (initialValue) {
			return sortOptions.find(option => option.value === initialValue)
		}
		return null
	})

	const animation = useRef(new Animated.Value(0)).current

	useEffect(() => {
		if (
			!initialValue ||
			!sortOptions.find(option => option.value === initialValue)
		) {
			setSelectedOption(null)
		} else {
			setSelectedOption(
				sortOptions.find(option => option.value === initialValue)
			)
		}
	}, [initialValue])

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
					selectedOption?.value === item.value && styles.selectedOption,
					isDarkMode && styles.optionDark
				]}
				onPress={() => handleSelect(item)}>
				<Ionicons
					name={item.icon}
					size={20}
					color={
						selectedOption?.value === item.value
							? '#D55004'
							: isDarkMode
							? '#FFFFFF'
							: '#333333'
					}
				/>
				<Text
					style={[
						styles.optionText,
						selectedOption?.value === item.value && styles.selectedOptionText,
						isDarkMode && styles.optionTextDark
					]}>
					{item.label}
				</Text>
				{selectedOption?.value === item.value && (
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
						<FontAwesome
							name='sort'
							size={20}
							color={isDarkMode ? 'white' : 'black'}
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
							intensity={isDarkMode ? 50 : 80}
							tint={isDarkMode ? 'dark' : 'light'}
							style={StyleSheet.absoluteFill}
						/>
					</TouchableWithoutFeedback>
					<Animated.View
						style={[
							styles.modalContent,
							{
								transform: [{ translateY: modalTranslateY }],
								backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF'
							}
						]}>
						<View style={styles.modalHeader}>
							<View style={styles.dragIndicator} />
							<Text
								style={[
									styles.modalTitle,
									isDarkMode && styles.modalTitleDark
								]}>
{i18n.t('filters.sort_by')}
							</Text>
						</View>
						<FlatList
							data={sortOptions}
							renderItem={renderOption}
							keyExtractor={item => item.value}
							showsVerticalScrollIndicator={false}
							style={styles.flatList}
							bounces={false}
						/>
					</Animated.View>
				</View>
			</Modal>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		alignItems: 'flex-start'
	},
	picker: {
		alignItems: 'center',
		justifyContent: 'center',
		width: 40,
		height: 40,
		borderRadius: 20
	},
	pickerDark: {},
	modalOverlay: {
		flex: 1,
		justifyContent: 'flex-end',
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
	modalHeader: {
		alignItems: 'center',
		marginBottom: 20
	},
	dragIndicator: {
		width: 40,
		height: 4,
		backgroundColor: '#E0E0E0',
		borderRadius: 2,
		marginBottom: 16
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#333333'
	},
	modalTitleDark: {
		color: '#FFFFFF'
	},
	flatList: {
		maxHeight: SCREEN_HEIGHT * 0.6
	},
	option: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 16,
		paddingHorizontal: 16,
		borderRadius: 12,
		marginBottom: 8
	},
	optionDark: {
		backgroundColor: 'rgba(255, 255, 255, 0.05)'
	},
	optionText: {
		marginLeft: 12,
		fontSize: 16,
		color: '#333333',
		flex: 1
	},
	optionTextDark: {
		color: '#FFFFFF'
	},
	selectedOption: {
		backgroundColor: 'rgba(213, 80, 4, 0.1)'
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
