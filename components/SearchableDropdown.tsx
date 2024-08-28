import React, { useState, useRef } from 'react'
import {
	View,
	Text,
	TextInput,
	FlatList,
	TouchableOpacity,
	ScrollView
} from 'react-native'
import { styled } from 'nativewind'
import { FontAwesome } from '@expo/vector-icons'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTextInput = styled(TextInput)
const StyledTouchableOpacity = styled(TouchableOpacity)

interface Item {
	id: string | number
	name: string
}

interface SearchableDropdownProps {
	items: Item[]
	onItemSelect: (item: Item | null) => void
	placeholder: string
	selectedItem?: Item
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
	items,
	onItemSelect,
	placeholder,
	selectedItem
}) => {
	const [searchTerm, setSearchTerm] = useState('')
	const [showDropdown, setShowDropdown] = useState(false)
	const inputRef = useRef<TextInput>(null)

	const filteredItems = items.filter(item =>
		item.name.toLowerCase().includes(searchTerm.toLowerCase())
	)

	const handleClearInput = () => {
		setSearchTerm('')
		onItemSelect(null)
		inputRef.current?.focus()
	}

	return (
		<StyledView className='relative mb-4'>
			<StyledView className='flex-row items-center border border-gray-300 rounded'>
				<StyledTextInput
					ref={inputRef}
					className='flex-1 p-2'
					placeholder={placeholder}
					value={selectedItem ? selectedItem.name : searchTerm}
					onChangeText={text => {
						setSearchTerm(text)
						setShowDropdown(true)
						if (selectedItem) {
							onItemSelect(null)
						}
					}}
					onFocus={() => setShowDropdown(true)}
				/>
				{(selectedItem || searchTerm) && (
					<StyledTouchableOpacity className='pr-2' onPress={handleClearInput}>
						<FontAwesome name='times-circle' size={20} color='gray' />
					</StyledTouchableOpacity>
				)}
			</StyledView>
			{showDropdown && (
				<StyledView className='absolute top-full left-0 right-0 bg-white border border-gray-300 rounded z-10'>
					<ScrollView style={{ maxHeight: 200 }}>
						{filteredItems.map(item => (
							<StyledTouchableOpacity
								key={item.id}
								className='p-2 border-b border-gray-200'
								onPress={() => {
									onItemSelect(item)
									setSearchTerm('')
									setShowDropdown(false)
								}}>
								<StyledText>{item.name}</StyledText>
							</StyledTouchableOpacity>
						))}
					</ScrollView>
				</StyledView>
			)}
		</StyledView>
	)
}

export default SearchableDropdown
