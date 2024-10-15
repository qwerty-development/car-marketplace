import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	Image,
	ScrollView,
	Alert,
	RefreshControl,
	ActivityIndicator,
	Dimensions,
	Platform
} from 'react-native'
import { useUser, useClerk } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import { useTheme } from '@/utils/ThemeContext'
import ThemeSwitch from '@/components/ThemeSwitch'
import { Ionicons, MaterialIcons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as Clipboard from 'expo-clipboard'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'

const { width } = Dimensions.get('window')

const AdminProfilePage = () => {
	const { user } = useUser()
	const clerk = useClerk()
	const router = useRouter()
	const { isDarkMode } = useTheme()
	const [refreshing, setRefreshing] = useState(false)
	const [loading, setLoading] = useState(false)
	const [adminInfo, setAdminInfo] = useState({
		firstName: '',
		lastName: '',
		email: '',
		role: 'Admin',
		lastLogin: new Date().toISOString()
	})
	const [isEditMode, setIsEditMode] = useState(false)
	const [isChangePasswordMode, setIsChangePasswordMode] = useState(false)
	const [currentPassword, setCurrentPassword] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')

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

	const onRefresh = useCallback(async () => {
		setRefreshing(true)
		try {
			await user?.reload()
			setAdminInfo({
				...adminInfo,
				firstName: user?.firstName || '',
				lastName: user?.lastName || '',
				email: user?.emailAddresses[0].emailAddress || ''
			})
		} catch (error) {
			console.error('Error refreshing user data:', error)
			Alert.alert(
				'Refresh Failed',
				'Unable to refresh user data. Please try again.'
			)
		} finally {
			setRefreshing(false)
		}
	}, [user])

	const handleUpdateProfile = useCallback(async () => {
		setLoading(true)
		try {
			await user?.update({
				firstName: adminInfo.firstName,
				lastName: adminInfo.lastName
			})
			Alert.alert('Success', 'Profile updated successfully')
			setIsEditMode(false)
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
		} catch (error) {
			console.error('Error updating profile:', error)
			Alert.alert(
				'Update Failed',
				'Failed to update profile. Please check your connection and try again.'
			)
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
		} finally {
			setLoading(false)
		}
	}, [user, adminInfo])

	const handleImagePicker = useCallback(async () => {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
		if (status !== 'granted') {
			Alert.alert(
				'Permission Denied',
				'Sorry, we need camera roll permissions to update your profile picture.'
			)
			return
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsEditing: true,
			aspect: [1, 1],
			quality: 0.5
		})

		if (!result.canceled && result.assets[0].uri) {
			setLoading(true)
			try {
				await user?.setProfileImage({ file: result.assets[0].uri })
				Alert.alert('Success', 'Profile picture updated successfully')
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
			} catch (error) {
				console.error('Error updating profile picture:', error)
				Alert.alert(
					'Update Failed',
					'Failed to update profile picture. Please try again.'
				)
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
			} finally {
				setLoading(false)
			}
		}
	}, [user])

	const handleSignOut = useCallback(async () => {
		try {
			await clerk.signOut()
			router.replace('/(auth)/sign-in')
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
		} catch (error) {
			console.error('Error signing out:', error)
			Alert.alert('Sign Out Failed', 'Unable to sign out. Please try again.')
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
		}
	}, [clerk, router])

	const handleChangePassword = useCallback(async () => {
		if (newPassword !== confirmPassword) {
			Alert.alert('Error', 'New passwords do not match')
			return
		}

		setLoading(true)
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
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
		} catch (error) {
			console.error('Error changing password:', error)
			Alert.alert(
				'Password Change Failed',
				'Failed to change password. Please check your current password and try again.'
			)
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
		} finally {
			setLoading(false)
		}
	}, [user, currentPassword, newPassword, confirmPassword])

	const ProfileImage = useMemo(
		() => (
			<TouchableOpacity onPress={handleImagePicker} className='items-center'>
				<Image
					source={{
						uri: user?.imageUrl || 'https://via.placeholder.com/150'
					}}
					className='w-36 h-36 rounded-full border-4 border-white mb-6'
				/>
				<BlurView
					intensity={80}
					className='absolute bottom-5 right-[140px] bg-white rounded-full p-2'>
					<Ionicons name='camera' size={24} color='#FF6B6B' />
				</BlurView>
			</TouchableOpacity>
		),
		[user?.imageUrl, handleImagePicker]
	)

	const renderContent = () => {
		if (isEditMode) {
			return (
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
			)
		} else if (isChangePasswordMode) {
			return (
				<>
					<TextInput
						className={`${
							isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
						} p-4 rounded-xl mb-4`}
						value={currentPassword}
						onChangeText={setCurrentPassword}
						placeholder='Current Password'
						placeholderTextColor={isDarkMode ? 'gray' : 'darkgray'}
						secureTextEntry
					/>
					<TextInput
						className={`${
							isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
						} p-4 rounded-xl mb-4`}
						value={newPassword}
						onChangeText={setNewPassword}
						placeholder='New Password'
						placeholderTextColor={isDarkMode ? 'gray' : 'darkgray'}
						secureTextEntry
					/>
					<TextInput
						className={`${
							isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
						} p-4 rounded-xl mb-4`}
						value={confirmPassword}
						onChangeText={setConfirmPassword}
						placeholder='Confirm New Password'
						placeholderTextColor={isDarkMode ? 'gray' : 'darkgray'}
						secureTextEntry
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
			)
		} else {
			return (
				<>
					<View className='border border-red rounded-lg'>
						<InfoRow label='First Name' value={adminInfo.firstName} />
						<InfoRow label='Last Name' value={adminInfo.lastName} />
						<InfoRow label='Email' value={adminInfo.email} />
						<InfoRow
							label='Last Login'
							value={new Date(adminInfo.lastLogin).toLocaleString()}
						/>
					</View>
					<TouchableOpacity
						className='bg-blue-600 p-4 rounded-xl items-center mt-4'
						onPress={() => setIsEditMode(true)}>
						<Text className='text-white font-bold text-lg'>Edit Profile</Text>
					</TouchableOpacity>
					<TouchableOpacity
						className='bg-yellow-600 p-4 rounded-xl items-center mt-4'
						onPress={() => setIsChangePasswordMode(true)}>
						<Text className='text-white font-bold text-lg'>
							Change Password
						</Text>
					</TouchableOpacity>
				</>
			)
		}
	}

	const InfoRow = useMemo(
		() =>
			({ label, value }: any) =>
				(
					<View className='flex-row justify-between items-center mb-4 border-b p-2 w-full  border-gray'>
						<Text className={`${isDarkMode ? 'text-white' : 'text-gray'}`}>
							{label}
						</Text>
						<Text
							className={`${
								isDarkMode ? 'text-red' : 'text-red'
							} font-semibold`}>
							{value}
						</Text>
					</View>
				),
		[isDarkMode]
	)

	return (
		<ScrollView
			className={`flex-1 ${isDarkMode ? 'bg-night' : 'bg-white'} mb-10`}
			refreshControl={
				<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
			}>
			<LinearGradient
				colors={isDarkMode ? ['#696969', '#D55004'] : ['#FF6B6B', '#FF8E53']}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}
				className='pt-16 pb-8 rounded-b-[40px] shadow-lg'>
				{ProfileImage}
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

				<BlurView
					intensity={100}
					tint={isDarkMode ? 'dark' : 'light'}
					className={`rounded-3xl shadow-lg p-6 mb-8`}>
					{renderContent()}
				</BlurView>

				<TouchableOpacity
					className='flex-row items-center justify-between bg-rose-500 p-4 rounded-xl mb-5'
					onPress={handleSignOut}>
					<View className='flex-row items-center'>
						<MaterialIcons name='logout' size={24} color='#FFFFFF' />
						<Text className='text-white text-lg ml-4'>Sign Out</Text>
					</View>
					<Ionicons name='chevron-forward' size={24} color='#FFFFFF' />
				</TouchableOpacity>
			</View>

			{loading && (
				<BlurView
					intensity={100}
					tint={isDarkMode ? 'dark' : 'light'}
					className='absolute inset-0 flex justify-center items-center'>
					<ActivityIndicator size='large' color='#D55004' />
				</BlurView>
			)}
		</ScrollView>
	)
}

export default React.memo(AdminProfilePage)
