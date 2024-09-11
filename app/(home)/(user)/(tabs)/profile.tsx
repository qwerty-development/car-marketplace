import React, { useState, useEffect, useCallback } from 'react'
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	Image,
	ScrollView,
	Alert,
	Linking,
	Switch,
	RefreshControl
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser, useAuth } from '@clerk/clerk-expo'
import * as ImagePicker from 'expo-image-picker'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import ThemeSwitch from '@/components/ThemeSwitch'

const WHATSAPP_NUMBER = '+1234567890'
const SUPPORT_EMAIL = 'support@example.com'
const EMAIL_SUBJECT = 'Support Request'

export default function UserProfileAndSupportPage() {
	const { isDarkMode, toggleTheme } = useTheme()
	const { user } = useUser()
	const { signOut } = useAuth()
	const [firstName, setFirstName] = useState('')
	const [lastName, setLastName] = useState('')
	const [email, setEmail] = useState('')
	const [refreshing, setRefreshing] = useState(false)

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
	const onRefresh = useCallback(() => {
		setRefreshing(true)
		// Fetch updated user data
		if (user) {
			setFirstName(user.firstName || '')
			setLastName(user.lastName || '')
			setEmail(user.emailAddresses[0].emailAddress || '')
		}
		setRefreshing(false)
	}, [user])

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
		<ScrollView
			className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}
			refreshControl={
				<RefreshControl
					refreshing={refreshing}
					onRefresh={onRefresh}
					tintColor={isDarkMode ? '#ffffff' : '#000000'}
					colors={['#D55004']}
				/>
			}>
			<View
				className={`items-center ${
					isDarkMode ? 'bg-red' : 'bg-red'
				} pt-16 pb-8 rounded-b-3xl shadow-lg`}>
				<Image
					source={{ uri: user?.imageUrl }}
					className='w-36 h-36 rounded-full border-4 border-white mb-6'
				/>
				<TouchableOpacity
					className='bg-white px-6 py-3 rounded-full shadow-md'
					onPress={onPickImage}>
					<Text className='text-red-600 font-semibold text-lg'>
						Change Picture
					</Text>
				</TouchableOpacity>
			</View>

			<View className='px-6 mt-8'>
				<View className='flex-row justify-between items-center mb-6'>
					<Text
						className={`text-3xl font-bold ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
						Profile Information
					</Text>
					<ThemeSwitch />
				</View>
				<View
					className={`${
						isDarkMode ? 'bg-gray-900' : 'bg-gray-100'
					} rounded-2xl shadow-md p-6 mb-8`}>
					<Text
						className={`${
							isDarkMode ? 'text-white' : 'text-gray'
						} text-sm font-semibold mb-2`}>
						First Name
					</Text>
					<TextInput
						className={`${
							isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
						} p-4 rounded-xl mb-4`}
						value={firstName}
						onChangeText={setFirstName}
						placeholder='First Name'
						placeholderTextColor='gray'
					/>
					<Text
						className={`${
							isDarkMode ? 'text-white' : 'text-gray'
						} text-sm font-semibold mb-2`}>
						Last Name
					</Text>
					<TextInput
						className={`${
							isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
						} p-4 rounded-xl mb-4`}
						value={lastName}
						onChangeText={setLastName}
						placeholder='Last Name'
						placeholderTextColor='gray'
					/>
					<Text
						className={`${
							isDarkMode ? 'text-white' : 'text-gray'
						} text-sm font-semibold mb-2`}>
						Email
					</Text>
					<TextInput
						className={`${
							isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
						} p-4 rounded-xl mb-4`}
						value={email}
						placeholder='Email'
						keyboardType='email-address'
						editable={false}
						placeholderTextColor='gray'
					/>
					<TouchableOpacity
						className='bg-red p-4 rounded-xl items-center mt-4'
						onPress={updateProfile}>
						<Text className='text-white font-bold text-xl'>Update Profile</Text>
					</TouchableOpacity>
				</View>

				<Text
					className={`text-3xl font-bold ${
						isDarkMode ? 'text-white' : 'text-black'
					} mb-6`}>
					Contact Support
				</Text>
				<View
					className={`${
						isDarkMode ? 'bg-gray-900' : 'bg-gray-100'
					} rounded-2xl shadow-md p-6 mb-8`}>
					<TouchableOpacity
						className='flex-row items-center mb-6'
						onPress={openWhatsApp}>
						<View className='bg-green-500 p-4 rounded-full mr-5'>
							<Feather name='message-circle' size={28} color='white' />
						</View>
						<View>
							<Text
								className={`text-xl font-semibold ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								Chat on WhatsApp
							</Text>
							<Text className='text-gray-400'>
								Quick responses, 24/7 support
							</Text>
						</View>
					</TouchableOpacity>
					<TouchableOpacity
						className='flex-row items-center'
						onPress={openEmail}>
						<View className='bg-[#ff4343] p-4 rounded-full mr-5'>
							<Feather name='mail' size={28} color='white' />
						</View>
						<View>
							<Text
								className={`text-xl font-semibold ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								Send an Email
							</Text>
							<Text className='text-gray-400'>
								Detailed inquiries and feedback
							</Text>
						</View>
					</TouchableOpacity>
				</View>

				<View
					className={`border border-red rounded-2xl shadow-md p-6 mb-8 ${
						isDarkMode ? 'bg-gray-900' : 'bg-gray-100'
					}`}>
					<Text
						className={`text-xl font-semibold ${
							isDarkMode ? 'text-white' : 'text-black'
						} mb-4`}>
						Support Hours
					</Text>
					<Text className={`${isDarkMode ? 'text-white' : 'text-gray'}`}>
						Monday - Friday: 9AM - 6PM
					</Text>
					<Text className={`${isDarkMode ? 'text-white' : 'text-gray'}`}>
						Saturday: 10AM - 4PM
					</Text>
					<Text className={`${isDarkMode ? 'text-white' : 'text-gray'}`}>
						Sunday: Closed
					</Text>
				</View>

				<TouchableOpacity
					className='bg-[#FF000024]  p-5 mb-24 rounded-xl items-center '
					onPress={() => signOut()}>
					<Text className='text-white font-bold text-xl'>Sign Out</Text>
				</TouchableOpacity>
			</View>
		</ScrollView>
	)
}
