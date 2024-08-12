// app/(home)/(dealer)/index.tsx
import React, { useEffect, useState } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	FlatList,
	StyleSheet
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function DealerDashboard() {
	const { user } = useUser()
	const router = useRouter()
	const [dealership, setDealership] = useState<any>(null)
	const [recentListings, setRecentListings] = useState<any>([])

	useEffect(() => {
		if (user) fetchDealershipInfo()
	}, [user])

	const fetchDealershipInfo = async () => {
		const { data, error } = await supabase
			.from('dealerships')
			.select('*, cars(*)')
			.eq('user_id', user?.id)
			.single()

		if (data) {
			setDealership(data)
			setRecentListings(data.cars.slice(0, 5))
		}
	}

	if (!dealership) return null

	return (
		<View style={styles.container}>
			<Text style={styles.title}>{dealership.name} Dashboard</Text>
			<View style={styles.buttonContainer}>
				<TouchableOpacity
					style={styles.button}
					onPress={() => router.push('/(home)/(dealer)/listings')}>
					<Ionicons name='car' size={24} color='white' />
					<Text style={styles.buttonText}>Manage Listings</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={styles.button}
					onPress={() => router.push('/(home)/(dealer)/sales-history')}>
					<Ionicons name='stats-chart' size={24} color='white' />
					<Text style={styles.buttonText}>Sales History</Text>
				</TouchableOpacity>
			</View>
			<TouchableOpacity
				style={styles.profileButton}
				onPress={() => router.push('/(home)/(dealer)/profile')}>
				<Ionicons name='person' size={24} color='white' />
				<Text style={styles.buttonText}>Dealership Profile</Text>
			</TouchableOpacity>
			<Text style={styles.sectionTitle}>Recent Listings</Text>
			<FlatList
				data={recentListings}
				renderItem={({ item }) => (
					<View style={styles.listingItem}>
						<Text style={styles.listingText}>
							{item.year} {item.make} {item.model}
						</Text>
						<Text style={styles.listingPrice}>${item.price}</Text>
					</View>
				)}
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
	buttonContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 20
	},
	button: {
		backgroundColor: '#007AFF',
		flexDirection: 'row',
		alignItems: 'center',
		padding: 15,
		borderRadius: 10,
		flex: 1,
		marginHorizontal: 5
	},
	profileButton: {
		backgroundColor: '#4CAF50',
		flexDirection: 'row',
		alignItems: 'center',
		padding: 15,
		borderRadius: 10,
		marginBottom: 20
	},
	buttonText: {
		color: 'white',
		marginLeft: 10,
		fontSize: 16,
		fontWeight: 'bold'
	},
	sectionTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		marginBottom: 10
	},
	listingItem: {
		backgroundColor: 'white',
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: 15,
		borderRadius: 10,
		marginBottom: 10
	},
	listingText: {
		fontSize: 16
	},
	listingPrice: {
		fontSize: 16,
		fontWeight: 'bold',
		color: 'green'
	}
})
