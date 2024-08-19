// components/SortPicker.js
import React, { useState } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	Modal,
	FlatList,
	StyleSheet
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const sortOptions = [
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
		initialValue || { label: 'Sort', value: null, icon: 'arrow-down' }
	)

	const handleSelect = (option: { value: any }) => {
		setSelectedOption(option)
		setModalVisible(false)
		onValueChange(option.value)
	}

	const renderOption = ({ item }: any) => (
		<TouchableOpacity style={styles.option} onPress={() => handleSelect(item)}>
			<Ionicons name={item.icon} size={24} color='#333' />
			<Text style={styles.optionText}>{item.label}</Text>
		</TouchableOpacity>
	)

	return (
		<View>
			<TouchableOpacity
				onPress={() => setModalVisible(true)}>
				<Ionicons name='chevron-down' size={20} color='#FFFFFF' />
			</TouchableOpacity>
			<Modal
				animationType='slide'
				transparent={true}
				visible={modalVisible}
				onRequestClose={() => setModalVisible(false)}>
				<View style={styles.modalContainer}>
					<View style={styles.modalContent}>
						<Text style={styles.modalTitle}>Sort By</Text>
						<FlatList
							data={sortOptions}
							renderItem={renderOption}
							keyExtractor={item => item.value}
						/>
					</View>
				</View>
			</Modal>
		</View>
	)
}

// ... styles remain the same

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
	}
})

export default SortPicker
