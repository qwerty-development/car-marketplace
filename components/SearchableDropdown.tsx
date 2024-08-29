import React, { useState } from 'react'
import { View, Text } from 'react-native'
import { Dropdown } from 'react-native-element-dropdown'
import { styled } from 'nativewind'
import { FontAwesome } from '@expo/vector-icons'

const StyledView = styled(View)
const StyledText = styled(Text)

interface Item {
	id: string | number
	name: string
}

interface DropdownComponentProps {
	items: Item[]
	onItemSelect: (item: Item | null) => void
	placeholder: string
	selectedItem?: Item
}

const DropdownComponent: React.FC<DropdownComponentProps> = ({
	items,
	onItemSelect,
	placeholder,
	selectedItem
}: any) => {
	const [isFocus, setIsFocus] = useState(false)

	const renderLabel = () => {
		if (selectedItem || isFocus) {
			return (
				<StyledText className='absolute left-0 top-0 z-10 bg-white px-1 text-sm text-gray-600'>
					{placeholder}
				</StyledText>
			)
		}
		return null
	}

	return (
		<StyledView className='mb-4'>
			{renderLabel()}
			<Dropdown
				style={[
					{
						height: 50,
						borderColor: 'gray',
						borderWidth: 0.5,
						borderRadius: 8,
						paddingHorizontal: 8
					},
					isFocus && { borderColor: 'blue' }
				]}
				placeholderStyle={{ fontSize: 16, color: 'gray' }}
				selectedTextStyle={{ fontSize: 16 }}
				inputSearchStyle={{ height: 40, fontSize: 16 }}
				iconStyle={{ width: 20, height: 20 }}
				data={items}
				search
				maxHeight={300}
				labelField='name'
				valueField='id'
				placeholder={!isFocus ? placeholder : '...'}
				searchPlaceholder='Search...'
				value={selectedItem?.id}
				onFocus={() => setIsFocus(true)}
				onBlur={() => setIsFocus(false)}
				onChange={item => {
					onItemSelect(item)
					setIsFocus(false)
				}}
				renderLeftIcon={() => (
					<FontAwesome
						style={{ marginRight: 5 }}
						color={isFocus ? 'blue' : 'black'}
						name='search'
						size={20}
					/>
				)}
			/>
		</StyledView>
	)
}

export default DropdownComponent
