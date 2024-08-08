import React, { useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { useUser, useClerk } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import { supabase } from '@/utils/supabase'

export default async function ProfilePage() {
	const { user } = useUser()
	const clerk = useClerk()
	const router = useRouter()

	useEffect(() => {
		fetchData()
	}, [])

	async function fetchData() {
		const { data } = await supabase.from('cars').select('*')
		console.log(data)
	}

	const handleManageAccount = () => {
		// Here you would typically open a web browser to Clerk's user management page
		// For this example, we'll just show an alert
		Alert.alert(
			'Manage Account',
			'This would typically open your account management page in a web browser.'
		)
	}

	const handleSignOut = async () => {
		try {
			await clerk.signOut()
			router.replace('/(auth)/sign-in')
		} catch (error) {
			console.error('Error signing out:', error)
		}
	}

	return (
		<View style={styles.container}>
			<Text style={styles.header}>User Profile</Text>

			<View style={styles.userInfo}>
				<Text style={styles.label}>Email:</Text>
				<Text style={styles.value}>{user?.emailAddresses[0].emailAddress}</Text>
			</View>

			<View style={styles.userInfo}>
				<Text style={styles.label}>Name:</Text>
				<Text style={styles.value}>{user?.fullName}</Text>
			</View>

			<View style={styles.buttonContainer}>
				<TouchableOpacity style={styles.button} onPress={handleManageAccount}>
					<Text style={styles.buttonText}>Manage Account</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={[styles.button, styles.signOutButton]}
					onPress={handleSignOut}>
					<Text style={styles.buttonText}>Sign Out</Text>
				</TouchableOpacity>
			</View>

			<Text style={styles.instructions}>
				Use the buttons above to manage your account or sign out.
			</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 20,
		backgroundColor: '#f5f5f5'
	},
	header: {
		fontSize: 24,
		fontWeight: 'bold',
		marginBottom: 20
	},
	userInfo: {
		flexDirection: 'row',
		marginBottom: 10
	},
	label: {
		fontWeight: 'bold',
		width: 80
	},
	value: {
		flex: 1
	},
	buttonContainer: {
		marginTop: 30,
		marginBottom: 20
	},
	button: {
		backgroundColor: '#007AFF',
		padding: 15,
		borderRadius: 5,
		alignItems: 'center',
		marginBottom: 10
	},
	signOutButton: {
		backgroundColor: '#FF3B30'
	},
	buttonText: {
		color: 'white',
		fontSize: 16,
		fontWeight: 'bold'
	},
	instructions: {
		textAlign: 'center',
		color: '#666',
		marginTop: 10
	}
})
