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
	LogBox
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import { format } from 'date-fns'
import { BlurView } from 'expo-blur'

LogBox.ignoreLogs(['VirtualizedLists should never be nested'])

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const CustomHeader = ({ title, showBackButton = true }) => {
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

const ChartContainer = ({ title, children }) => {
	const { isDarkMode } = useTheme()
	return (
		<BlurView
			intensity={100}
			tint={isDarkMode ? 'dark' : 'light'}
			className='rounded-lg shadow-md p-4 mb-4'>
			<Text
				className={`text-xl font-semibold mb-2 ${
					isDarkMode ? 'text-white' : 'text-night'
				}`}>
				{title}
			</Text>
			<ScrollView horizontal showsHorizontalScrollIndicator={false}>
				{children}
			</ScrollView>
		</BlurView>
	)
}

const CarListing = React.memo(({ dealershipId, isDarkMode }) => {
	const router = useRouter()
	const [cars, setCars] = useState([])
	const [isLoadingCars, setIsLoadingCars] = useState(false)
	const [currentPage, setCurrentPage] = useState(1)
	const [totalPages, setTotalPages] = useState(1)
	const carsPerPage = 10

	const fetchCarData = useCallback(async () => {
		if (!dealershipId) return
		setIsLoadingCars(true)
		try {
			const { data, error, count } = await supabase
				.from('cars')
				.select('*', { count: 'exact' })
				.eq('dealership_id', dealershipId)
				.range((currentPage - 1) * carsPerPage, currentPage * carsPerPage - 1)
				.order('listed_at', { ascending: false })

			if (error) throw error

			setCars(data || [])
			setTotalPages(Math.ceil((count || 0) / carsPerPage))
		} catch (err) {
			console.error('Error fetching car data:', err)
		} finally {
			setIsLoadingCars(false)
		}
	}, [dealershipId, currentPage])

	useEffect(() => {
		fetchCarData()
	}, [fetchCarData])

	const renderCarItem = useCallback(
		({ item }) => (
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

	return (
		<BlurView
			intensity={100}
			tint={isDarkMode ? 'dark' : 'light'}
			className='rounded-lg shadow-md mx-4 mb-4 p-4'>
			<Text
				className={`text-xl font-semibold mb-2 ${
					isDarkMode ? 'text-white' : 'text-night'
				}`}>
				Recent Listings
			</Text>
			{isLoadingCars ? (
				<ActivityIndicator size='large' color='#D55004' />
			) : (
				<>
					<FlatList
						data={cars}
						renderItem={renderCarItem}
						keyExtractor={item => `${item.id}-${item.make}-${item.model}`}
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
								className={
									currentPage === totalPages ? 'text-gray' : 'text-red'
								}>
								Next
							</Text>
						</TouchableOpacity>
					</View>
				</>
			)}
		</BlurView>
	)
})

const SUBSCRIPTION_WARNING_DAYS = 7

export default function DealerAnalyticsPage() {
	const { isDarkMode } = useTheme()
	const { user } = useUser()
	const router = useRouter()
	const [dealership, setDealership] = useState(null)
	const [analytics, setAnalytics] = useState(null)
	const [timeRange, setTimeRange] = useState('year')
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState(null)
	const [refreshing, setRefreshing] = useState(false)
	const fetchData = useCallback(async () => {
		if (!user) return
		setIsLoading(true)
		setError(null)
		try {
			const { data: dealershipData, error: dealershipError } = await supabase
				.from('dealerships')
				.select('*')
				.eq('user_id', user.id)
				.single()

			if (dealershipError) throw dealershipError
			setDealership(dealershipData)

			if (!isSubscriptionValid(dealershipData)) {
				setError('Subscription expired')
				return
			}

			const { data: analyticsData, error: analyticsError } = await supabase.rpc(
				'get_dealer_analytics',
				{
					p_dealership_id: dealershipData.id,
					p_time_range: timeRange
				}
			)

			if (analyticsError) throw analyticsError
			setAnalytics(analyticsData)
		} catch (err) {
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

	const isSubscriptionValid = useCallback(dealershipData => {
		if (!dealershipData || !dealershipData.subscription_end_date) return false
		const endDate = new Date(dealershipData.subscription_end_date)
		return endDate > new Date()
	}, [])

	const getDaysUntilExpiration = useCallback(dealershipData => {
		if (!dealershipData || !dealershipData.subscription_end_date) return 0
		const endDate = new Date(dealershipData.subscription_end_date)
		const today = new Date()
		const diffTime = endDate.getTime() - today.getTime()
		return Math.ceil(diffTime / (1000 * 3600 * 24))
	}, [])

	const formatChartData = useMemo(() => {
		if (!analytics?.time_series_data) return null

		const data = analytics.time_series_data

		const labels = data.map((d: { date: string | number | Date }) =>
			format(new Date(d.date), 'MMM dd')
		)
		const viewsData = data.map((d: { views: any }) => d.views)
		const likesData = data.map((d: { likes: any }) => d.likes)

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
	}, [analytics])

	const topViewedCarsData = useMemo(() => {
		if (!analytics?.top_viewed_cars) return null

		const labels = analytics.top_viewed_cars.map(
			(c: { year: any; make: any; model: any }) =>
				`${c.year} ${c.make} ${c.model}`
		)
		const data = analytics.top_viewed_cars.map((c: { views: any }) => c.views)

		return { labels, data }
	}, [analytics])

	const topLikedCarsData = useMemo(() => {
		if (!analytics?.top_liked_cars) return null

		const labels = analytics.top_liked_cars.map(
			(c: { year: any; make: any; model: any }) =>
				`${c.year} ${c.make} ${c.model}`
		)
		const data = analytics.top_liked_cars.map((c: { likes: any }) => c.likes)

		return { labels, data }
	}, [analytics])

	const categoryColors = {
		Sedan: '#4285F4',
		SUV: '#34A853',
		Hatchback: '#FBBC05',
		Convertible: '#EA4335',
		Coupe: '#9C27B0',
		Sports: '#FF9800',
		Other: '#795548'
	}

	const categoryDistribution = useMemo(() => {
		if (!analytics?.category_distribution) return null

		return Object.entries(analytics.category_distribution).map(
			([category, count]) => ({
				name: category,
				population: count,
				color: categoryColors[category] || '#CCCCCC',
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

	if (error === 'Subscription expired') {
		return (
			<SafeAreaView
				className={`flex-1 ${isDarkMode ? 'bg-night' : 'bg-white'}`}>
				<View className='flex-1 justify-center items-center p-4'>
					<Text
						className={`text-xl ${
							isDarkMode ? 'text-white' : 'text-night'
						} text-center mb-4`}>
						Your subscription has expired. Please renew to access analytics.
					</Text>
					<TouchableOpacity
						className='bg-rose-700 p-3 rounded-lg'
						onPress={() => router.push('/(home)/(dealer)/profile')}>
						<Text className='text-white font-semibold'>Go to Profile</Text>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
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

	const daysUntilExpiration = getDaysUntilExpiration(dealership)
	const showWarning =
		daysUntilExpiration <= SUBSCRIPTION_WARNING_DAYS && daysUntilExpiration > 0

	return (
		<ScrollView
			className={`flex-1 ${isDarkMode ? 'bg-night' : 'bg-white'}`}
			refreshControl={
				<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
			}>
			<CustomHeader title='Analytics' />

			{showWarning && (
				<View className='bg-yellow-500 p-4'>
					<Text className='text-white text-center font-bold'>
						Your subscription will expire in {daysUntilExpiration} day(s).
						Please renew soon.
					</Text>
				</View>
			)}

			<BlurView
				intensity={100}
				tint={isDarkMode ? 'dark' : 'light'}
				className='p-4 rounded-lg shadow-md mx-4 my-4'>
				<View className='flex-row justify-between'>
					<OverviewMetric
						title='Total Listings'
						value={analytics?.total_listings || 0}
						icon='list'
						color='#4CAF50'
					/>
					<OverviewMetric
						title='Total Views'
						value={analytics?.total_views || 0}
						icon='eye'
						color='#2196F3'
					/>
					<OverviewMetric
						title='Total Likes'
						value={analytics?.total_likes || 0}
						icon='heart'
						color='#F44336'
					/>
				</View>
			</BlurView>

			{formatChartData && (
				<ChartContainer title='Views and Likes Over Time'>
					<LineChart
						data={formatChartData}
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
						style={{ marginVertical: 8, borderRadius: 16 }}
					/>
				</ChartContainer>
			)}
			{topViewedCarsData && (
				<ChartContainer title='Top 5 Most Viewed Cars'>
					<BarChart
						data={{
							labels: topViewedCarsData.labels.map(
								(label: string) =>
									label.split(' ')[1] + ' ' + label.split(' ')[2]
							), // Only show the year
							datasets: [{ data: topViewedCarsData.data }]
						}}
						width={SCREEN_WIDTH * 1.5}
						height={300} // Increased height
						yAxisLabel=''
						yAxisSuffix=''
						chartConfig={{
							backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
							backgroundGradientFrom: isDarkMode ? '#1e1e1e' : '#ffffff',
							backgroundGradientTo: isDarkMode ? '#1e1e1e' : '#ffffff',
							decimalPlaces: 0,
							color: (opacity = 1) => `rgba(20, 184, 166, ${opacity})`,
							style: { borderRadius: 16 },
							barPercentage: 0.7,
							propsForVerticalLabels: {
								fontSize: 10,
								rotation: 0
							}
						}}
						style={{ marginVertical: 8, borderRadius: 16 }}
						showValuesOnTopOfBars
						fromZero
					/>
					<View className='mt-4 bg-opacity-20 bg-gray-500 rounded-lg p-3'>
						{topViewedCarsData.labels.map(
							(
								label:
									| string
									| number
									| boolean
									| React.ReactElement<
											any,
											string | React.JSXElementConstructor<any>
									  >
									| Iterable<React.ReactNode>
									| React.ReactPortal
									| null
									| undefined,
								index: React.Key | null | undefined
							) => (
								<View key={index} className='flex-row items-center mb-2'>
									<View className='w-5 h-5 rounded-full bg-teal-500 mr-3 flex items-center justify-center'>
										<Text className='text-white font-bold text-xs'>
											{index + 1}
										</Text>
									</View>
									<Text
										className={`text-sm ${
											isDarkMode ? 'text-white' : 'text-night'
										}`}>
										{label}
									</Text>
								</View>
							)
						)}
					</View>
				</ChartContainer>
			)}

			{topLikedCarsData && (
				<ChartContainer title='Top 5 Most Liked Cars'>
					<BarChart
						data={{
							labels: topViewedCarsData!.labels.map(
								(label: string) =>
									label.split(' ')[1] + ' ' + label.split(' ')[2]
							),
							datasets: [{ data: topLikedCarsData.data }]
						}}
						width={SCREEN_WIDTH * 1.5}
						height={300} // Increased height
						yAxisLabel=''
						yAxisSuffix=''
						chartConfig={{
							backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
							backgroundGradientFrom: isDarkMode ? '#1e1e1e' : '#ffffff',
							backgroundGradientTo: isDarkMode ? '#1e1e1e' : '#ffffff',
							decimalPlaces: 0,
							color: (opacity = 1) => `rgba(0, 255, 0, ${opacity})`,
							style: { borderRadius: 16 },
							barPercentage: 0.7,
							propsForVerticalLabels: {
								fontSize: 10,
								rotation: 0
							}
						}}
						style={{ marginVertical: 8, borderRadius: 16 }}
						showValuesOnTopOfBars
						fromZero
					/>
					<View className='mt-4 bg-opacity-20 bg-gray-500 rounded-lg p-3'>
						{topLikedCarsData.labels.map(
							(
								label:
									| string
									| number
									| boolean
									| React.ReactElement<
											any,
											string | React.JSXElementConstructor<any>
									  >
									| Iterable<React.ReactNode>
									| React.ReactPortal
									| null
									| undefined,
								index: any
							) => (
								<View key={index} className='flex-row items-center mb-2'>
									<View className='w-5 h-5 rounded-full bg-green-500 mr-3 flex items-center justify-center'>
										<Text className='text-white font-bold text-xs'>
											{index + 1}
										</Text>
									</View>
									<Text
										className={`text-sm ${
											isDarkMode ? 'text-white' : 'text-night'
										}`}>
										{label}
									</Text>
								</View>
							)
						)}
					</View>
				</ChartContainer>
			)}

			{categoryDistribution && (
				<ChartContainer title='Category Distribution'>
					<PieChart
						data={categoryDistribution}
						width={SCREEN_WIDTH - 32}
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

			<InventorySummary analytics={analytics} isDarkMode={isDarkMode} />
			<PerformanceMetrics analytics={analytics} isDarkMode={isDarkMode} />
			<SalesSummary analytics={analytics} isDarkMode={isDarkMode} />
			<DealershipInfo dealership={dealership} isDarkMode={isDarkMode} />

			{dealership && (
				<CarListing dealershipId={dealership.id} isDarkMode={isDarkMode} />
			)}
		</ScrollView>
	)
}

const SummaryContainer = ({ title, children, isDarkMode }: any) => (
	<BlurView
		intensity={100}
		tint={isDarkMode ? 'dark' : 'light'}
		className='rounded-lg shadow-md mx-4 mb-6 p-6'>
		<Text
			className={`text-xl font-semibold mb-4 ${
				isDarkMode ? 'text-white' : 'text-night'
			}`}>
			{title}
		</Text>
		<View className='bg-opacity-10 bg-gray-500 rounded-lg p-4'>{children}</View>
	</BlurView>
)

const OverviewMetric = ({ title, value, icon, color }: any) => (
	<View className='items-center'>
		<Ionicons name={icon} size={24} color={color} />
		<Text className='text-2xl font-bold mt-2 text-red' style={{ color }}>
			{value}
		</Text>
		<Text className='text-xs text-gray'>{title}</Text>
	</View>
)

const InventorySummary = ({ analytics, isDarkMode }: any) => (
	<SummaryContainer title='Inventory Summary' isDarkMode={isDarkMode}>
		<MetricRow
			label='Total Cars'
			value={
				analytics?.inventory_summary?.new_cars +
					analytics?.inventory_summary?.used_cars || 0
			}
			isDarkMode={isDarkMode}
		/>
		<MetricRow
			label='New Cars'
			value={analytics?.inventory_summary?.new_cars || 0}
			isDarkMode={isDarkMode}
		/>
		<MetricRow
			label='Used Cars'
			value={analytics?.inventory_summary?.used_cars || 0}
			isDarkMode={isDarkMode}
		/>
		<MetricRow
			label='Average Price'
			value={`$${
				analytics?.inventory_summary?.avg_price?.toLocaleString(undefined, {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2
				}) || '0'
			}`}
			isDarkMode={isDarkMode}
		/>
		<MetricRow
			label='Average Mileage'
			value={`${
				analytics?.inventory_summary?.avg_mileage?.toLocaleString(undefined, {
					minimumFractionDigits: 0,
					maximumFractionDigits: 0
				}) || '0'
			} miles`}
			isDarkMode={isDarkMode}
		/>
		<MetricRow
			label='Total Inventory Value'
			value={`$${
				analytics?.inventory_summary?.total_value?.toLocaleString() || '0'
			}`}
			isDarkMode={isDarkMode}
		/>
		<MetricRow
			label='Price Range'
			value={`$${
				analytics?.inventory_summary?.price_range?.min?.toLocaleString() || '0'
			} - $${
				analytics?.inventory_summary?.price_range?.max?.toLocaleString() || '0'
			}`}
			isDarkMode={isDarkMode}
		/>
	</SummaryContainer>
)

const PerformanceMetrics = ({ analytics, isDarkMode }: any) => (
	<SummaryContainer title='Performance Metrics' isDarkMode={isDarkMode}>
		<MetricRow
			label='Avg. Time to Sell'
			value={`${
				analytics?.performance_metrics?.avg_time_to_sell?.toFixed(1) || 'N/A'
			} days`}
			isDarkMode={isDarkMode}
		/>
		<MetricRow
			label='Conversion Rate'
			value={`${
				(analytics?.performance_metrics?.conversion_rate * 100)?.toFixed(2) ||
				'N/A'
			}%`}
			isDarkMode={isDarkMode}
		/>
		<MetricRow
			label='Avg. Listing Price'
			value={`$${
				analytics?.performance_metrics?.avg_listing_price?.toFixed(2) || 'N/A'
			}`}
			isDarkMode={isDarkMode}
		/>
		<MetricRow
			label='Avg. Sale Price'
			value={`$${
				analytics?.performance_metrics?.avg_sale_price?.toFixed(2) || 'N/A'
			}`}
			isDarkMode={isDarkMode}
		/>
		<MetricRow
			label='Avg. Price Difference'
			value={`$${
				analytics?.performance_metrics?.price_difference?.toFixed(2) || 'N/A'
			}`}
			isDarkMode={isDarkMode}
		/>
	</SummaryContainer>
)

const SalesSummary = ({ analytics, isDarkMode }: any) => (
	<SummaryContainer title='Sales Summary' isDarkMode={isDarkMode}>
		<MetricRow
			label='Total Sales'
			value={analytics?.sales_summary?.total_sales || 0}
			isDarkMode={isDarkMode}
		/>
		<MetricRow
			label='Total Revenue'
			value={`$${
				analytics?.sales_summary?.total_revenue?.toLocaleString() || '0'
			}`}
			isDarkMode={isDarkMode}
		/>
	</SummaryContainer>
)

const DealershipInfo = ({ dealership, isDarkMode }: any) => (
	<SummaryContainer title='Dealership Information' isDarkMode={isDarkMode}>
		<MetricRow
			label='Name'
			value={dealership?.name || 'N/A'}
			isDarkMode={isDarkMode}
		/>
		<MetricRow
			label='Location '
			value={dealership?.location || 'N/A'}
			isDarkMode={isDarkMode}
		/>
		<MetricRow
			label='Phone'
			value={dealership?.phone || 'N/A'}
			isDarkMode={isDarkMode}
		/>
	</SummaryContainer>
)

const MetricRow = ({ label, value, isDarkMode }: any) => (
	<View className='flex-row justify-between items-center mb-4 pb-3 border-b border-gray-300'>
		<View className='flex-row items-center'>
			<View className='w-2 h-2 rounded-full bg-red mr-2' />
			<Text
				className={`${isDarkMode ? 'text-white' : 'text-gray'} font-medium`}>
				{label}
			</Text>
		</View>
		<Text
			className={`font-bold text-base ${
				isDarkMode ? 'text-white' : 'text-night'
			}`}>
			{value}
		</Text>
	</View>
)
