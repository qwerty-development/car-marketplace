// app/(home)/profile.tsx
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

export default function UserProfilePage() {
	const { user } = useUser()
	const { signOut } = useAuth()
	const [name, setName] = useState('')
	const [email, setEmail] = useState('')
	const [phone, setPhone] = useState('')

	useEffect(() => {
		if (user) fetchUserProfile()
	}, [user])

	const fetchUserProfile = async () => {
		const { data, error } = await supabase
			.from('users')
			.select('*')
			.eq('id', user?.id)
			.single()

		if (data) {
			setName(data.name || '')
			setEmail(user?.emailAddresses[0].emailAddress || '')
			setPhone(data.phone || '')
		}
	}

	const updateProfile = async () => {
		const { error: supabaseError } = await supabase
			.from('users')
			.update({ name, phone })
			.eq('id', user?.id)

		if (supabaseError) {
			alert('Error updating Supabase profile')
			return
		}

		try {
			await user?.update({
				firstName: name.split(' ')[0],
				lastName: name.split(' ').slice(1).join(' ')
			})
			alert('Profile updated successfully')
		} catch (error) {
			alert('Error updating Clerk profile')
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
			try {
				await user?.setProfileImage({ file: convertToBlob(result.assets[0]) })
				alert('Profile picture updated successfully')
			} catch (error) {
				alert('Error updating profile picture')
			}
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

			<Text style={styles.label}>Full Name</Text>
			<TextInput
				style={styles.input}
				value={name}
				onChangeText={setName}
				placeholder='Full Name'
			/>

			<Text style={styles.label}>Email</Text>
			<TextInput
				style={styles.input}
				value={email}
				onChangeText={setEmail}
				placeholder='Email'
				keyboardType='email-address'
				editable={false}
			/>

			<Text style={styles.label}>Phone</Text>
			<TextInput
				style={styles.input}
				value={phone}
				onChangeText={setPhone}
				placeholder='Phone'
				keyboardType='phone-pad'
			/>

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
