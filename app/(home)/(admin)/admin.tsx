import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'

export default function AdminScreen() {
	return (
		<View style={styles.container}>
			<Text style={styles.title}>Admin Dashboard</Text>
			<TouchableOpacity style={styles.button}>
				<Text style={styles.buttonText}>Manage Users</Text>
			</TouchableOpacity>
			<TouchableOpacity style={styles.button}>
				<Text style={styles.buttonText}>Manage Listings</Text>
			</TouchableOpacity>
			<TouchableOpacity style={styles.button}>
				<Text style={styles.buttonText}>View Analytics</Text>
			</TouchableOpacity>
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
	button: {
		backgroundColor: '#007AFF',
		padding: 15,
		borderRadius: 5,
		marginBottom: 10
	},
	buttonText: {
		color: 'white',
		textAlign: 'center',
		fontWeight: 'bold'
	}
})
