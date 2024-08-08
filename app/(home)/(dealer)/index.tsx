import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'

export default function DealerHomePage() {
	const router = useRouter()

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Dealer Dashboard</Text>
			<Text style={styles.subtitle}>Welcome to your dealership portal</Text>
			<TouchableOpacity
				style={styles.button}
				onPress={() => router.push('/(home)/(dealer)/dealership')}>
				<Text style={styles.buttonText}>Go to Dealership</Text>
			</TouchableOpacity>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#f5f5f5'
	},
	title: {
		fontSize: 24,
		fontWeight: 'bold',
		marginBottom: 10
	},
	subtitle: {
		fontSize: 16,
		color: '#666',
		marginBottom: 20
	},
	button: {
		backgroundColor: '#007AFF',
		paddingHorizontal: 20,
		paddingVertical: 10,
		borderRadius: 5
	},
	buttonText: {
		color: 'white',
		fontSize: 16,
		fontWeight: 'bold'
	}
})
