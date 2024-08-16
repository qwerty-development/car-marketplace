import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/utils/supabase'
import { LineChart } from 'react-native-chart-kit'
import { Dimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

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
			p_car_id: id.toString(), // Convert to string if it's not already
			p_time_range: timeRange
		})

		if (data) setAnalytics(data)
		if (error) console.error('Error fetching car analytics:', error)
	}

	if (!carData || !analytics) return <Text className='p-4'>Loading...</Text>

	return (
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

			{/* Time Range Selector */}
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

			{/* Key Metrics */}
			<View className='bg-white p-4 mb-4'>
				<Text className='text-xl font-bold mb-4'>Key Metrics</Text>
				<View className='flex-row justify-between'>
					{[
						{ label: 'Views', value: analytics.total_views, color: 'blue' },
						{ label: 'Likes', value: analytics.total_likes, color: 'red' }
					].map(metric => (
						<View key={metric.label} className='items-center'>
							<Text className={`text-3xl font-bold text-${metric.color}-500`}>
								{metric.value}
							</Text>
							<Text className='text-sm text-gray-600'>{metric.label}</Text>
						</View>
					))}
				</View>
			</View>

			{/* Views Over Time */}
			<View className='bg-white p-4 mb-4'>
				<Text className='text-xl font-bold mb-4'>Views Over Time</Text>
				<LineChart
					data={{
						labels: analytics.view_data.map((d: { date: any }) => d.date),
						datasets: [
							{ data: analytics.view_data.map((d: { views: any }) => d.views) }
						]
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

			{/* Comparison to Average */}
			<View className='bg-white p-4 mb-4'>
				<Text className='text-xl font-bold mb-4'>Comparison to Average</Text>
				<View className='flex-row justify-between'>
					<View>
						<Text className='text-gray-600'>Views Difference:</Text>
						<Text className='font-bold'>
							{analytics.comparison_to_average.views_diff}
						</Text>
					</View>
					<View>
						<Text className='text-gray-600'>Likes Difference:</Text>
						<Text className='font-bold'>
							{analytics.comparison_to_average.likes_diff}
						</Text>
					</View>
				</View>
			</View>
		</ScrollView>
	)
}
