import React, { useMemo } from 'react'
import { View, Text, ScrollView, Dimensions } from 'react-native'
import { BarChart } from 'react-native-chart-kit'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const FuturisticSalesChart = ({ salesData, isDarkMode }) => {
	const processedData = useMemo(() => {
		const last12Months = salesData.slice(-12)

		// Calculate month-over-month growth
		const currentMonth = last12Months[last12Months.length - 1]?.count || 0
		const lastMonth = last12Months[last12Months.length - 2]?.count || 0
		const growthRate = lastMonth
			? ((currentMonth - lastMonth) / lastMonth) * 100
			: 0

		// Calculate performance metrics
		const total = last12Months.reduce(
			(sum, month) => sum + (month.count || 0),
			0
		)
		const average = total / last12Months.length

		return {
			chartData: {
				labels: last12Months.map(d => d.month),
				datasets: [
					{
						data: last12Months.map(d => d.count || 0)
					}
				]
			},
			metrics: {
				growthRate,
				total,
				average,
				trend: currentMonth > average ? 'up' : 'down'
			}
		}
	}, [salesData])

	const getPerformanceText = growthRate => {
		if (growthRate > 20) return 'Exceptional growth!'
		if (growthRate > 10) return 'Strong performance!'
		if (growthRate > 0) return 'Positive trend'
		if (growthRate === 0) return 'Stable performance'
		return 'Needs attention'
	}

	const chartConfig = {
		backgroundGradientFrom: isDarkMode ? '#1A1A1A' : '#FFFFFF',
		backgroundGradientTo: isDarkMode ? '#1A1A1A' : '#FFFFFF',
		backgroundColor: 'transparent',
		decimalPlaces: 0,
		color: (opacity = 1) => {
			// Create a modern gradient effect
			return isDarkMode
				? `rgba(56, 189, 248, ${opacity})` // Bright blue for dark mode
				: `rgba(2, 132, 199, ${opacity})` // Deep blue for light mode
		},
		barPercentage: 0.7,
		useShadowColorFromDataset: false,
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

	const InsightCard = ({ title, value, icon, trend, color }) => (
		<LinearGradient
			colors={
				isDarkMode
					? ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
					: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']
			}
			className='rounded-2xl p-4 flex-1 mx-1'
			start={{ x: 0, y: 0 }}
			end={{ x: 1, y: 1 }}>
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
			{trend && (
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

	const PerformanceInsight = ({ growthRate }) => (
		<LinearGradient
			colors={
				isDarkMode
					? ['rgba(56, 189, 248, 0.2)', 'rgba(56, 189, 248, 0.1)']
					: ['rgba(2, 132, 199, 0.1)', 'rgba(2, 132, 199, 0.05)']
			}
			className='rounded-2xl p-4 mb-6'>
			<View className='flex-row justify-between items-center'>
				<View className='flex-1'>
					<Text
						className={`text-xl font-bold mb-2 ${
							isDarkMode ? 'text-white' : 'text-neutral-900'
						}`}>
						{getPerformanceText(growthRate)}
					</Text>
					<Text
						className={`text-sm ${
							isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
						}`}>
						Your sales performance is{' '}
						<Text
							className={growthRate >= 0 ? 'text-green-500' : 'text-red-500'}>
							{growthRate > 0 ? '+' : ''}
							{growthRate.toFixed(1)}%
						</Text>{' '}
						compared to last month
					</Text>
				</View>
				<View
					className={`rounded-full p-3 ${
						growthRate >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'
					}`}>
					<Ionicons
						name={growthRate >= 0 ? 'trending-up' : 'trending-down'}
						size={24}
						color={growthRate >= 0 ? '#10B981' : '#EF4444'}
					/>
				</View>
			</View>
		</LinearGradient>
	)

	return (
		<View className={` mb-6`}>
			<BlurView
				intensity={isDarkMode ? 20 : 40}
				tint={isDarkMode ? 'dark' : 'light'}
				className='absolute inset-0 rounded-3xl'
			/>

			<PerformanceInsight growthRate={processedData.metrics.growthRate} />

			<View className='flex-row mb-6'>
				<InsightCard
					title='Monthly Average'
					value={Math.round(processedData.metrics.average)}
					icon='analytics'
					color='#0EA5E9'
				/>
				<InsightCard
					title='Current Month'
					value={processedData.chartData.datasets[0].data.slice(-1)[0]}
					icon='pulse'
					trend={processedData.metrics.growthRate}
					color='#10B981'
				/>
			</View>

			<View>
				<ScrollView horizontal showsHorizontalScrollIndicator={false}>
					<BarChart
						data={processedData.chartData}
						width={Math.max(
							SCREEN_WIDTH * 1.5,
							processedData.chartData.labels.length * 80
						)}
						height={220}
						chartConfig={chartConfig}
						showValuesOnTopOfBars={true}
						withInnerLines={true}
						segments={5}
						fromZero={true}
						style={{
							borderRadius: 16,
							paddingTop: 12
						}}
					/>
				</ScrollView>
			</View>

			{/* Future Prediction Indicator */}
			<View className='mt-6 p-4 rounded-2xl bg-blue-500/10'>
				<Text
					className={`text-sm ${
						isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
					}`}>
					Based on current trends, next month's sales are projected to be{' '}
					<Text className='font-bold text-blue-500'>
						{Math.round(
							processedData.metrics.average *
								(1 + processedData.metrics.growthRate / 100)
						)}{' '}
						cars
					</Text>
				</Text>
			</View>
		</View>
	)
}

export default FuturisticSalesChart
