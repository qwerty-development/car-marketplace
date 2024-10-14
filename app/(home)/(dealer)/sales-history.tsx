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
	const [currentImageIndex, setCurrentImageIndex] = useState(0)
	const daysListed = Math.ceil(
		(new Date(sale.date_sold).getTime() - new Date(sale.listed_at).getTime()) /
			(1000 * 60 * 60 * 24)
	)
	const priceDifference = sale.sold_price - sale.price
	const priceDifferencePercentage = (
		(priceDifference / sale.price) *
		100
	).toFixed(2)

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
							<FlatList
								data={sale.images}
								horizontal
								pagingEnabled
								showsHorizontalScrollIndicator={false}
								onMomentumScrollEnd={event => {
									const newIndex = Math.round(
										event.nativeEvent.contentOffset.x / SCREEN_WIDTH
									)
									setCurrentImageIndex(newIndex)
								}}
								renderItem={({ item, index }) => (
									<Image
										key={index}
										source={{ uri: item }}
										className='w-full h-48 rounded-lg mb-4'
										style={{ width: SCREEN_WIDTH - 48 }}
									/>
								)}
							/>
						)}
						<Text className={`mb-2 ${isDarkMode ? 'text-white' : 'text-gray'}`}>
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
						'id, make, model, year, sold_price, date_sold, price, listed_at, images, description'
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
		// Sort the sales chronologically for the chart, regardless of the list sort order
		const chronologicalSales = [...salesHistory].sort(
			(a, b) =>
				new Date(a.date_sold).getTime() - new Date(b.date_sold).getTime()
		)
		chronologicalSales.forEach(sale => {
			const month = new Date(sale.date_sold).toLocaleString('default', {
				month: 'short'
			})
			monthlyData[month] = (monthlyData[month] || 0) + sale.sold_price
		})
		return Object.entries(monthlyData).map(([month, total]) => ({
			month,
			total
		}))
	}, [salesHistory])

	const renderSaleItem = useCallback(
		(item: SaleRecord) => {
			const priceDifference = item.sold_price - item.price
			const priceDifferencePercentage = (
				(priceDifference / item.price) *
				100
			).toFixed(2)

			return (
				<TouchableOpacity
					key={item.id}
					className={`${
						isDarkMode ? 'bg-gray' : 'bg-white'
					} p-4 rounded-lg mb-5 shadow-lg`}
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
							<Text
								className={`ml-2 ${isDarkMode ? 'text-white' : 'text-gray'}`}>
								{new Date(item.date_sold).toLocaleDateString()}
							</Text>
						</View>
						<Text
							className={
								priceDifference >= 0 ? 'text-green-500' : 'text-pink-600'
							}>
							{priceDifference >= 0 ? '+' : '-'}$
							{Math.abs(priceDifference).toLocaleString()} (
							{priceDifferencePercentage}%)
						</Text>
					</View>
				</TouchableOpacity>
			)
		},
		[isDarkMode]
	)

	return (
		<LinearGradient
			colors={isDarkMode ? ['#1E1E1E', '#2D2D2D'] : ['#F5F5F5', '#E0E0E0']}
			className='flex-1'>
			<CustomHeader title='Sales History' />
			<ScrollView className='flex-1'>
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
						<TouchableOpacity onPress={toggleSortOrder} className='ml-2 p-2'>
							<FontAwesome5
								name={
									sortOrder === 'asc' ? 'sort-amount-up' : 'sort-amount-down'
								}
								size={20}
								color={isDarkMode ? '#FFFFFF' : '#000000'}
							/>
						</TouchableOpacity>
					</View>
					{isLoading ? (
						<ActivityIndicator size='large' color='#D55004' />
					) : (
						<>
							<View
								className={`${
									isDarkMode ? 'bg-gray-800' : 'bg-white'
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
