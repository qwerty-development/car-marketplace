// app/(home)/(dealer)/sales-history.tsx
import React, { useState, useEffect } from 'react'
import { View, Text, FlatList, StyleSheet } from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'

interface SaleRecord {
	id: number
	make: string
	model: string
	year: number
	sold_price: number
	date_sold: string
}

export default function SalesHistoryPage() {
	const { user } = useUser()
	const [salesHistory, setSalesHistory] = useState<SaleRecord[]>([])

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
				.order('date_sold', { ascending: false })

			if (data) setSalesHistory(data)
		}
	}

	const renderSaleItem = ({ item }: { item: SaleRecord }) => (
		<View style={styles.saleItem}>
			<Text style={styles.carInfo}>
				{item.year} {item.make} {item.model}
			</Text>
			<Text style={styles.salePrice}>Sold for: ${item.sold_price}</Text>
			<Text style={styles.saleDate}>
				Date: {new Date(item.date_sold).toLocaleDateString()}
			</Text>
		</View>
	)

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Sales History</Text>
			<FlatList
				data={salesHistory}
				renderItem={renderSaleItem}
				keyExtractor={item => item.id.toString()}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 20,
		backgroundColor: '#f5f5f5'
	},
	title: {
		fontSize: 24,
		fontWeight: 'bold',
		marginBottom: 20
	},
	saleItem: {
		backgroundColor: 'white',
		padding: 15,
		borderRadius: 10,
		marginBottom: 10
	},
	carInfo: {
		fontSize: 18,
		fontWeight: 'bold'
	},
	salePrice: {
		fontSize: 16,
		color: 'green',
		marginTop: 5
	},
	saleDate: {
		fontSize: 14,
		color: 'gray',
		marginTop: 5
	}
})
