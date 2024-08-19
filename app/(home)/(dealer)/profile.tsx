import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	Image,
	ScrollView,
	ActivityIndicator
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser, useAuth } from '@clerk/clerk-expo'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { Buffer } from 'buffer'

export default function DealershipProfilePage() {
	const { user } = useUser()
	const { signOut } = useAuth()
	const [dealership, setDealership] = useState<any>(null)
	const [name, setName] = useState('')
	const [location, setLocation] = useState('')
	const [phone, setPhone] = useState('')
	const [logo, setLogo] = useState('')
	const [isUploading, setIsUploading] = useState(false)

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
			setLogo(data.logo)
		}
	}

	const updateProfile = async () => {
		const { error } = await supabase
			.from('dealerships')
			.update({ name, location, phone, logo })
			.eq('id', dealership.id)

		if (!error) {
			alert('Profile updated successfully')
		}
	}

	const pickImage = async () => {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
		if (status !== 'granted') {
			alert('Sorry, we need camera roll permissions to make this work!')
			return
		}

		let result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsEditing: true,
			aspect: [1, 1],
			quality: 1
		})

		if (!result.canceled && result.assets && result.assets.length > 0) {
			setIsUploading(true)
			try {
				await handleImageUpload(result.assets[0].uri)
			} catch (error) {
				console.error('Error uploading image:', error)
				alert('Failed to upload image. Please try again.')
			} finally {
				setIsUploading(false)
			}
		}
	}

	const handleImageUpload = async (imageUri: string) => {
		if (!dealership) return

		try {
			const fileName = `${Date.now()}_${Math.random()
				.toString(36)
				.substring(7)}.jpg`
			const filePath = `${dealership.id}/${fileName}`

			const base64 = await FileSystem.readAsStringAsync(imageUri, {
				encoding: FileSystem.EncodingType.Base64
			})

			const { data, error } = await supabase.storage
				.from('logos')
				.upload(filePath, Buffer.from(base64, 'base64'), {
					contentType: 'image/jpeg'
				})

			if (error) throw error

			const { data: publicURLData } = supabase.storage
				.from('logos')
				.getPublicUrl(filePath)

			if (!publicURLData) throw new Error('Error getting public URL')

			setLogo(publicURLData.publicUrl)
			const { error: updateError } = await supabase
				.from('dealerships')
				.update({ logo: publicURLData.publicUrl })
				.eq('id', dealership.id)
		} catch (error: any) {
			console.error('Detailed error in handleImageUpload:', error)
			alert(`Failed to upload image: ${error.message}`)
		}
	}

	return (
		<ScrollView className='flex-1 bg-gray-100 p-4'>
			<View className='items-center mb-6'>
				<Image
					source={{ uri: logo || 'https://via.placeholder.com/150' }}
					className='w-36 h-36 rounded-full mb-4'
				/>
				<TouchableOpacity
					className='bg-red py-2 px-4 rounded-full'
					onPress={pickImage}
					disabled={isUploading}>
					{isUploading ? (
						<ActivityIndicator color='white' />
					) : (
						<Text className='text-white font-semibold'>Change Logo</Text>
					)}
				</TouchableOpacity>
			</View>

			<Text className='text-lg font-bold mb-2'>Dealership Name</Text>
			<TextInput
				className='bg-white p-3 rounded-lg mb-4'
				value={name}
				onChangeText={setName}
				placeholder='Dealership Name'
			/>

			<Text className='text-lg font-bold mb-2'>Location</Text>
			<TextInput
				className='bg-white p-3 rounded-lg mb-4'
				value={location}
				onChangeText={setLocation}
				placeholder='Location'
			/>

			<Text className='text-lg font-bold mb-2'>Phone</Text>
			<TextInput
				className='bg-white p-3 rounded-lg mb-4'
				value={phone}
				onChangeText={setPhone}
				placeholder='Phone'
				keyboardType='phone-pad'
			/>

			<Text className='text-lg font-bold mb-2'>Email</Text>
			<Text className='bg-white p-3 rounded-lg mb-4'>
				{user?.emailAddresses[0].emailAddress}
			</Text>

			<Text className='text-lg font-bold mb-2'>Subscription End Date</Text>
			<Text className='bg-white p-3 rounded-lg mb-6'>
				{dealership?.subscription_end_date
					? new Date(dealership.subscription_end_date).toLocaleDateString()
					: 'N/A'}
			</Text>

			<TouchableOpacity
				className='bg-red p-4 rounded-lg items-center mb-4'
				onPress={updateProfile}>
				<Text className='text-white font-bold text-lg'>Update Profile</Text>
			</TouchableOpacity>

			<TouchableOpacity
				className='bg-red-500 p-4 mb-12 rounded-lg items-center'
				onPress={() => signOut()}>
				<Text className='text-white font-bold text-lg'>Sign Out</Text>
			</TouchableOpacity>
		</ScrollView>
	)
}
