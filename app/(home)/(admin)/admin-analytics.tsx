// app/(home)/(admin)/admin-analytics.tsx
import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	Dimensions
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit'
import { Ionicons } from '@expo/vector-icons'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export default function AdminAnalyticsDashboard() {
	const [analytics, setAnalytics] = useState<any>(null)
	const [timeRange, setTimeRange] = useState('week')

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

	if (!analytics) return <Text className='p-4'>Loading analytics...</Text>

	return (
		<ScrollView className='flex-1 bg-gray-100'>
			<View className='p-4 bg-white rounded-lg shadow-md m-4'>
				<Text className='text-2xl font-bold mb-4'>
					Admin Analytics Dashboard
				</Text>
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
				</View>
			</View>

			<View className='bg-white rounded-lg shadow-md m-4 p-4'>
				<Text className='text-xl font-semibold mb-2'>
					Performance Over Time
				</Text>
				<LineChart
					data={{
						labels: analytics.time_series_data.map((d: any) => d.date),
						datasets: [
							{
								data: analytics.time_series_data.map((d: any) => d.views),
								color: () => 'rgba(0, 255, 0, 0.5)',
								strokeWidth: 2
							},
							{
								data: analytics.time_series_data.map((d: any) => d.likes),
								color: () => 'rgba(255, 0, 0, 0.5)',
								strokeWidth: 2
							},
							{
								data: analytics.time_series_data.map((d: any) => d.sales),
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

			<View className='bg-white rounded-lg shadow-md m-4 p-4'>
				<Text className='text-xl font-semibold mb-2'>Top 5 Dealerships</Text>
				<BarChart
					data={{
						labels: analytics.top_dealerships.map((d: any) => d.name),
						datasets: [
							{ data: analytics.top_dealerships.map((d: any) => d.listings) }
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
						color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
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
							name: 'New Cars',
							population: analytics.inventory_summary.new_cars,
							color: '#FF9800',
							legendFontColor: '#7F7F7F',
							legendFontSize: 12
						},
						{
							name: 'Used Cars',
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

			<View className='bg-white rounded-lg shadow-md m-4 p-4'>
				<Text className='text-xl font-semibold mb-2'>Performance Metrics</Text>
				<MetricRow
					title='Avg. Time to Sell'
					value={`${analytics.performance_metrics.avg_time_to_sell?.toFixed(
						1
					)} days`}
				/>
				<MetricRow
					title='Conversion Rate'
					value={`${(
						analytics.performance_metrics.conversion_rate * 100
					)?.toFixed(2)}%`}
				/>
				<MetricRow
					title='Avg. Listing Price'
					value={`$${analytics.performance_metrics.avg_listing_price?.toFixed(
						2
					)}`}
				/>
				<MetricRow
					title='Avg. Sale Price'
					value={`$${analytics.performance_metrics.avg_sale_price?.toFixed(2)}`}
				/>
			</View>
		</ScrollView>
	)
}

const MetricCard = ({ title, value, icon, color }: any) => (
	<View className='w-[30%] bg-white rounded-lg shadow p-3 mb-4'>
		<Ionicons name={icon} size={24} color={color} />
		<Text className='text-lg font-bold mt-2'>{value}</Text>
		<Text className='text-xs text-gray-600'>{title}</Text>
	</View>
)

const MetricRow = ({ title, value }: any) => (
	<View className='flex-row justify-between items-center mb-2'>
		<Text className='text-gray-600'>{title}:</Text>
		<Text className='font-bold'>{value}</Text>
	</View>
)
