import React, { useState, useEffect, useCallback } from 'react'
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
	Keyboard
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser, useAuth } from '@clerk/clerk-expo'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import * as Location from 'expo-location'
import MapView, { Marker } from 'react-native-maps'
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete'
import { Buffer } from 'buffer'
import { useTheme } from '@/utils/ThemeContext'
import ThemeSwitch from '@/components/ThemeSwitch'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

const CustomHeader = ({ title, onBack }: any) => {
	const { isDarkMode } = useTheme()

	return (
		<SafeAreaView
			edges={['top']}
			style={{
				backgroundColor: isDarkMode ? 'black' : 'white',
				borderBottomWidth: 0,
				borderBottomColor: '#D55004',
				borderTopWidth: 0,
				borderWidth: 0,

				borderColor: '#D55004'
			}}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View
				className='border-b border-red'
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'center', // Centers the content horizontally
					paddingHorizontal: 0,
					paddingBottom: 9
				}}>
				<Text
					style={{
						fontSize: 20,
						textAlign: 'center',
						color: '#D55004',
						fontWeight: '600'
					}}>
					{title}
				</Text>
			</View>
		</SafeAreaView>
	)
}

export default function DealershipProfilePage() {
	const { isDarkMode } = useTheme()
	const { user } = useUser()
	const { signOut } = useAuth()
	const router = useRouter()
	const [dealership, setDealership] = useState<any>(null)
	const [name, setName] = useState('')
	const [location, setLocation] = useState('')
	const [phone, setPhone] = useState('')
	const [logo, setLogo] = useState('')
	const [latitude, setLatitude] = useState('')
	const [longitude, setLongitude] = useState('')
	const [isUploading, setIsUploading] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [mapVisible, setMapVisible] = useState(false)
	const [selectedLocation, setSelectedLocation] = useState<{
		latitude: number
		longitude: number
	} | null>(null)
	const [refreshing, setRefreshing] = useState(false)

	const getLocation = async () => {
		let { status } = await Location.requestForegroundPermissionsAsync()
		if (status !== 'granted') {
			Alert.alert(
				'Permission Denied',
				'Please allow access to your location to use this feature.'
			)
			return
		}

		let location = await Location.getCurrentPositionAsync({})
		setLatitude(location.coords.latitude.toString())
		setLongitude(location.coords.longitude.toString())
		setSelectedLocation({
			latitude: location.coords.latitude,
			longitude: location.coords.longitude
		})
	}

	const openMap = () => {
		setMapVisible(true)
	}

	const closeMap = () => {
		setMapVisible(false)
		setSelectedLocation(null)
	}

	const selectLocation = (event: any) => {
		const { latitude, longitude } = event.nativeEvent.coordinate
		setSelectedLocation({ latitude, longitude })
	}

	const confirmLocation = () => {
		if (selectedLocation) {
			setLatitude(selectedLocation.latitude.toString())
			setLongitude(selectedLocation.longitude.toString())
			setLocation('Custom Location') // You might want to reverse geocode here for a more precise address
		}
		closeMap()
	}

	const onRefresh = useCallback(() => {
		setRefreshing(true)
		fetchDealershipProfile().then(() => setRefreshing(false))
	}, [])

	useEffect(() => {
		if (user) fetchDealershipProfile()
	}, [user])

	const fetchDealershipProfile = async () => {
		setIsLoading(true)
		setError(null)
		try {
			const { data, error } = await supabase
				.from('dealerships')
				.select('*')
				.eq('user_id', user?.id)
				.single()

			if (error) throw error

			if (data) {
				setDealership(data)
				setName(data.name)
				setLocation(data.location)
				setPhone(data.phone)
				setLogo(data.logo)
				setLatitude(data.latitude ? data.latitude.toString() : '')
				setLongitude(data.longitude ? data.longitude.toString() : '')
			}
		} catch (error: any) {
			setError(error.message)
		} finally {
			setIsLoading(false)
		}
	}

	const updateProfile = async () => {
		setIsLoading(true)
		setError(null)
		try {
			const { error } = await supabase
				.from('dealerships')
				.update({
					name,
					location,
					phone,
					logo,
					latitude: parseFloat(latitude) || null,
					longitude: parseFloat(longitude) || null
				})
				.eq('id', dealership.id)

			if (error) throw error

			Alert.alert('Success', 'Profile updated successfully')
		} catch (error: any) {
			setError(`Failed to update profile: ${error.message}`)
		} finally {
			setIsLoading(false)
		}
	}

	const pickImage = async () => {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
		if (status !== 'granted') {
			Alert.alert(
				'Permission Denied',
				'We need access to your photos to update your logo.'
			)
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
				Alert.alert('Error', 'Failed to upload image. Please try again.')
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

			if (updateError) throw updateError

			Alert.alert('Success', 'Logo updated successfully')
		} catch (error: any) {
			console.error('Detailed error in handleImageUpload:', error)
			Alert.alert('Error', `Failed to upload image: ${error.message}`)
		}
	}

	const navigateToAnalytics = () => {
		router.push('/analytics')
	}

	return (
		<>
			<CustomHeader title='Dealership Profile' />
			<ScrollView
				className={`flex-1 ${isDarkMode ? 'bg-gray' : 'bg-white'}`}
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
					className={`items-center bg-red  pt-8 pb-8 rounded-b-3xl shadow-lg`}>
					<Image
						source={{ uri: logo || 'https://via.placeholder.com/150' }}
						className='w-36 h-36 rounded-full border-4 border-white mb-6'
					/>
					<TouchableOpacity
						className='bg-emerald-400 px-6 py-3 rounded-full shadow-md flex-row items-center'
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
							isDarkMode ? 'bg-gray' : 'bg-white'
						} rounded-2xl shadow-md p-6 mb-8`}>
						<Text
							className={`${
								isDarkMode ? 'text-red' : 'text-red'
							} text-sm font-semibold mb-2`}>
							Dealership Name
						</Text>
						<TextInput
							className={`${
								isDarkMode ? 'bg-gray text-white' : ' text-black'
							} p-4 rounded-xl mb-4 border border-red`}
							value={name}
							onChangeText={setName}
							placeholder='Enter your dealership name'
							placeholderTextColor={isDarkMode ? 'gray' : 'rgba(0, 0, 0, 0.5)'}
						/>

						<Text
							className={`${
								isDarkMode ? 'text-red' : 'text-red'
							} text-sm font-semibold mb-2`}>
							Address
						</Text>
						<TextInput
							className={`${
								isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
							} p-4 rounded-xl mb-4 border border-red`}
							value={location}
							onChangeText={setLocation}
							placeholder='Enter your dealership address'
							placeholderTextColor={isDarkMode ? 'gray' : 'rgba(0, 0, 0, 0.5)'}
						/>

						<Text
							className={`${
								isDarkMode ? 'text-red' : 'text-red'
							} text-sm font-semibold mb-2`}>
							Phone Number
						</Text>
						<TextInput
							className={`${
								isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
							} p-4 rounded-xl mb-4 border border-red`}
							value={phone}
							onChangeText={setPhone}
							placeholder='Enter your contact number'
							keyboardType='phone-pad'
							placeholderTextColor={isDarkMode ? 'gray' : 'rgba(0, 0, 0, 0.5)'}
						/>

						<Text
							className={`${
								isDarkMode ? 'text-red' : 'text-red'
							} text-sm font-semibold mb-2`}>
							Location Coordinates
						</Text>
						<View className='flex-row items-center mb-4'>
							<TextInput
								className={`${
									isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
								} p-4 rounded-xl flex-1 mr-2 border border-red`}
								value={latitude}
								onChangeText={setLatitude}
								placeholder='Latitude'
								keyboardType='numeric'
								placeholderTextColor={
									isDarkMode ? 'gray' : 'rgba(0, 0, 0, 0.5)'
								}
							/>
							<TextInput
								className={`${
									isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
								} p-4 rounded-xl flex-1 ml-2 border border-red`}
								value={longitude}
								onChangeText={setLongitude}
								placeholder='Longitude'
								keyboardType='numeric'
								placeholderTextColor={
									isDarkMode ? 'gray' : 'rgba(0, 0, 0, 0.5)'
								}
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
								isDarkMode ? 'text-red' : 'text-red'
							} text-sm font-semibold mb-2`}>
							Email Address
						</Text>
						<Text
							className={`${
								isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
							} p-4 rounded-xl mb-4 border border-red`}>
							{user?.emailAddresses[0].emailAddress}
						</Text>

						<Text
							className={`${
								isDarkMode ? 'text-red' : 'text-red'
							} text-sm font-semibold mb-2`}>
							Subscription End Date
						</Text>
						<Text
							className={`${
								isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
							} p-4 rounded-xl mb-6 border border-red`}>
							{dealership?.subscription_end_date
								? new Date(
										dealership.subscription_end_date
								  ).toLocaleDateString()
								: 'N/A'}
						</Text>

						<TouchableOpacity
							className='bg-orange-500 p-4 rounded-xl items-center mt-4 flex-row justify-center'
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
					</View>

					<TouchableOpacity
						className='bg-rose-700 p-5 mb-24 rounded-xl items-center flex-row justify-center'
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
					<MapView
						style={{ flex: 1 }}
						initialRegion={{
							latitude: parseFloat(latitude) || 0,
							longitude: parseFloat(longitude) || 0,
							latitudeDelta: 0.0922,
							longitudeDelta: 0.0421
						}}
						onPress={selectLocation}>
						{selectedLocation && (
							<Marker
								coordinate={{
									latitude: selectedLocation.latitude,
									longitude: selectedLocation.longitude
								}}
							/>
						)}
					</MapView>
					<View
						style={{
							position: 'absolute',
							top: 10,
							left: 10,
							right: 10,
							backgroundColor: isDarkMode
								? 'rgba(0,0,0,0.7)'
								: 'rgba(255,255,255,0.7)',
							padding: 10,
							borderRadius: 5
						}}>
						<Text
							style={{
								color: isDarkMode ? 'white' : 'black',
								fontWeight: 'bold',
								marginBottom: 5
							}}>
							Tap on the map to select a location
						</Text>
						{selectedLocation && (
							<Text style={{ color: isDarkMode ? 'white' : 'black' }}>
								Selected: {selectedLocation.latitude.toFixed(6)},{' '}
								{selectedLocation.longitude.toFixed(6)}
							</Text>
						)}
					</View>
					<View
						style={{
							flexDirection: 'row',
							justifyContent: 'space-around',
							padding: 15,
							backgroundColor: isDarkMode ? '#1E1E1E' : 'white'
						}}>
						<TouchableOpacity
							style={{
								backgroundColor: 'red',
								padding: 10,
								borderRadius: 5,
								flexDirection: 'row',
								alignItems: 'center'
							}}
							onPress={closeMap}>
							<Ionicons
								name='close-outline'
								size={24}
								color='white'
								style={{ marginRight: 8 }}
							/>
							<Text style={{ color: 'white', fontWeight: 'bold' }}>Cancel</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={{
								backgroundColor: 'green',
								padding: 10,
								borderRadius: 5,
								flexDirection: 'row',
								alignItems: 'center'
							}}
							onPress={confirmLocation}>
							<Ionicons
								name='checkmark-outline'
								size={24}
								color='white'
								style={{ marginRight: 8 }}
							/>
							<Text style={{ color: 'white', fontWeight: 'bold' }}>
								Confirm Location
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
		</>
	)
}
