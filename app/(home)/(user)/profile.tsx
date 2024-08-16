import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	Image,
	ScrollView,
	Alert
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser, useAuth } from '@clerk/clerk-expo'
import * as ImagePicker from 'expo-image-picker'

export default function UserProfilePage() {
	const { user } = useUser()
	const { signOut } = useAuth()
	const [firstName, setFirstName] = useState('')
	const [lastName, setLastName] = useState('')
	const [email, setEmail] = useState('')

	useEffect(() => {
		if (user) {
			setFirstName(user.firstName || '')
			setLastName(user.lastName || '')
			setEmail(user.emailAddresses[0].emailAddress || '')
		}
	}, [user])

	const updateProfile = async () => {
		try {
			// Update Clerk profile
			await user?.update({
				firstName,
				lastName
			})

			// Update Supabase profile
			const fullName = `${firstName} ${lastName}`.trim()
			const { error: supabaseError } = await supabase
				.from('users')
				.update({ name: fullName })
				.eq('id', user?.id)

			if (supabaseError) throw supabaseError

			Alert.alert('Success', 'Profile updated successfully')
		} catch (error) {
			console.error('Error updating profile:', error)
			Alert.alert('Error', 'Failed to update profile')
		}
	}

	const onPickImage = async () => {
		try {
			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ImagePicker.MediaTypeOptions.Images,
				allowsEditing: true,
				aspect: [1, 1],
				quality: 0.1,
				base64: true
			})

			if (!result.canceled && result.assets[0].base64) {
				const base64 = result.assets[0].base64
				const mimeType = result.assets[0].mimeType || 'image/jpeg'
				const image = `data:${mimeType};base64,${base64}`

				await user?.setProfileImage({
					file: image
				})
				Alert.alert('Success', 'Profile picture updated successfully')
			}
		} catch (err: any) {
			console.error('Error updating profile picture:', err)
			Alert.alert(
				'Error',
				err.errors?.[0]?.message || 'Failed to update profile picture'
			)
		}
	}

	return (
		<ScrollView className='flex-1 bg-gray-100 p-4'>
			<View className='items-center mb-6'>
				<Image
					source={{ uri: user?.imageUrl }}
					className='w-32 h-32 rounded-full mb-4'
				/>
				<TouchableOpacity
					className='bg-blue-500 px-4 py-2 rounded-full'
					onPress={onPickImage}>
					<Text className='text-white font-semibold'>
						Change Profile Picture
					</Text>
				</TouchableOpacity>
			</View>

			<Text className='text-lg font-bold mb-2'>First Name</Text>
			<TextInput
				className='bg-white p-3 rounded-lg mb-4'
				value={firstName}
				onChangeText={setFirstName}
				placeholder='First Name'
			/>

			<Text className='text-lg font-bold mb-2'>Last Name</Text>
			<TextInput
				className='bg-white p-3 rounded-lg mb-4'
				value={lastName}
				onChangeText={setLastName}
				placeholder='Last Name'
			/>

			<Text className='text-lg font-bold mb-2'>Email</Text>
			<TextInput
				className='bg-white p-3 rounded-lg mb-4'
				value={email}
				placeholder='Email'
				keyboardType='email-address'
				editable={false}
			/>

			<TouchableOpacity
				className='bg-blue-500 p-4 rounded-lg items-center mb-4'
				onPress={updateProfile}>
				<Text className='text-white font-bold text-lg'>Update Profile</Text>
			</TouchableOpacity>

			<TouchableOpacity
				className='bg-red-500 p-4 rounded-lg items-center'
				onPress={() => signOut()}>
				<Text className='text-white font-bold text-lg'>Sign Out</Text>
			</TouchableOpacity>
		</ScrollView>
	)
}
