import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	Image,
	ScrollView,
	Alert,
	Linking
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser, useAuth } from '@clerk/clerk-expo'
import * as ImagePicker from 'expo-image-picker'
import { Feather } from '@expo/vector-icons'

const WHATSAPP_NUMBER = '+1234567890'
const SUPPORT_EMAIL = 'support@example.com'
const EMAIL_SUBJECT = 'Support Request'

export default function UserProfileAndSupportPage() {
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
			await user?.update({ firstName, lastName })
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
				await user?.setProfileImage({ file: image })
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

	const openWhatsApp = () => {
		let url = `whatsapp://send?phone=${WHATSAPP_NUMBER}`
		Linking.canOpenURL(url).then(supported => {
			if (supported) {
				return Linking.openURL(url)
			} else {
				return Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}`)
			}
		})
	}

	const openEmail = () => {
		const subject = encodeURIComponent(EMAIL_SUBJECT)
		Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`)
	}

	return (
		<ScrollView className='flex-1 bg-gray-100'>
			<View className='items-center bg-blue-500 pt-12 pb-6 rounded-b-3xl shadow-lg'>
				<Image
					source={{ uri: user?.imageUrl }}
					className='w-32 h-32 rounded-full border-4 border-white mb-4'
				/>
				<TouchableOpacity
					className='bg-white px-4 py-2 rounded-full shadow-md'
					onPress={onPickImage}>
					<Text className='text-blue-500 font-semibold'>Change Picture</Text>
				</TouchableOpacity>
			</View>

			<View className='px-4 mt-6'>
				<Text className='text-2xl font-bold text-gray-800 mb-4'>
					Profile Information
				</Text>
				<View className='bg-white rounded-xl shadow-md p-4 mb-4'>
					<Text className='text-sm font-semibold text-gray-600 mb-1'>
						First Name
					</Text>
					<TextInput
						className='bg-gray-100 p-3 rounded-lg mb-3'
						value={firstName}
						onChangeText={setFirstName}
						placeholder='First Name'
					/>
					<Text className='text-sm font-semibold text-gray-600 mb-1'>
						Last Name
					</Text>
					<TextInput
						className='bg-gray-100 p-3 rounded-lg mb-3'
						value={lastName}
						onChangeText={setLastName}
						placeholder='Last Name'
					/>
					<Text className='text-sm font-semibold text-gray-600 mb-1'>
						Email
					</Text>
					<TextInput
						className='bg-gray-100 p-3 rounded-lg mb-3'
						value={email}
						placeholder='Email'
						keyboardType='email-address'
						editable={false}
					/>
					<TouchableOpacity
						className='bg-blue-500 p-4 rounded-lg items-center mt-2'
						onPress={updateProfile}>
						<Text className='text-white font-bold text-lg'>Update Profile</Text>
					</TouchableOpacity>
				</View>

				<Text className='text-2xl font-bold text-gray-800 mb-4'>
					Contact Support
				</Text>
				<View className='bg-white rounded-xl shadow-md p-4 mb-4'>
					<TouchableOpacity
						className='flex-row items-center mb-4'
						onPress={openWhatsApp}>
						<View className='bg-green-500 p-3 rounded-full mr-4'>
							<Feather name='message-circle' size={24} color='white' />
						</View>
						<View>
							<Text className='text-lg font-semibold'>Chat on WhatsApp</Text>
							<Text className='text-gray-600'>
								Quick responses, 24/7 support
							</Text>
						</View>
					</TouchableOpacity>
					<TouchableOpacity
						className='flex-row items-center'
						onPress={openEmail}>
						<View className='bg-red-500 p-3 rounded-full mr-4'>
							<Feather name='mail' size={24} color='white' />
						</View>
						<View>
							<Text className='text-lg font-semibold'>Send an Email</Text>
							<Text className='text-gray-600'>
								Detailed inquiries and feedback
							</Text>
						</View>
					</TouchableOpacity>
				</View>

				<View className='bg-white rounded-xl shadow-md p-4 mb-6'>
					<Text className='text-lg font-semibold mb-2'>Support Hours</Text>
					<Text className='text-gray-600'>Monday - Friday: 9AM - 6PM</Text>
					<Text className='text-gray-600'>Saturday: 10AM - 4PM</Text>
					<Text className='text-gray-600'>Sunday: Closed</Text>
				</View>

				<TouchableOpacity
					className='bg-red-500 p-4 rounded-lg items-center mb-8'
					onPress={() => signOut()}>
					<Text className='text-white font-bold text-lg'>Sign Out</Text>
				</TouchableOpacity>
			</View>
		</ScrollView>
	)
}
