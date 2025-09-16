import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	RefreshControl,
	Dimensions,
	StatusBar,
	ActivityIndicator,
	Animated,
	Platform
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit'
import { router, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import { format } from 'date-fns'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import TimeRangeSelector from '@/components/TimeRangeSelector'
import CarAnalyticsCard from '@/components/CarAnalyticsCard'
import { useAuth } from '@/utils/AuthContext'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/utils/LanguageContext'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const SUBSCRIPTION_WARNING_DAYS = 7

const ModernHeader = ({ title, isDarkMode, onRefresh, isLoading, onBack, t, language }: any) => (
	<LinearGradient
	  colors={isDarkMode ? ['#1A1A1A', '#0D0D0D'] : ['#FFFFFF', '#F8F8F8']}
	  className='px-4 py-6 rounded-b-3xl shadow-lg'
	>
	  <SafeAreaView edges={['top']}>
		<View className={`flex-row justify-between items-center ${
		  language === 'ar' ? 'flex-row-reverse' : ''
		}`}>
		  <View className={`flex-row items-center ${
			language === 'ar' ? 'flex-row-reverse' : ''
		  }`}>
			<TouchableOpacity
			  onPress={router.back}
			  className={language === 'ar' ? 'ml-3' : 'mr-3'}
			>
			  <Ionicons
				name='chevron-back'
				size={24}
				color={isDarkMode ? '#FFFFFF' : '#000000'}
			  />
			</TouchableOpacity>
			<View>
			  <Text
				className={`text-sm ${
				  isDarkMode ? 'text-neutral-400' : 'text-neutral-500'
				}`}
			  >
				{t('analytics.dashboard')}
			  </Text>
			  <Text
				className={`text-2xl font-bold mt-1 ${
				  isDarkMode ? 'text-white' : 'text-night'
				}`}
			  >
				{title}
			  </Text>
			</View>
		  </View>
		  <TouchableOpacity
			onPress={onRefresh}
			className={`rounded-full p-3 ${
			  isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'
			}`}
		  >
			{isLoading ? (
			  <ActivityIndicator color='#D55004' size='small' />
			) : (
			  <Ionicons
				name='refresh'
				size={22}
				color={isDarkMode ? '#FFFFFF' : '#000000'}
			  />
			)}
		  </TouchableOpacity>
		</View>
	  </SafeAreaView>
	</LinearGradient>
  )

const MetricCard = ({ title, value, icon, trend, color, isDarkMode }: any) => (
	<LinearGradient
		colors={
			isDarkMode
				? ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
				: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']
		}
		className='rounded-2xl p-4 flex-1 mx-1'
		start={{ x: 0, y: 0 }}
		end={{ x: 1, y: 1 }}>
		<BlurView
			intensity={isDarkMode ? 20 : 40}
			tint={isDarkMode ? 'dark' : 'light'}
			className='absolute inset-0 rounded-2xl'
		/>
		<View className='flex-row justify-between items-center mb-2'>
			<Text
				className={`text-xs ${
					isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
				}`}>
				{title}
			</Text>
			<Ionicons name={icon} size={16} color={color} />
		</View>
		<Text
			className={`text-lg font-bold ${
				isDarkMode ? 'text-white' : 'text-neutral-900'
			}`}>
			{value}
		</Text>
		{trend !== undefined && (
			<View className='flex-row items-center mt-1'>
				<Ionicons
					name={trend >= 0 ? 'trending-up' : 'trending-down'}
					size={14}
					color={trend >= 0 ? '#10B981' : '#EF4444'}
				/>
				<Text
					className={`text-xs ml-1 ${
						trend >= 0 ? 'text-green-500' : 'text-rose-500'
					}`}>
					{Math.abs(trend).toFixed(1)}%
				</Text>
			</View>
		)}
	</LinearGradient>
)

const ChartContainer = ({ title, subtitle, children, isDarkMode }: any) => (
	<View className='mb-6 p-4'>
		<LinearGradient
			colors={
				isDarkMode
					? ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
					: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']
			}
			className='rounded-3xl p-4'
			start={{ x: 0, y: 0 }}
			end={{ x: 1, y: 1 }}>
			<BlurView
				intensity={isDarkMode ? 20 : 40}
				tint={isDarkMode ? 'dark' : 'light'}
				className='absolute inset-0 rounded-3xl'
			/>
			<View className='mb-4'>
				<Text
					className={`text-lg font-semibold ${
						isDarkMode ? 'text-white' : 'text-night'
					}`}>
					{title}
				</Text>
				{subtitle && (
					<Text
						className={`text-sm mt-1 ${
							isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
						}`}>
						{subtitle}
					</Text>
				)}
			</View>
			{children}
		</LinearGradient>
	</View>
)

const MetricSection = ({ title, metrics, isDarkMode, language }: any) => (
	<View className='mb-6 mx-4'>
		<LinearGradient
			colors={
				isDarkMode
					? ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
					: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']
			}
			className='rounded-3xl p-6'
			start={{ x: 0, y: 0 }}
			end={{ x: 1, y: 1 }}>
			<BlurView
				intensity={isDarkMode ? 20 : 40}
				tint={isDarkMode ? 'dark' : 'light'}
				className='absolute inset-0 rounded-3xl'
			/>
			<Text
				className={`text-lg font-semibold mb-4 ${
					isDarkMode ? 'text-white' : 'text-night'
				}`}>
				{title}
			</Text>
			{metrics.map(
				(
					metric: {
						label:
							| boolean
							| React.ReactElement<
									any,
									string | React.JSXElementConstructor<any>
							  >
							| Iterable<React.ReactNode>
							| React.Key
							| null
							| undefined
						color: any
						value:
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
							| undefined
					},
					index: number
				) => (
					<View
						key={metric.label}
						className={`flex-row justify-between items-center ${
							language === 'ar' ? 'flex-row-reverse' : ''
						} ${
							index !== metrics.length - 1
								? 'mb-4 pb-4 border-b border-neutral-200'
								: ''
						}`}>
						<View className={`flex-row items-center ${
							language === 'ar' ? 'flex-row-reverse' : ''
						}`}>
							<View
								className={`w-2 h-2 rounded-full bg-${metric.color} ${
									language === 'ar' ? 'ml-2' : 'mr-2'
								}`}
							/>
							<Text
								className={
									isDarkMode ? 'text-neutral-300' : 'text-neutral-600'
								}>
								{metric.label}
							</Text>
						</View>
						<Text
							className={`font-bold ${
								isDarkMode ? 'text-white' : 'text-night'
							}`}>
							{metric.value}
						</Text>
					</View>
				)
			)}
		</LinearGradient>
	</View>
)

const SubscriptionWarning = ({ daysLeft, isDarkMode, t }: any) => (
	<LinearGradient
		colors={['#FEF3C7', '#FDE68A']}
		className='mx-4 mt-4 rounded-2xl p-4'>
		<View className='flex-row items-center'>
			<View className='bg-amber-500 rounded-full p-2 mr-3'>
				<Ionicons name='warning' size={20} color='white' />
			</View>
			<View className='flex-1'>
				<Text className='text-amber-800 font-semibold'>
					{t('analytics.subscription_expires_soon')}
				</Text>
				<Text className='text-amber-700 text-sm mt-1'>
					{t('analytics.days_remaining', { days: daysLeft })}
				</Text>
			</View>
		</View>
	</LinearGradient>
)

export default function DealerAnalyticsPage() {
	const { isDarkMode } = useTheme()
	const { user } = useAuth()
	const { t } = useTranslation()
	const { language } = useLanguage()
	const router = useRouter()
	const [dealership, setDealership] = useState<any>(null)
	const [analytics, setAnalytics] = useState(null)
	const [timeRange, setTimeRange] = useState('month')
	const [isLoading, setIsLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)
	const [error, setError] = useState(null)
	const [cars, setCars] = useState([])

	const fetchData = useCallback(async () => {
		if (!user) return
		setIsLoading(true)
		setError(null)
		try {
			// 1. Fetch dealership data
			const { data: dealershipData, error: dealershipError } = await supabase
				.from('dealerships')
				.select('*')
				.eq('user_id', user.id)
				.single()

			if (dealershipError) throw dealershipError
			setDealership(dealershipData)

			// 2. Fetch analytics data with time range
			const { data: analyticsData, error: analyticsError } = await supabase.rpc(
				'get_dealer_analytics',
				{
					p_dealership_id: dealershipData.id,
					p_time_range: timeRange
				}
			)

			if (analyticsError) throw analyticsError
			setAnalytics(analyticsData)

			// 3. Fetch cars with analytics
			const { data: carsData, error: carsError } = await supabase
				.from('cars')
				.select('*')
				.eq('dealership_id', dealershipData.id)
				.order('listed_at', { ascending: false })

			if (carsError) throw carsError

			// Calculate changes for views and likes (simulated for now)
			const carsWithAnalytics = carsData.map(car => ({
				...car,
				views_change: Math.floor(Math.random() * 20) - 10, // Replace with actual calculation
				likes_change: Math.floor(Math.random() * 20) - 10 // Replace with actual calculation
			}))

			setCars(carsWithAnalytics)
		} catch (err) {
			setError(err.message)
			console.error('Error fetching data:', err)
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

	const handleTimeRangeChange = useCallback(newRange => {
		setTimeRange(newRange)
	}, [])

	const handleCarPress = useCallback(
		carId => {
			router.push(`/car-analytics/${carId}`)
		},
		[router]
	)

	const chartConfig = {
		backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF',
		backgroundGradientFrom: isDarkMode ? '#1A1A1A' : '#FFFFFF',
		backgroundGradientTo: isDarkMode ? '#1A1A1A' : '#FFFFFF',
		decimalPlaces: 0,
		color: (opacity = 1) =>
			isDarkMode
				? `rgba(56, 189, 248, ${opacity})`
				: `rgba(2, 132, 199, ${opacity})`,
		style: {
			borderRadius: 16
		},
		propsForBackgroundLines: {
			strokeWidth: 1,
			strokeDasharray: '',
			stroke: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
		},
		propsForLabels: {
			fontSize: 10,
			fontWeight: '600'
		}
	}

	const formatChartData = useMemo(() => {
		if (!analytics?.time_series_data) return null

		const data = analytics.time_series_data
		return {
			labels: data.map((d: { date: string | number | Date }) =>
				format(new Date(d.date), 'MMM dd')
			),
			datasets: [
				{
					data: data.map((d: { views: any }) => d.views),
					color: () => 'rgba(56, 189, 248, 0.5)',
					strokeWidth: 2
				},
				{
					data: data.map((d: { likes: any }) => d.likes),
					color: () => 'rgba(239, 68, 68, 0.5)',
					strokeWidth: 2
				}
			],
			legend: [t('analytics.views'), t('analytics.likes')]
		}
	}, [analytics])

	if (error) {
		return (
			<View
				className={`flex-1 justify-center items-center ${
					isDarkMode ? 'bg-night' : 'bg-white'
				}`}>
				<Text
					className={`text-xl mb-4 ${
						isDarkMode ? 'text-white' : 'text-night'
					}`}>
					{error}
				</Text>
				<TouchableOpacity
					className='bg-red px-6 py-3 rounded-full'
					onPress={fetchData}>
					<Text className='text-white font-semibold'>{t('common.retry')}</Text>
				</TouchableOpacity>
			</View>
		)
	}

	return (
		<View className={`flex-1 ${isDarkMode ? 'bg-night' : 'bg-white'}`}>
			<ModernHeader
				title={t('analytics.title')}
				isDarkMode={isDarkMode}
				onRefresh={onRefresh}
				isLoading={isLoading}
				t={t}
				language={language}
			/>

			<ScrollView
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
				}
				className='flex-1'>
				<TimeRangeSelector
					selectedRange={timeRange}
					onRangeChange={handleTimeRangeChange}
					isDarkMode={isDarkMode}
				/>

				{dealership?.subscription_end_date &&
					getDaysUntilExpiration(dealership) <= SUBSCRIPTION_WARNING_DAYS && (
						<SubscriptionWarning
							daysLeft={getDaysUntilExpiration(dealership)}
							isDarkMode={isDarkMode}
							t={t}
						/>
					)}

				{/* Overview Cards */}
				<View className='flex-row mx-4 my-6'>
					<MetricCard
						title={t('analytics.total_listings')}
						value={analytics?.total_listings || 0}
						icon='list'
						color='#10B981'
						isDarkMode={isDarkMode}
					/>
					<MetricCard
						title={t('analytics.total_views')}
						value={analytics?.total_views || 0}
						icon='eye'
						trend={10.5}
						color='#3B82F6'
						isDarkMode={isDarkMode}
					/>
					<MetricCard
						title={t('analytics.total_likes')}
						value={analytics?.total_likes || 0}
						icon='heart'
						trend={-5.2}
						color='#EF4444'
						isDarkMode={isDarkMode}
					/>
				</View>

				{/* Performance Trends Chart */}
				{formatChartData && (
					<ChartContainer
						title={t('analytics.performance_trends')}
						subtitle={t('analytics.trends_for_period', { period: timeRange })}
						isDarkMode={isDarkMode}>
						<ScrollView horizontal showsHorizontalScrollIndicator={false}>
							<LineChart
								data={formatChartData}
								width={SCREEN_WIDTH * 1.5}
								height={220}
								chartConfig={chartConfig}
								bezier
								style={{
									marginVertical: 8,
									borderRadius: 16
								}}
							/>
						</ScrollView>
					</ChartContainer>
				)}

				{/* Top Viewed Cars Chart */}
				{analytics?.top_viewed_cars && (
					<ChartContainer
						title={t('analytics.most_viewed_cars')}
						subtitle={t('analytics.top_5_listings')}
						isDarkMode={isDarkMode}>
						<ScrollView horizontal showsHorizontalScrollIndicator={false}>
							<BarChart
								data={{
									labels: analytics.top_viewed_cars.map(
										c => `${c.year} ${c.make}`
									),
									datasets: [
										{
											data: analytics.top_viewed_cars.map(c => c.views)
										}
									]
								}}
								width={SCREEN_WIDTH * 1.5}
								height={220}
								chartConfig={{
									...chartConfig,
									color: (opacity = 1) => `rgba(56, 189, 248, ${opacity})`
								}}
								showValuesOnTopOfBars
								withInnerLines={true}
								fromZero
								style={{
									marginVertical: 8,
									borderRadius: 16
								}}
							/>
						</ScrollView>
					</ChartContainer>
				)}

				{/* Category Distribution Chart */}
				{analytics?.category_distribution && (
					<ChartContainer
						title={t('analytics.category_distribution')}
						subtitle={t('analytics.vehicle_categories_breakdown')}
						isDarkMode={isDarkMode}>
						<PieChart
							data={Object.entries(analytics.category_distribution).map(
								([category, count]) => ({
									name: translateCategory(category, language, t),
									population: count,
									color: getCategoryColor(category),
									legendFontColor: isDarkMode ? '#E0E0E0' : '#7F7F7F',
									legendFontSize: 12
								})
							)}
							width={SCREEN_WIDTH - 48}
							height={220}
							chartConfig={chartConfig}
							accessor='population'
							backgroundColor='transparent'
							paddingLeft='15'
							absolute
						/>
					</ChartContainer>
				)}

				{/* Inventory Metrics */}
				<MetricSection
					title={t('analytics.inventory_overview')}
					metrics={[
						{
							label: t('analytics.total_cars'),
							value: analytics?.inventory_summary?.total_cars || 0,
							color: 'blue-500'
						},
						{
							label: t('analytics.new_cars'),
							value: analytics?.inventory_summary?.new_cars || 0,
							color: 'green-500'
						},
						{
							label: t('analytics.used_cars'),
							value: analytics?.inventory_summary?.used_cars || 0,
							color: 'yellow-500'
						},
						{
							label: t('analytics.average_price'),
							value: `${language === 'ar' ? '' : '$'}${formatPrice(analytics?.inventory_summary?.avg_price)}${language === 'ar' ? ' د.ل' : ''}`,
							color: 'purple-500'
						},
						{
							label: t('analytics.total_value'),
							value: `${language === 'ar' ? '' : '$'}${formatPrice(
								analytics?.inventory_summary?.total_value
							)}${language === 'ar' ? ' د.ل' : ''}`,
							color: 'red-500'
						}
					]}
					isDarkMode={isDarkMode}
					language={language}
				/>

				{/* Performance Metrics */}
				<MetricSection
					title={t('analytics.performance_metrics')}
					metrics={[
						{
							label: t('analytics.avg_time_to_sell'),
							value: `${
								analytics?.performance_metrics?.avg_time_to_sell?.toFixed(1) ||
								0
							} ${t('analytics.days')}`,
							color: 'blue-500'
						},
						{
							label: t('analytics.conversion_rate'),
							value: `${(
								(analytics?.performance_metrics?.conversion_rate || 0) * 100
							).toFixed(1)}%`,
							color: 'green-500'
						},
						{
							label: t('analytics.avg_sale_price'),
							value: `${language === 'ar' ? '' : '$'}${formatPrice(
								analytics?.performance_metrics?.avg_sale_price
							)}${language === 'ar' ? ' د.ل' : ''}`,
							color: 'yellow-500'
						},
						{
							label: t('analytics.price_difference'),
							value: `${language === 'ar' ? '' : '$'}${formatPrice(
								analytics?.performance_metrics?.price_difference
							)}${language === 'ar' ? ' د.ل' : ''}`,
							color: 'purple-500'
						}
					]}
					isDarkMode={isDarkMode}
					language={language}
				/>

				{/* Sales Summary */}
				<MetricSection
					title={t('analytics.sales_summary')}
					metrics={[
						{
							label: t('analytics.total_sales'),
							value: analytics?.sales_summary?.total_sales || 0,
							color: 'blue-500'
						},
						{
							label: t('analytics.total_revenue'),
							value: `${language === 'ar' ? '' : '$'}${formatPrice(analytics?.sales_summary?.total_revenue)}${language === 'ar' ? ' د.ل' : ''}`,
							color: 'green-500'
						}
					]}
					isDarkMode={isDarkMode}
					language={language}
				/>

				{/* Cars Analytics Section */}
				<View className='mb-6'>
					<Text
						className={`text-lg font-semibold mx-4 mb-4 ${
							isDarkMode ? 'text-white' : 'text-night'
						}`}>
						{t('analytics.listings_analytics')}
					</Text>
					{cars.map(car => (
						<CarAnalyticsCard
							key={car.id}
							car={car}
							onPress={() => handleCarPress(car.id)}
							isDarkMode={isDarkMode}
						/>
					))}
				</View>

				{/* Bottom Spacing */}
				<View className='h-20' />
			</ScrollView>
		</View>
	)
}

const formatPrice = (price: {
	toLocaleString: (
		arg0: undefined,
		arg1: { minimumFractionDigits: number; maximumFractionDigits: number }
	) => any
}) => {
	if (!price) return '0'
	return price.toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	})
}

const translateCategory = (category: string, language: string, t: any) => {
	if (language === 'ar') {
		const translations = {
			'Sedan': 'سيدان',
			'SUV': 'اس يو في',
			'Hatchback': 'هاتشباك',
			'Convertible': 'قابل للتحويل',
			'Coupe': 'كوبيه',
			'Sports': 'رياضي',
			'Other': 'أخرى'
		}
		return translations[category] || category
	}
	return category
}

const getCategoryColor = (category: string) => {
	const colors = {
		'Sedan': '#4285F4',
		'SUV': '#34A853',
		'Hatchback': '#FBBC05',
		'Convertible': '#EA4335',
		'Coupe': '#9C27B0',
		'Sports': '#FF9800',
		'Other': '#795548',
		// Arabic translations
		'سيدان': '#4285F4',
		'اس يو في': '#34A853',
		'هاتشباك': '#FBBC05',
		'قابل للتحويل': '#EA4335',
		'كوبيه': '#9C27B0',
		'رياضي': '#FF9800',
		'أخرى': '#795548'
	}
	return colors[category] || '#CCCCCC'
}

const getDaysUntilExpiration = (dealership: any) => {
	if (!dealership?.subscription_end_date) return 0
	const endDate = new Date(dealership.subscription_end_date)
	const today = new Date()
	const diffTime = endDate.getTime() - today.getTime()
	return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}
