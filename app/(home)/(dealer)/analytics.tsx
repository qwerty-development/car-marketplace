import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	FlatList
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit'
import { Dimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export default function DealerAnalyticsPage() {
	const { user } = useUser()
	const router = useRouter()
	const [dealership, setDealership] = useState<any>(null)
	const [analytics, setAnalytics] = useState<any>(null)
	const [timeRange, setTimeRange] = useState('week')
	const [cars, setCars] = useState<any[]>([])

	useEffect(() => {
		if (user) fetchDealershipInfo()
	}, [user])

	useEffect(() => {
		if (dealership) {
			fetchAnalytics()
			fetchCars()
		}
	}, [dealership, timeRange])

	const fetchDealershipInfo = async () => {
		const { data, error } = await supabase
			.from('dealerships')
			.select('*')
			.eq('user_id', user?.id)
			.single()

		if (data) setDealership(data)
	}

	const fetchAnalytics = async () => {
		const { data, error } = await supabase.rpc('get_dealer_analytics', {
			p_dealership_id: dealership.id,
			p_time_range: timeRange
		})

		if (data) setAnalytics(data)
	}

	const fetchCars = async () => {
		const { data, error } = await supabase
			.from('cars')
			.select('id, make, model, year, views, likes')
			.eq('dealership_id', dealership.id)
			.order('views', { ascending: false })

		if (data) setCars(data)
	}

	if (!analytics) return <Text className='p-4'>Loading analytics...</Text>

	const renderCarItem = ({ item }: { item: any }) => (
		<TouchableOpacity
			className='bg-white p-4 mb-2 rounded-lg flex-row justify-between items-center'
			onPress={() => router.push(`/car-analytics/${item.id}`)}>
			<View>
				<Text className='font-bold'>
					{item.year} {item.make} {item.model}
				</Text>
				<Text className='text-gray-600'>
					Views: {item.views} | Likes: {item.likes}
				</Text>
			</View>
			<Ionicons name='chevron-forward' size={24} color='#007AFF' />
		</TouchableOpacity>
	)

	return (
		<View className='flex-1 bg-gray-100'>
			<View className='p-4 rounded-lg shadow-md'>
				<View className='flex-row justify-around mb-4'>
					{['week', 'month', 'year']?.map(range => (
						<TouchableOpacity
							key={range}
							onPress={() => setTimeRange(range)}
							className={`px-4 py-2 rounded-full ${
								timeRange === range ? 'bg-red' : 'bg-gray-200'
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

			<ScrollView>
				<View className='bg-white rounded-lg shadow-md m-4 p-4'>
					<Text className='text-xl font-semibold mb-2'>Overview</Text>
					<View className='flex-row justify-between'>
						<View className='items-center'>
							<Text className='text-3xl font-bold text-blue-500'>
								{analytics.total_listings}
							</Text>
							<Text className='text-sm text-gray-600'>Total Listings</Text>
						</View>
						<View className='items-center'>
							<Text className='text-3xl font-bold text-green-500'>
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
					</View>
				</View>

				<View className='bg-white rounded-lg shadow-md p-4'>
					<Text className='text-xl font-semibold mb-2'>
						Views and Likes Over Time
					</Text>
					<LineChart
						data={{
							labels: analytics.time_series_data?.map((d: any) => d.date),
							datasets: [
								{
									data: analytics.time_series_data?.map((d: any) => d.views),
									color: () => 'rgba(0, 255, 0, 0.5)'
								},
								{
									data: analytics.time_series_data?.map((d: any) => d.likes),
									color: () => 'rgba(255, 0, 0, 0.5)'
								}
							],
							legend: ['Views', 'Likes']
						}}
						width={SCREEN_WIDTH - 40}
						height={220}
						chartConfig={{
							backgroundColor: '#ffffff',
							backgroundGradientFrom: '#ffffff',
							backgroundGradientTo: '#ffffff',
							decimalPlaces: 0,
							color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
							style: { borderRadius: 16 }
						}}
						bezier
						style={{ marginVertical: 8, borderRadius: 16 }}
					/>
				</View>

				<View className='bg-white rounded-lg shadow-md p-4'>
					<Text className='text-xl font-semibold mb-2'>
						Top 5 Most Viewed Cars
					</Text>
					<BarChart
						data={{
							labels: analytics.top_viewed_cars?.map(
								(c: any) => `${c.make} ${c.model}`
							),
							datasets: [
								{ data: analytics.top_viewed_cars?.map((c: any) => c.views) }
							]
						}}
						width={SCREEN_WIDTH - 40}
						height={220}
						yAxisLabel=''
						yAxisSuffix=''
						chartConfig={{
							backgroundColor: '#ffffff',
							backgroundGradientFrom: '#ffffff',
							backgroundGradientTo: '#ffffff',
							decimalPlaces: 0,
							color: (opacity = 1) => `rgba(0, 255, 0, ${opacity})`,
							style: { borderRadius: 16 }
						}}
						style={{ marginVertical: 8, borderRadius: 16 }}
					/>
				</View>

				<View className='bg-white rounded-lg shadow-md p-4'>
					<Text className='text-xl font-semibold mb-2'>
						Top 5 Most Liked Cars
					</Text>
					<BarChart
						data={{
							labels: analytics.top_liked_cars?.map(
								(c: any) => `${c.make} ${c.model}`
							),
							datasets: [
								{ data: analytics.top_liked_cars?.map((c: any) => c.likes) }
							]
						}}
						width={SCREEN_WIDTH - 40}
						height={220}
						yAxisLabel=''
						yAxisSuffix=''
						chartConfig={{
							backgroundColor: '#ffffff',
							backgroundGradientFrom: '#ffffff',
							backgroundGradientTo: '#ffffff',
							decimalPlaces: 0,
							color: (opacity = 1) => `rgba(255, 0, 0, ${opacity})`,
							style: { borderRadius: 16 }
						}}
						style={{ marginVertical: 8, borderRadius: 16 }}
					/>
				</View>

				<View className='bg-white rounded-lg shadow-md m-4 p-4'>
					<Text className='text-xl font-semibold mb-2'>Inventory Summary</Text>
					<PieChart
						data={[
							{
								name: 'New',
								population: analytics.inventory_summary.new_cars,
								color: '#FF9800',
								legendFontColor: '#7F7F7F',
								legendFontSize: 12
							},
							{
								name: 'Used',
								population: analytics.inventory_summary.used_cars,
								color: '#2196F3',
								legendFontColor: '#7F7F7F',
								legendFontSize: 12
							}
						]}
						width={SCREEN_WIDTH - 40}
						height={220}
						chartConfig={{
							color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`
						}}
						accessor='population'
						backgroundColor='transparent'
						paddingLeft='15'
					/>
				</View>

				<View className='bg-white rounded-lg shadow-md m-2 p-4'>
					<Text className='text-xl font-semibold mb-2'>
						Performance Metrics
					</Text>
					<View className='flex-row justify-between items-center mb-2'>
						<Text className='text-gray-600'>Avg. Time to Sell:</Text>
						<Text className='font-bold'>
							{analytics.performance_metrics.avg_time_to_sell} days
						</Text>
					</View>
					<View className='flex-row justify-between items-center mb-2'>
						<Text className='text-gray-600'>Conversion Rate:</Text>
						<Text className='font-bold'>
							{(analytics.performance_metrics.conversion_rate * 100)?.toFixed(
								2
							)}
							%
						</Text>
					</View>
					<View className='flex-row justify-between items-center'>
						<Text className='text-gray-600'>Avg. Listing Price:</Text>
						<Text className='font-bold'>
							${analytics.performance_metrics.avg_listing_price?.toFixed(2)}
						</Text>
					</View>
				</View>

				<View className='bg-white rounded-lg shadow-md m-4 p-4'>
					<Text className='text-xl font-semibold mb-2'>
						Individual Car Analytics
					</Text>
					<FlatList
						data={cars}
						renderItem={renderCarItem}
						keyExtractor={item => item.id.toString()}
						scrollEnabled={false}
					/>
				</View>
			</ScrollView>
		</View>
	)
}
