import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	FlatList,
	StyleSheet,
	StatusBar,
	TouchableOpacity
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import { FontAwesome } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

interface SaleRecord {
	id: number
	make: string
	model: string
	year: number
	sold_price: number | null
	date_sold: string
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

export default function SalesHistoryPage() {
	const { isDarkMode } = useTheme()
	const { user } = useUser()
	const [salesHistory, setSalesHistory] = useState<SaleRecord[]>([])
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

	useEffect(() => {
		if (user) fetchSalesHistory()
	}, [user])

	const fetchSalesHistory = async () => {
		const { data: dealershipData } = await supabase
			.from('dealerships')
			.select('id')
			.eq('user_id', user?.id)
			.single()

		if (dealershipData) {
			const { data, error } = await supabase
				.from('cars')
				.select('id, make, model, year, sold_price, date_sold')
				.eq('dealership_id', dealershipData.id)
				.eq('status', 'sold')
				.order('date_sold', { ascending: sortOrder === 'asc' })

			if (data) setSalesHistory(data)
		}
	}

	const toggleSortOrder = () => {
		setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
		fetchSalesHistory()
	}

	const formatPrice = (price: number | null): string => {
		if (price === null || isNaN(price)) {
			return 'N/A'
		}
		return `$${price.toLocaleString()}`
	}

	const renderSaleItem = ({ item }: { item: SaleRecord }) => (
		<TouchableOpacity
			style={[styles.saleItem, isDarkMode && styles.darkSaleItem]}>
			<View style={styles.saleItemHeader}>
				<Text style={[styles.carInfo, isDarkMode && styles.darkText]}>
					{item.year} {item.make} {item.model}
				</Text>
				<Text style={[styles.salePrice, isDarkMode && styles.darkSalePrice]}>
					{formatPrice(item.sold_price)}
				</Text>
			</View>
			<View style={styles.saleItemFooter}>
				<FontAwesome
					name='calendar'
					size={14}
					color={isDarkMode ? '#BBBBBB' : '#666666'}
				/>
				<Text style={[styles.saleDate, isDarkMode && styles.darkText]}>
					{new Date(item.date_sold).toLocaleDateString()}
				</Text>
			</View>
		</TouchableOpacity>
	)

	return (
		<LinearGradient
			colors={isDarkMode ? ['#1E1E1E', '#2D2D2D'] : ['#F5F5F5', '#E0E0E0']}
			style={styles.gradient}>
			<CustomHeader title='Sales History' />
			<SafeAreaView style={styles.safeArea}>
				<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
				<View style={styles.container}>
					<View style={styles.header}>
						<Text style={[styles.title, isDarkMode && styles.darkText]}>
							Sales History
						</Text>
						<TouchableOpacity
							style={styles.sortButton}
							onPress={toggleSortOrder}>
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
						keyExtractor={item => {
							const id = item.id?.toString() || ''
							const make = item.make || ''
							const model = item.model || ''
							return `${id}-${make}-${model}-${Math.random()}`
						}}
						contentContainerStyle={styles.listContainer}
					/>
				</View>
			</SafeAreaView>
		</LinearGradient>
	)
}
const styles = StyleSheet.create({
	gradient: {
		flex: 1
	},
	safeArea: {
		flex: 1
	},
	container: {
		flex: 1,
		padding: 20
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 20
	},
	title: {
		fontSize: 28,
		fontWeight: 'bold',
		color: '#333333'
	},
	darkText: {
		color: '#FFFFFF'
	},
	sortButton: {
		padding: 10
	},
	listContainer: {
		paddingBottom: 20
	},
	saleItem: {
		backgroundColor: '#FFFFFF',
		padding: 15,
		borderRadius: 10,
		marginBottom: 10,
		shadowColor: '#000000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3
	},
	darkSaleItem: {
		backgroundColor: '#3D3D3D'
	},
	saleItemHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 10
	},
	carInfo: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#333333'
	},
	salePrice: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#D55004'
	},
	darkSalePrice: {
		color: '#FF8C42'
	},
	saleItemFooter: {
		flexDirection: 'row',
		alignItems: 'center'
	},
	saleDate: {
		fontSize: 14,
		color: '#666666',
		marginLeft: 5
	}
})
