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
	Dimensions,
	Animated
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/utils/supabase'
import { BarChart, LineChart } from 'react-native-chart-kit'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '@/utils/ThemeContext'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const ModernHeader = ({ title, onBack, isDarkMode }) => (
	<LinearGradient
		colors={isDarkMode ? ['#1A1A1A', '#0D0D0D'] : ['#FFFFFF', '#F8F8F8']}
		className='rounded-b-3xl shadow-lg'>
		<SafeAreaView edges={['top']}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View className='flex-row items-center justify-between py-4 px-4'>
				<TouchableOpacity
					onPress={onBack}
					className={`rounded-full p-2 ${
						isDarkMode ? 'bg-gray/20' : 'bg-gray/10'
					}`}>
					<Ionicons
						name='chevron-back'
						size={24}
						color={isDarkMode ? 'white' : 'black'}
					/>
				</TouchableOpacity>
				<Text className='text-xl font-bold text-red'>{title}</Text>
				<View style={{ width: 40 }} />
			</View>
		</SafeAreaView>
	</LinearGradient>
)

const MetricCard = ({ title, value, icon, trend, color, isDarkMode }) => (
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
			className={`text-2xl font-bold ${
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
						trend >= 0 ? 'text-green-500' : 'text-red-500'
					}`}>
					{Math.abs(trend).toFixed(1)}%
				</Text>
			</View>
		)}
	</LinearGradient>
)

const ChartContainer = ({ title, subtitle, children, isDarkMode }) => (
	<View className='mb-6 mx-4'>
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

const ComparisonBar = ({ label, value, maxValue, difference, isDarkMode }) => (
	<View className='mb-4'>
		<View className='flex-row justify-between mb-2'>
			<Text className={isDarkMode ? 'text-white' : 'text-gray'}>{label}</Text>
			<Text
				className={`font-bold ${
					difference >= 0 ? 'text-green-500' : 'text-rose-500'
				}`}>
				{difference >= 0 ? '+' : ''}
				{difference.toFixed(2)}
			</Text>
		</View>
		<View className='h-3 bg-gray/20 rounded-full overflow-hidden'>
			<View
				className={`h-full rounded-full ${
					difference >= 0 ? 'bg-green-500' : 'bg-rose-500'
				}`}
				style={{
					width: `${(value / maxValue) * 100}%`
				}}
			/>
		</View>
	</View>
)

const DetailCard = ({ title, items, isDarkMode }) => (
	<LinearGradient
		colors={
			isDarkMode
				? ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
				: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']
		}
		className='rounded-3xl p-6 mx-4 mb-6'
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
		<View className='flex-row flex-wrap justify-between'>
			{items.map((item, index) => (
				<View key={index} className='w-1/2 mb-4'>
					<Text
						className={isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}>
						{item.label}
					</Text>
					<Text
						className={`text-lg font-semibold mt-1 ${
							isDarkMode ? 'text-red' : 'text-red'
						}`}>
						{item.value}
					</Text>
				</View>
			))}
		</View>
	</LinearGradient>
)

export default function IndividualCarAnalyticsPage() {
	const { id } = useLocalSearchParams()
	const router = useRouter()
	const { isDarkMode } = useTheme()
	const [carData, setCarData] = useState(null)
	const [analytics, setAnalytics] = useState(null)
	const [isLoading, setIsLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)

	// Helper function to calculate CTA Rate
	const calculateCTARate = useCallback((carData, analytics) => {
		const totalCTAs = (carData.call_count || 0) + (carData.whatsapp_count || 0);
		const totalViews = analytics.total_views || 1; // Avoid division by zero
		return ((totalCTAs / totalViews) * 100).toFixed(1);
	}, []);

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
		<View className={`flex-1 ${isDarkMode ? 'bg-night' : 'bg-white'}`}>
			<ModernHeader
				title={`${carData.year} ${carData.make} ${carData.model}`}
				onBack={() => router.back()}
				isDarkMode={isDarkMode}
			/>

			<Animated.ScrollView
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
				}
				className='flex-1'>
				<LinearGradient
					colors={
						isDarkMode
							? ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
							: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']
					}
					className='mx-4 mt-4 rounded-3xl overflow-hidden'
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 1 }}>
					<BlurView
						intensity={isDarkMode ? 20 : 40}
						tint={isDarkMode ? 'dark' : 'light'}
						className='absolute inset-0'
					/>
					<Image
						source={{ uri: carData.images[0] }}
						className='w-full h-48'
						resizeMode='cover'
					/>
					<View className='p-4'>
						<Text
							className={`text-2xl font-bold ${
								isDarkMode ? 'text-white' : 'text-night'
							}`}>
							{carData.year} {carData.make} {carData.model}
						</Text>
						<Text className='text-xl text-red font-semibold'>
							${carData.price.toLocaleString()}
						</Text>
					</View>
				</LinearGradient>

				{/* Overview Metrics */}
				<View className='flex-row mx-4 my-6'>
					<MetricCard
						title='Total Views'
						value={analytics.total_views}
						icon='eye'
						color='#3B82F6'
						isDarkMode={isDarkMode}
					/>
					<MetricCard
						title='Total Likes'
						value={analytics.total_likes}
						icon='heart'
						color='#EF4444'
						isDarkMode={isDarkMode}
					/>
					<MetricCard
						title='Like Rate'
						value={`${(
							(analytics.total_likes / Math.max(analytics.total_views, 1)) *
							100
						).toFixed(1)}%`}
						icon='trending-up'
						color='#10B981'
						isDarkMode={isDarkMode}
					/>
				</View>

				{/* Engagement Metrics */}
				<View className='mx-4 my-6'>
					<Text className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-night'}`}>
						Engagement Metrics
					</Text>
					<View className='flex-row'>
						<MetricCard
							title='Call Actions'
							value={carData.call_count || 0}
							icon='call'
							color='#10B981' // green
							isDarkMode={isDarkMode}
						/>
						<MetricCard
							title='WhatsApp'
							value={carData.whatsapp_count || 0}
							icon='logo-whatsapp'
							color='#25D366' // whatsapp green
							isDarkMode={isDarkMode}
						/>
						<MetricCard
							title='Total CTAs'
							value={(carData.call_count || 0) + (carData.whatsapp_count || 0)}
							icon='navigate-circle'
							color='#D55004' // app orange
							isDarkMode={isDarkMode}
						/>
					</View>
				</View>

				{/* CTA Engagement Rate */}
				<ChartContainer
					title='CTA Engagement Rate'
					subtitle='Percentage of views resulting in contact attempts'
					isDarkMode={isDarkMode}>
					<View className='items-center justify-center py-4'>
						<View className='w-36 h-36 rounded-full border-8 border-red items-center justify-center'>
							<Text className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-night'}`}>
								{calculateCTARate(carData, analytics)}%
							</Text>
						</View>
						<Text className={`text-sm mt-4 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
							{`${(carData.call_count || 0) + (carData.whatsapp_count || 0)} actions from ${analytics.total_views} views`}
						</Text>
					</View>
				</ChartContainer>

				{/* Performance Comparison */}
				<ChartContainer
					title='Performance Comparison'
					subtitle='Comparison with dealership average'
					isDarkMode={isDarkMode}>
					<View className='px-4'>
						<ComparisonBar
							label='Views'
							value={analytics.total_views}
							maxValue={Math.max(
								analytics.total_views,
								analytics.total_views -
									analytics.comparison_to_average.views_diff
							)}
							difference={analytics.comparison_to_average.views_diff}
							isDarkMode={isDarkMode}
						/>
						<ComparisonBar
							label='Likes'
							value={analytics.total_likes}
							maxValue={Math.max(
								analytics.total_likes,
								analytics.total_likes -
									analytics.comparison_to_average.likes_diff
							)}
							difference={analytics.comparison_to_average.likes_diff}
							isDarkMode={isDarkMode}
						/>
					</View>
				</ChartContainer>

				{/* CTA Comparison */}
				{analytics.comparison_to_average && (
					<ChartContainer
						title='CTA Performance'
						subtitle='Comparison with dealership average'
						isDarkMode={isDarkMode}>
						<View className='px-4'>
							<ComparisonBar
								label='Call Actions'
								value={carData.call_count || 0}
								maxValue={Math.max(
									carData.call_count || 0,
									(carData.call_count || 0) - (analytics.comparison_to_average.call_diff || 0)
								)}
								difference={analytics.comparison_to_average.call_diff || 0}
								isDarkMode={isDarkMode}
							/>
							<ComparisonBar
								label='WhatsApp Actions'
								value={carData.whatsapp_count || 0}
								maxValue={Math.max(
									carData.whatsapp_count || 0,
									(carData.whatsapp_count || 0) - (analytics.comparison_to_average.whatsapp_diff || 0)
								)}
								difference={analytics.comparison_to_average.whatsapp_diff || 0}
								isDarkMode={isDarkMode}
							/>
							<ComparisonBar
								label='Total CTA'
								value={(carData.call_count || 0) + (carData.whatsapp_count || 0)}
								maxValue={Math.max(
									(carData.call_count || 0) + (carData.whatsapp_count || 0),
									(carData.call_count || 0) + (carData.whatsapp_count || 0) -
									((analytics.comparison_to_average.call_diff || 0) + (analytics.comparison_to_average.whatsapp_diff || 0))
								)}
								difference={(analytics.comparison_to_average.call_diff || 0) + (analytics.comparison_to_average.whatsapp_diff || 0)}
								isDarkMode={isDarkMode}
							/>
						</View>
					</ChartContainer>
				)}

				{/* Car Details */}
				<DetailCard
					title='Car Details'
					items={[
						{ label: 'Condition', value: carData.condition },
						{ label: 'Transmission', value: carData.transmission },
						{ label: 'Color', value: carData.color },
						{
							label: 'Mileage',
							value: `${carData.mileage.toLocaleString()} miles`
						},
						{ label: 'Drivetrain', value: carData.drivetrain },
						{ label: 'Status', value: carData.status }
					]}
					isDarkMode={isDarkMode}
				/>

				<View className='h-20' />
			</Animated.ScrollView>
		</View>
	)
}