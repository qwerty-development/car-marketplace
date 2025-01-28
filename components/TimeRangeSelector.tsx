import { View, TouchableOpacity, Text } from 'react-native'

const TimeRangeSelector = ({
	selectedRange,
	onRangeChange,
	isDarkMode
}: any) => {
	const ranges = [
		{ label: 'Week', value: 'week' },
		{ label: 'Month', value: 'month' },
		{ label: 'Year', value: 'year' }
	]

	return (
		<View className='flex-row mx-4 mb-4'>
			{ranges.map(range => (
				<TouchableOpacity
					key={range.value}
					onPress={() => onRangeChange(range.value)}
					className={`px-4 py-2 rounded-full mx-1 ${
						selectedRange === range.value
							? 'bg-red'
							: isDarkMode
							? 'bg-gray/20'
							: 'bg-gray/10'
					}`}>
					<Text
						className={`text-sm font-medium ${
							selectedRange === range.value
								? 'text-white'
								: isDarkMode
								? 'text-white'
								: 'text-night'
						}`}>
						{range.label}
					</Text>
				</TouchableOpacity>
			))}
		</View>
	)
}

export default TimeRangeSelector
