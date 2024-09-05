import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	FlatList,
	StatusBar
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit'
import { Dimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import ThemeSwitch from '@/components/ThemeSwitch'
import { SafeAreaView } from 'react-native-safe-area-context'

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

export default function DealerAnalyticsPage() {
	const { isDarkMode } = useTheme()
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

	if (!analytics)
		return (
			<Text className={`p-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>
				Loading analytics...
			</Text>
		)

	const renderCarItem = ({ item }: { item: any }) => (
		<TouchableOpacity
			className={`${
				isDarkMode ? 'bg-gray' : 'bg-white'
			} p-4 mb-2 rounded-lg flex-row justify-between items-center`}
			onPress={() => router.push(`/car-analytics/${item.id}`)}>
			<View>
				<Text
					className={`font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
					{item.year} {item.make} {item.model}
				</Text>
				<Text className={isDarkMode ? 'text-gray' : 'text-gray'}>
					Views: {item.views} | Likes: {item.likes}
				</Text>
			</View>
			<Ionicons
				name='chevron-forward'
				size={24}
				color={isDarkMode ? '#ffffff' : '#007AFF'}
			/>
		</TouchableOpacity>
	)

	return (
		<View className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
			<CustomHeader title='Analytics' />
			<View
				className={`p-4 rounded-lg shadow-md ${
					isDarkMode ? 'bg-black' : 'bg-white'
				}`}>
				<View className='flex-row justify-around mb-4'>
					{['week', 'month', 'year']?.map(range => (
						<TouchableOpacity
							key={range}
							onPress={() => setTimeRange(range)}
							className={`px-4 py-2 rounded-full ${
								timeRange === range ? 'bg-red' : isDarkMode ? 'bg-gray' : 'bg-'
							}`}>
							<Text
								className={
									timeRange === range
										? 'text-white'
										: isDarkMode
										? 'text-white'
										: 'text-gray'
								}>
								{range.charAt(0).toUpperCase() + range.slice(1)}
							</Text>
						</TouchableOpacity>
					))}
				</View>
			</View>

			<ScrollView>
				<View
					className={`rounded-lg shadow-md m-4 p-4 ${
						isDarkMode ? 'bg-gray' : 'bg-white'
					}`}>
					<Text
						className={`text-xl font-semibold mb-2 ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
						Overview
					</Text>
					<View className='flex-row justify-between'>
						<View className='items-center'>
							<Text className='text-3xl font-bold text-blue-500'>
								{analytics.total_listings}
							</Text>
							<Text
								className={`text-sm ${
									isDarkMode ? 'text-gray-400' : 'text-gray-600'
								}`}>
								Total Listings
							</Text>
						</View>
						<View className='items-center'>
							<Text className='text-3xl font-bold text-green-500'>
								{analytics.total_views}
							</Text>
							<Text
								className={`text-sm ${
									isDarkMode ? 'text-gray-400' : 'text-gray-600'
								}`}>
								Total Views
							</Text>
						</View>
						<View className='items-center'>
							<Text className='text-3xl font-bold text-red-500'>
								{analytics.total_likes}
							</Text>
							<Text
								className={`text-sm ${
									isDarkMode ? 'text-gray-400' : 'text-gray-600'
								}`}>
								Total Likes
							</Text>
						</View>
					</View>
				</View>

				<View
					className={`rounded-lg shadow-md p-4 ${
						isDarkMode ? 'bg-gray-800' : 'bg-white'
					}`}>
					<Text
						className={`text-xl font-semibold mb-2 ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
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
							backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
							backgroundGradientFrom: isDarkMode ? '#1e1e1e' : '#ffffff',
							backgroundGradientTo: isDarkMode ? '#1e1e1e' : '#ffffff',
							decimalPlaces: 0,
							color: (opacity = 1) =>
								isDarkMode
									? `rgba(255, 255, 255, ${opacity})`
									: `rgba(0, 0, 0, ${opacity})`,
							style: { borderRadius: 16 }
						}}
						bezier
						style={{ marginVertical: 8, borderRadius: 16 }}
					/>
				</View>

				<View
					className={`rounded-lg shadow-md p-4 ${
						isDarkMode ? 'bg-gray-800' : 'bg-white'
					}`}>
					<Text
						className={`text-xl font-semibold mb-2 ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
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
							backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
							backgroundGradientFrom: isDarkMode ? '#1e1e1e' : '#ffffff',
							backgroundGradientTo: isDarkMode ? '#1e1e1e' : '#ffffff',
							decimalPlaces: 0,
							color: (opacity = 1) => `rgba(0, 255, 0, ${opacity})`,
							style: { borderRadius: 16 }
						}}
						style={{ marginVertical: 8, borderRadius: 16 }}
					/>
				</View>

				<View
					className={`rounded-lg shadow-md p-4 ${
						isDarkMode ? 'bg-gray-800' : 'bg-white'
					}`}>
					<Text
						className={`text-xl font-semibold mb-2 ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
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
							backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
							backgroundGradientFrom: isDarkMode ? '#1e1e1e' : '#ffffff',
							backgroundGradientTo: isDarkMode ? '#1e1e1e' : '#ffffff',
							decimalPlaces: 0,
							color: (opacity = 1) => `rgba(255, 0, 0, ${opacity})`,
							style: { borderRadius: 16 }
						}}
						style={{ marginVertical: 8, borderRadius: 16 }}
					/>
				</View>

				<View
					className={`rounded-lg shadow-md m-4 p-4 ${
						isDarkMode ? 'bg-gray-800' : 'bg-white'
					}`}>
					<Text
						className={`text-xl font-semibold mb-2 ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
						Inventory Summary
					</Text>
					<PieChart
						data={[
							{
								name: 'New',
								population: analytics.inventory_summary.new_cars,
								color: '#FF9800',
								legendFontColor: isDarkMode ? '#E0E0E0' : '#7F7F7F',
								legendFontSize: 12
							},
							{
								name: 'Used',
								population: analytics.inventory_summary.used_cars,
								color: '#2196F3',
								legendFontColor: isDarkMode ? '#E0E0E0' : '#7F7F7F',
								legendFontSize: 12
							}
						]}
						width={SCREEN_WIDTH - 40}
						height={220}
						chartConfig={{
							color: (opacity = 1) =>
								isDarkMode
									? `rgba(255, 255, 255, ${opacity})`
									: `rgba(0, 0, 0, ${opacity})`
						}}
						accessor='population'
						backgroundColor='transparent'
						paddingLeft='15'
					/>
				</View>

				<View
					className={`rounded-lg shadow-md m-2 p-4 ${
						isDarkMode ? 'bg-gray-800' : 'bg-white'
					}`}>
					<Text
						className={`text-xl font-semibold mb-2 ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
						Performance Metrics
					</Text>
					<View className='flex-row justify-between items-center mb-2'>
						<Text className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
							Avg. Time to Sell:
						</Text>
						<Text
							className={`font-bold ${
								isDarkMode ? 'text-white' : 'text-black'
							}`}>
							{analytics.performance_metrics.avg_time_to_sell} days
						</Text>
					</View>
					<View className='flex-row justify-between items-center mb-2'>
						<Text className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
							Conversion Rate:
						</Text>
						<Text
							className={`font-bold ${
								isDarkMode ? 'text-white' : 'text-black'
							}`}>
							{(analytics.performance_metrics.conversion_rate * 100)?.toFixed(
								2
							)}
							%
						</Text>
					</View>
					<View className='flex-row justify-between items-center'>
						<Text className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
							Avg. Listing Price:
						</Text>
						<Text
							className={`font-bold ${
								isDarkMode ? 'text-white' : 'text-black'
							}`}>
							${analytics.performance_metrics.avg_listing_price?.toFixed(2)}
						</Text>
					</View>
				</View>

				<View
					className={`rounded-lg shadow-md m-4 p-4 ${
						isDarkMode ? 'bg-gray-800' : 'bg-white'
					}`}>
					<Text
						className={`text-xl font-semibold mb-2 ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
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
