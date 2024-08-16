import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	Dimensions,
	Image
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit'
import { Ionicons } from '@expo/vector-icons'
import RNHTMLtoPDF from 'react-native-html-to-pdf'
import { Share } from 'react-native'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

interface Analytics {
	total_listings: number
	total_views: number
	total_likes: number
	total_sales: number
	total_revenue: number
	total_dealerships: number
	total_users: number
	period_comparison: {
		listings_growth: number
		views_growth: number
		likes_growth: number
		sales_growth: number
		revenue_growth: number
	}
	time_series_data: Array<{
		date: string
		views: number
		likes: number
		sales: number
		revenue: number
	}>
	top_dealerships: Array<{
		name: string
		logo: string
		listings: number
		views: number
		likes: number
		sales: number
		revenue: number
	}>
	top_cars: Array<{
		make: string
		model: string
		views: number
		likes: number
		sales: number
		revenue: number
	}>
	inventory_summary: {
		condition_distribution: { [key: string]: number }
		price_ranges: { [key: string]: number }
		avg_price: number
		avg_mileage: number
	}
	performance_metrics: {
		avg_time_to_sell: number
		conversion_rate: number
		avg_listing_price: number
		avg_sale_price: number
		price_difference: number
	}
	user_engagement: {
		top_likers: Array<{
			name: string
			email: string
			likes: number
		}>
		likes_distribution: { [key: string]: number }
	}
}

export default function AdminAnalyticsDashboard() {
	const [analytics, setAnalytics] = useState<Analytics | null>(null)
	const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week')

	useEffect(() => {
		fetchAnalytics()
	}, [timeRange])

	const fetchAnalytics = async () => {
		const { data, error } = await supabase.rpc('get_admin_analytics', {
			p_time_range: timeRange
		})

		if (data) setAnalytics(data)
		if (error) console.error('Error fetching admin analytics:', error)
	}

	const exportToCSV = async () => {
		if (!analytics) return
		const csvContent = generateCSVContent(analytics)
		try {
			await Share.share({
				message: csvContent,
				title: `Admin Analytics Report (${timeRange})`
			})
		} catch (error) {
			console.error('Error exporting to CSV:', error)
		}
	}

	if (!analytics) return <Text className='p-4'>Loading analytics...</Text>

	return (
		<ScrollView className='flex-1 bg-gray-100'>
			<View className='p-4 bg-white rounded-lg shadow-md m-4'>
				<Text className='text-2xl font-bold mb-4'>
					Admin Analytics Dashboard
				</Text>
				<TimeRangeSelector timeRange={timeRange} setTimeRange={setTimeRange} />
				<View className='flex-row justify-around mt-4'>
					<TouchableOpacity
						onPress={exportToCSV}
						className='bg-green-500 px-4 py-2 rounded'>
						<Text className='text-white'>Export CSV</Text>
					</TouchableOpacity>
				</View>
			</View>

			<OverviewMetrics analytics={analytics} />
			<PeriodComparison analytics={analytics} />
			<PerformanceOverTime analytics={analytics} />
			<TopDealerships analytics={analytics} />
			<TopCars analytics={analytics} />
			<InventorySummary analytics={analytics} />
			<PerformanceMetrics analytics={analytics} />
			<UserEngagement analytics={analytics} />
		</ScrollView>
	)
}

const TimeRangeSelector: React.FC<{
	timeRange: 'week' | 'month' | 'year'
	setTimeRange: (range: 'week' | 'month' | 'year') => void
}> = ({ timeRange, setTimeRange }) => (
	<View className='flex-row justify-around mb-4'>
		{(['week', 'month', 'year'] as const).map(range => (
			<TouchableOpacity
				key={range}
				onPress={() => setTimeRange(range)}
				className={`px-4 py-2 rounded-full ${
					timeRange === range ? 'bg-blue-500' : 'bg-gray-200'
				}`}>
				<Text className={timeRange === range ? 'text-white' : 'text-gray-800'}>
					{range.charAt(0).toUpperCase() + range.slice(1)}
				</Text>
			</TouchableOpacity>
		))}
	</View>
)

const OverviewMetrics: React.FC<{ analytics: Analytics }> = ({ analytics }) => (
	<View className='bg-white rounded-lg shadow-md m-4 p-4'>
		<Text className='text-xl font-semibold mb-2'>Overview</Text>
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
)

const PeriodComparison: React.FC<{ analytics: Analytics }> = ({
	analytics
}) => (
	<View className='bg-white rounded-lg shadow-md m-4 p-4'>
		<Text className='text-xl font-semibold mb-2'>Period Comparison</Text>
		<View className='flex-row flex-wrap justify-between'>
			<GrowthMetric
				title='Listings Growth'
				value={analytics.period_comparison.listings_growth}
			/>
			<GrowthMetric
				title='Views Growth'
				value={analytics.period_comparison.views_growth}
			/>
			<GrowthMetric
				title='Likes Growth'
				value={analytics.period_comparison.likes_growth}
			/>
			<GrowthMetric
				title='Sales Growth'
				value={analytics.period_comparison.sales_growth}
			/>
			<GrowthMetric
				title='Revenue Growth'
				value={analytics.period_comparison.revenue_growth}
			/>
		</View>
	</View>
)

const PerformanceOverTime: React.FC<{ analytics: Analytics }> = ({
	analytics
}) => (
	<View className='bg-white rounded-lg shadow-md m-4 p-4'>
		<Text className='text-xl font-semibold mb-2'>Performance Over Time</Text>
		<LineChart
			data={{
				labels: analytics.time_series_data.map(d => d.date),
				datasets: [
					{
						data: analytics.time_series_data.map(d => d.views),
						color: () => 'rgba(0, 255, 0, 0.5)',
						strokeWidth: 2
					},
					{
						data: analytics.time_series_data.map(d => d.likes),
						color: () => 'rgba(255, 0, 0, 0.5)',
						strokeWidth: 2
					},
					{
						data: analytics.time_series_data.map(d => d.sales),
						color: () => 'rgba(0, 0, 255, 0.5)',
						strokeWidth: 2
					}
				],
				legend: ['Views', 'Likes', 'Sales']
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
)

const TopDealerships: React.FC<{ analytics: Analytics }> = ({ analytics }) => (
	<View className='bg-white rounded-lg shadow-md m-4 p-4'>
		<Text className='text-xl font-semibold mb-2'>Top 10 Dealerships</Text>
		<ScrollView horizontal showsHorizontalScrollIndicator={false}>
			<BarChart
				data={{
					labels: analytics.top_dealerships.map(d => d.name),
					datasets: [{ data: analytics.top_dealerships.map(d => d.listings) }]
				}}
				width={SCREEN_WIDTH * 1.5}
				height={220}
				yAxisLabel=''
				yAxisSuffix=''
				chartConfig={{
					backgroundColor: '#ffffff',
					backgroundGradientFrom: '#ffffff',
					backgroundGradientTo: '#ffffff',
					decimalPlaces: 0,
					color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
					style: { borderRadius: 16 }
				}}
				style={{ marginVertical: 8, borderRadius: 16 }}
			/>
		</ScrollView>
		{analytics.top_dealerships.map((dealership, index) => (
			<View key={index} className='flex-row justify-between items-center mb-2'>
				<View className='flex-row items-center'>
					<Image
						source={{ uri: dealership.logo }}
						style={{ width: 30, height: 30, marginRight: 10 }}
					/>
					<Text className='font-semibold'>{dealership.name}</Text>
				</View>
				<Text>
					Listings: {dealership.listings}, Sales: {dealership.sales}
				</Text>
			</View>
		))}
	</View>
)

const TopCars: React.FC<{ analytics: Analytics }> = ({ analytics }) => (
	<View className='bg-white rounded-lg shadow-md m-4 p-4'>
		<Text className='text-xl font-semibold mb-2'>Top 10 Cars</Text>
		<ScrollView horizontal showsHorizontalScrollIndicator={false}>
			<BarChart
				data={{
					labels: analytics.top_cars.map(c => `${c.make} ${c.model}`),
					datasets: [{ data: analytics.top_cars.map(c => c.views) }]
				}}
				width={SCREEN_WIDTH * 1.5}
				height={220}
				yAxisLabel=''
				yAxisSuffix=''
				chartConfig={{
					backgroundColor: '#ffffff',
					backgroundGradientFrom: '#ffffff',
					backgroundGradientTo: '#ffffff',
					decimalPlaces: 0,
					color: (opacity = 1) => `rgba(255, 99, 132, ${opacity})`,
					style: { borderRadius: 16 }
				}}
				style={{ marginVertical: 8, borderRadius: 16 }}
			/>
		</ScrollView>
		{analytics.top_cars.map((car, index) => (
			<View key={index} className='flex-row justify-between items-center mb-2'>
				<Text className='font-semibold'>
					{car.make} {car.model}
				</Text>
				<Text>
					Views: {car.views}, Likes: {car.likes}, Sales: {car.sales}
				</Text>
			</View>
		))}
	</View>
)

const InventorySummary: React.FC<{ analytics: Analytics }> = ({
	analytics
}) => (
	<View className='bg-white rounded-lg shadow-md m-4 p-4'>
		<Text className='text-xl font-semibold mb-2'>Inventory Summary</Text>
		<View className='flex-row justify-between mb-4'>
			<View>
				<Text className='font-semibold'>Condition Distribution</Text>
				<PieChart
					data={Object.entries(
						analytics.inventory_summary.condition_distribution
					).map(([key, value]) => ({
						name: key,
						population: value,
						color: `rgb(${Math.random() * 255},${Math.random() * 255},${
							Math.random() * 255
						})`,
						legendFontColor: '#7F7F7F',
						legendFontSize: 12
					}))}
					width={SCREEN_WIDTH / 2 - 40}
					height={150}
					chartConfig={{
						color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`
					}}
					accessor='population'
					backgroundColor='transparent'
					paddingLeft='15'
				/>
			</View>
			<View>
				<Text className='font-semibold'>Price Ranges</Text>
				<PieChart
					data={Object.entries(analytics.inventory_summary.price_ranges).map(
						([key, value]) => ({
							name: key,
							population: value,
							color: `rgb(${Math.random() * 255},${Math.random() * 255},${
								Math.random() * 255
							})`,
							legendFontColor: '#7F7F7F',
							legendFontSize: 12
						})
					)}
					width={SCREEN_WIDTH / 2 - 40}
					height={150}
					chartConfig={{
						color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`
					}}
					accessor='population'
					backgroundColor='transparent'
					paddingLeft='15'
				/>
			</View>
		</View>
		<MetricRow
			title='Average Price'
			value={`$${analytics.inventory_summary.avg_price}`}
		/>
		<MetricRow
			title='Average Mileage'
			value={`${analytics.inventory_summary.avg_mileage} miles`}
		/>
	</View>
)

const PerformanceMetrics: React.FC<{ analytics: Analytics }> = ({
	analytics
}) => (
	<View className='bg-white rounded-lg shadow-md m-4 p-4'>
		<Text className='text-xl font-semibold mb-2'>Performance Metrics</Text>
		<MetricRow
			title='Avg. Time to Sell'
			value={`${analytics.performance_metrics.avg_time_to_sell} days`}
		/>
		<MetricRow
			title='Conversion Rate'
			value={`${analytics.performance_metrics.conversion_rate * 100}%`}
		/>
		<MetricRow
			title='Avg. Listing Price'
			value={`$${analytics.performance_metrics.avg_listing_price}`}
		/>
		<MetricRow
			title='Avg. Sale Price'
			value={`$${analytics.performance_metrics.avg_sale_price}`}
		/>
		<MetricRow
			title='Avg. Price Difference'
			value={`$${analytics.performance_metrics.price_difference}`}
		/>
	</View>
)

const UserEngagement: React.FC<{ analytics: Analytics }> = ({ analytics }) => (
	<View className='bg-white rounded-lg shadow-md m-4 p-4'>
		<Text className='text-xl font-semibold mb-2'>User Engagement</Text>
		<Text className='font-semibold mb-2'>Top Likers</Text>
		{analytics.user_engagement.top_likers.map((user, index) => (
			<View key={index} className='flex-row justify-between items-center mb-2'>
				<Text>{user.name}</Text>
				<Text>{user.likes} likes</Text>
			</View>
		))}
		<Text className='font-semibold mt-4 mb-2'>Likes Distribution</Text>
		<PieChart
			data={Object.entries(analytics.user_engagement.likes_distribution).map(
				([key, value]) => ({
					name: key,
					population: value,
					color: `rgb(${Math.random() * 255},${Math.random() * 255},${
						Math.random() * 255
					})`,
					legendFontColor: '#7F7F7F',
					legendFontSize: 12
				})
			)}
			width={SCREEN_WIDTH - 80}
			height={200}
			chartConfig={{
				color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`
			}}
			accessor='population'
			backgroundColor='transparent'
			paddingLeft='15'
		/>
	</View>
)

const MetricCard: React.FC<{
	title: string
	value: string | number
	icon: string
	color: string
}> = ({ title, value, icon, color }) => (
	<View className='w-[30%] bg-white rounded-lg shadow p-3 mb-4'>
		<Ionicons name={icon as any} size={24} color={color} />
		<Text className='text-lg font-bold mt-2'>{value}</Text>
		<Text className='text-xs text-gray-600'>{title}</Text>
	</View>
)

const MetricRow: React.FC<{ title: string; value: string }> = ({
	title,
	value
}) => (
	<View className='flex-row justify-between items-center mb-2'>
		<Text className='text-gray-600'>{title}:</Text>
		<Text className='font-bold'>{value}</Text>
	</View>
)

const GrowthMetric: React.FC<{ title: string; value: number }> = ({
	title,
	value
}) => (
	<View className='w-[48%] bg-white rounded-lg shadow p-3 mb-4'>
		<Text className='text-sm text-gray-600'>{title}</Text>
		<Text
			className={`text-lg font-bold ${
				value >= 0 ? 'text-green-500' : 'text-red-500'
			}`}>
			{value * 100}%
		</Text>
		<Ionicons
			name={value >= 0 ? 'arrow-up' : 'arrow-down'}
			size={24}
			color={value >= 0 ? 'green' : 'red'}
		/>
	</View>
)

function generateCSVContent(analytics: Analytics): string {
	const csvRows = [
		['Admin Analytics Report'],
		[],
		['Overview'],
		['Metric', 'Value'],
		['Total Listings', analytics.total_listings],
		['Total Views', analytics.total_views],
		['Total Likes', analytics.total_likes],
		['Total Sales', analytics.total_sales],
		['Total Revenue', analytics.total_revenue],
		['Total Dealerships', analytics.total_dealerships],
		['Total Users', analytics.total_users],
		[],
		['Period Comparison'],
		['Metric', 'Growth'],
		[
			'Listings Growth',
			`${(analytics.period_comparison.listings_growth * 100).toFixed(2)}%`
		],
		[
			'Views Growth',
			`${(analytics.period_comparison.views_growth * 100).toFixed(2)}%`
		],
		[
			'Likes Growth',
			`${(analytics.period_comparison.likes_growth * 100).toFixed(2)}%`
		],
		[
			'Sales Growth',
			`${(analytics.period_comparison.sales_growth * 100).toFixed(2)}%`
		],
		[
			'Revenue Growth',
			`${(analytics.period_comparison.revenue_growth * 100).toFixed(2)}%`
		],
		[],
		['Top 10 Dealerships'],
		['Name', 'Listings', 'Views', 'Likes', 'Sales', 'Revenue'],
		...analytics.top_dealerships.map(d => [
			d.name,
			d.listings,
			d.views,
			d.likes,
			d.sales,
			d.revenue
		]),
		[],
		['Top 10 Cars'],
		['Make', 'Model', 'Views', 'Likes', 'Sales', 'Revenue'],
		...analytics.top_cars.map(c => [
			c.make,
			c.model,
			c.views,
			c.likes,
			c.sales,
			c.revenue
		]),
		[],
		['Inventory Summary'],
		['Condition Distribution'],
		['Condition', 'Count'],
		...Object.entries(analytics.inventory_summary.condition_distribution),
		[],
		['Price Ranges'],
		['Range', 'Count'],
		...Object.entries(analytics.inventory_summary.price_ranges),
		[],
		['Performance Metrics'],
		['Metric', 'Value'],
		[
			'Avg. Time to Sell',
			`${analytics.performance_metrics.avg_time_to_sell.toFixed(1)} days`
		],
		[
			'Conversion Rate',
			`${(analytics.performance_metrics.conversion_rate * 100).toFixed(2)}%`
		],
		[
			'Avg. Listing Price',
			`$${analytics.performance_metrics.avg_listing_price.toFixed(2)}`
		],
		[
			'Avg. Sale Price',
			`$${analytics.performance_metrics.avg_sale_price.toFixed(2)}`
		],
		[
			'Avg. Price Difference',
			`$${analytics.performance_metrics.price_difference.toFixed(2)}`
		],
		[],
		['User Engagement'],
		['Top Likers'],
		['Name', 'Email', 'Likes'],
		...analytics.user_engagement.top_likers.map(u => [
			u.name,
			u.email,
			u.likes
		]),
		[],
		['Likes Distribution'],
		['Range', 'Count'],
		...Object.entries(analytics.user_engagement.likes_distribution)
	]

	return csvRows.map(row => row.join(',')).join('\n')
}
