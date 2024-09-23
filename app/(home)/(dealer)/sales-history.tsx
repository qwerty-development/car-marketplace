import React, { useState, useEffect, useCallback } from 'react'
import {
	View,
	Text,
	FlatList,
	TouchableOpacity,
	Image,
	Modal,
	ScrollView,
	RefreshControl
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import { FontAwesome, Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'react-native'
import { PieChart } from 'react-native-chart-kit'

interface SaleRecord {
	id: number
	make: string
	model: string
	year: number
	sold_price: number | null
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
			style={{
				backgroundColor: isDarkMode ? 'black' : 'white',
				borderBottomWidth: 0,
				borderBottomColor: '#D55004',
				borderTopWidth: 0,
				borderWidth: 0,

				borderColor: '#D55004'
			}}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'center', // Centers the content horizontally
					paddingHorizontal: 0,
					paddingBottom: 9
				}}>
				<Text
					style={{
						fontSize: 20,
						textAlign: 'center',
						color: '#D55004',
						fontWeight: '600'
					}}>
					{title}
				</Text>
			</View>
		</SafeAreaView>
	)
}

const SaleDetailsModal = ({ isVisible, onClose, sale, isDarkMode }: any) => {
	const daysListed = Math.ceil(
		(new Date(sale.date_sold) - new Date(sale.listed_at)) /
			(1000 * 60 * 60 * 24)
	)
	const priceDifference = sale.sold_price - sale.price
	const priceDifferencePercentage = (
		(priceDifference / sale.price) *
		100
	).toFixed(2)

	return (
		<Modal visible={isVisible} animationType='slide' transparent={true}>
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
							<Image
								source={{ uri: sale.images[0] }}
								className='w-full h-48 rounded-lg mb-4'
							/>
						)}
						<Text className={`mb-2 ${isDarkMode ? 'text-white' : 'text-gray'}`}>
							{sale.description}
						</Text>
						<View className='flex-row justify-between items-center mb-2 text-nowrap'>
							<Text
								className={`font-semibold text-nowrap ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								Listed Price:
							</Text>
							<Text className={`${isDarkMode ? 'text-white' : 'text-black'}`}>
								${sale.price.toLocaleString()}
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
								${sale.sold_price.toLocaleString()}
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
									priceDifference >= 0 ? 'text-green-500' : 'text-pink-700'
								}>
								{priceDifference >= 0 ? '+' : '-'}$
								{Math.abs(priceDifference).toLocaleString()} (
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
									color: '#D55004',
									legendFontColor: isDarkMode ? '#FFFFFF' : '#7F7F7F'
								},
								{
									name: 'Price Difference',
									population: Math.abs(priceDifference),
									color: priceDifference >= 0 ? '#4CAF50' : '#F44336',
									legendFontColor: isDarkMode ? '#FFFFFF' : '#7F7F7F'
								}
							]}
							width={350}
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
		</Modal>
	)
}

export default function SalesHistoryPage() {
	const { isDarkMode } = useTheme()
	const { user } = useUser()
	const [salesHistory, setSalesHistory] = useState<SaleRecord[]>([])
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
	const [refreshing, setRefreshing] = useState(false)
	const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null)
	const [isModalVisible, setIsModalVisible] = useState(false)

	const fetchSalesHistory = useCallback(async () => {
		if (!user) return
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

			if (data) setSalesHistory(data)
			if (error) console.error('Error fetching sales history:', error)
		}
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

	const renderSaleItem = ({ item }: { item: SaleRecord }) => (
		<TouchableOpacity
			className={`${
				isDarkMode ? 'bg-gray-800' : 'bg-white'
			} p-4 rounded-lg mb-4 shadow-md`}
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
						isDarkMode ? 'text-red' : 'text-red'
					}`}>
					${item.sold_price?.toLocaleString()}
				</Text>
			</View>
			<View className='flex-row items-center'>
				<FontAwesome
					name='calendar'
					size={14}
					color={isDarkMode ? '#BBBBBB' : '#666666'}
				/>
				<Text className={`ml-2 ${isDarkMode ? 'text-white' : 'text-gray'}`}>
					{new Date(item.date_sold).toLocaleDateString()}
				</Text>
			</View>
		</TouchableOpacity>
	)

	return (
		<LinearGradient
			colors={isDarkMode ? ['#1E1E1E', '#2D2D2D'] : ['#F5F5F5', '#E0E0E0']}
			className='flex-1'>
			<CustomHeader title='Sales History' />
			<View className='flex-1 px-4'>
				<View className='flex-row justify-between items-center mb-4'>
					<Text
						className={`text-2xl font-bold ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
						Sales History
					</Text>
					<TouchableOpacity onPress={toggleSortOrder} className='p-2'>
						<FontAwesome
							name={
								sortOrder === 'asc' ? 'sort-amount-asc' : 'sort-amount-desc'
							}
							size={20}
							color={isDarkMode ? '#FFFFFF' : '#000000'}
						/>
					</TouchableOpacity>
				</View>
				<FlatList
					data={salesHistory}
					renderItem={renderSaleItem}
					keyExtractor={item => `${item.id}-${Math.random()}`}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={onRefresh}
							tintColor={isDarkMode ? '#FFFFFF' : '#000000'}
						/>
					}
					ListEmptyComponent={
						<Text
							className={`text-center mt-4 ${
								isDarkMode ? 'text-gray' : 'text-gray'
							}`}>
							No sales history available.
						</Text>
					}
				/>
			</View>
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
