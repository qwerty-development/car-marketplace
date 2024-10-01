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
	Dimensions
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const CustomHeader = ({ title, showBackButton = true }: any) => {
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
						onPress={() => router.push('/(home)/(admin)/profile')}>
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

const ChartContainer = ({ title, children }: any) => {
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

export default function AdminAnalyticsDashboard() {
	const { isDarkMode } = useTheme()
	const [analytics, setAnalytics] = useState<any>(null)
	const [isLoading, setIsLoading] = useState<any>(true)
	const [error, setError] = useState<any>(null)
	const [refreshing, setRefreshing] = useState<any>(false)

	const fetchAnalytics = async () => {
		setIsLoading(true)
		setError(null)
		try {
			const { data, error } = await supabase.rpc('get_admin_analytics')
			if (error) throw error
			setAnalytics(data)
			console.log(analytics)
		} catch (err: any) {
			setError(err.message)
		} finally {
			setIsLoading(false)
		}
	}

	useEffect(() => {
		fetchAnalytics()
	}, [])

	const onRefresh = useCallback(() => {
		setRefreshing(true)
		fetchAnalytics().then(() => setRefreshing(false))
	}, [])

	const exportToCSV = async () => {
		if (!analytics) return

		const csvContent = generateCSVContent(analytics)
		const fileName = 'admin_analytics.csv'
		const filePath = `${FileSystem.documentDirectory}${fileName}`

		try {
			await FileSystem.writeAsStringAsync(filePath, csvContent)
			await Sharing.shareAsync(filePath)
		} catch (error) {
			console.error('Error exporting to CSV:', error)
		}
	}

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
					onPress={fetchAnalytics}>
					<Text className='text-white font-semibold'>Retry</Text>
				</TouchableOpacity>
			</View>
		)
	}

	// Process price distribution data
	const priceRangeOrder = [
		'Under $10k',
		'$10k-$20k',
		'$20k-$30k',
		'$30k-$50k',
		'Over $50k'
	]
	const priceDistributionData = priceRangeOrder.map(range => ({
		range,
		count:
			analytics!.price_distribution.find((item: any) => item.range === range)
				?.count || 0
	}))

	return (
		<ScrollView
			className={`flex-1 ${isDarkMode ? 'bg-night' : 'bg-white'}`}
			refreshControl={
				<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
			}>
			<CustomHeader title='Admin Analytics' />

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
				<View className='flex-row flex-wrap justify-between'>
					<MetricCard
						title='Total Listings'
						value={analytics.total_listings}
						icon='list'
						color='blue'
					/>
					<MetricCard
						title='Total Views'
						value={analytics.total_views}
						icon='eye'
						color='green'
					/>
					<MetricCard
						title='Total Likes'
						value={analytics.total_likes}
						icon='heart'
						color='red'
					/>
					<MetricCard
						title='Total Sales'
						value={analytics.total_sales}
						icon='cart'
						color='purple'
					/>
					<MetricCard
						title='Total Revenue'
						value={`$${analytics.total_revenue.toLocaleString()}`}
						icon='cash'
						color='gold'
					/>
					<MetricCard
						title='Total Dealerships'
						value={analytics.total_dealerships}
						icon='business'
						color='teal'
					/>
					<MetricCard
						title='Total Users'
						value={analytics.total_users}
						icon='people'
						color='indigo'
					/>
				</View>
			</View>

			<ChartContainer title='Top 10 Dealerships'>
				<BarChart
					data={{
						labels: analytics.top_dealerships.map((d: { name: any }) => d.name),
						datasets: [
							{
								data: analytics.top_dealerships.map(
									(d: { listings: any }) => d.listings
								)
							}
						]
					}}
					width={SCREEN_WIDTH * 2}
					height={220}
					yAxisLabel=''
					yAxisSuffix=''
					chartConfig={{
						backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
						backgroundGradientFrom: isDarkMode ? '#1e1e1e' : '#ffffff',
						backgroundGradientTo: isDarkMode ? '#1e1e1e' : '#ffffff',
						decimalPlaces: 0,
						color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
						labelColor: (opacity = 1) =>
							`${
								isDarkMode
									? `rgba(255, 255, 255, ${opacity})`
									: `rgba(0, 0, 0, ${opacity})`
							} )`,
						style: { borderRadius: 16 },
						barPercentage: 0.5
					}}
					style={{ marginVertical: 8, borderRadius: 16 }}
				/>
			</ChartContainer>

			<ChartContainer title='Top 10 Cars'>
				<BarChart
					data={{
						labels: analytics.top_cars.map(
							(c: { make: any; model: any }) => `${c.make} ${c.model}`
						),
						datasets: [
							{ data: analytics.top_cars.map((c: { views: any }) => c.views) }
						]
					}}
					width={SCREEN_WIDTH * 3} // Increased width
					height={300} // Increased height
					yAxisLabel=''
					yAxisSuffix=''
					chartConfig={{
						backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
						backgroundGradientFrom: isDarkMode ? '#1e1e1e' : '#ffffff',
						backgroundGradientTo: isDarkMode ? '#1e1e1e' : '#ffffff',
						decimalPlaces: 0,
						color: (opacity = 1) => `rgba(255, 99, 132, ${opacity})`,
						labelColor: (opacity = 1) =>
							`${
								isDarkMode
									? `rgba(255, 255, 255, ${opacity})`
									: `rgba(0, 0, 0, ${opacity})`
							} )`,
						style: { borderRadius: 16 },
						barPercentage: 0.5
					}}
					style={{ marginVertical: 8, borderRadius: 16 }}
				/>
			</ChartContainer>

			<ChartContainer title='Inventory Summary'>
				<PieChart
					data={Object.entries(
						analytics.inventory_summary.condition_distribution
					).map(([key, value]) => ({
						name: key,
						population: value,
						color: `rgb(${Math.random() * 255},${Math.random() * 255},${
							Math.random() * 255
						})`,
						legendFontColor: isDarkMode ? '#E0E0E0' : '#7F7F7F',
						legendFontSize: 12
					}))}
					width={SCREEN_WIDTH - 40}
					height={220}
					chartConfig={{
						color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`
					}}
					accessor='population'
					backgroundColor='transparent'
					paddingLeft='15'
					absolute
				/>
			</ChartContainer>

			<ChartContainer title='Price Distribution'>
				<BarChart
					data={{
						labels: priceDistributionData.map(item => item.range),
						datasets: [{ data: priceDistributionData.map(item => item.count) }]
					}}
					width={SCREEN_WIDTH * 2}
					height={220}
					yAxisLabel=''
					yAxisSuffix=''
					chartConfig={{
						backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
						backgroundGradientFrom: isDarkMode ? '#1e1e1e' : '#ffffff',
						backgroundGradientTo: isDarkMode ? '#1e1e1e' : '#ffffff',
						decimalPlaces: 0,
						color: (opacity = 1) => `rgba(0, 255, 0, ${opacity})`,
						labelColor: (opacity = 1) =>
							`${
								isDarkMode
									? `rgba(255, 255, 255, ${opacity})`
									: `rgba(0, 0, 0, ${opacity})`
							} )`,
						style: { borderRadius: 16 },
						barPercentage: 0.5
					}}
					style={{ marginVertical: 8, borderRadius: 16 }}
				/>
			</ChartContainer>

			<ChartContainer title='User Growth'>
				<LineChart
					data={{
						labels: analytics.user_growth.map(
							(item: { month: string }) => item.month?.split('-')[1]
						),
						datasets: [
							{
								data: analytics.user_growth.map(
									(item: { new_users: any }) => item.new_users
								)
							}
						]
					}}
					width={SCREEN_WIDTH * 2}
					height={220}
					chartConfig={{
						backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
						backgroundGradientFrom: isDarkMode ? '#1e1e1e' : '#ffffff',
						backgroundGradientTo: isDarkMode ? '#1e1e1e' : '#ffffff',
						decimalPlaces: 0,
						color: (opacity = 1) => `rgba(0, 255, 255, ${opacity})`,
						labelColor: (opacity = 1) =>
							`${
								isDarkMode
									? `rgba(255, 255, 255, ${opacity})`
									: `rgba(0, 0, 0, ${opacity})`
							} )`,
						style: { borderRadius: 16 },
						propsForDots: {
							r: '6',
							strokeWidth: '2',
							stroke: '#ffa726'
						}
					}}
					bezier
					style={{ marginVertical: 8, borderRadius: 16 }}
				/>
			</ChartContainer>

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
				<MetricRow
					title='Avg. Time to Sell'
					value={`${analytics.performance_metrics.avg_time_to_sell.toFixed(
						1
					)} days`}
				/>
				<MetricRow
					title='Conversion Rate'
					value={`${(
						analytics.performance_metrics.conversion_rate * 100
					).toFixed(2)}%`}
				/>
				<MetricRow
					title='Avg. Listing Price'
					value={`$${analytics.performance_metrics.avg_listing_price.toFixed(
						2
					)}`}
				/>
				<MetricRow
					title='Avg. Sale Price'
					value={`$${analytics.performance_metrics.avg_sale_price.toFixed(2)}`}
				/>
				<MetricRow
					title='Avg. Price Difference'
					value={`$${analytics.performance_metrics.price_difference.toFixed(
						2
					)}`}
				/>
			</View>

			<View
				className={`rounded-lg shadow-md mx-4 mb-4 p-4 ${
					isDarkMode ? 'bg-gray' : 'bg-white'
				}`}>
				<Text
					className={`text-xl font-semibold mb-2 ${
						isDarkMode ? 'text-white' : 'text-night'
					}`}>
					User Engagement
				</Text>
				<Text
					className={`font-semibold mb-2 ${
						isDarkMode ? 'text-white' : 'text-night'
					}`}>
					Top Likers
				</Text>
				{analytics.user_engagement.top_likers.map(
					(
						user: {
							name:
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
							likes_count:
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
						index: React.Key | null | undefined
					) => (
						<View
							key={index}
							className='flex-row justify-between items-center mb-2'>
							<Text className={isDarkMode ? 'text-white' : 'text-night'}>
								{user.name}
							</Text>
							<Text className={isDarkMode ? 'text-white' : 'text-night'}>
								{user.likes_count} likes
							</Text>
						</View>
					)
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
					Geographical Data
				</Text>
				<FlatList
					data={analytics.geographical_data}
					keyExtractor={(item, index) => index.toString()}
					renderItem={({ item }) => (
						<View className='flex-row justify-between items-center mb-2'>
							<Text className={isDarkMode ? 'text-white' : 'text-night'}>
								{item.name}
							</Text>
							<Text className={isDarkMode ? 'text-white' : 'text-night'}>
								Listings: {item.listings}, Sales: {item.sales}
							</Text>
						</View>
					)}
				/>
			</View>

			<TouchableOpacity
				className='bg-red py-3 px-6 rounded-full mx-4 mb-8'
				onPress={exportToCSV}>
				<Text className='text-white font-semibold text-center'>
					Export to CSV
				</Text>
			</TouchableOpacity>
		</ScrollView>
	)
}

const MetricCard = ({ title, value, icon, color }: any) => {
	const { isDarkMode } = useTheme()
	return (
		<View
			className={`w-[30%] ${
				isDarkMode ? 'bg-gray' : 'bg-white'
			} rounded-lg shadow p-3 mb-4`}>
			<Ionicons name={icon} size={24} color={color} />
			<Text
				className={`text-lg font-bold mt-2 text-nowrap ${
					isDarkMode ? 'text-white' : 'text-black'
				}`}>
				{value}
			</Text>
			<Text className={`text-xs ${isDarkMode ? 'text-red' : 'text-red'}`}>
				{title}
			</Text>
		</View>
	)
}

const MetricRow = ({ title, value }: any) => {
	const { isDarkMode } = useTheme()
	return (
		<View className='flex-row justify-between items-center mb-2'>
			<Text className={isDarkMode ? 'text-white' : 'text-night'}>{title}:</Text>
			<Text className={`font-bold ${isDarkMode ? 'text-white' : 'text-night'}`}>
				{value}
			</Text>
		</View>
	)
}

const generateCSVContent = (analytics: {
	total_listings: any
	total_views: any
	total_likes: any
	total_sales: any
	total_revenue: any
	total_dealerships: any
	total_users: any
	sales_trend: any[]
	top_dealerships: any[]
	top_cars: any[]
	inventory_summary: {
		condition_distribution: { [s: string]: unknown } | ArrayLike<unknown>
	}
	price_distribution: any[]
	performance_metrics: {
		avg_time_to_sell: any
		conversion_rate: any
		avg_listing_price: any
		avg_sale_price: any
		price_difference: any
	}
	user_engagement: { top_likers: any[] }
	geographical_data: any[]
}) => {
	let csvContent = 'data:text/csv;charset=utf-8,'
	csvContent += 'Metric,Value\n'
	csvContent += `Total Listings,${analytics.total_listings}\n`
	csvContent += `Total Views,${analytics.total_views}\n`
	csvContent += `Total Likes,${analytics.total_likes}\n`
	csvContent += `Total Sales,${analytics.total_sales}\n`
	csvContent += `Total Revenue,${analytics.total_revenue}\n`
	csvContent += `Total Dealerships,${analytics.total_dealerships}\n`
	csvContent += `Total Users,${analytics.total_users}\n`

	csvContent += '\nSales Trend\n'
	csvContent += 'Month,Sales\n'
	analytics.sales_trend.forEach(item => {
		csvContent += `${item.month},${item.sales}\n`
	})

	csvContent += '\nTop Dealerships\n'
	csvContent += 'Name,Listings,Views,Likes,Sales,Revenue\n'
	analytics.top_dealerships.forEach(item => {
		csvContent += `${item.name},${item.listings},${item.views},${item.likes},${item.sales},${item.revenue}\n`
	})

	csvContent += '\nTop Cars\n'
	csvContent += 'Make,Model,Views,Likes,Sales,Revenue\n'
	analytics.top_cars.forEach(item => {
		csvContent += `${item.make},${item.model},${item.views},${item.likes},${item.sales},${item.revenue}\n`
	})

	csvContent += '\nInventory Summary\n'
	csvContent += 'Condition,Count\n'
	Object.entries(analytics.inventory_summary.condition_distribution).forEach(
		([key, value]) => {
			csvContent += `${key},${value}\n`
		}
	)

	csvContent += '\nPrice Distribution\n'
	csvContent += 'Range,Count\n'
	analytics.price_distribution.forEach(item => {
		csvContent += `${item.range},${item.count}\n`
	})

	csvContent += '\nPerformance Metrics\n'
	csvContent += `Avg. Time to Sell,${analytics.performance_metrics.avg_time_to_sell}\n`
	csvContent += `Conversion Rate,${analytics.performance_metrics.conversion_rate}\n`
	csvContent += `Avg. Listing Price,${analytics.performance_metrics.avg_listing_price}\n`
	csvContent += `Avg. Sale Price,${analytics.performance_metrics.avg_sale_price}\n`
	csvContent += `Avg. Price Difference,${analytics.performance_metrics.price_difference}\n`

	csvContent += '\nUser Engagement - Top Likers\n'
	csvContent += 'Name,Email,Likes Count\n'
	analytics.user_engagement.top_likers.forEach(item => {
		csvContent += `${item.name},${item.email},${item.likes_count}\n`
	})

	csvContent += '\nGeographical Data\n'
	csvContent += 'Name,Listings,Sales\n'
	analytics.geographical_data.forEach(item => {
		csvContent += `${item.name},${item.listings},${item.sales}\n`
	})

	return csvContent
}
