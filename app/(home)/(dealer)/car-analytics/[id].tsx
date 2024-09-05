import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	ScrollView,
	Image,
	TouchableOpacity,
	StatusBar
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/utils/supabase'
import { LineChart, BarChart } from 'react-native-chart-kit'
import { Dimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '@/utils/ThemeContext'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CustomHeader = ({ title, onBack }: any) => {
	const { isDarkMode } = useTheme()

	return (
		<SafeAreaView
			edges={['top']}
			style={{
				backgroundColor: isDarkMode ? 'black' : 'white',
				borderBottomWidth: 0,
				borderBottomColor: '#D55004',
				borderTopWidth: 0,
				borderWidth: 0,

				borderColor: '#D55004'
			}}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'center', // Centers the content horizontally
					paddingHorizontal: 0,
					paddingBottom: 9
				}}>
				<Text
					style={{
						fontSize: 20,
						textAlign: 'center',
						color: '#D55004',
						fontWeight: '600'
					}}>
					{title}
				</Text>
			</View>
		</SafeAreaView>
	)
}

export default function IndividualCarAnalyticsPage() {
	const { id }: any = useLocalSearchParams()
	const router = useRouter()
	const [carData, setCarData] = useState<any>(null)
	const [analytics, setAnalytics] = useState<any>(null)
	const [timeRange, setTimeRange] = useState('week')

	useEffect(() => {
		fetchCarData()
		fetchCarAnalytics()
	}, [id, timeRange])

	const fetchCarData = async () => {
		const { data, error } = await supabase
			.from('cars')
			.select('*')
			.eq('id', id)
			.single()

		if (data) setCarData(data)
		if (error) console.error('Error fetching car data:', error)
	}

	const fetchCarAnalytics = async () => {
		const { data, error } = await supabase.rpc('get_car_analytics', {
			p_car_id: id.toString(),
			p_time_range: timeRange
		})

		if (data) setAnalytics(data)
		if (error) console.error('Error fetching car analytics:', error)
	}

	if (!carData || !analytics) return <Text className='p-4'>Loading...</Text>

	const viewsData = analytics.view_data.map((d: any) => d.views)
	const maxViews = Math.max(...viewsData)

	return (
		<>
			<CustomHeader
				title={carData.year + ' ' + carData.make + ' ' + carData.model}
				onBack={() => router.back()}
			/>
			<ScrollView className='flex-1 bg-gray-100'>
				<View className='bg-white p-4 mb-4'>
					<TouchableOpacity onPress={() => router.back()} className='mb-4'>
						<Ionicons name='arrow-back' size={24} color='black' />
					</TouchableOpacity>
					<Image
						source={{ uri: carData.images[0] }}
						className='w-full h-48 rounded-lg mb-4'
					/>
					<Text className='text-2xl font-bold'>
						{carData.year} {carData.make} {carData.model}
					</Text>
					<Text className='text-xl text-gray-600'>
						${carData.price.toLocaleString()}
					</Text>
				</View>

				<View className='bg-white p-4 mb-4'>
					<Text className='text-xl font-bold mb-4'>Analytics Overview</Text>
					<View className='flex-row justify-around mb-4'>
						{['week', 'month', 'year'].map(range => (
							<TouchableOpacity
								key={range}
								onPress={() => setTimeRange(range)}
								className={`px-4 py-2 rounded-full ${
									timeRange === range ? 'bg-blue-500' : 'bg-gray-200'
								}`}>
								<Text
									className={
										timeRange === range ? 'text-white' : 'text-gray-800'
									}>
									{range.charAt(0).toUpperCase() + range.slice(1)}
								</Text>
							</TouchableOpacity>
						))}
					</View>
				</View>

				<View className='bg-white p-4 mb-4'>
					<Text className='text-xl font-bold mb-4'>Key Metrics</Text>
					<View className='flex-row justify-between'>
						<View className='items-center'>
							<Text className='text-3xl font-bold text-blue-500'>
								{analytics.total_views}
							</Text>
							<Text className='text-sm text-gray-600'>Total Views</Text>
						</View>
						<View className='items-center'>
							<Text className='text-3xl font-bold text-red-500'>
								{analytics.total_likes}
							</Text>
							<Text className='text-sm text-gray-600'>Total Likes</Text>
						</View>
						<View className='items-center'>
							<Text className='text-3xl font-bold text-green-500'>
								{(
									(analytics.total_likes / analytics.total_views) *
									100
								).toFixed(2)}
								%
							</Text>
							<Text className='text-sm text-gray-600'>Like Rate</Text>
						</View>
					</View>
				</View>

				<View className='bg-white p-4 mb-4'>
					<Text className='text-xl font-bold mb-4'>Views Over Time</Text>
					<LineChart
						data={{
							labels: analytics.view_data.map((d: any) => d.date.slice(5)),
							datasets: [{ data: viewsData }]
						}}
						width={SCREEN_WIDTH - 32}
						height={220}
						chartConfig={{
							backgroundColor: '#ffffff',
							backgroundGradientFrom: '#ffffff',
							backgroundGradientTo: '#ffffff',
							decimalPlaces: 0,
							color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
							style: { borderRadius: 16 }
						}}
						bezier
						style={{ marginVertical: 8, borderRadius: 16 }}
					/>
				</View>

				<View className='bg-white p-4 mb-4'>
					<Text className='text-xl font-bold mb-4'>
						Views and Likes Comparison
					</Text>
					<BarChart
						data={{
							labels: ['This Car', 'Dealership Avg'],
							datasets: [
								{
									data: [
										analytics.total_views,
										analytics.total_views -
											analytics.comparison_to_average.views_diff
									]
								}
							]
						}}
						width={SCREEN_WIDTH - 32}
						height={220}
						yAxisLabel=''
						yAxisSuffix=''
						chartConfig={{
							backgroundColor: '#ffffff',
							backgroundGradientFrom: '#ffffff',
							backgroundGradientTo: '#ffffff',
							decimalPlaces: 0,
							color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
							barPercentage: 0.5,
							style: { borderRadius: 16 }
						}}
						style={{ marginVertical: 8, borderRadius: 16 }}
					/>
				</View>

				<View className='bg-white p-4 mb-4'>
					<Text className='text-xl font-bold mb-4'>
						Comparison to Dealership Average
					</Text>
					<View className='mb-4'>
						<Text className='text-gray-600 mb-2'>Views Difference:</Text>
						<View className='flex-row items-center'>
							<View
								className={`h-4 ${
									analytics.comparison_to_average.views_diff >= 0
										? 'bg-green-500'
										: 'bg-red-500'
								}`}
								style={{
									width: `${
										(Math.abs(analytics.comparison_to_average.views_diff) /
											maxViews) *
										100
									}%`
								}}
							/>
							<Text className='ml-2 font-bold'>
								{analytics.comparison_to_average.views_diff >= 0 ? '+' : ''}
								{analytics.comparison_to_average.views_diff}
							</Text>
						</View>
					</View>
					<View>
						<Text className='text-gray-600 mb-2'>Likes Difference:</Text>
						<View className='flex-row items-center'>
							<View
								className={`h-4 ${
									analytics.comparison_to_average.likes_diff >= 0
										? 'bg-green-500'
										: 'bg-red-500'
								}`}
								style={{
									width: `${
										(Math.abs(analytics.comparison_to_average.likes_diff) /
											maxViews) *
										100
									}%`
								}}
							/>
							<Text className='ml-2 font-bold'>
								{analytics.comparison_to_average.likes_diff >= 0 ? '+' : ''}
								{analytics.comparison_to_average.likes_diff}
							</Text>
						</View>
					</View>
				</View>

				<View className='bg-white p-4 mb-4'>
					<Text className='text-xl font-bold mb-4'>Car Details</Text>
					<View className='flex-row flex-wrap justify-between'>
						<View className='w-1/2 mb-2'>
							<Text className='text-gray-600'>Condition:</Text>
							<Text className='font-bold'>{carData.condition}</Text>
						</View>
						<View className='w-1/2 mb-2'>
							<Text className='text-gray-600'>Transmission:</Text>
							<Text className='font-bold'>{carData.transmission}</Text>
						</View>
						<View className='w-1/2 mb-2'>
							<Text className='text-gray-600'>Color:</Text>
							<Text className='font-bold'>{carData.color}</Text>
						</View>
						<View className='w-1/2 mb-2'>
							<Text className='text-gray-600'>Mileage:</Text>
							<Text className='font-bold'>
								{carData.mileage.toLocaleString()} miles
							</Text>
						</View>
						<View className='w-1/2 mb-2'>
							<Text className='text-gray-600'>Drivetrain:</Text>
							<Text className='font-bold'>{carData.drivetrain}</Text>
						</View>
						<View className='w-1/2 mb-2'>
							<Text className='text-gray-600'>Status:</Text>
							<Text className='font-bold'>{carData.status}</Text>
						</View>
					</View>
				</View>
			</ScrollView>
		</>
	)
}
