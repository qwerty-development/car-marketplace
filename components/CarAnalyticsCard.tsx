import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { TouchableOpacity, View, Text } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

const CarAnalyticsCard = ({ car, onPress, isDarkMode }: any) => {
	const getStatusColor = (status: any) => {
		switch (status) {
			case 'available':
				return '#10B981'
			case 'pending':
				return '#F59E0B'
			case 'sold':
				return '#EF4444'
			default:
				return '#6B7280'
		}
	}

	const getChangeIndicator = (value: any) => {
		const change = Number(value)
		if (change > 0) return { icon: 'trending-up', color: '#10B981' }
		if (change < 0) return { icon: 'trending-down', color: '#EF4444' }
		return { icon: 'remove', color: '#6B7280' }
	}

	const viewsChange = getChangeIndicator(car.views_change || 0)
	const likesChange = getChangeIndicator(car.likes_change || 0)

	return (
		<TouchableOpacity
			onPress={onPress}
			className={`mx-4 mb-4 rounded-2xl overflow-hidden`}>
			<LinearGradient
				colors={
					isDarkMode
						? ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
						: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']
				}
				className='p-4'
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}>
				<BlurView
					intensity={isDarkMode ? 20 : 40}
					tint={isDarkMode ? 'dark' : 'light'}
					className='absolute inset-0'
				/>

				<View className='flex-row justify-between items-start'>
					<View className='flex-1'>
						<Text
							className={`text-lg font-bold ${
								isDarkMode ? 'text-white' : 'text-night'
							}`}>
							{car.year} {car.make} {car.model}
						</Text>
						<View className='flex-row items-center mt-1'>
							<View
								style={{ backgroundColor: getStatusColor(car.status) }}
								className='rounded-full px-2 py-1'>
								<Text className='text-white text-xs capitalize'>
									{car.status}
								</Text>
							</View>
							<Text
								className={`ml-2 ${
									isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
								}`}>
								${car.price?.toLocaleString()}
							</Text>
						</View>
					</View>

					<View className='flex-row'>
						<View className='items-center mr-4'>
							<View className='flex-row items-center'>
								<Ionicons name='eye' size={16} color={viewsChange.color} />
								<Text
									className={`ml-1 ${
										isDarkMode ? 'text-white' : 'text-night'
									}`}>
									{car.views || 0}
								</Text>
							</View>
							<View className='flex-row items-center mt-1'>
								<Ionicons
									name={viewsChange.icon}
									size={12}
									color={viewsChange.color}
								/>
								<Text
									style={{ color: viewsChange.color }}
									className='text-xs ml-1'>
									{Math.abs(car.views_change || 0)}%
								</Text>
							</View>
						</View>

						<View className='items-center'>
							<View className='flex-row items-center'>
								<Ionicons name='heart' size={16} color={likesChange.color} />
								<Text
									className={`ml-1 ${
										isDarkMode ? 'text-white' : 'text-night'
									}`}>
									{car.likes || 0}
								</Text>
							</View>
							<View className='flex-row items-center mt-1'>
								<Ionicons
									name={likesChange.icon}
									size={12}
									color={likesChange.color}
								/>
								<Text
									style={{ color: likesChange.color }}
									className='text-xs ml-1'>
									{Math.abs(car.likes_change || 0)}%
								</Text>
							</View>
						</View>
					</View>
				</View>
			</LinearGradient>
		</TouchableOpacity>
	)
}

export default CarAnalyticsCard
