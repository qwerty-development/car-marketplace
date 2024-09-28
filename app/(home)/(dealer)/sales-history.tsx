import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
	View,
	Text,
	FlatList,
	TouchableOpacity,
	Image,
	Modal,
	ScrollView,
	RefreshControl,
	Dimensions,
	TextInput,
	ActivityIndicator
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import { FontAwesome5, Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'react-native'
import { PieChart, LineChart } from 'react-native-chart-kit'
import { BlurView } from 'expo-blur'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

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
}

const CustomHeader = ({ title }: any) => {
	const { isDarkMode } = useTheme()
	return (
		<SafeAreaView
			edges={['top']}
			className={`${isDarkMode ? 'bg-black' : 'bg-white'}`}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View className='border-b border-red py-2'>
				<Text className='text-2xl font-bold text-red text-center'>{title}</Text>
			</View>
		</SafeAreaView>
	)
}

const SaleDetailsModal = ({ isVisible, onClose, sale, isDarkMode }: any) => {
	const daysListed = Math.ceil(
		(new Date(sale.date_sold).getTime() - new Date(sale.listed_at).getTime()) /
			(1000 * 60 * 60 * 24)
	)
	const priceDifference = sale.sold_price - sale.price
	const priceDifferencePercentage = (
		(priceDifference / sale.price) *
		100
	).toFixed(2)

	const [currentImageIndex, setCurrentImageIndex] = useState(0)

	return (
		<Modal visible={isVisible} animationType='slide' transparent={true}>
			<BlurView
				intensity={100}
				tint={isDarkMode ? 'dark' : 'light'}
				className='flex-1'>
				<View
					className={`flex-1 justify-end ${
						isDarkMode ? 'bg-black/50' : 'bg-gray/50'
					}`}>
					<View
						className={`${
							isDarkMode ? 'bg-gray' : 'bg-white'
						} rounded-t-3xl p-6 pt-3 h-5/6`}>
						<ScrollView showsVerticalScrollIndicator={false}>
							<TouchableOpacity onPress={onClose} className='self-end'>
								<Ionicons
									name='close'
									size={24}
									color={isDarkMode ? '#D55004' : '#FF8C00'}
								/>
							</TouchableOpacity>
							<Text
								className={`text-2xl font-bold mb-4 ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								{sale.year} {sale.make} {sale.model}
							</Text>
							{sale.images && sale.images.length > 0 && (
								<View>
									<ScrollView
										horizontal
										pagingEnabled
										showsHorizontalScrollIndicator={false}
										onMomentumScrollEnd={event => {
											const newIndex = Math.round(
												event.nativeEvent.contentOffset.x / SCREEN_WIDTH
											)
											setCurrentImageIndex(newIndex)
										}}>
										{sale.images.map(
											(image: any, index: React.Key | null | undefined) => (
												<Image
													key={index}
													source={{ uri: image }}
													className='w-full h-48 rounded-lg mb-4'
													style={{ width: SCREEN_WIDTH - 48 }}
												/>
											)
										)}
									</ScrollView>
								</View>
							)}
							<Text
								className={`mb-2 ${isDarkMode ? 'text-white' : 'text-gray'}`}>
								{sale.description}
							</Text>
							<View className='flex-row justify-between items-center mb-2'>
								<Text
									className={`font-semibold ${
										isDarkMode ? 'text-white' : 'text-black'
									}`}>
									Listed Price:
								</Text>
								<Text className={`${isDarkMode ? 'text-white' : 'text-black'}`}>
									${sale.price?.toLocaleString()}
								</Text>
							</View>
							<View className='flex-row justify-between items-center mb-2'>
								<Text
									className={`font-semibold ${
										isDarkMode ? 'text-white' : 'text-black'
									}`}>
									Sold Price:
								</Text>
								<Text className={`${isDarkMode ? 'text-white' : 'text-black'}`}>
									${sale.sold_price?.toLocaleString()}
								</Text>
							</View>
							<View className='flex-row justify-between items-center mb-2'>
								<Text
									className={`font-semibold ${
										isDarkMode ? 'text-white' : 'text-black'
									}`}>
									Price Difference:
								</Text>
								<Text
									className={
										priceDifference >= 0 ? 'text-green-500' : 'text-pink-600'
									}>
									{priceDifference >= 0 ? '+' : '-'}$
									{Math.abs(priceDifference)?.toLocaleString()} (
									{priceDifferencePercentage}%)
								</Text>
							</View>
							<View className='flex-row justify-between items-center mb-4'>
								<Text
									className={`font-semibold ${
										isDarkMode ? 'text-white' : 'text-black'
									}`}>
									Days Listed:
								</Text>
								<Text className={`${isDarkMode ? 'text-white' : 'text-black'}`}>
									{daysListed}
								</Text>
							</View>
							<PieChart
								data={[
									{
										name: 'Listed Price',
										population: sale.price,
										color: '#3b82f6',
										legendFontColor: isDarkMode ? '#FFFFFF' : '#7F7F7F'
									},
									{
										name: 'Difference',
										population: Math.abs(priceDifference),
										color: priceDifference >= 0 ? '#4CAF50' : '#F44336',
										legendFontColor: isDarkMode ? '#FFFFFF' : '#7F7F7F'
									}
								]}
								width={SCREEN_WIDTH - 48}
								height={200}
								chartConfig={{
									color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`
								}}
								accessor='population'
								backgroundColor='transparent'
								paddingLeft='-5'
								absolute
							/>
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
	const [filteredSales, setFilteredSales] = useState<SaleRecord[]>([])
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
	const [refreshing, setRefreshing] = useState(false)
	const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null)
	const [isModalVisible, setIsModalVisible] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	const [searchQuery, setSearchQuery] = useState('')

	const fetchSalesHistory = useCallback(async () => {
		if (!user) return

		if (refreshing === false) {
			setIsLoading(true)
		}

		const { data: dealershipData } = await supabase
			.from('dealerships')
			.select('id')
			.eq('user_id', user.id)
			.single()

		if (dealershipData) {
			const { data, error } = await supabase
				.from('cars')
				.select(
					'id, make, model, year, sold_price, date_sold, price, listed_at, images, description'
				)
				.eq('dealership_id', dealershipData.id)
				.eq('status', 'sold')
				.order('date_sold', { ascending: sortOrder === 'asc' })

			if (data) {
				setSalesHistory(data)
				setFilteredSales(data)
			}
			if (error) console.error('Error fetching sales history:', error)
		}
		setIsLoading(false)
	}, [user, sortOrder])

	useEffect(() => {
		fetchSalesHistory()
	}, [fetchSalesHistory])

	const onRefresh = useCallback(async () => {
		setRefreshing(true)
		await fetchSalesHistory()
		setRefreshing(false)
	}, [fetchSalesHistory])

	const toggleSortOrder = () => {
		setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
	}

	const handleSearch = (query: string) => {
		setSearchQuery(query)
		const filtered = salesHistory.filter(sale =>
			`${sale.make} ${sale.model}`.toLowerCase().includes(query.toLowerCase())
		)
		setFilteredSales(filtered)
	}

	const salesData = useMemo(() => {
		const monthlyData: { [key: string]: number } = {}
		filteredSales.forEach(sale => {
			const month = new Date(sale.date_sold)?.toLocaleString('default', {
				month: 'short'
			})
			monthlyData[month] = (monthlyData[month] || 0) + sale.sold_price
		})
		return Object.entries(monthlyData).map(([month, total]) => ({
			month,
			total
		}))
	}, [filteredSales])

	const renderSaleItem = ({ item }: { item: SaleRecord }) => {
		const priceDifference = item.sold_price - item.price
		const priceDifferencePercentage = (
			(priceDifference / item.price) *
			100
		).toFixed(2)

		return (
			<TouchableOpacity
				className={`${
					isDarkMode ? 'bg-gray' : 'bg-white'
				} p-4 rounded-lg mb-4 shadow-lg`}
				onPress={() => {
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
							priceDifference >= 0 ? 'text-green-500' : 'text-pink-600'
						}`}>
						${item.sold_price?.toLocaleString()}
					</Text>
				</View>
				<View className='flex-row justify-between items-center'>
					<View className='flex-row items-center'>
						<FontAwesome5
							name='calendar-alt'
							size={14}
							color={isDarkMode ? '#BBBBBB' : '#666666'}
						/>
						<Text className={`ml-2 ${isDarkMode ? 'text-white' : 'text-gray'}`}>
							{new Date(item.date_sold)?.toLocaleDateString()}
						</Text>
					</View>
					<Text
						className={
							priceDifference >= 0 ? 'text-green-500 ' : 'text-pink-600'
						}>
						{priceDifference >= 0 ? '+' : '-'}$
						{Math.abs(priceDifference)?.toLocaleString()} (
						{priceDifferencePercentage}%)
					</Text>
				</View>
			</TouchableOpacity>
		)
	}

	return (
		<LinearGradient
			colors={isDarkMode ? ['#1E1E1E', '#2D2D2D'] : ['#F5F5F5', '#E0E0E0']}
			className='flex-1'>
			<CustomHeader title='Sales History' />
			<ScrollView
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						tintColor='#D55004'
					/>
				}
				className='flex-1'>
				<View className='px-4'>
					<View className='flex-row justify-between items-center my-4'>
						<View className='flex-1 mr-2'>
							<TextInput
								className={`bg-white dark:bg-gray rounded-full px-4 py-2 ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}
								placeholder='Search sales...'
								placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
								value={searchQuery}
								onChangeText={handleSearch}
							/>
						</View>
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
					{isLoading && !refreshing ? (
						<ActivityIndicator size='large' color='#D55004' />
					) : (
						<>
							<ScrollView
								horizontal
								showsHorizontalScrollIndicator={false}
								className='mb-4'>
								<View
									className={`${
										isDarkMode ? '' : 'bg-white'
									} p-1 rounded-lg shadow-lg`}>
									<Text
										className={`text-lg font-bold mb-2 ${
											isDarkMode ? 'text-white' : 'text-black'
										}`}>
										Monthly Sales Chart
									</Text>
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
											propsForLabels: {
												fontSize: 12
											}
										}}
										bezier
										style={{ marginVertical: 8, borderRadius: 16 }}
										withVerticalLabels
										withHorizontalLabels
									/>
								</View>
							</ScrollView>
							{filteredSales.map(item => renderSaleItem({ item }))}
							{filteredSales.length === 0 && (
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
										No sales history available.
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
		</LinearGradient>
	)
}
