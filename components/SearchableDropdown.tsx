import React, { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Dropdown } from 'react-native-element-dropdown'
import { FontAwesome } from '@expo/vector-icons'

interface Item {
	id: string | number
	name: string
}

interface DropdownComponentProps {
	items: Item[]
	onItemSelect: (item: Item | null) => void
	placeholder: string
	selectedItem?: Item | null
}

const DropdownComponent: React.FC<DropdownComponentProps> = ({
	items,
	onItemSelect,
	placeholder,
	selectedItem
}: any) => {
	const [isFocus, setIsFocus] = useState(false)

	return (
		<View style={styles.container}>
			<Dropdown
				style={[styles.dropdown, isFocus && styles.focusedDropdown]}
				containerStyle={styles.dropdownContainer}
				placeholderStyle={styles.placeholderText}
				selectedTextStyle={styles.selectedText}
				inputSearchStyle={styles.searchInput}
				iconStyle={styles.icon}
				data={items}
				search
				maxHeight={300}
				labelField='name'
				valueField='id'
				placeholder={!isFocus && !selectedItem ? placeholder : ''}
				searchPlaceholder='Search...'
				value={selectedItem ? selectedItem.id : null}
				onFocus={() => setIsFocus(true)}
				onBlur={() => setIsFocus(false)}
				onChange={item => {
					onItemSelect(item)
					setIsFocus(false)
				}}
				renderLeftIcon={() => (
					<FontAwesome
						name='search'
						size={20}
						color={isFocus ? '#007AFF' : '#6B7280'}
						style={styles.leftIcon}
					/>
				)}
				activeColor='#E5E7EB'
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		marginBottom: 16
	},
	dropdown: {
		height: 48,
		borderColor: '#D1D5DB',
		borderWidth: 1,
		borderRadius: 8,
		paddingHorizontal: 12,
		backgroundColor: 'white'
	},
	focusedDropdown: {
		borderColor: '#007AFF'
	},
	dropdownContainer: {
		backgroundColor: 'white',
		borderRadius: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3
	},
	placeholderText: {
		color: '#6B7280',
		fontSize: 16
	},
	selectedText: {
		color: 'black',
		fontSize: 16,
		fontWeight: '500'
	},
	searchInput: {
		height: 40,
		borderBottomColor: '#D1D5DB',
		borderBottomWidth: 1,
		fontSize: 16
	},
	icon: {
		width: 20,
		height: 20
	},
	leftIcon: {
		marginRight: 8
	}
})

export default DropdownComponent
