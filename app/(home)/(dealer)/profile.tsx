// app/(home)/(dealer)/profile.tsx
import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	Image,
	StyleSheet,
	ScrollView
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser, useAuth } from '@clerk/clerk-expo'
import * as ImagePicker from 'expo-image-picker'
import { ImagePickerAsset } from 'expo-image-picker'

function convertToBlob(asset: ImagePickerAsset): Blob {
	const data = asset.base64 ? atob(asset.base64) : ''
	const bytes = new Uint8Array(data.length)
	for (let i = 0; i < data.length; i++) {
		bytes[i] = data.charCodeAt(i)
	}
	const blob = new Blob([bytes.buffer], { type: asset.type })
	return blob
}

export default function DealershipProfilePage() {
	const { user } = useUser()
	const { signOut } = useAuth()
	const [dealership, setDealership] = useState<any>(null)
	const [name, setName] = useState('')
	const [location, setLocation] = useState('')
	const [phone, setPhone] = useState('')

	useEffect(() => {
		if (user) fetchDealershipProfile()
	}, [user])

	const fetchDealershipProfile = async () => {
		const { data, error } = await supabase
			.from('dealerships')
			.select('*')
			.eq('user_id', user?.id)
			.single()

		if (data) {
			setDealership(data)
			setName(data.name)
			setLocation(data.location)
			setPhone(data.phone)
		}
	}

	const updateProfile = async () => {
		const { error } = await supabase
			.from('dealerships')
			.update({ name, location, phone })
			.eq('id', dealership.id)

		if (!error) {
			alert('Profile updated successfully')
		}
	}

	const pickImage = async () => {
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsEditing: true,
			aspect: [4, 3],
			quality: 1
		})

		if (!result.canceled) {
			await user?.setProfileImage({ file: convertToBlob(result.assets[0]) })
		}
	}

	return (
		<ScrollView style={styles.container}>
			<View style={styles.profileImageContainer}>
				<Image source={{ uri: user?.imageUrl }} style={styles.profileImage} />
				<TouchableOpacity style={styles.changeImageButton} onPress={pickImage}>
					<Text style={styles.changeImageText}>Change Image</Text>
				</TouchableOpacity>
			</View>

			<Text style={styles.label}>Dealership Name</Text>
			<TextInput
				style={styles.input}
				value={name}
				onChangeText={setName}
				placeholder='Dealership Name'
			/>

			<Text style={styles.label}>Location</Text>
			<TextInput
				style={styles.input}
				value={location}
				onChangeText={setLocation}
				placeholder='Location'
			/>

			<Text style={styles.label}>Phone</Text>
			<TextInput
				style={styles.input}
				value={phone}
				onChangeText={setPhone}
				placeholder='Phone'
				keyboardType='phone-pad'
			/>

			<Text style={styles.label}>Email</Text>
			<Text style={styles.text}>{user?.emailAddresses[0].emailAddress}</Text>

			<Text style={styles.label}>Subscription End Date</Text>
			<Text style={styles.text}>
				{dealership?.subscription_end_date
					? new Date(dealership.subscription_end_date).toLocaleDateString()
					: 'N/A'}
			</Text>

			<TouchableOpacity style={styles.updateButton} onPress={updateProfile}>
				<Text style={styles.updateButtonText}>Update Profile</Text>
			</TouchableOpacity>

			<TouchableOpacity style={styles.signOutButton} onPress={() => signOut()}>
				<Text style={styles.signOutButtonText}>Sign Out</Text>
			</TouchableOpacity>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 20,
		backgroundColor: '#f5f5f5'
	},
	profileImageContainer: {
		alignItems: 'center',
		marginBottom: 20
	},
	profileImage: {
		width: 150,
		height: 150,
		borderRadius: 75
	},
	changeImageButton: {
		marginTop: 10
	},
	changeImageText: {
		color: '#007AFF',
		fontSize: 16
	},
	label: {
		fontSize: 16,
		fontWeight: 'bold',
		marginBottom: 5
	},
	input: {
		backgroundColor: 'white',
		padding: 10,
		borderRadius: 5,
		marginBottom: 15
	},
	text: {
		fontSize: 16,
		marginBottom: 15
	},
	updateButton: {
		backgroundColor: '#007AFF',
		padding: 15,
		borderRadius: 5,
		alignItems: 'center',
		marginTop: 20
	},
	updateButtonText: {
		color: 'white',
		fontSize: 16,
		fontWeight: 'bold'
	},
	signOutButton: {
		backgroundColor: '#FF3B30',
		padding: 15,
		borderRadius: 5,
		alignItems: 'center',
		marginTop: 20
	},
	signOutButtonText: {
		color: 'white',
		fontSize: 16,
		fontWeight: 'bold'
	}
})
