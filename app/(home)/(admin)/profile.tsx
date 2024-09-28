import React, { useState, useEffect, useCallback } from 'react'
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	Image,
	ScrollView,
	Alert,
	RefreshControl,
	Dimensions
} from 'react-native'
import { useUser, useClerk } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import { useTheme } from '@/utils/ThemeContext'
import ThemeSwitch from '@/components/ThemeSwitch'
import { Ionicons, MaterialIcons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as Clipboard from 'expo-clipboard'
import { LinearGradient } from 'expo-linear-gradient'

export default function AdminProfilePage() {
	const { user } = useUser()
	const clerk = useClerk()
	const router = useRouter()
	const { isDarkMode } = useTheme()
	const [refreshing, setRefreshing] = useState(false)
	const [adminInfo, setAdminInfo] = useState({
		firstName: '',
		lastName: '',
		email: '',
		role: 'Admin',
		lastLogin: new Date().toISOString()
	})
	const [isEditMode, setIsEditMode] = useState(false)

	useEffect(() => {
		if (user) {
			setAdminInfo({
				...adminInfo,
				firstName: user.firstName || '',
				lastName: user.lastName || '',
				email: user.emailAddresses[0].emailAddress || ''
			})
		}
	}, [user])

	const onRefresh = useCallback(() => {
		setRefreshing(true)
		// Fetch updated user data here if needed
		setRefreshing(false)
	}, [])

	const handleUpdateProfile = async () => {
		try {
			await user?.update({
				firstName: adminInfo.firstName,
				lastName: adminInfo.lastName
			})
			Alert.alert('Success', 'Profile updated successfully')
			setIsEditMode(false)
		} catch (error) {
			console.error('Error updating profile:', error)
			Alert.alert('Error', 'Failed to update profile')
		}
	}

	const handleImagePicker = async () => {
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsEditing: true,
			aspect: [1, 1],
			quality: 0.5
		})

		if (!result.canceled && result.assets[0].uri) {
			try {
				await user?.setProfileImage({ file: result.assets[0].uri })
				Alert.alert('Success', 'Profile picture updated successfully')
			} catch (error) {
				console.error('Error updating profile picture:', error)
				Alert.alert('Error', 'Failed to update profile picture')
			}
		}
	}

	const handleCopyUserId = async () => {
		if (user?.id) {
			await Clipboard.setStringAsync(user.id)
			Alert.alert('Success', 'User ID copied to clipboard')
		}
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
		<ScrollView
			className={`flex-1 ${isDarkMode ? 'bg-night' : 'bg-white'}`}
			refreshControl={
				<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
			}>
			<LinearGradient
				colors={isDarkMode ? ['#696969', '#D55004'] : ['#FF6B6B', '#FF8E53']}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}
				className='pt-16 pb-8 rounded-b-[40px] shadow-lg'>
				<TouchableOpacity onPress={handleImagePicker} className='items-center'>
					<Image
						source={{
							uri: user?.imageUrl || 'https://via.placeholder.com/150'
						}}
						className='w-36 h-36 rounded-full border-4 border-white mb-6'
					/>
					<View className='absolute bottom-5 right-[140px] bg-white rounded-full p-2'>
						<Ionicons name='camera' size={24} color='#FF6B6B' />
					</View>
				</TouchableOpacity>
				<Text className='text-white text-2xl font-bold text-center mt-4'>
					{adminInfo.firstName} {adminInfo.lastName}
				</Text>
				<Text className='text-white text-lg text-center'>{adminInfo.role}</Text>
			</LinearGradient>

			<View className='px-6 mt-8'>
				<View className='flex-row justify-between items-center mb-6'>
					<Text
						className={`text-3xl font-bold ${
							isDarkMode ? 'text-white' : 'text-gray'
						}`}>
						Admin Profile
					</Text>
					<ThemeSwitch />
				</View>

				<View
					className={`${
						isDarkMode ? 'bg-gray' : 'bg-white'
					} rounded-3xl shadow-lg p-6 mb-8`}>
					{isEditMode ? (
						<>
							<TextInput
								className={`${
									isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
								} p-4 rounded-xl mb-4`}
								value={adminInfo.firstName}
								onChangeText={text =>
									setAdminInfo({ ...adminInfo, firstName: text })
								}
								placeholder='First Name'
								placeholderTextColor={isDarkMode ? 'gray' : 'darkgray'}
							/>
							<TextInput
								className={`${
									isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
								} p-4 rounded-xl mb-4`}
								value={adminInfo.lastName}
								onChangeText={text =>
									setAdminInfo({ ...adminInfo, lastName: text })
								}
								placeholder='Last Name'
								placeholderTextColor={isDarkMode ? 'gray' : 'darkgray'}
							/>
							<View className='flex-row justify-between mt-4'>
								<TouchableOpacity
									className='bg-pink-500 p-4 rounded-xl items-center flex-1 mr-2'
									onPress={() => setIsEditMode(false)}>
									<Text className='text-white font-bold text-lg'>Cancel</Text>
								</TouchableOpacity>
								<TouchableOpacity
									className='bg-green-600 p-4 rounded-xl items-center flex-1 ml-2'
									onPress={handleUpdateProfile}>
									<Text className='text-white font-bold text-lg'>Save</Text>
								</TouchableOpacity>
							</View>
						</>
					) : (
						<>
							<View className='flex-row justify-between items-center mb-4'>
								<Text className={`${isDarkMode ? 'text-white' : 'text-gray'}`}>
									First Name
								</Text>
								<Text
									className={`${
										isDarkMode ? 'text-red' : 'text-red'
									} font-semibold`}>
									{adminInfo.firstName}
								</Text>
							</View>
							<View className='flex-row justify-between items-center mb-4'>
								<Text className={`${isDarkMode ? 'text-white' : 'text-gray'}`}>
									Last Name
								</Text>
								<Text
									className={`${
										isDarkMode ? 'text-red' : 'text-red'
									} font-semibold`}>
									{adminInfo.lastName}
								</Text>
							</View>
							<View className='flex-row justify-between items-center mb-4'>
								<Text className={`${isDarkMode ? 'text-white' : 'text-gray'}`}>
									Email
								</Text>
								<Text
									className={`${
										isDarkMode ? 'text-red' : 'text-red'
									} font-semibold`}>
									{adminInfo.email}
								</Text>
							</View>
							<View className='flex-row justify-between items-center mb-4'>
								<Text className={`${isDarkMode ? 'text-white' : 'text-gray'}`}>
									Last Login
								</Text>
								<Text
									className={`${
										isDarkMode ? 'text-red' : 'text-red'
									} font-semibold`}>
									{new Date(adminInfo.lastLogin).toLocaleString()}
								</Text>
							</View>
							<TouchableOpacity
								className='bg-blue-600 p-4 rounded-xl items-center mt-4'
								onPress={() => setIsEditMode(true)}>
								<Text className='text-white font-bold text-lg'>
									Edit Profile
								</Text>
							</TouchableOpacity>
						</>
					)}
				</View>

				<View
					className={`${
						isDarkMode ? 'bg-gray' : 'bg-white'
					} rounded-3xl shadow-lg p-6 mb-8`}>
					<TouchableOpacity
						className='flex-row items-center justify-between mb-4 bg-yellow-300 p-4 rounded-xl'
						onPress={handleCopyUserId}>
						<View className='flex-row items-center'>
							<MaterialIcons name='content-copy' size={24} color='#FF6B6B' />
							<Text
								className={`${
									isDarkMode ? 'text-red' : 'text-red'
								} text-lg ml-4`}>
								Copy User ID
							</Text>
						</View>
						<Ionicons
							name='chevron-forward'
							size={24}
							color={isDarkMode ? 'white' : 'black'}
						/>
					</TouchableOpacity>
					<TouchableOpacity
						className='flex-row items-center justify-between bg-rose-500 p-4 rounded-xl'
						onPress={handleSignOut}>
						<View className='flex-row items-center'>
							<MaterialIcons name='logout' size={24} color='#FFFFFF' />
							<Text className='text-white text-lg ml-4'>Sign Out</Text>
						</View>
						<Ionicons name='chevron-forward' size={24} color='#FFFFFF' />
					</TouchableOpacity>
				</View>
			</View>
		</ScrollView>
	)
}
