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
import { Feather, Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import ThemeSwitch from '@/components/ThemeSwitch'
import { NotificationBell } from '@/components/NotificationBell'
import { useNotifications } from '@/hooks/useNotifications'
import { setIsSigningOut } from '@/app/(home)/_layout'

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
	const [isChangePasswordMode, setIsChangePasswordMode] = useState(false)
	const [currentPassword, setCurrentPassword] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const { cleanupPushToken } = useNotifications()

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

	const handleChangePassword = async () => {
		if (newPassword !== confirmPassword) {
			Alert.alert('Error', 'New passwords do not match')
			return
		}

		try {
			await user?.updatePassword({
				currentPassword,
				newPassword
			})
			Alert.alert('Success', 'Password changed successfully')
			setIsChangePasswordMode(false)
			setCurrentPassword('')
			setNewPassword('')
			setConfirmPassword('')
		} catch (error) {
			console.error('Error changing password:', error)
			Alert.alert('Error', 'Failed to change password')
		}
	}

	const handleSignOut = async () => {
		try {
			setIsSigningOut(true)

			// Clean up the push token
			await cleanupPushToken()

			// Sign out from Clerk
			await signOut()
		} catch (error) {
			console.error('Error during sign out:', error)
			Alert.alert('Error', 'Failed to sign out properly')
		} finally {
			// Ensure the flag is reset even if sign out fails
			setIsSigningOut(false)
		}
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
				className={`${
					isDarkMode ? 'bg-red' : 'bg-red'
				} pt-12 pb-8 rounded-b-3xl shadow-lg`}>
				<View className='flex-row justify-end px-4 mb-4'>
					<NotificationBell />
				</View>

				{/* Profile image section */}
				<View className='items-center'>
					<Image
						source={{ uri: user?.imageUrl }}
						className='w-36 h-36 rounded-full border-4 border-white mb-6'
					/>
					<TouchableOpacity
						className='bg-white px-6 py-3 rounded-full shadow-md'
						onPress={onPickImage}>
						<Text className='text-red font-semibold text-lg'>
							Change Picture
						</Text>
					</TouchableOpacity>
				</View>
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
						isDarkMode ? 'bg-gray' : 'bg-white'
					} rounded-2xl shadow-md p-6 mb-8`}>
					{isChangePasswordMode ? (
						<>
							<TextInput
								className={`${
									isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
								} p-4 rounded-xl mb-4 border border-red`}
								value={currentPassword}
								onChangeText={setCurrentPassword}
								placeholder='Current Password'
								placeholderTextColor='gray'
								secureTextEntry
								cursorColor='#D55004'
								autoComplete='password'
							/>
							<TextInput
								className={`${
									isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
								} p-4 rounded-xl mb-4 border border-red`}
								value={newPassword}
								onChangeText={setNewPassword}
								placeholder='New Password'
								placeholderTextColor='gray'
								secureTextEntry
								cursorColor='#D55004'
								autoComplete='password'
							/>
							<TextInput
								className={`${
									isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
								} p-4 rounded-xl mb-4 border border-red`}
								value={confirmPassword}
								onChangeText={setConfirmPassword}
								placeholder='Confirm New Password'
								placeholderTextColor='gray'
								secureTextEntry
								cursorColor='#D55004'
								autoComplete='password'
							/>
							<View className='flex-row justify-between mt-4'>
								<TouchableOpacity
									className='bg-pink-500 p-4 rounded-xl items-center flex-1 mr-2'
									onPress={() => setIsChangePasswordMode(false)}>
									<Text className='text-white font-bold text-lg'>Cancel</Text>
								</TouchableOpacity>
								<TouchableOpacity
									className='bg-green-600 p-4 rounded-xl items-center flex-1 ml-2'
									onPress={handleChangePassword}>
									<Text className='text-white font-bold text-lg'>Confirm</Text>
								</TouchableOpacity>
							</View>
						</>
					) : (
						<>
							<Text
								className={`${
									isDarkMode ? 'text-white' : 'text-gray'
								} text-sm font-semibold mb-2`}>
								First Name
							</Text>
							<TextInput
								className={`${
									isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
								} p-4 rounded-xl mb-4 border border-red`}
								value={firstName}
								onChangeText={setFirstName}
								placeholder='First Name'
								placeholderTextColor='gray'
								cursorColor='#D55004'
								autoComplete='name'
								autoCapitalize='words'
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
								} p-4 rounded-xl mb-4 border border-red`}
								value={lastName}
								onChangeText={setLastName}
								placeholder='Last Name'
								placeholderTextColor='gray'
								cursorColor='#D55004'
								autoComplete='name'
								autoCapitalize='words'
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
								} p-4 rounded-xl mb-4 border border-red`}
								value={email}
								placeholder='Email'
								keyboardType='email-address'
								editable={false}
								placeholderTextColor='gray'
								cursorColor='#D55004'
								autoComplete='email'
							/>
							<TouchableOpacity
								className='bg-red p-4 rounded-xl items-center mt-4'
								onPress={updateProfile}>
								<Text className='text-white font-bold text-xl'>
									Update Profile
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								className='bg-yellow-600 p-4 rounded-xl items-center mt-4 flex-row justify-center'
								onPress={() => setIsChangePasswordMode(true)}>
								<Ionicons
									name='key-outline'
									size={24}
									color='white'
									style={{ marginRight: 8 }}
								/>
								<Text className='text-white font-bold text-xl'>
									Change Password
								</Text>
							</TouchableOpacity>
						</>
					)}
				</View>

				<Text
					className={`text-3xl font-bold ${
						isDarkMode ? 'text-white' : 'text-black'
					} mb-6`}>
					Contact Support
				</Text>
				<View
					className={`${
						isDarkMode ? 'bg-gray' : 'bg-white'
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
							<Text className='text-blue-500'>
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
							<Text className='text-blue-500'>
								Detailed inquiries and feedback
							</Text>
						</View>
					</TouchableOpacity>
				</View>

				<View
					className={`border border-red rounded-2xl shadow-md p-6 mb-8 ${
						isDarkMode ? 'bg-gray' : 'bg-white'
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
					className='bg-rose-600  p-5 mb-24 rounded-xl items-center '
					onPress={handleSignOut}>
					<Text className='text-white font-bold text-xl'>Sign Out</Text>
				</TouchableOpacity>
			</View>
		</ScrollView>
	)
}
