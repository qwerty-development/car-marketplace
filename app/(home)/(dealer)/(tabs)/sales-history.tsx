import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	Image,
	Modal,
	TextInput,
	ActivityIndicator,
	Dimensions,
	StatusBar,
	ScrollView,
	FlatList
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import { FontAwesome5, Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PieChart, LineChart, BarChart } from 'react-native-chart-kit'
import { BlurView } from 'expo-blur'
import { Alert } from 'react-native'
import ExportSalesModal from '@/components/ExportSalesModal'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import MonthlyBarChart from '@/components/FuturisticSalesChart'
import { useScrollToTop } from '@react-navigation/native'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const SUBSCRIPTION_WARNING_DAYS = 7

interface SaleRecord {
	id: number
	make: string
	model: string
	year: number
	sold_price: number
	date_sold: string
	price: number
	listed_at: string
	images: string[]
	description: string
	buyer_name: string | null
	bought_price: number // Added bought_price
	date_bought: string // Added date_bought
	seller_name: string | null // Added seller_name
}

const CustomHeader = React.memo(({ title }: { title: string }) => {
	const { isDarkMode } = useTheme()

	return (
		<SafeAreaView className={`bg-${isDarkMode ? 'black' : 'white'} `}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View className='flex-row ml-6'>
				<Text className='text-2xl -mb-5 font-bold text-black dark:text-white'>
					{title}
				</Text>
			</View>
		</SafeAreaView>
	)
})

const SaleDetailsModal = ({ isVisible, onClose, sale, isDarkMode }: any) => {
	const daysListed = Math.ceil(
		(new Date(sale.date_sold).getTime() - new Date(sale.listed_at).getTime()) /
			(1000 * 60 * 60 * 24)
	)
	const daysInStock = Math.ceil(
		(new Date(sale.date_sold).getTime() -
			new Date(sale.date_bought).getTime()) /
			(1000 * 60 * 60 * 24)
	)
	const priceDifference = sale.sold_price - sale.price
	const actualProfit = sale.sold_price - sale.bought_price
	const expectedProfit = sale.price - sale.bought_price
	const priceDifferencePercentage = (
		(priceDifference / sale.price) *
		100
	).toFixed(2)

	const StatCard = ({ title, value, trend = null, subValue = null }: any) => (
		<View
			className={`${
				isDarkMode ? 'bg-neutral-700' : 'bg-white'
			} p-4 rounded-2xl flex-1 mx-1`}>
			<Text
				className={`text-xs ${
					isDarkMode ? 'text-white' : 'text-neutral-700'
				} mb-2`}>
				{title}
			</Text>
			<View className='flex-row items-baseline'>
				<Text
					className={`text-lg font-bold ${
						isDarkMode ? 'text-white' : 'text-black'
					}`}>
					{typeof value === 'number' ? `$${value?.toLocaleString()}` : value}
				</Text>
				{trend && (
					<View
						className={`ml-2 px-2 py-1 rounded-full ${
							trend >= 0 ? 'bg-green-100' : 'bg-rose-100'
						}`}>
						<Text
							className={`text-xs ${
								trend >= 0 ? 'text-green-600' : 'text-rose-600'
							}`}>
							{trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
						</Text>
					</View>
				)}
			</View>
			{subValue && (
				<Text
					className={`text-xs mt-1 ${
						isDarkMode ? 'text-white' : 'text-neutral-700'
					}`}>
					{subValue}
				</Text>
			)}
		</View>
	)

	const StatCard2 = ({ title, value, trend = null, subValue = null }: any) => (
		<View
			className={`${
				isDarkMode ? 'bg-neutral-700' : 'bg-white'
			} p-4 rounded-2xl flex-1 mx-1`}>
			<Text
				className={`text-xs ${
					isDarkMode ? 'text-white' : 'text-neutral-700'
				} mb-2`}>
				{title}
			</Text>
			<View className='flex-row items-baseline'>
				<Text
					className={`text-lg font-bold ${
						isDarkMode ? 'text-white' : 'text-black'
					}`}>
					{typeof value === 'number' ? `${value?.toLocaleString()}` : value}
				</Text>
				{trend && (
					<View
						className={`ml-2 px-2 py-1 rounded-full ${
							trend >= 0 ? 'bg-green-100' : 'bg-rose-100'
						}`}>
						<Text
							className={`text-xs ${
								trend >= 0 ? 'text-green-600' : 'text-rose-600'
							}`}>
							{trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
						</Text>
					</View>
				)}
			</View>
			{subValue && (
				<Text
					className={`text-xs mt-1 ${
						isDarkMode ? 'text-white' : 'text-neutral-700'
					}`}>
					{subValue}
				</Text>
			)}
		</View>
	)

	return (
		<Modal visible={isVisible} animationType='slide' transparent={true}>
			<BlurView
				intensity={100}
				tint={isDarkMode ? 'dark' : 'light'}
				className='flex-1'>
				<View
					className={`flex-1 justify-end ${
						isDarkMode ? 'bg-black/50' : 'bg-white/50'
					}`}>
					<View
						className={`${
							isDarkMode ? 'bg-neutral-700' : 'bg-white'
						} rounded-t-3xl`}>
						{/* Header */}
						<View className='p-4 border-b border-neutral-200 flex-row justify-between items-center'>
							<View>
								<Text
									className={`text-2xl font-bold ${
										isDarkMode ? 'text-white' : 'text-black'
									}`}>
									Sale Details
								</Text>
								<Text
									className={`${
										isDarkMode ? 'text-white' : 'text-neutral-700'
									}`}>
									{sale.year} {sale.make} {sale.model}
								</Text>
							</View>
							<TouchableOpacity
								onPress={onClose}
								className={`${
									isDarkMode ? 'bg-neutral-700' : 'bg-white'
								} p-2 rounded-full`}>
								<Ionicons
									name='close'
									size={24}
									color={isDarkMode ? '#D55004' : '#FF8C00'}
								/>
							</TouchableOpacity>
						</View>

						<ScrollView className='h-[85%]'>
							{/* Key Stats Grid */}
							<View className='p-4'>
								<View className='flex-row mb-4'>
									<StatCard title='Listed Price' value={sale.price} />
									<StatCard
										title='Sold Price'
										value={sale.sold_price}
										trend={parseFloat(priceDifferencePercentage)}
									/>
								</View>

								<View className='flex-row mb-4'>
									<StatCard
										title='Actual Profit'
										value={actualProfit}
										trend={((actualProfit / sale.bought_price) * 100).toFixed(
											1
										)}
									/>
									<StatCard title='Expected Profit' value={expectedProfit} />
								</View>

								<View className='flex-row mb-4'>
									<StatCard2
										title='Days Listed'
										value={daysListed}
										subValue='Until Sale'
									/>
									<StatCard2
										title='Days in Stock'
										value={daysInStock}
										subValue='Total Duration'
									/>
								</View>
							</View>

							{/* Transaction Details */}
							<View
								className={`mx-4 p-4 rounded-2xl ${
									isDarkMode ? 'bg-neutral-700' : 'bg-white'
								}`}>
								<Text
									className={`text-lg font-bold mb-4 ${
										isDarkMode ? 'text-white' : 'text-black'
									}`}>
									Transaction Details
								</Text>

								<View className='space-y-3'>
									{sale.buyer_name && (
										<View className='flex-row justify-between'>
											<Text
												className={`${
													isDarkMode ? 'text-white' : 'text-neutral-700'
												}`}>
												Buyer
											</Text>
											<Text
												className={`font-medium ${
													isDarkMode ? 'text-white' : 'text-black'
												}`}>
												{sale.buyer_name}
											</Text>
										</View>
									)}

									{sale.seller_name && (
										<View className='flex-row justify-between'>
											<Text
												className={`${
													isDarkMode ? 'text-white' : 'text-neutral-700'
												}`}>
												Seller
											</Text>
											<Text
												className={`font-medium ${
													isDarkMode ? 'text-white' : 'text-black'
												}`}>
												{sale.seller_name}
											</Text>
										</View>
									)}

									<View className='flex-row justify-between'>
										<Text
											className={`${
												isDarkMode ? 'text-white' : 'text-neutral-700'
											}`}>
											Purchase Date
										</Text>
										<Text
											className={`font-medium ${
												isDarkMode ? 'text-white' : 'text-black'
											}`}>
											{new Date(sale.date_bought)?.toLocaleDateString()}
										</Text>
									</View>

									<View className='flex-row justify-between'>
										<Text
											className={`${
												isDarkMode ? 'text-white' : 'text-neutral-700'
											}`}>
											Sale Date
										</Text>
										<Text
											className={`font-medium ${
												isDarkMode ? 'text-white' : 'text-black'
											}`}>
											{new Date(sale.date_sold)?.toLocaleDateString()}
										</Text>
									</View>
								</View>
							</View>

							{/* Price Chart */}
							<View className='p-4 mt-2'>
								<Text
									className={`text-lg font-bold mb-4 ${
										isDarkMode ? 'text-white' : 'text-black'
									}`}>
									Price Breakdown
								</Text>
								<BarChart
									data={{
										labels: ['Bought', 'Listed', 'Sold'],
										datasets: [
											{
												data: [sale.bought_price, sale.price, sale.sold_price]
											}
										]
									}}
									width={SCREEN_WIDTH - 48}
									height={220}
									yAxisLabel='$'
									chartConfig={{
										backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF',
										backgroundGradientFrom: isDarkMode ? '#1E1E1E' : '#FFFFFF',
										backgroundGradientTo: isDarkMode ? '#1E1E1E' : '#FFFFFF',
										decimalPlaces: 0,
										color: (opacity = 1) => `rgba(213, 80, 4, ${opacity})`,
										labelColor: (opacity = 1) =>
											isDarkMode
												? `rgba(255, 255, 255, ${opacity})`
												: `rgba(0, 0, 0, ${opacity})`,
										style: { borderRadius: 16, paddingVertical: 8 },
										propsForLabels: { fontSize: 12 },
										barPercentage: 0.7
									}}
									showValuesOnTopOfBars={true}
									fromZero={true}
									style={{
										marginVertical: 8,
										borderRadius: 16
									}}
								/>
							</View>
						</ScrollView>
					</View>
				</View>
			</BlurView>
		</Modal>
	)
}

const KPICard = ({ title, value, icon, trend, isDarkMode }) => (
	<View
		className={`${
			isDarkMode ? 'bg-neutral-700/30' : 'bg-white'
		} rounded-2xl p-4 flex-1 mx-1`}>
		<BlurView
			intensity={isDarkMode ? 20 : 40}
			className='absolute inset 0 rounded-2xl'
		/>
		<View className='flex-row justify-between items-center mb-2'>
			<Text
				className={`text-xs ${
					isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
				}`}>
				{title}
			</Text>
			<Ionicons
				name={icon}
				size={20}
				color={isDarkMode ? '#D55004' : '#FF8C00'}
			/>
		</View>
		<Text
			className={`text-xl font-bold ${
				isDarkMode ? 'text-white' : 'text-black'
			}`}>
			{value}
		</Text>
		{trend && (
			<View className='flex-row items-center mt-2'>
				<Ionicons
					name={trend >= 0 ? 'trending-up' : 'trending-down'}
					size={16}
					color={trend >= 0 ? '#10B981' : '#EF4444'}
				/>
				<Text
					className={trend >= 0 ? 'text-green-500' : 'text-red-500'}
					style={{ fontSize: 12 }}>
					{trend}%
				</Text>
			</View>
		)}
	</View>
)

// Sale Card Component
const SaleCard = ({ sale, isDarkMode, onPress }) => {
	const profit = sale.sold_price - sale.bought_price
	const profitPercentage = ((profit / sale.bought_price) * 100).toFixed(1)
	const daysInStock = Math.ceil(
		(new Date(sale.date_sold).getTime() -
			new Date(sale.date_bought).getTime()) /
			(1000 * 60 * 60 * 24)
	)

	return (
		<TouchableOpacity
			onPress={onPress}
			className={`mb-4 rounded-2xl overflow-hidden ${
				isDarkMode ? 'bg-neutral-700/30' : 'bg-white'
			}`}>
			<BlurView intensity={isDarkMode ? 20 : 40} className='absolute inset-0' />
			<LinearGradient
				colors={
					isDarkMode
						? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']
						: ['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.6)']
				}
				className='p-4'>
				{/* Header: Vehicle Name and Profit */}
				<View className='flex-row justify-between items-center mb-3'>
					<Text
						className={`text-lg font-bold flex-1 ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
						{sale.year} {sale.make} {sale.model}
					</Text>
					<View
						className={`px-3 py-1.5 rounded-full flex-row items-center gap-1
              ${profit >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
						<MaterialCommunityIcons
							name={profit >= 0 ? 'trending-up' : 'trending-down'}
							size={16}
							color={profit >= 0 ? '#10B981' : '#EF4444'}
						/>
						<Text
							className={
								profit >= 0
									? 'text-green-500 font-medium'
									: 'text-red-500 font-medium'
							}>
							${Math.abs(profit).toLocaleString()}
						</Text>
					</View>
				</View>

				{/* Buyer and Dealership Info */}
				<View className='flex-row justify-between items-center py-2 border-b border-t border-neutral-200/20'>
					<View className='flex-row items-center gap-2'>
						<MaterialCommunityIcons
							name='account'
							size={18}
							color={isDarkMode ? '#D55004' : '#FF8C00'}
						/>
						<View>
							<Text
								className={`text-xs ${
									isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
								}`}>
								Purchaser
							</Text>
							<Text
								className={`text-sm font-medium ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								{sale.buyer_name || 'N/A'}
							</Text>
						</View>
					</View>
					<View className='flex-row items-center gap-2'>
						<MaterialCommunityIcons
							name='store'
							size={18}
							color={isDarkMode ? '#D55004' : '#FF8C00'}
						/>
						<View>
							<Text
								className={`text-xs ${
									isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
								}`}>
								Dealership
							</Text>
							<Text
								className={`text-sm font-medium ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								{sale.seller_name || 'N/A'}
							</Text>
						</View>
					</View>
				</View>

				{/* Price and Stock Information */}
				<View className='flex-row justify-between items-center py-2'>
					<View className='flex-row items-center gap-2'>
						<MaterialCommunityIcons
							name='timer-outline'
							size={18}
							color={isDarkMode ? '#D55004' : '#FF8C00'}
						/>
						<View>
							<Text
								className={`text-xs ${
									isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
								}`}>
								In Stock
							</Text>
							<Text
								className={`text-sm font-medium ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								{daysInStock} days
							</Text>
						</View>
					</View>
					<View className='flex-row items-center gap-2'>
						<MaterialCommunityIcons
							name='currency-usd'
							size={18}
							color={isDarkMode ? '#D55004' : '#FF8C00'}
						/>
						<View>
							<Text
								className={`text-xs ${
									isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
								}`}>
								Listed Price
							</Text>
							<Text
								className={`text-sm font-medium ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								${sale.price.toLocaleString()}
							</Text>
						</View>
					</View>
				</View>

				{/* Dates */}
				<View className='flex-row justify-between items-center pt-2 mt-1 border-t border-neutral-200/20'>
					<View className='flex-row items-center gap-2'>
						<MaterialCommunityIcons
							name='calendar'
							size={16}
							color={isDarkMode ? '#D55004' : '#FF8C00'}
						/>
						<View>
							<Text
								className={`text-xs ${
									isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
								}`}>
								Bought
							</Text>
							<Text
								className={`text-sm font-medium ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								{new Date(sale.date_bought).toLocaleDateString()}
							</Text>
						</View>
					</View>
					<View className='flex-row items-center gap-2'>
						<MaterialCommunityIcons
							name='calendar-check'
							size={16}
							color={isDarkMode ? '#D55004' : '#FF8C00'}
						/>
						<View>
							<Text
								className={`text-xs ${
									isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
								}`}>
								Sold
							</Text>
							<Text
								className={`text-sm font-medium ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								{new Date(sale.date_sold).toLocaleDateString()}
							</Text>
						</View>
					</View>
				</View>
			</LinearGradient>
		</TouchableOpacity>
	)
}

const calculateKPIs = salesHistory => {
	const totalSold = salesHistory.length
	const totalViews = salesHistory.reduce(
		(sum, sale) => sum + (sale.views || 0),
		0
	)
	const totalRevenue = salesHistory.reduce(
		(sum, sale) => sum + sale.sold_price,
		0
	)
	const totalProfit = salesHistory.reduce(
		(sum, sale) => sum + (sale.sold_price - sale.bought_price),
		0
	)

	// Calculate trends (example: compare with previous month)
	const currentMonth = new Date().getMonth()
	const currentYearSales = salesHistory.filter(
		sale => new Date(sale.date_sold).getMonth() === currentMonth
	)
	const previousMonthSales = salesHistory.filter(
		sale => new Date(sale.date_sold).getMonth() === currentMonth - 1
	)

	const trend =
		previousMonthSales.length > 0
			? ((currentYearSales.length - previousMonthSales.length) /
					previousMonthSales.length) *
			  100
			: 0

	return {
		totalSold,
		totalViews,
		totalRevenue,
		totalProfit,
		trend: trend.toFixed(1)
	}
}

export default function SalesHistoryPage() {
	const { isDarkMode } = useTheme()
	const { user } = useUser()
	const [salesHistory, setSalesHistory] = useState<SaleRecord[]>([])
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
	const [isLoading, setIsLoading] = useState(true)
	const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null)
	const [isModalVisible, setIsModalVisible] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [isExportModalVisible, setIsExportModalVisible] = useState(false)
	const scrollRef = useRef(null)
	useScrollToTop(scrollRef)
	const [kpis, setKpis] = useState({
		totalSold: 0,
		totalViews: 0,
		totalRevenue: 0,
		totalProfit: 0,
		trend: 0
	})

	useEffect(() => {
		if (salesHistory.length > 0) {
			setKpis(calculateKPIs(salesHistory))
		}
	}, [salesHistory])
	const [dealership, setDealership] = useState<any>(null)

	const fetchDealershipDetails = useCallback(async () => {
		if (!user) return
		try {
			const { data, error } = await supabase
				.from('dealerships')
				.select('*')
				.eq('user_id', user.id)
				.single()

			if (error) throw error
			setDealership(data)
		} catch (error) {
			console.error('Error fetching dealership details:', error)
		}
	}, [user])

	useEffect(() => {
		fetchDealershipDetails()
	}, [fetchDealershipDetails])

	const fetchSalesHistory = useCallback(async () => {
		if (!user) return
		setIsLoading(true)
		try {
			const { data: dealershipData } = await supabase
				.from('dealerships')
				.select('id')
				.eq('user_id', user.id)
				.single()

			if (dealershipData) {
				const { data, error } = await supabase
					.from('cars')
					.select(
						'id, make, model, year, sold_price, date_sold, price, listed_at, images, description, buyer_name, bought_price, date_bought, seller_name, views'
					)
					.eq('dealership_id', dealershipData.id)
					.eq('status', 'sold')

				if (error) throw error
				setSalesHistory(data || [])
			}
		} catch (error) {
			console.error('Error fetching sales history:', error)
		} finally {
			setIsLoading(false)
		}
	}, [user])

	useEffect(() => {
		fetchSalesHistory()
	}, [fetchSalesHistory])

	const toggleSortOrder = useCallback(() => {
		setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
	}, [])

	const filteredAndSortedSales = useMemo(() => {
		return salesHistory
			.filter(sale =>
				`${sale.make} ${sale.model}`
					.toLowerCase()
					.includes(searchQuery.toLowerCase())
			)
			.sort((a, b) => {
				const dateA = new Date(a.date_sold).getTime()
				const dateB = new Date(b.date_sold).getTime()
				return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
			})
	}, [salesHistory, searchQuery, sortOrder])

	// Update your salesData calculation in the main component:
	const salesData = useMemo(() => {
		const monthlyData = {}

		salesHistory.forEach(sale => {
			const saleDate = new Date(sale.date_sold)
			const monthYear = saleDate.toLocaleString('default', {
				month: 'short',
				year: '2-digit'
			})

			monthlyData[monthYear] = {
				count: (monthlyData[monthYear]?.count || 0) + 1,
				total: (monthlyData[monthYear]?.total || 0) + sale.sold_price
			}
		})

		return Object.entries(monthlyData)
			.map(([month, data]) => ({
				month,
				count: data.count,
				total: data.total
			}))
			.sort((a, b) => {
				const [aMonth, aYear] = a.month.split(' ')
				const [bMonth, bYear] = b.month.split(' ')
				return (
					new Date(`${aMonth} 20${aYear}`) - new Date(`${bMonth} 20${bYear}`)
				)
			})
	}, [salesHistory])

	interface VehicleCardProps {
		vehicleName: string
		profit: string
		purchaser: string
		dealership: string
		stockDays: number
		listedPrice: string
		boughtDate: string
		soldDate: string
	}

	return (
		<LinearGradient
			colors={isDarkMode ? ['#1A1A1A', '#2D2D2D'] : ['#F8F9FA', '#E9ECEF']}
			className='flex-1'>
			<SafeAreaView className='flex-1'>
				{/* Header */}
				<View className='px-4 pt-2 pb-4'>
					<Text
						className={`text-2xl font-bold ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
						Sales History
					</Text>
				</View>

				{/* KPI Section */}
				<ScrollView className='flex-1' ref={scrollRef}>
					<View className='px-4'>
						<View className='flex-row mb-4'>
							<KPICard
								title='Total Sold'
								value={kpis.totalSold}
								icon='car-sport'
								isDarkMode={isDarkMode}
							/>
							<KPICard
								title='Total Views'
								value={kpis.totalViews}
								icon='eye'
								isDarkMode={isDarkMode}
							/>
						</View>
						<View className='flex-row mb-6'>
							<KPICard
								title='Total Revenue'
								value={`$${kpis.totalRevenue?.toLocaleString()}`}
								icon='cash'
								isDarkMode={isDarkMode}
							/>
							<KPICard
								title='Total Profit'
								value={`$${kpis.totalProfit?.toLocaleString()}`}
								icon='trending-up'
								isDarkMode={isDarkMode}
							/>
						</View>

						{/* Chart Section */}
						<MonthlyBarChart salesData={salesData} isDarkMode={isDarkMode} />

						{/* Sales List */}
						<View className='mb-6'>
							<Text
								className={`text-lg font-bold mb-4 ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								Recent Sales
							</Text>
							{filteredAndSortedSales.map((sale, index) => (
								<SaleCard
									key={sale.id}
									sale={sale}
									isDarkMode={isDarkMode}
									onPress={() => {
										setSelectedSale(sale)
										setIsModalVisible(true)
									}}
								/>
							))}
						</View>
					</View>
				</ScrollView>
			</SafeAreaView>
			{selectedSale && (
				<SaleDetailsModal
					isVisible={isModalVisible}
					onClose={() => setIsModalVisible(false)}
					sale={selectedSale}
					isDarkMode={isDarkMode}
				/>
			)}
			<ExportSalesModal
				isVisible={isExportModalVisible}
				onClose={() => setIsExportModalVisible(false)}
				salesData={salesHistory}
				isDarkMode={isDarkMode}
			/>
		</LinearGradient>
	)
}
