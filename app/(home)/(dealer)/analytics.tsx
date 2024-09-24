import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
	LogBox,
	StyleSheet
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
	format,
	subDays,
	startOfWeek,
	startOfMonth,
	startOfYear
} from 'date-fns'
import RNPickerSelect from 'react-native-picker-select'

LogBox.ignoreLogs(['VirtualizedLists should never be nested'])

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const CustomHeader = ({
	title,
	showBackButton = true
}: {
	title: string
	showBackButton?: boolean
}) => {
	const { isDarkMode } = useTheme()
	const router = useRouter()

	return (
		<SafeAreaView
			edges={['top']}
			className={`${isDarkMode ? 'bg-night' : 'bg-white'} border-b border-red`}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View className='flex-row items-center justify-between py-4 px-4'>
				{showBackButton ? (
					<TouchableOpacity
						onPress={() => router.push('/(home)/(dealer)/profile')}>
						<Ionicons
							name='chevron-back'
							size={24}
							color={isDarkMode ? 'white' : 'black'}
						/>
					</TouchableOpacity>
				) : (
					<View style={{ width: 24 }} />
				)}
				<Text className='text-xl font-bold text-red'>{title}</Text>
				<View style={{ width: 24 }} />
			</View>
		</SafeAreaView>
	)
}

const ChartContainer = ({
	title,
	children
}: {
	title: string
	children: React.ReactNode
}) => {
	const { isDarkMode } = useTheme()
	return (
		<View
			className={`rounded-lg shadow-md p-4 mb-4 ${
				isDarkMode ? 'bg-black' : 'bg-white'
			}`}>
			<Text
				className={`text-xl font-semibold mb-2 ${
					isDarkMode ? 'text-white' : 'text-night'
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
	const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week')
	const [cars, setCars] = useState<any>([])
	const [isLoading, setIsLoading] = useState<boolean>(true)
	const [error, setError] = useState<string | null>(null)
	const [refreshing, setRefreshing] = useState<boolean>(false)
	const [currentPage, setCurrentPage] = useState(1)
	const [carsPerPage] = useState(10)
	const [totalPages, setTotalPages] = useState(1)
	const [hasMore, setHasMore] = useState(false)
	const [filterStatus, setFilterStatus] = useState('all')
	const [sortBy, setSortBy] = useState('latest')

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

			let query = supabase
				.from('cars')
				.select('*', { count: 'exact' })
				.eq('dealership_id', dealershipData.id)

			if (filterStatus !== 'all') {
				query = query.eq('status', filterStatus)
			}

			if (sortBy === 'latest') {
				query = query.order('listed_at', { ascending: false })
			} else if (sortBy === 'views') {
				query = query.order('views', { ascending: false })
			} else if (sortBy === 'likes') {
				query = query.order('likes', { ascending: false })
			}

			const { data, error, count } = await query.range(
				(currentPage - 1) * carsPerPage,
				currentPage * carsPerPage - 1
			)

			if (error) throw error

			setCars(data || [])
			setTotalPages(Math.ceil((count || 0) / carsPerPage))
		} catch (err: any) {
			setError(err.message)
		} finally {
			setIsLoading(false)
		}
	}, [user, currentPage, carsPerPage, filterStatus, sortBy])

	useEffect(() => {
		fetchData()
	}, [fetchData, currentPage, filterStatus, sortBy])

	const onRefresh = useCallback(() => {
		setRefreshing(true)
		fetchData().then(() => setRefreshing(false))
	}, [fetchData])

	const CarListing = () => {
		const getFilterStatusLabel = (value: string) => {
			const item = [
				{ label: 'All', value: 'all' },
				{ label: 'Available', value: 'available' },
				{ label: 'Sold', value: 'sold' },
				{ label: 'Pending', value: 'pending' }
			].find(item => item.value === value)
			return item ? item.label : ''
		}

		const getSortByLabel = (value: string) => {
			const item = [
				{ label: 'Latest', value: 'latest' },
				{ label: 'Most Viewed', value: 'views' },
				{ label: 'Most Liked', value: 'likes' }
			].find(item => item.value === value)
			return item ? item.label : ''
		}

		return (
			<View
				className={`rounded-lg shadow-md mx-4 mb-4 p-4 ${
					isDarkMode ? 'bg-gray' : 'bg-white'
				}`}>
				<Text
					className={`text-xl font-semibold mb-2 ${
						isDarkMode ? 'text-white' : 'text-night'
					}`}>
					Car Listings
				</Text>

				<View className='flex-row justify-between items-center mb-4'>
					<View className='flex-1 mr-2'>
						<Text className={` ${isDarkMode ? 'text-white' : 'text-night'}`}>
							Status:
						</Text>
						<RNPickerSelect
							onValueChange={value => {
								setFilterStatus(value)
								setCurrentPage(1)
							}}
							items={[
								{ label: 'All', value: 'all' },
								{ label: 'Available', value: 'available' },
								{ label: 'Sold', value: 'sold' },
								{ label: 'Pending', value: 'pending' }
							]}
							style={pickerSelectStyles}
							value={filterStatus}
							placeholder={{}}
						/>
					</View>
					<View className='flex-1 ml-2'>
						<Text className={`${isDarkMode ? 'text-white' : 'text-night'}`}>
							Sort by:
						</Text>
						<RNPickerSelect
							onValueChange={value => {
								setSortBy(value)
								setCurrentPage(1)
							}}
							items={[
								{ label: 'Latest', value: 'latest' },
								{ label: 'Most Viewed', value: 'views' },
								{ label: 'Most Liked', value: 'likes' }
							]}
							style={pickerSelectStyles}
							value={sortBy}
							placeholder={{}}
						/>
					</View>
				</View>

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

				<View className='flex-row justify-between items-center mt-4'>
					<TouchableOpacity
						onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
						disabled={currentPage === 1}>
						<Text className={currentPage === 1 ? 'text-gray' : 'text-red'}>
							Previous
						</Text>
					</TouchableOpacity>
					<Text className={isDarkMode ? 'text-white' : 'text-night'}>
						Page {currentPage} of {totalPages}
					</Text>
					<TouchableOpacity
						onPress={() =>
							setCurrentPage(prev => Math.min(totalPages, prev + 1))
						}
						disabled={currentPage === totalPages}>
						<Text
							className={currentPage === totalPages ? 'text-gray' : 'text-red'}>
							Next
						</Text>
					</TouchableOpacity>
				</View>
			</View>
		)
	}

	const renderCarItem = useCallback(
		({ item }: any) => (
			<TouchableOpacity
				className={`border border-red ${
					isDarkMode ? 'bg-gray' : 'bg-white'
				} p-4 mb-2 rounded-lg flex-row justify-between items-center`}
				onPress={() => router.push(`/car-analytics/${item.id}`)}>
				<View>
					<Text
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-night'}`}>
						{item.year} {item.make} {item.model}
					</Text>
					<Text className='text-red'>
						Views: {item.views} | Likes: {item.likes}
					</Text>
					<Text className={isDarkMode ? 'text-light-secondary' : 'text-gray'}>
						Price: ${item.price.toLocaleString()} | Status: {item.status}
					</Text>
				</View>
				<Ionicons
					name='chevron-forward'
					size={24}
					color={isDarkMode ? '#ffffff' : '#D55004'}
				/>
			</TouchableOpacity>
		),
		[isDarkMode, router]
	)

	const getDateRange = useMemo(() => {
		const endDate = new Date()
		let startDate
		switch (timeRange) {
			case 'week':
				startDate = startOfWeek(endDate)
				break
			case 'month':
				startDate = startOfMonth(endDate)
				break
			case 'year':
				startDate = startOfYear(endDate)
				break
			default:
				startDate = subDays(endDate, 7)
		}
		return { startDate, endDate }
	}, [timeRange])

	const formatChartData = useMemo(() => {
		if (!analytics?.time_series_data) return null

		const { startDate, endDate } = getDateRange
		const data = analytics.time_series_data.filter(
			(d: any) => new Date(d.date) >= startDate && new Date(d.date) <= endDate
		)

		const labels = data.map((d: any) => format(new Date(d.date), 'MMM dd'))
		const viewsData = data.map((d: any) => d.views)
		const likesData = data.map((d: any) => d.likes)

		return {
			labels,
			datasets: [
				{
					data: viewsData,
					color: () => 'rgba(0, 255, 0, 0.5)',
					strokeWidth: 2
				},
				{
					data: likesData,
					color: () => 'rgba(255, 0, 0, 0.5)',
					strokeWidth: 2
				}
			],
			legend: ['Views', 'Likes']
		}
	}, [analytics, getDateRange])

	const topViewedCarsData = useMemo(() => {
		if (!analytics?.top_viewed_cars) return null

		const labels = analytics.top_viewed_cars.map(
			(c: any) => `${c.year} ${c.make} ${c.model}`
		)
		const data = analytics.top_viewed_cars.map((c: any) => c.views)

		return { labels, data }
	}, [analytics])

	const topLikedCarsData = useMemo(() => {
		if (!analytics?.top_liked_cars) return null

		const labels = analytics.top_liked_cars.map(
			(c: any) => `${c.year} ${c.make} ${c.model}`
		)
		const data = analytics.top_liked_cars.map((c: any) => c.likes)

		return { labels, data }
	}, [analytics])

	const inventorySummary = useMemo(() => {
		if (!analytics?.inventory_summary) return null

		const { new_cars, used_cars } = analytics.inventory_summary
		const total = new_cars + used_cars

		return [
			{
				name: 'New Cars',
				population: new_cars,
				color: '#FF9800',
				legendFontColor: isDarkMode ? '#E0E0E0' : '#7F7F7F',
				legendFontSize: 12,
				percentage: ((new_cars / total) * 100).toFixed(1)
			},
			{
				name: 'Used Cars',
				population: used_cars,
				color: '#2196F3',
				legendFontColor: isDarkMode ? '#E0E0E0' : '#7F7F7F',
				legendFontSize: 12,
				percentage: ((used_cars / total) * 100).toFixed(1)
			}
		]
	}, [analytics, isDarkMode])

	const categoryColors = {
		Sedan: '#4285F4', // Blue
		SUV: '#34A853', // Green
		Hatchback: '#FBBC05', // Yellow
		Convertible: '#EA4335', // Red
		Coupe: '#9C27B0', // Purple
		Sports: '#FF9800', // Orange
		Other: '#795548' // Brown
	}

	const categoryDistribution = useMemo(() => {
		if (!analytics?.category_distribution) return null

		return Object.entries(analytics.category_distribution).map(
			([category, count]) => ({
				name: category,
				population: count,
				color:
					categoryColors[category as keyof typeof categoryColors] || '#CCCCCC', // Fallback color if category is not in our list
				legendFontColor: isDarkMode ? '#E0E0E0' : '#7F7F7F',
				legendFontSize: 12
			})
		)
	}, [analytics, isDarkMode])

	if (isLoading) {
		return (
			<View
				className={`flex-1 justify-center items-center ${
					isDarkMode ? 'bg-night' : 'bg-white'
				}`}>
				<ActivityIndicator size='large' color='#D55004' />
			</View>
		)
	}

	if (error) {
		return (
			<View
				className={`flex-1 justify-center items-center ${
					isDarkMode ? 'bg-night' : 'bg-white'
				}`}>
				<Text className={`text-xl ${isDarkMode ? 'text-white' : 'text-night'}`}>
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
			className={`flex-1 ${isDarkMode ? 'bg-night' : 'bg-white'}`}
			refreshControl={
				<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
			}>
			<CustomHeader title='Analytics' />

			<View
				className={`p-4 rounded-lg shadow-md  ${
					isDarkMode ? 'bg-night' : 'bg-white'
				}`}>
				<View className='flex-row justify-around mb-4'>
					{['week', 'month', 'year'].map(range => (
						<TouchableOpacity
							key={range}
							onPress={() => setTimeRange(range as 'week' | 'month' | 'year')}
							className={`px-4 py-2 rounded-full ${
								timeRange === range
									? 'bg-red'
									: isDarkMode
									? 'bg-gray'
									: 'bg-light-secondary'
							}`}>
							<Text
								className={
									timeRange === range
										? 'text-white'
										: isDarkMode
										? 'text-white'
										: 'text-night'
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
						isDarkMode ? 'text-white' : 'text-night'
					}`}>
					Overview
				</Text>
				<View className='flex-row justify-between'>
					<View className='items-center'>
						<Text className='text-3xl font-bold text-teal-500'>
							{analytics?.total_listings || 0}
						</Text>
						<Text
							className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray'}`}>
							Total Listings
						</Text>
					</View>
					<View className='items-center'>
						<Text className='text-3xl font-bold text-emerald-500'>
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

			{formatChartData && (
				<ChartContainer title='Views and Likes Over Time'>
					<LineChart
						data={formatChartData}
						width={SCREEN_WIDTH * 2}
						height={300}
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
			)}

			{topViewedCarsData && (
				<ChartContainer title='Top 5 Most Viewed Cars'>
					<BarChart
						data={{
							labels: topViewedCarsData.labels,
							datasets: [{ data: topViewedCarsData.data }]
						}}
						width={SCREEN_WIDTH * 2}
						height={300}
						yAxisLabel=''
						yAxisSuffix=''
						chartConfig={{
							backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
							backgroundGradientFrom: isDarkMode ? '#1e1e1e' : '#ffffff',
							backgroundGradientTo: isDarkMode ? '#1e1e1e' : '#ffffff',
							decimalPlaces: 0,
							color: (opacity = 1) => `rgba(20, 184, 166, ${opacity})`,
							style: { borderRadius: 16 },
							barPercentage: 0.5
						}}
						style={{ marginRight: 20, borderRadius: 16 }}
						showValuesOnTopOfBars
						fromZero
					/>
				</ChartContainer>
			)}

			{topLikedCarsData && (
				<ChartContainer title='Top 5 Most Liked Cars'>
					<BarChart
						data={{
							labels: topLikedCarsData.labels,
							datasets: [{ data: topLikedCarsData.data }]
						}}
						width={SCREEN_WIDTH * 2}
						height={300}
						yAxisLabel=''
						yAxisSuffix=''
						chartConfig={{
							backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
							backgroundGradientFrom: isDarkMode ? '#1e1e1e' : '#ffffff',
							backgroundGradientTo: isDarkMode ? '#1e1e1e' : '#ffffff',
							decimalPlaces: 0,
							color: (opacity = 1) => `rgba(0, 255, 0, ${opacity})`,
							style: { borderRadius: 16 },
							barPercentage: 0.5
						}}
						style={{ marginRight: 20, borderRadius: 16 }}
						showValuesOnTopOfBars
						fromZero
					/>
				</ChartContainer>
			)}

			{categoryDistribution && (
				<ChartContainer title='Category Distribution'>
					<PieChart
						data={categoryDistribution}
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
						center={[10, 0]}
						absolute
					/>
				</ChartContainer>
			)}

			<View
				className={`rounded-lg shadow-md mx-4 mb-4 p-4 ${
					isDarkMode ? 'bg-gray' : 'bg-white'
				}`}>
				<Text
					className={`text-xl font-semibold mb-2 ${
						isDarkMode ? 'text-white' : 'text-night'
					}`}>
					Inventory Summary
				</Text>

				<View className='flex-row justify-between items-center mb-2'>
					<Text className={isDarkMode ? 'text-red' : 'text-gray'}>
						Total Cars:
					</Text>
					<Text
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-night'}`}>
						{analytics?.inventory_summary?.new_cars +
							analytics?.inventory_summary?.used_cars || 0}
					</Text>
				</View>

				<View className='flex-row justify-between items-center mb-2'>
					<Text className={isDarkMode ? 'text-red' : 'text-gray'}>
						New Cars:
					</Text>
					<Text
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-night'}`}>
						{analytics?.inventory_summary?.new_cars || 0}
					</Text>
				</View>

				<View className='flex-row justify-between items-center mb-2'>
					<Text className={isDarkMode ? 'text-red' : 'text-gray'}>
						Used Cars:
					</Text>
					<Text
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-night'}`}>
						{analytics?.inventory_summary?.used_cars || 0}
					</Text>
				</View>

				<View className='flex-row justify-between items-center mb-2'>
					<Text className={isDarkMode ? 'text-red' : 'text-gray'}>
						Average Price:
					</Text>
					<Text
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-night'}`}>
						$
						{analytics?.inventory_summary?.avg_price?.toLocaleString(
							undefined,
							{ minimumFractionDigits: 2, maximumFractionDigits: 2 }
						) || '0'}
					</Text>
				</View>

				<View className='flex-row justify-between items-center mb-2'>
					<Text className={isDarkMode ? 'text-red' : 'text-gray'}>
						Average Mileage:
					</Text>
					<Text
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-night'}`}>
						{analytics?.inventory_summary?.avg_mileage?.toLocaleString(
							undefined,
							{ minimumFractionDigits: 0, maximumFractionDigits: 0 }
						) || '0'}{' '}
						miles
					</Text>
				</View>

				<View className='flex-row justify-between items-center mb-2'>
					<Text className={isDarkMode ? 'text-red' : 'text-gray'}>
						Total Inventory Value:
					</Text>
					<Text
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-night'}`}>
						$
						{analytics?.inventory_summary?.total_value?.toLocaleString() || '0'}
					</Text>
				</View>

				<View className='flex-row justify-between items-center mb-4'>
					<Text className={isDarkMode ? 'text-red' : 'text-gray'}>
						Price Range:
					</Text>
					<Text
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-night'}`}>
						$
						{analytics?.inventory_summary?.price_range?.min?.toLocaleString() ||
							'0'}{' '}
						- $
						{analytics?.inventory_summary?.price_range?.max?.toLocaleString() ||
							'0'}
					</Text>
				</View>

				{inventorySummary && (
					<View className='mb-4'>
						<Text
							className={`text-lg font-semibold mb-2 ${
								isDarkMode ? 'text-white' : 'text-night'
							}`}>
							New vs Used Cars
						</Text>
						<PieChart
							data={inventorySummary}
							width={SCREEN_WIDTH - 80}
							height={200}
							chartConfig={{
								color: (opacity = 1) =>
									isDarkMode
										? `rgba(255, 255, 255, ${opacity})`
										: `rgba(0, 0, 0, ${opacity})`
							}}
							accessor='population'
							backgroundColor='transparent'
							paddingLeft='15'
							center={[10, 0]}
							absolute
						/>
					</View>
				)}
			</View>

			<View
				className={`rounded-lg shadow-md mx-4 mb-4 p-4 ${
					isDarkMode ? 'bg-gray' : 'bg-white'
				}`}>
				<Text
					className={`text-xl font-semibold mb-2 ${
						isDarkMode ? 'text-white' : 'text-night'
					}`}>
					Performance Metrics
				</Text>
				<View className='flex-row justify-between items-center mb-2'>
					<Text className={isDarkMode ? 'text-red' : 'text-gray'}>
						Avg. Time to Sell:
					</Text>
					<Text
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-night'}`}>
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
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-night'}`}>
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
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-night'}`}>
						$
						{analytics?.performance_metrics?.avg_listing_price?.toFixed(2) ||
							'N/A'}
					</Text>
				</View>
				<View className='flex-row justify-between items-center mb-2'>
					<Text className={isDarkMode ? 'text-red' : 'text-gray'}>
						Avg. Sale Price:
					</Text>
					<Text
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-night'}`}>
						$
						{analytics?.performance_metrics?.avg_sale_price?.toFixed(2) ||
							'N/A'}
					</Text>
				</View>
				<View className='flex-row justify-between items-center'>
					<Text className={isDarkMode ? 'text-red' : 'text-gray'}>
						Avg. Price Difference:
					</Text>
					<Text
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-night'}`}>
						$
						{analytics?.performance_metrics?.price_difference?.toFixed(2) ||
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
						isDarkMode ? 'text-white' : 'text-night'
					}`}>
					Sales Summary
				</Text>
				<View className='flex-row justify-between items-center mb-2'>
					<Text className={isDarkMode ? 'text-red' : 'text-gray'}>
						Total Sales:
					</Text>
					<Text
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-night'}`}>
						{analytics?.sales_summary?.total_sales || 0}
					</Text>
				</View>
				<View className='flex-row justify-between items-center'>
					<Text className={isDarkMode ? 'text-red' : 'text-gray'}>
						Total Revenue:
					</Text>
					<Text
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-night'}`}>
						${analytics?.sales_summary?.total_revenue?.toLocaleString() || '0'}
					</Text>
				</View>
			</View>

			<View
				className={`rounded-lg shadow-md mx-4 mb-4 p-4 ${
					isDarkMode ? 'bg-gray' : 'bg-white'
				}`}>
				<Text
					className={`text-xl font-semibold mb-2 ${
						isDarkMode ? 'text-white' : 'text-night'
					}`}>
					Dealership Information
				</Text>
				<View className='flex-row justify-between items-center mb-2'>
					<Text className={isDarkMode ? 'text-red' : 'text-gray'}>Name:</Text>
					<Text
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-night'}`}>
						{dealership?.name || 'N/A'}
					</Text>
				</View>
				<View className='flex-row justify-between items-center mb-2'>
					<Text className={isDarkMode ? 'text-red' : 'text-gray'}>
						Location:
					</Text>
					<Text
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-night'}`}>
						{dealership?.location || 'N/A'}
					</Text>
				</View>
				<View className='flex-row justify-between items-center'>
					<Text className={isDarkMode ? 'text-red' : 'text-gray'}>Phone:</Text>
					<Text
						className={`font-bold ${isDarkMode ? 'text-white' : 'text-night'}`}>
						{dealership?.phone || 'N/A'}
					</Text>
				</View>
			</View>
			<CarListing />
		</ScrollView>
	)
}

const pickerSelectStyles = StyleSheet.create({
	inputIOS: {
		fontSize: 16,
		paddingVertical: 12,
		paddingHorizontal: 10,
		borderWidth: 1,
		borderColor: 'gray',
		borderRadius: 4,
		color: 'black',
		paddingRight: 30
	},
	inputAndroid: {
		fontSize: 16,
		paddingHorizontal: 10,
		paddingVertical: 8,
		borderWidth: 1,
		borderColor: 'gray',
		borderRadius: 8,
		color: 'black',
		paddingRight: 30
	}
})
