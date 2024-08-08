import React from 'react'
import { View, Text, StyleSheet, FlatList } from 'react-native'

const dummyCars = [
	{ id: '1', make: 'Toyota', model: 'Camry', year: 2022, status: 'Active' },
	{ id: '2', make: 'Honda', model: 'Civic', year: 2023, status: 'Pending' },
	{ id: '3', make: 'Ford', model: 'Mustang', year: 2021, status: 'Sold' }
]

export default function AdminBrowseScreen() {
	return (
		<View style={styles.container}>
			<Text style={styles.title}>Manage Listings</Text>
			<FlatList
				data={dummyCars}
				keyExtractor={item => item.id}
				renderItem={({ item }) => (
					<View style={styles.carItem}>
						<Text>
							{item.year} {item.make} {item.model}
						</Text>
						<Text style={styles.status}>Status: {item.status}</Text>
					</View>
				)}
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
	carItem: {
		backgroundColor: 'white',
		padding: 15,
		borderRadius: 5,
		marginBottom: 10
	},
	status: {
		color: '#666',
		marginTop: 5
	}
})
