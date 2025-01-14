import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
		<SafeAreaView
			edges={['top']}
			className={`bg-${isDarkMode ? 'black' : 'white'}`}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View className='flex-row items-center border-b border-red justify-center pb-2'>
				<Text className='text-xl font-semibold text-red'>{title}</Text>
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
				isDarkMode ? 'bg-gray' : 'bg-white'
			} p-4 rounded-2xl flex-1 mx-1`}>
			<Text
				className={`text-xs ${isDarkMode ? 'text-white' : 'text-gray'} mb-2`}>
				{title}
			</Text>
			<View className='flex-row items-baseline'>
				<Text
					className={`text-lg font-bold ${
						isDarkMode ? 'text-white' : 'text-black'
					}`}>
					{typeof value === 'number' ? `$${value.toLocaleString()}` : value}
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
					className={`text-xs mt-1 ${isDarkMode ? 'text-white' : 'text-gray'}`}>
					{subValue}
				</Text>
			)}
		</View>
	)

	const StatCard2 = ({ title, value, trend = null, subValue = null }: any) => (
		<View
			className={`${
				isDarkMode ? 'bg-gray' : 'bg-white'
			} p-4 rounded-2xl flex-1 mx-1`}>
			<Text
				className={`text-xs ${isDarkMode ? 'text-white' : 'text-gray'} mb-2`}>
				{title}
			</Text>
			<View className='flex-row items-baseline'>
				<Text
					className={`text-lg font-bold ${
						isDarkMode ? 'text-white' : 'text-black'
					}`}>
					{typeof value === 'number' ? `${value.toLocaleString()}` : value}
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
					className={`text-xs mt-1 ${isDarkMode ? 'text-white' : 'text-gray'}`}>
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
						className={`${isDarkMode ? 'bg-gray' : 'bg-white'} rounded-t-3xl`}>
						{/* Header */}
						<View className='p-4 border-b border-gray-200 flex-row justify-between items-center'>
							<View>
								<Text
									className={`text-2xl font-bold ${
										isDarkMode ? 'text-white' : 'text-black'
									}`}>
									Sale Details
								</Text>
								<Text className={`${isDarkMode ? 'text-white' : 'text-gray'}`}>
									{sale.year} {sale.make} {sale.model}
								</Text>
							</View>
							<TouchableOpacity
								onPress={onClose}
								className={`${
									isDarkMode ? 'bg-gray' : 'bg-white'
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
									isDarkMode ? 'bg-gray' : 'bg-white'
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
													isDarkMode ? 'text-white' : 'text-gray'
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
													isDarkMode ? 'text-white' : 'text-gray'
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
											className={`${isDarkMode ? 'text-white' : 'text-gray'}`}>
											Purchase Date
										</Text>
										<Text
											className={`font-medium ${
												isDarkMode ? 'text-white' : 'text-black'
											}`}>
											{new Date(sale.date_bought).toLocaleDateString()}
										</Text>
									</View>

									<View className='flex-row justify-between'>
										<Text
											className={`${isDarkMode ? 'text-white' : 'text-gray'}`}>
											Sale Date
										</Text>
										<Text
											className={`font-medium ${
												isDarkMode ? 'text-white' : 'text-black'
											}`}>
											{new Date(sale.date_sold).toLocaleDateString()}
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

	const isSubscriptionValid = useCallback(() => {
		if (!dealership) {
			console.log('Dealership data is not loaded yet.')
			return false
		}

		if (!dealership.subscription_end_date) {
			console.log(
				'Subscription end date is not set. Assuming subscription is not valid.'
			)
			return false
		}

		const endDate = new Date(dealership.subscription_end_date)
		const today = new Date()

		endDate.setHours(0, 0, 0, 0)
		today.setHours(0, 0, 0, 0)

		console.log('End Date:', endDate)
		console.log('Today:', today)
		console.log('Is Valid:', endDate >= today)

		return endDate >= today
	}, [dealership])

	const getDaysUntilExpiration = useCallback(() => {
		if (!dealership || !dealership.subscription_end_date) return 0
		const endDate = new Date(dealership.subscription_end_date)
		const today = new Date()
		const diffTime = endDate.getTime() - today.getTime()
		return Math.ceil(diffTime / (1000 * 3600 * 24))
	}, [dealership])

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
						'id, make, model, year, sold_price, date_sold, price, listed_at, images, description, buyer_name, bought_price, date_bought, seller_name'
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

	const filteredSales = useMemo(() => {
		return salesHistory.filter(sale =>
			`${sale.make} ${sale.model}`
				.toLowerCase()
				.includes(searchQuery.toLowerCase())
		)
	}, [salesHistory, searchQuery])

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

	const salesData = useMemo(() => {
		const monthlyData: { [key: string]: number } = {}
		const chronologicalSales = [...salesHistory].sort(
			(a, b) =>
				new Date(a.date_sold).getTime() - new Date(b.date_sold).getTime()
		)

		chronologicalSales.forEach(sale => {
			const saleDate = new Date(sale.date_sold)
			const month = saleDate.toLocaleString('default', { month: 'short' })
			const year = saleDate.getFullYear() // Get the year
			const monthYear = `${month} ${year}` // Combine month and year

			monthlyData[monthYear] = (monthlyData[monthYear] || 0) + sale.sold_price
		})

		return Object.entries(monthlyData).map(([monthYear, total]) => ({
			month: monthYear, // Use the combined month and year
			total
		}))
	}, [salesHistory])

	const renderSaleItem = useCallback(
		(item: SaleRecord) => {
			const priceDifference = item.sold_price - item.price
			const actualProfit = item.sold_price - item.bought_price
			const expectedProfit = item.price - item.bought_price
			const priceDifferencePercentage = (
				(priceDifference / item.price) *
				100
			).toFixed(2)
			const daysInStock = Math.ceil(
				(new Date(item.date_sold).getTime() -
					new Date(item.date_bought).getTime()) /
					(1000 * 60 * 60 * 24)
			)

			return (
				<TouchableOpacity
					key={item.id}
					className={`${
						isDarkMode ? 'bg-gray' : 'bg-white'
					} p-4 rounded-lg mb-5 shadow-lg`}
					onPress={() => {
						console.log('Subscription Status:', isSubscriptionValid())
						console.log('Current Dealership:', dealership)

						if (!dealership?.subscription_end_date) {
							Alert.alert(
								'Error',
								'Unable to verify subscription status. Please try again.'
							)
							return
						}

						if (!isSubscriptionValid()) {
							Alert.alert(
								'Subscription Expired',
								`Your subscription expired on ${new Date(
									dealership.subscription_end_date
								).toLocaleDateString()}`
							)
							return
						}

						setSelectedSale(item)
						setIsModalVisible(true)
					}}>
					<View className='flex-row justify-between items-center mb-2'>
						<Text
							className={`text-lg font-bold ${
								isDarkMode ? 'text-white' : 'text-black'
							}`}>
							{item.year} {item.make} {item.model}
						</Text>
						<Text
							className={`text-lg font-bold ${
								actualProfit >= 0 ? 'text-green-500' : 'text-pink-600'
							}`}>
							{actualProfit >= 0 ? '+' : '-'}$
							{Math.abs(actualProfit)?.toLocaleString()}
						</Text>
					</View>
					{item.buyer_name && (
						<View className='flex-row justify-between items-center mb-2'>
							<Text
								className={`text-sm ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								Buyer:
							</Text>
							<Text
								className={`text-sm ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								{item.buyer_name}
							</Text>
						</View>
					)}
					{item.seller_name && (
						<View className='flex-row justify-between items-center mb-2'>
							<Text
								className={`text-sm ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								Bought From:
							</Text>
							<Text
								className={`text-sm ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								{item.seller_name}
							</Text>
						</View>
					)}
					<View className='flex-row justify-between items-center mb-2'>
						<Text
							className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray'}`}>
							Bought: {new Date(item.date_bought).toLocaleDateString()}
						</Text>
						<Text
							className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray'}`}>
							Sold: {new Date(item.date_sold).toLocaleDateString()}
						</Text>
					</View>
					<View className='flex-row justify-between items-center'>
						<Text
							className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray'}`}>
							Days in Stock: {daysInStock}
						</Text>
						<Text
							className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray'}`}>
							Listed Price: ${item.price?.toLocaleString()}
						</Text>
					</View>
				</TouchableOpacity>
			)
		},
		[isDarkMode, dealership, isSubscriptionValid]
	)

	return (
		<LinearGradient
			colors={isDarkMode ? ['#1E1E1E', '#2D2D2D'] : ['#F5F5F5', '#E0E0E0']}
			className='flex-1'>
			<CustomHeader title='Sales History' />
			{/* Subscription Status Messages */}
			{!isSubscriptionValid() && (
				<View className='bg-rose-700 p-4'>
					<Text className='text-white text-center font-bold'>
						Your subscription has expired. Some features may be limited.
					</Text>
				</View>
			)}
			{dealership?.subscription_end_date ? (
				<>
					{!isSubscriptionValid() && (
						<View className='bg-rose-700 p-4'>
							<Text className='text-white text-center font-bold'>
								Your subscription expired on{' '}
								{new Date(
									dealership.subscription_end_date
								).toLocaleDateString()}
							</Text>
						</View>
					)}
					{isSubscriptionValid() &&
						getDaysUntilExpiration() <= SUBSCRIPTION_WARNING_DAYS && (
							<View className='bg-yellow-500 p-4'>
								<Text className='text-white text-center font-bold'>
									Your subscription will expire in {getDaysUntilExpiration()}{' '}
									day(s). Please renew soon.
								</Text>
							</View>
						)}
				</>
			) : (
				<View className='bg-rose-700 p-4'>
					<Text className='text-white text-center font-bold'>
						Unable to verify subscription status. Please contact support.
					</Text>
				</View>
			)}
			<ScrollView className='flex-1 mb-10'>
				<View className='px-4 py-2 mb-5'>
					<View className='flex-row justify-between items-center mb-4'>
						<TextInput
							className={`flex-1 bg-white dark:bg-gray rounded-full px-4 py-2 ${
								isDarkMode ? 'text-white' : 'text-black'
							}`}
							placeholder='Search sales...'
							placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
							value={searchQuery}
							onChangeText={setSearchQuery}
						/>

						<View className='flex-row ml-3'>
							<TouchableOpacity
								onPress={() => setIsExportModalVisible(true)}
								className='mr-2 p-2 bg-red rounded-full'>
								<Ionicons name='download-outline' size={20} color='white' />
							</TouchableOpacity>
							<TouchableOpacity onPress={toggleSortOrder} className='p-2'>
								<FontAwesome5
									name={
										sortOrder === 'asc' ? 'sort-amount-up' : 'sort-amount-down'
									}
									size={20}
									color={isDarkMode ? '#FFFFFF' : '#000000'}
								/>
							</TouchableOpacity>
						</View>
					</View>
					{isLoading ? (
						<ActivityIndicator size='large' color='#D55004' />
					) : (
						<>
							<View
								className={`${
									isDarkMode ? 'bg-gray' : 'bg-white'
								} rounded-lg py-4 mb-4`}>
								<Text
									className={`text-lg font-bold ${
										isDarkMode ? 'text-white' : 'text-black'
									} mb-2`}>
									Monthly Sales Chart
								</Text>
								<ScrollView horizontal showsHorizontalScrollIndicator={false}>
									<LineChart
										data={{
											labels: salesData.map(d => d.month),
											datasets: [{ data: salesData.map(d => d.total) }]
										}}
										width={SCREEN_WIDTH * 1.5}
										height={220}
										chartConfig={{
											backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF',
											backgroundGradientFrom: isDarkMode
												? '#1E1E1E'
												: '#FFFFFF',
											backgroundGradientTo: isDarkMode ? '#1E1E1E' : '#FFFFFF',
											decimalPlaces: 0,
											color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
											labelColor: (opacity = 1) =>
												isDarkMode
													? `rgba(255, 255, 255, ${opacity})`
													: `rgba(0, 0, 0, ${opacity})`,
											style: { borderRadius: 16 },
											propsForDots: {
												r: '6',
												strokeWidth: '2',
												stroke: '#0077FF'
											},
											propsForLabels: { fontSize: 12 }
										}}
										bezier
										style={{ marginVertical: 8, borderRadius: 16 }}
										withVerticalLabels
										withHorizontalLabels
									/>
								</ScrollView>
							</View>
							{/* Enhanced Empty Sales Message */}
							{filteredAndSortedSales.length > 0 ? (
								filteredAndSortedSales.map(renderSaleItem)
							) : (
								<View className='flex-1 justify-center items-center mt-10'>
									<FontAwesome5
										name='clipboard-list'
										size={50}
										color={isDarkMode ? '#BBBBBB' : '#666666'}
									/>
									<Text
										className={`text-center mt-4 ${
											isDarkMode ? 'text-white' : 'text-gray'
										}`}>
										{isLoading
											? 'Loading sales history...'
											: 'No sales history available.'}
									</Text>
								</View>
							)}
						</>
					)}
				</View>
			</ScrollView>
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
