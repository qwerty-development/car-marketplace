import React, { useState } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	Modal,
	FlatList,
	StyleSheet,
	TouchableWithoutFeedback
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

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
	const [modalVisible, setModalVisible] = useState(false)
	const [selectedOption, setSelectedOption] = useState(
		initialValue &&
			sortOptions.find(option => option.value === initialValue.value)
			? initialValue
			: sortOptions[0]
	)

	const handleSelect = (option: { value: any }) => {
		setSelectedOption(option)
		setModalVisible(false)
		onValueChange(option.value)
	}

	const renderOption = ({ item }: any) => (
		<TouchableOpacity
			style={[
				styles.option,
				selectedOption.value === item.value && styles.selectedOption
			]}
			onPress={() => handleSelect(item)}>
			<Ionicons
				name={item.icon}
				size={24}
				color={selectedOption.value === item.value ? '#D55004' : '#333'}
			/>
			<Text
				style={[
					styles.optionText,
					selectedOption.value === item.value && styles.selectedOptionText
				]}>
				{item.label}
			</Text>
		</TouchableOpacity>
	)

	return (
		<View>
			<TouchableOpacity onPress={() => setModalVisible(true)}>
				<Ionicons name='chevron-down' size={20} color='#FFFFFF' />
			</TouchableOpacity>
			<Modal
				animationType='slide'
				transparent={true}
				visible={modalVisible}
				onRequestClose={() => setModalVisible(false)}>
				<TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
					<View style={styles.modalContainer}>
						<TouchableWithoutFeedback>
							<View style={styles.modalContent}>
								<Text style={styles.modalTitle}>Sort By</Text>
								<FlatList
									data={sortOptions}
									renderItem={renderOption}
									keyExtractor={item => item.value}
								/>
							</View>
						</TouchableWithoutFeedback>
					</View>
				</TouchableWithoutFeedback>
			</Modal>
		</View>
	)
}

const styles = StyleSheet.create({
	picker: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: 'white',
		padding: 12,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#ccc'
	},
	pickerText: {
		flex: 1,
		marginLeft: 8,
		fontSize: 16,
		color: '#333'
	},
	modalContainer: {
		flex: 1,
		justifyContent: 'flex-end',
		backgroundColor: 'rgba(0, 0, 0, 0.5)'
	},
	modalContent: {
		backgroundColor: 'white',
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		padding: 20,
		maxHeight: '80%'
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		marginBottom: 15,
		textAlign: 'center'
	},
	option: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 15,
		borderBottomWidth: 1,
		borderBottomColor: '#eee'
	},
	optionText: {
		marginLeft: 10,
		fontSize: 16,
		color: '#333'
	},
	selectedOption: {
		backgroundColor: '#F0F0F0'
	},
	selectedOptionText: {
		color: '#D55004',
		fontWeight: 'bold'
	}
})

export default SortPicker
