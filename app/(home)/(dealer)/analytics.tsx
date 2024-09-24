import React, { useState, useEffect, useCallback } from 'react'
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	FlatList,
	StatusBar,
	ActivityIndicator,
	RefreshControl,
	Dimensions,
	LogBox
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'

LogBox.ignoreLogs(['VirtualizedLists should never be nested'])

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const CustomHeader = ({ title }: any) => {
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

const ChartContainer = ({ title, children }: any) => {
	const { isDarkMode } = useTheme()
	return (
		<View
			className={`rounded-lg shadow-md p-4 mb-4 ${
				isDarkMode ? '' : 'bg-white'
			}`}>
			<Text
				className={`text-xl font-semibold mb-2 ${
					isDarkMode ? 'text-white' : 'text-black'
				}`}>
				{title}
			</Text>
			<ScrollView horizontal showsHorizontalScrollIndicator={false}>
				{children}
			</ScrollView>
		</View>
	)
}

export default function DealerAnalyticsPage() {
	const { isDarkMode } = useTheme()
	const { user } = useUser()
	const router = useRouter()
	const [dealership, setDealership] = useState<any>(null)
	const [analytics, setAnalytics] = useState<any>(null)
	const [timeRange, setTimeRange] = useState<any>('week')
	const [cars, setCars] = useState<any>([])
	const [isLoading, setIsLoading] = useState<any>(true)
	const [error, setError] = useState<any>(null)
	const [refreshing, setRefreshing] = useState<any>(false)

	const fetchData = useCallback(async () => {
		setIsLoading(true)
		setError(null)
		try {
			if (!user) throw new Error('User not authenticated')

			const { data: dealershipData, error: dealershipError } = await supabase
				.from('dealerships')
				.select('*')
				.eq('user_id', user.id)
				.single()

			if (dealershipError) throw dealershipError
			setDealership(dealershipData)

			const { data: analyticsData, error: analyticsError } = await supabase.rpc(
				'get_dealer_analytics',
				{
					p_dealership_id: dealershipData.id,
					p_time_range: timeRange
				}
			)

			if (analyticsError) throw analyticsError
			setAnalytics(analyticsData)

			const { data: carsData, error: carsError } = await supabase
				.from('cars')
				.select('id, make, model, year, views, likes')
				.eq('dealership_id', dealershipData.id)
				.order('views', { ascending: false })

			if (carsError) throw carsError
			setCars(carsData)
		} catch (err: any) {
			setError(err.message)
		} finally {
			setIsLoading(false)
		}
	}, [user, timeRange])

	useEffect(() => {
		fetchData()
	}, [fetchData])

	const onRefresh = useCallback(() => {
		setRefreshing(true)
		fetchData().then(() => setRefreshing(false))
	}, [fetchData])

	const renderCarItem = useCallback(
		({ item }: any) => (
			<TouchableOpacity
				className={`border border-red ${
					isDarkMode ? 'bg-gray' : 'bg-white'
				} p-4 mb-2 rounded-lg flex-row justify-between items-center`}
				onPress={() => router.push(`/car-analytics/${item.id}`)}>
				<View>
					<Text
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
						{item.year} {item.make} {item.model}
					</Text>
					<Text className='text-red'>
						Views: {item.views} | Likes: {item.likes}
					</Text>
				</View>
				<Ionicons
					name='chevron-forward'
					size={24}
					color={isDarkMode ? '#ffffff' : '#007AFF'}
				/>
			</TouchableOpacity>
		),
		[isDarkMode, router]
	)

	if (isLoading) {
		return (
			<View
				className={`flex-1 justify-center items-center ${
					isDarkMode ? 'bg-black' : 'bg-white'
				}`}>
				<ActivityIndicator size='large' color='#D55004' />
			</View>
		)
	}

	if (error) {
		return (
			<View
				className={`flex-1 justify-center items-center ${
					isDarkMode ? 'bg-black' : 'bg-white'
				}`}>
				<Text className={`text-xl ${isDarkMode ? 'text-white' : 'text-black'}`}>
					{error}
				</Text>
				<TouchableOpacity
					className='mt-4 bg-red p-3 rounded-lg'
					onPress={fetchData}>
					<Text className='text-white font-semibold'>Retry</Text>
				</TouchableOpacity>
			</View>
		)
	}

	return (
		<ScrollView
			className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}
			refreshControl={
				<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
			}>
			<CustomHeader title='Analytics' />

			<View
				className={`p-4 rounded-lg shadow-md mb-4 ${
					isDarkMode ? 'bg-night' : 'bg-white'
				}`}>
				<View className='flex-row justify-around mb-4'>
					{['week', 'month', 'year'].map(range => (
						<TouchableOpacity
							key={range}
							onPress={() => setTimeRange(range)}
							className={`px-4 py-2 rounded-full ${
								timeRange === range
									? 'bg-red'
									: isDarkMode
									? 'bg-gray'
									: 'bg-black '
							}`}>
							<Text
								className={
									timeRange === range
										? 'text-white'
										: isDarkMode
										? 'text-white'
										: 'text-black'
								}>
								{range.charAt(0).toUpperCase() + range.slice(1)}
							</Text>
						</TouchableOpacity>
					))}
				</View>
			</View>

			<View
				className={`rounded-lg shadow-md mx-4 mb-4 p-4 ${
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
							{analytics?.total_listings || 0}
						</Text>
						<Text
							className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray'}`}>
							Total Listings
						</Text>
					</View>
					<View className='items-center'>
						<Text className='text-3xl font-bold text-green-500'>
							{analytics?.total_views || 0}
						</Text>
						<Text
							className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray'}`}>
							Total Views
						</Text>
					</View>
					<View className='items-center'>
						<Text className='text-3xl font-bold text-rose-500'>
							{analytics?.total_likes || 0}
						</Text>
						<Text
							className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray'}`}>
							Total Likes
						</Text>
					</View>
				</View>
			</View>

			<ChartContainer title='Views and Likes Over Time'>
				<LineChart
					data={{
						labels:
							analytics?.time_series_data?.map((d: { date: any }) => d.date) ||
							[],
						datasets: [
							{
								data:
									analytics?.time_series_data?.map(
										(d: { views: any }) => d.views
									) || [],
								color: () => 'rgba(0, 255, 0, 0.5)',
								strokeWidth: 2
							},
							{
								data:
									analytics?.time_series_data?.map(
										(d: { likes: any }) => d.likes
									) || [],
								color: () => 'rgba(255, 0, 0, 0.5)',
								strokeWidth: 2
							}
						],
						legend: ['Views', 'Likes']
					}}
					width={SCREEN_WIDTH * 1.5}
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
					style={{ marginRight: 20, borderRadius: 16 }}
				/>
			</ChartContainer>

			<ChartContainer title='Top 5 Most Viewed Cars'>
				<BarChart
					data={{
						labels:
							analytics?.top_viewed_cars?.map(
								(c: { make: any; model: any }) => `${c.make} ${c.model}`
							) || [],
						datasets: [
							{
								data:
									analytics?.top_viewed_cars?.map(
										(c: { views: any }) => c.views
									) || []
							}
						]
					}}
					width={SCREEN_WIDTH * 1.5}
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
					style={{ marginRight: 20, borderRadius: 16 }}
				/>
			</ChartContainer>

			<ChartContainer title='Top 5 Most Liked Cars'>
				<BarChart
					data={{
						labels:
							analytics?.top_liked_cars?.map(
								(c: { make: any; model: any }) => `${c.make} ${c.model}`
							) || [],
						datasets: [
							{
								data:
									analytics?.top_liked_cars?.map(
										(c: { likes: any }) => c.likes
									) || []
							}
						]
					}}
					width={SCREEN_WIDTH * 1.5}
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
					style={{ marginRight: 20, borderRadius: 16 }}
				/>
			</ChartContainer>

			<ChartContainer title='Inventory Summary'>
				<PieChart
					data={[
						{
							name: 'New',
							population: analytics?.inventory_summary?.new_cars || 0,
							color: '#FF9800',
							legendFontColor: isDarkMode ? '#E0E0E0' : '#7F7F7F',
							legendFontSize: 12
						},
						{
							name: 'Used',
							population: analytics?.inventory_summary?.used_cars || 0,
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
			</ChartContainer>

			<View
				className={`rounded-lg shadow-md mx-4 mb-4 p-4 ${
					isDarkMode ? 'bg-gray' : 'bg-white'
				}`}>
				<Text
					className={`text-xl font-semibold mb-2 ${
						isDarkMode ? 'text-white' : 'text-black'
					}`}>
					Performance Metrics
				</Text>
				<View className='flex-row justify-between items-center mb-2'>
					<Text className={isDarkMode ? 'text-red' : 'text-gray'}>
						Avg. Time to Sell:
					</Text>
					<Text
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
						{analytics?.performance_metrics?.avg_time_to_sell?.toFixed(1) ||
							'N/A'}{' '}
						days
					</Text>
				</View>
				<View className='flex-row justify-between items-center mb-2'>
					<Text className={isDarkMode ? 'text-red' : 'text-gray'}>
						Conversion Rate:
					</Text>
					<Text
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
						{(analytics?.performance_metrics?.conversion_rate * 100)?.toFixed(
							2
						) || 'N/A'}
						%
					</Text>
				</View>
				<View className='flex-row justify-between items-center'>
					<Text className={isDarkMode ? 'text-red' : 'text-gray'}>
						Avg. Listing Price:
					</Text>
					<Text
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
						$
						{analytics?.performance_metrics?.avg_listing_price?.toFixed(2) ||
							'N/A'}
					</Text>
				</View>
			</View>

			<View
				className={`rounded-lg shadow-md mx-4 mb-4 p-4 ${
					isDarkMode ? 'bg-gray' : 'bg-white'
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
					keyExtractor={item =>
						`${item.id}-${item.make}-${item.model}-${Math.random()}`
					}
					ListEmptyComponent={
						<Text
							className={`text-center py-4 ${
								isDarkMode ? 'text-red' : 'text-gray'
							}`}>
							No car data available
						</Text>
					}
				/>
			</View>
		</ScrollView>
	)
}
