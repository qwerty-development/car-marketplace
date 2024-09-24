import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
	View,
	Text,
	ScrollView,
	Image,
	TouchableOpacity,
	StatusBar,
	ActivityIndicator,
	RefreshControl,
	Dimensions
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/utils/supabase'
import { BarChart } from 'react-native-chart-kit'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '@/utils/ThemeContext'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const CustomHeader = ({
	title,
	onBack
}: {
	title: string
	onBack: () => void
}) => {
	const { isDarkMode } = useTheme()

	return (
		<SafeAreaView
			edges={['top']}
			className={`${isDarkMode ? 'bg-night' : 'bg-white'} border-b border-red`}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View className='flex-row items-center justify-between py-4 px-4'>
				<TouchableOpacity onPress={onBack}>
					<Ionicons
						name='chevron-back'
						size={24}
						color={isDarkMode ? 'white' : 'black'}
					/>
				</TouchableOpacity>
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
				isDarkMode ? 'bg-night' : 'bg-white'
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

export default function IndividualCarAnalyticsPage() {
	const { id }: any = useLocalSearchParams()
	const router = useRouter()
	const { isDarkMode } = useTheme()
	const [carData, setCarData] = useState<any>(null)
	const [analytics, setAnalytics] = useState<any>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)

	const fetchData = useCallback(async () => {
		setIsLoading(true)
		try {
			const { data: carData, error: carError } = await supabase
				.from('cars')
				.select('*')
				.eq('id', id)
				.single()

			if (carError) throw carError
			setCarData(carData)

			const { data: analyticsData, error: analyticsError } = await supabase.rpc(
				'get_car_analytics',
				{
					p_car_id: id,
					p_time_range: 'week'
				}
			)

			if (analyticsError) throw analyticsError
			setAnalytics(analyticsData)
		} catch (error) {
			console.error('Error fetching data:', error)
		} finally {
			setIsLoading(false)
		}
	}, [id])

	useEffect(() => {
		fetchData()
	}, [fetchData])

	const onRefresh = useCallback(() => {
		setRefreshing(true)
		fetchData().then(() => setRefreshing(false))
	}, [fetchData])

	const viewsComparisonData = useMemo(() => {
		if (!analytics?.comparison_to_average) return null

		return {
			labels: ['This Car', 'Dealership Avg'],
			datasets: [
				{
					data: [
						analytics.total_views,
						analytics.total_views - analytics.comparison_to_average.views_diff
					]
				}
			]
		}
	}, [analytics])

	const likesComparisonData = useMemo(() => {
		if (!analytics?.comparison_to_average) return null

		return {
			labels: ['This Car', 'Dealership Avg'],
			datasets: [
				{
					data: [
						analytics.total_likes,
						analytics.total_likes - analytics.comparison_to_average.likes_diff
					]
				}
			]
		}
	}, [analytics])

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

	if (!carData || !analytics) {
		return (
			<View
				className={`flex-1 justify-center items-center ${
					isDarkMode ? 'bg-night' : 'bg-white'
				}`}>
				<Text className={`text-xl ${isDarkMode ? 'text-white' : 'text-night'}`}>
					No data available
				</Text>
			</View>
		)
	}

	return (
		<ScrollView
			className={`flex-1 ${isDarkMode ? 'bg-night' : 'bg-white'}`}
			refreshControl={
				<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
			}>
			<CustomHeader
				title={`${carData.year} ${carData.make} ${carData.model}`}
				onBack={() => router.push('(home)/(dealer)/analytics')}
			/>

			<View className={`p-4 ${isDarkMode ? 'bg-night' : 'bg-white'}`}>
				<Image
					source={{ uri: carData.images[0] }}
					className='w-full h-48 rounded-lg mb-4'
				/>
				<Text
					className={`text-2xl font-bold ${
						isDarkMode ? 'text-white' : 'text-night'
					}`}>
					{carData.year} {carData.make} {carData.model}
				</Text>
				<Text className='text-xl text-red'>
					${carData.price.toLocaleString()}
				</Text>
			</View>

			<View
				className={`rounded-lg shadow-md mx-4 mb-4 p-4 ${
					isDarkMode ? 'bg-gray' : 'bg-white'
				}`}>
				<Text
					className={`text-xl font-semibold mb-2 ${
						isDarkMode ? 'text-white' : 'text-night'
					}`}>
					Key Metrics
				</Text>
				<View className='flex-row justify-between'>
					<View className='items-center'>
						<Text className='text-3xl font-bold text-blue-500'>
							{analytics.total_views}
						</Text>
						<Text
							className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray'}`}>
							Total Views
						</Text>
					</View>
					<View className='items-center'>
						<Text className='text-3xl font-bold text-rose-500'>
							{analytics.total_likes}
						</Text>
						<Text
							className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray'}`}>
							Total Likes
						</Text>
					</View>
					<View className='items-center'>
						<Text className='text-3xl font-bold text-green-500'>
							{analytics.total_views != 0
								? (
										(analytics.total_likes / analytics.total_views) *
										100
								  ).toFixed(2)
								: 0}
							%
						</Text>
						<Text
							className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray'}`}>
							Like Rate
						</Text>
					</View>
				</View>
			</View>

			{viewsComparisonData && (
				<ChartContainer title='Views Comparison'>
					<BarChart
						data={viewsComparisonData}
						width={SCREEN_WIDTH - 32}
						height={220}
						yAxisLabel=''
						yAxisSuffix=''
						chartConfig={{
							backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
							backgroundGradientFrom: isDarkMode ? '#1e1e1e' : '#ffffff',
							backgroundGradientTo: isDarkMode ? '#1e1e1e' : '#ffffff',
							decimalPlaces: 0,
							color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
							style: { borderRadius: 16 }
						}}
						style={{ marginVertical: 8, borderRadius: 16 }}
					/>
				</ChartContainer>
			)}

			{likesComparisonData && (
				<ChartContainer title='Likes Comparison'>
					<BarChart
						data={likesComparisonData}
						width={SCREEN_WIDTH - 32}
						height={220}
						yAxisLabel=''
						yAxisSuffix=''
						chartConfig={{
							backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
							backgroundGradientFrom: isDarkMode ? '#1e1e1e' : '#ffffff',
							backgroundGradientTo: isDarkMode ? '#1e1e1e' : '#ffffff',
							decimalPlaces: 0,
							color: (opacity = 1) => `rgba(255, 99, 132, ${opacity})`,
							style: { borderRadius: 16 }
						}}
						style={{ marginVertical: 8, borderRadius: 16 }}
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
					Comparison to Dealership Average
				</Text>
				<View className='mb-4'>
					<Text className={isDarkMode ? 'text-white' : 'text-gray'}>
						Views Difference:
					</Text>
					<View className='flex-row items-center mt-2'>
						<View
							className={`h-4 ${
								analytics.comparison_to_average.views_diff >= 0
									? 'bg-green-500'
									: 'bg-rose-700'
							}`}
							style={{
								width: `${
									(Math.abs(analytics.comparison_to_average.views_diff) /
										Math.max(
											analytics.total_views,
											analytics.total_views -
												analytics.comparison_to_average.views_diff
										)) *
									60
								}%`
							}}
						/>
						<Text
							className={`ml-2 font-bold ${
								isDarkMode ? 'text-white' : 'text-night'
							}`}>
							{analytics.comparison_to_average.views_diff >= 0 ? '+' : ''}
							{analytics.comparison_to_average.views_diff.toFixed(2)}
						</Text>
					</View>
				</View>
				<View>
					<Text className={isDarkMode ? 'text-white' : 'text-gray'}>
						Likes Difference:
					</Text>
					<View className='flex-row items-center mt-2'>
						<View
							className={`h-4 ${
								analytics.comparison_to_average.likes_diff >= 0
									? 'bg-green-500'
									: 'bg-rose-700'
							}`}
							style={{
								width: `${
									(Math.abs(analytics.comparison_to_average.likes_diff) /
										Math.max(
											analytics.total_likes,
											analytics.total_likes -
												analytics.comparison_to_average.likes_diff
										)) *
									60
								}%`
							}}
						/>
						<Text
							className={`ml-2 font-bold ${
								isDarkMode ? 'text-white' : 'text-night'
							}`}>
							{analytics.comparison_to_average.likes_diff >= 0 ? '+' : ''}
							{analytics.comparison_to_average.likes_diff.toFixed(2)}
						</Text>
					</View>
				</View>
			</View>

			<View
				className={`rounded-lg shadow-md mx-4 mb-4 p-4 ${
					isDarkMode ? 'bg-gray' : 'bg-white'
				}`}>
				<Text
					className={`text-xl font-semibold mb-4 ${
						isDarkMode ? 'text-white' : 'text-night'
					}`}>
					Car Details
				</Text>
				<View className='flex-row flex-wrap justify-between'>
					<DetailItem
						label='Condition'
						value={carData.condition}
						isDarkMode={isDarkMode}
					/>
					<DetailItem
						label='Transmission'
						value={carData.transmission}
						isDarkMode={isDarkMode}
					/>
					<DetailItem
						label='Color'
						value={carData.color}
						isDarkMode={isDarkMode}
					/>
					<DetailItem
						label='Mileage'
						value={`${carData.mileage.toLocaleString()} miles`}
						isDarkMode={isDarkMode}
					/>
					<DetailItem
						label='Drivetrain'
						value={carData.drivetrain}
						isDarkMode={isDarkMode}
					/>
					<DetailItem
						label='Status'
						value={carData.status}
						isDarkMode={isDarkMode}
					/>
				</View>
			</View>
		</ScrollView>
	)
}

const DetailItem = ({
	label,
	value,
	isDarkMode
}: {
	label: string
	value: string
	isDarkMode: boolean
}) => (
	<View className='w-1/2 mb-4'>
		<Text className={isDarkMode ? 'text-white' : 'text-gray'}>{label}:</Text>
		<Text className={`font-bold ${isDarkMode ? 'text-red' : 'text-red'}`}>
			{value}
		</Text>
	</View>
)
