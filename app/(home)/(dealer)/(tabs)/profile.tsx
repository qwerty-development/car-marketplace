import 'react-native-get-random-values'
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	Image,
	ScrollView,
	ActivityIndicator,
	Alert,
	StatusBar,
	Modal,
	RefreshControl,
	KeyboardAvoidingView,
	Platform
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser, useAuth } from '@clerk/clerk-expo'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import * as Location from 'expo-location'
import MapView, { Marker } from 'react-native-maps'
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete'
import { useTheme } from '@/utils/ThemeContext'
import ThemeSwitch from '@/components/ThemeSwitch'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'

const CustomHeader = React.memo(({ title }: { title: string }) => {
	const { isDarkMode } = useTheme()
	return (
		<SafeAreaView
			edges={['top']}
			className={`${isDarkMode ? 'bg-black' : 'bg-white'} border-b border-red`}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View className='flex-row items-center justify-center py-4'>
				<Text className='text-xl font-bold text-red'>{title}</Text>
			</View>
		</SafeAreaView>
	)
})

const SUBSCRIPTION_WARNING_DAYS = 7

export default function DealershipProfilePage() {
	const { isDarkMode } = useTheme()
	const { user } = useUser()
	const { signOut } = useAuth()
	const router = useRouter()
	const [dealership, setDealership] = useState<any>(null)
	const [formData, setFormData] = useState({
		name: '',
		location: '',
		phone: '',
		logo: '',
		latitude: '',
		longitude: ''
	})
	const [isUploading, setIsUploading] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [mapVisible, setMapVisible] = useState(false)
	const [selectedLocation, setSelectedLocation] = useState<{
		latitude: number
		longitude: number
	} | null>(null)
	const [refreshing, setRefreshing] = useState(false)
	const [isChangePasswordMode, setIsChangePasswordMode] = useState(false)
	const [passwordData, setPasswordData] = useState({
		currentPassword: '',
		newPassword: '',
		confirmPassword: ''
	})
	const [mapRegion, setMapRegion] = useState({
		latitude: 33.8547, // Beirut, Lebanon latitude
		longitude: 35.8623, // Beirut, Lebanon longitude
		latitudeDelta: 2, // Increased to show more of Lebanon
		longitudeDelta: 2
	})
	const mapRef = useRef<MapView | null>(null)

	const isSubscriptionValid = useCallback(() => {
		if (!dealership || !dealership.subscription_end_date) return false
		const endDate = new Date(dealership.subscription_end_date)
		return endDate > new Date()
	}, [dealership])

	const getDaysUntilExpiration = useCallback(() => {
		if (!dealership || !dealership.subscription_end_date) return
		const endDate = new Date(dealership.subscription_end_date)
		const today = new Date()
		const diffTime = endDate.getTime() - today.getTime()
		return Math.ceil(diffTime / (1000 * 3600 * 24))
	}, [dealership])

	const daysUntilExpiration = getDaysUntilExpiration()
	const showWarning =
		daysUntilExpiration <= SUBSCRIPTION_WARNING_DAYS && daysUntilExpiration > 0
	const subscriptionExpired = !isSubscriptionValid()

	useEffect(() => {
		;(async () => {
			let { status } = await Location.requestForegroundPermissionsAsync()
			if (status !== 'granted') {
				console.log('Permission to access location was denied')
				return
			}

			let location = await Location.getCurrentPositionAsync({})
			setMapRegion({
				latitude: location.coords.latitude,
				longitude: location.coords.longitude,
				latitudeDelta: 0.0922,
				longitudeDelta: 0.0421
			})
			setSelectedLocation({
				latitude: location.coords.latitude,
				longitude: location.coords.longitude
			})
		})()
	}, [])

	const getLocation = useCallback(async () => {
		const { status } = await Location.requestForegroundPermissionsAsync()
		if (status !== 'granted') {
			Alert.alert(
				'Permission Denied',
				'Please allow access to your location to use this feature.'
			)
			return
		}

		const location = await Location.getCurrentPositionAsync({})
		setFormData(prev => ({
			...prev,
			latitude: location.coords.latitude.toString(),
			longitude: location.coords.longitude.toString()
		}))
		setSelectedLocation({
			latitude: location.coords.latitude,
			longitude: location.coords.longitude
		})
	}, [])

	const openMap = useCallback(() => setMapVisible(true), [])
	const closeMap = useCallback(() => {
		setMapVisible(false)
		setSelectedLocation(null)
	}, [])

	const selectLocation = useCallback((details: any) => {
		if (details && details.geometry && details.geometry.location) {
			const { lat, lng } = details.geometry.location
			const newRegion = {
				latitude: lat,
				longitude: lng,
				latitudeDelta: 0.0922,
				longitudeDelta: 0.0421
			}
			setSelectedLocation({ latitude: lat, longitude: lng })
			setMapRegion(newRegion)
			mapRef.current?.animateToRegion(newRegion, 1000)
		}
	}, [])

	const handleMapPress = useCallback((e: any) => {
		const { latitude, longitude } = e.nativeEvent.coordinate
		const newRegion = {
			latitude,
			longitude,
			latitudeDelta: 0.0922,
			longitudeDelta: 0.0421
		}
		setSelectedLocation({ latitude, longitude })
		setMapRegion(newRegion)
		mapRef.current?.animateToRegion(newRegion, 1000)
	}, [])

	const confirmLocation = useCallback(() => {
		if (selectedLocation) {
			setFormData(prev => ({
				...prev,
				latitude: selectedLocation.latitude.toString(),
				longitude: selectedLocation.longitude.toString(),
				location: 'Custom Location'
			}))
		}
		closeMap()
	}, [selectedLocation, closeMap])

	const fetchDealershipProfile = useCallback(async () => {
		if (!user) return
		setIsLoading(true)
		setError(null)
		try {
			const { data, error } = await supabase
				.from('dealerships')
				.select('*')
				.eq('user_id', user.id)
				.single()

			if (error) throw error

			if (data) {
				setDealership(data)
				setFormData({
					name: data.name,
					location: data.location,
					phone: data.phone,
					logo: data.logo,
					latitude: data.latitude ? data.latitude.toString() : '',
					longitude: data.longitude ? data.longitude.toString() : ''
				})
			}
		} catch (error: any) {
			setError(error.message)
		} finally {
			setIsLoading(false)
		}
	}, [user])

	useEffect(() => {
		fetchDealershipProfile()
	}, [fetchDealershipProfile])

	const onRefresh = useCallback(() => {
		setRefreshing(true)
		fetchDealershipProfile().then(() => setRefreshing(false))
	}, [fetchDealershipProfile])

	const updateProfile = useCallback(async () => {
		setIsLoading(true)
		setError(null)
		try {
			const { error } = await supabase
				.from('dealerships')
				.update({
					name: formData.name,
					location: formData.location,
					phone: formData.phone,
					logo: formData.logo,
					latitude: parseFloat(formData.latitude) || null,
					longitude: parseFloat(formData.longitude) || null
				})
				.eq('id', dealership.id)

			if (error) throw error

			Alert.alert('Success', 'Profile updated successfully')
		} catch (error: any) {
			setError(`Failed to update profile: ${error.message}`)
		} finally {
			setIsLoading(false)
		}
	}, [formData, dealership])

	const pickImage = useCallback(async () => {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
		if (status !== 'granted') {
			Alert.alert(
				'Permission Denied',
				'We need access to your photos to update your logo.'
			)
			return
		}

		const result = await ImagePicker.launchImageLibraryAsync({
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
				Alert.alert('Error', 'Failed to upload image. Please try again.')
			} finally {
				setIsUploading(false)
			}
		}
	}, [])

	const handleImageUpload = useCallback(
		async (imageUri: string) => {
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

				setFormData(prev => ({ ...prev, logo: publicURLData.publicUrl }))
				await supabase
					.from('dealerships')
					.update({ logo: publicURLData.publicUrl })
					.eq('id', dealership.id)

				Alert.alert('Success', 'Logo updated successfully')
			} catch (error: any) {
				console.error('Detailed error in handleImageUpload:', error)
				Alert.alert('Error', `Failed to upload image: ${error.message}`)
			}
		},
		[dealership]
	)

	const navigateToAnalytics = useCallback(() => {
		router.push('/analytics')
	}, [router])

	const handleChangePassword = useCallback(async () => {
		if (passwordData.newPassword !== passwordData.confirmPassword) {
			Alert.alert('Error', 'New passwords do not match')
			return
		}

		try {
			await user?.updatePassword({
				currentPassword: passwordData.currentPassword,
				newPassword: passwordData.newPassword
			})
			Alert.alert('Success', 'Password changed successfully')
			setIsChangePasswordMode(false)
			setPasswordData({
				currentPassword: '',
				newPassword: '',
				confirmPassword: ''
			})
		} catch (error) {
			console.error('Error changing password:', error)
			Alert.alert('Error', 'Failed to change password')
		}
	}, [passwordData, user])

	const renderProfileForm = useMemo(
		() => (
			<>
				<TextInput
					className={`${
						isDarkMode ? 'bg-night text-white' : ' text-black'
					} p-4 rounded-xl mb-4 border border-red`}
					value={formData.name}
					onChangeText={text => setFormData(prev => ({ ...prev, name: text }))}
					placeholder='Enter your dealership name'
					placeholderTextColor={isDarkMode ? 'gray' : 'rgba(0, 0, 0, 0.5)'}
					cursorColor='#D55004'
					autoComplete='username'
					autoCapitalize='words'
				/>
				<TextInput
					className={`${
						isDarkMode ? 'bg-night text-white' : 'bg-white text-black'
					} p-4 rounded-xl mb-4 border border-red`}
					value={formData.location}
					onChangeText={text =>
						setFormData(prev => ({ ...prev, location: text }))
					}
					placeholder='Enter your dealership address'
					placeholderTextColor={isDarkMode ? 'gray' : 'rgba(0, 0, 0, 0.5)'}
					cursorColor='#D55004'
					autoComplete='street-address'
					autoCapitalize='words'
				/>
				<TextInput
					className={`${
						isDarkMode ? 'bg-night text-white' : 'bg-white text-black'
					} p-4 rounded-xl mb-4 border border-red`}
					value={formData.phone.toString()}
					onChangeText={text => setFormData(prev => ({ ...prev, phone: text }))}
					placeholder='Enter your contact number'
					keyboardType='numeric'
					placeholderTextColor={isDarkMode ? 'gray' : 'rgba(0, 0, 0, 0.5)'}
					cursorColor='#D55004'
					autoComplete='tel'
				/>
				<View className='flex-row items-center mb-4'>
					<TextInput
						className={`${
							isDarkMode ? 'bg-night text-white' : 'bg-white text-black'
						} p-4 rounded-xl flex-1 mr-2 border border-red`}
						value={formData.latitude}
						onChangeText={text =>
							setFormData(prev => ({ ...prev, latitude: text }))
						}
						placeholder='Latitude'
						keyboardType='numeric'
						placeholderTextColor={isDarkMode ? 'gray' : 'rgba(0, 0, 0, 0.5)'}
						cursorColor='#D55004'
					/>
					<TextInput
						className={`${
							isDarkMode ? 'bg-night text-white' : 'bg-white text-black'
						} p-4 rounded-xl flex-1 ml-2 border border-red`}
						value={formData.longitude}
						onChangeText={text =>
							setFormData(prev => ({ ...prev, longitude: text }))
						}
						placeholder='Longitude'
						keyboardType='numeric'
						placeholderTextColor={isDarkMode ? 'gray' : 'rgba(0, 0, 0, 0.5)'}
						cursorColor='#D55004'
					/>
				</View>
				<View className='flex-row justify-between mb-4'>
					<TouchableOpacity
						className='bg-blue-500 p-3 rounded-xl flex-1 mr-2 items-center flex-row justify-center'
						onPress={getLocation}>
						<Ionicons
							name='location-outline'
							size={24}
							color='white'
							style={{ marginRight: 8 }}
						/>
						<Text className='text-white font-bold'>Get Location</Text>
					</TouchableOpacity>
					<TouchableOpacity
						className='bg-green-500 p-3 rounded-xl flex-1 ml-2 items-center flex-row justify-center'
						onPress={openMap}>
						<Ionicons
							name='map-outline'
							size={24}
							color='white'
							style={{ marginRight: 8 }}
						/>
						<Text className='text-white font-bold'>Pick on Map</Text>
					</TouchableOpacity>
				</View>
				<Text
					className={`${
						isDarkMode ? 'bg-night text-white' : 'bg-white text-black'
					} p-4 rounded-xl mb-4 border border-red`}>
					{user?.emailAddresses[0].emailAddress}
				</Text>
				<Text
					className={`${
						isDarkMode ? 'bg-night text-white' : 'bg-white text-black'
					} p-4 rounded-xl mb-6 border border-red`}>
					{dealership?.subscription_end_date
						? new Date(dealership.subscription_end_date).toLocaleDateString()
						: 'N/A'}
				</Text>
			</>
		),
		[formData, isDarkMode, user, dealership, getLocation, openMap]
	)

	const renderPasswordForm = useMemo(
		() => (
			<>
				<TextInput
					className={`${
						isDarkMode ? 'bg-night text-white' : 'bg-white text-black'
					} p-4 rounded-xl mb-4 border-2 border-red`}
					value={passwordData.currentPassword}
					onChangeText={text =>
						setPasswordData(prev => ({ ...prev, currentPassword: text }))
					}
					placeholder='Current Password'
					placeholderTextColor={isDarkMode ? 'gray' : 'rgba(0, 0, 0, 0.5)'}
					secureTextEntry
					cursorColor='#D55004'
					autoComplete='password'
				/>
				<TextInput
					className={`${
						isDarkMode ? 'bg-night text-white' : 'bg-white text-black'
					} p-4 rounded-xl mb-4 border border-red`}
					value={passwordData.newPassword}
					onChangeText={text =>
						setPasswordData(prev => ({ ...prev, newPassword: text }))
					}
					placeholder='New Password'
					placeholderTextColor={isDarkMode ? 'gray' : 'rgba(0, 0, 0, 0.5)'}
					secureTextEntry
					cursorColor='#D55004'
					autoComplete='password'
				/>
				<TextInput
					className={`${
						isDarkMode ? 'bg-night text-white' : 'bg-white text-black'
					} p-4 rounded-xl mb-4 border border-red`}
					value={passwordData.confirmPassword}
					onChangeText={text =>
						setPasswordData(prev => ({ ...prev, confirmPassword: text }))
					}
					placeholder='Confirm New Password'
					placeholderTextColor={isDarkMode ? 'gray' : 'rgba(0, 0, 0, 0.5)'}
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
		),
		[isDarkMode, passwordData, handleChangePassword]
	)

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
			className={`flex-1 ${isDarkMode ? 'bg-night' : 'bg-white'}`}>
			<CustomHeader title='Dealership Profile' />
			{subscriptionExpired && (
				<View className='bg-rose-700 p-4'>
					<Text className='text-white text-center font-bold'>
						Your subscription has expired. Please renew to manage your listings.
					</Text>
				</View>
			)}
			{showWarning && (
				<View className='bg-yellow-500 p-4'>
					<Text className='text-white text-center font-bold'>
						Your subscription will expire in {daysUntilExpiration} day
						{daysUntilExpiration !== 1 ? 's' : ''}. Please renew soon.
					</Text>
				</View>
			)}
			<ScrollView
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
				}>
				{isLoading && (
					<View className='items-center justify-center py-4'>
						<ActivityIndicator
							size='large'
							color={isDarkMode ? 'white' : 'black'}
						/>
					</View>
				)}
				{error && (
					<View className='bg-red p-4 mb-4 rounded-xl mx-4 mt-4'>
						<Text className='text-white font-bold text-center'>{error}</Text>
					</View>
				)}
				<View
					className={`items-center bg-red pt-8 pb-8 rounded-b-3xl shadow-lg`}>
					<Image
						source={{ uri: formData.logo || 'https://via.placeholder.com/150' }}
						className='w-36 h-36 rounded-full border-4 border-white mb-6'
					/>
					<TouchableOpacity
						className='bg-blue-500 px-6 py-3 rounded-full shadow-md flex-row items-center'
						onPress={pickImage}
						disabled={isUploading}>
						{isUploading ? (
							<ActivityIndicator color='white' />
						) : (
							<>
								<Ionicons
									name='camera-outline'
									size={24}
									color='white'
									style={{ marginRight: 8 }}
								/>
								<Text className='text-white font-semibold text-lg'>
									Change Logo
								</Text>
							</>
						)}
					</TouchableOpacity>
				</View>

				<View className='px-6 mt-8'>
					<View className='flex-row justify-between items-center mb-6'>
						<Text
							className={`text-3xl font-bold ${
								isDarkMode ? 'text-white' : 'text-black'
							}`}>
							Dealership Details
						</Text>
						<ThemeSwitch />
					</View>

					<View
						className={`${
							isDarkMode ? 'bg-night' : 'bg-white'
						} rounded-2xl shadow-md p-6 mb-8`}>
						{isChangePasswordMode ? renderPasswordForm : renderProfileForm}

						{!isChangePasswordMode && (
							<>
								<TouchableOpacity
									className='bg-red p-4 rounded-xl items-center mt-4 flex-row justify-center'
									onPress={updateProfile}>
									<Ionicons
										name='save-outline'
										size={24}
										color='white'
										style={{ marginRight: 8 }}
									/>
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

								<TouchableOpacity
									className='bg-blue-500 p-4 rounded-xl items-center mt-4 flex-row justify-center'
									onPress={navigateToAnalytics}>
									<Ionicons
										name='bar-chart-outline'
										size={24}
										color='white'
										style={{ marginRight: 8 }}
									/>
									<Text className='text-white font-bold text-xl'>
										View Analytics
									</Text>
								</TouchableOpacity>
							</>
						)}
					</View>

					<TouchableOpacity
						className='bg-rose-600 p-5 mb-24 rounded-xl items-center flex-row justify-center'
						onPress={() => signOut()}>
						<Ionicons
							name='log-out-outline'
							size={24}
							color='white'
							style={{ marginRight: 8 }}
						/>
						<Text className='text-white font-bold text-xl'>Sign Out</Text>
					</TouchableOpacity>
				</View>
			</ScrollView>

			<Modal visible={mapVisible} animationType='slide'>
				<View style={{ flex: 1 }}>
					<GooglePlacesAutocomplete
						placeholder='Search in Lebanon'
						onPress={(data, details = null) => {
							if (details) selectLocation(details)
						}}
						query={{
							key: 'AIzaSyCe8nbmSQBR9KmZG5AP3yYZeKogvjQbwX4',
							language: 'en',
							components: 'country:lb', // This restricts results to Lebanon

							region: 'lb' // This sets the default region to Lebanon
						}}
						fetchDetails={true}
						styles={{
							container: {
								position: 'absolute',
								top: 10,
								left: 10,
								right: 10,
								zIndex: 1
							},
							textInput: {
								height: 50,
								borderRadius: 25,
								paddingHorizontal: 16,
								backgroundColor: isDarkMode ? '#333' : '#fff',
								color: isDarkMode ? '#fff' : '#000'
							}
						}}
						filterReverseGeocodingByTypes={[
							'locality',
							'administrative_area_level_3'
						]} // This helps in getting more relevant reverse geocoding results
					/>
					<MapView
						ref={mapRef}
						style={{ flex: 1 }}
						region={mapRegion}
						onPress={handleMapPress}>
						{selectedLocation && (
							<Marker
								coordinate={{
									latitude: selectedLocation.latitude,
									longitude: selectedLocation.longitude
								}}
							/>
						)}
					</MapView>
					<BlurView
						intensity={80}
						tint={isDarkMode ? 'dark' : 'light'}
						style={{
							position: 'absolute',
							bottom: 10,
							left: 10,
							right: 10,
							padding: 10,
							borderRadius: 5
						}}>
						{selectedLocation && (
							<Text style={{ color: isDarkMode ? 'white' : 'black' }}>
								Selected: {selectedLocation.latitude.toFixed(6)},{' '}
								{selectedLocation.longitude.toFixed(6)}
							</Text>
						)}
					</BlurView>
					<View
						className={`flex-row justify-around p-4 ${
							isDarkMode ? 'bg-night' : 'bg-white'
						}`}>
						<TouchableOpacity
							className='bg-red px-6 py-3 rounded-full flex-row items-center'
							onPress={closeMap}>
							<Ionicons
								name='close-outline'
								size={24}
								color='white'
								style={{ marginRight: 8 }}
							/>
							<Text className='text-white font-bold'>Cancel</Text>
						</TouchableOpacity>
						<TouchableOpacity
							className='bg-green-500 px-6 py-3 rounded-full flex-row items-center'
							onPress={confirmLocation}>
							<Ionicons
								name='checkmark-outline'
								size={24}
								color='white'
								style={{ marginRight: 8 }}
							/>
							<Text className='text-white font-bold'>Confirm Location</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
		</KeyboardAvoidingView>
	)
}
