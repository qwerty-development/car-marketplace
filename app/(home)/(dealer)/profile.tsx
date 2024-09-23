import React, { useState, useEffect } from 'react'
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
	Modal
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser, useAuth } from '@clerk/clerk-expo'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import * as Location from 'expo-location'
import MapView, { Marker } from 'react-native-maps'
import { Buffer } from 'buffer'
import { useTheme } from '@/utils/ThemeContext'
import ThemeSwitch from '@/components/ThemeSwitch'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
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

	const getLocation = async () => {
		let { status } = await Location.requestForegroundPermissionsAsync()
		if (status !== 'granted') {
			Alert.alert('Permission to access location was denied')
			return
		}

		let location = await Location.getCurrentPositionAsync({})
		setLatitude(location.coords.latitude.toString())
		setLongitude(location.coords.longitude.toString())
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
		}
		closeMap()
	}

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
				'Sorry, we need camera roll permissions to make this work!'
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
			<CustomHeader title='Profile' />
			<ScrollView
				className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-gray-100'}`}>
				{isLoading && (
					<View className='items-center justify-center py-4'>
						<ActivityIndicator
							size='large'
							color={isDarkMode ? 'white' : 'black'}
						/>
					</View>
				)}
				{error && (
					<View className='bg-red-500 p-4 mb-4 rounded-xl'>
						<Text className='text-white font-bold text-center'>{error}</Text>
					</View>
				)}
				<View
					className={`items-center ${
						isDarkMode ? 'bg-red' : 'bg-red'
					} pt-16 pb-8 rounded-b-3xl shadow-lg`}>
					<Image
						source={{ uri: logo || 'https://via.placeholder.com/150' }}
						className='w-36 h-36 rounded-full border-4 border-white mb-6'
					/>
					<TouchableOpacity
						className='bg-white px-6 py-3 rounded-full shadow-md'
						onPress={pickImage}
						disabled={isUploading}>
						{isUploading ? (
							<ActivityIndicator color='red' />
						) : (
							<Text className='text-red-600 font-semibold text-lg'>
								Change Logo
							</Text>
						)}
					</TouchableOpacity>
				</View>

				<View className='px-6 mt-8'>
					<View className='flex-row justify-between items-center mb-6'>
						<Text
							className={`text-3xl font-bold ${
								isDarkMode ? 'text-white' : 'text-black'
							}`}>
							Dealership Profile
						</Text>
						<ThemeSwitch />
					</View>

					<View
						className={`${
							isDarkMode ? 'bg-black' : 'bg-white'
						} rounded-2xl shadow-md p-6 mb-8`}>
						<Text
							className={`${
								isDarkMode ? 'text-white' : 'text-gray-700'
							} text-sm font-semibold mb-2`}>
							Dealership Name
						</Text>
						<TextInput
							className={`${
								isDarkMode
									? 'bg-gray-800 text-orange-500'
									: 'bg-white text-black'
							} p-4 rounded-xl mb-4`}
							value={name}
							onChangeText={setName}
							placeholder='Dealership Name'
							placeholderTextColor={isDarkMode ? 'gray' : 'rgba(0, 0, 0, 0.5)'}
						/>

						<Text
							className={`${
								isDarkMode ? 'text-white' : 'text-gray-700'
							} text-sm font-semibold mb-2`}>
							Address
						</Text>
						<TextInput
							className={`${
								isDarkMode
									? 'bg-gray-800 text-orange-500'
									: 'bg-white text-black'
							} p-4 rounded-xl mb-4`}
							value={location}
							onChangeText={setLocation}
							placeholder='Location'
							placeholderTextColor={isDarkMode ? 'gray' : 'rgba(0, 0, 0, 0.5)'}
						/>

						<Text
							className={`${
								isDarkMode ? 'text-white' : 'text-gray-700'
							} text-sm font-semibold mb-2`}>
							Phone
						</Text>
						<TextInput
							className={`${
								isDarkMode
									? 'bg-gray-800 text-orange-500'
									: 'bg-white text-black'
							} p-4 rounded-xl mb-4`}
							value={phone}
							onChangeText={setPhone}
							placeholder='Phone'
							keyboardType='phone-pad'
							placeholderTextColor={isDarkMode ? 'gray' : 'rgba(0, 0, 0, 0.5)'}
						/>

						<Text
							className={`${
								isDarkMode ? 'text-white' : 'text-gray-700'
							} text-sm font-semibold mb-2`}>
							Location
						</Text>
						<View className='flex-row items-center mb-4'>
							<TextInput
								className={`${
									isDarkMode
										? 'bg-gray-800 text-orange-500'
										: 'bg-white text-black'
								} p-4 rounded-xl flex-1 mr-2`}
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
									isDarkMode
										? 'bg-gray-800 text-orange-500'
										: 'bg-white text-black'
								} p-4 rounded-xl flex-1 ml-2`}
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
								className='bg-blue-500 p-3 rounded-xl flex-1 mr-2 items-center'
								onPress={getLocation}>
								<Text className='text-white font-bold'>Get Location</Text>
							</TouchableOpacity>
							<TouchableOpacity
								className='bg-green-500 p-3 rounded-xl flex-1 ml-2 items-center'
								onPress={openMap}>
								<Text className='text-white font-bold'>Pick on Map</Text>
							</TouchableOpacity>
						</View>

						<Text
							className={`${
								isDarkMode ? 'text-white' : 'text-gray-700'
							} text-sm font-semibold mb-2`}>
							Email
						</Text>
						<Text
							className={`${
								isDarkMode
									? 'bg-gray-800 text-orange-500'
									: 'bg-gray-100 text-black'
							} p-4 rounded-xl mb-4`}>
							{user?.emailAddresses[0].emailAddress}
						</Text>

						<Text
							className={`${
								isDarkMode ? 'text-white' : 'text-gray-700'
							} text-sm font-semibold mb-2`}>
							Subscription End Date
						</Text>
						<Text
							className={`${
								isDarkMode
									? 'bg-gray-800 text-orange-500'
									: 'bg-gray-100 text-black'
							} p-4 rounded-xl mb-6`}>
							{dealership?.subscription_end_date
								? new Date(
										dealership.subscription_end_date
								  ).toLocaleDateString()
								: 'N/A'}
						</Text>

						<TouchableOpacity
							className='bg-red p-4 rounded-xl items-center mt-4'
							onPress={updateProfile}>
							<Text className='text-white font-bold text-xl'>
								Update Profile
							</Text>
						</TouchableOpacity>

						<TouchableOpacity
							className='bg-blue-500 p-4 rounded-xl items-center mt-4'
							onPress={navigateToAnalytics}>
							<Text className='text-white font-bold text-xl'>
								View Analytics
							</Text>
						</TouchableOpacity>
					</View>

					<TouchableOpacity
						className='bg-[#FF000024] p-5 mb-24 rounded-xl items-center'
						onPress={() => signOut()}>
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
							flexDirection: 'row',
							justifyContent: 'space-around',
							padding: 15
						}}>
						<TouchableOpacity
							style={{ backgroundColor: 'red', padding: 10, borderRadius: 5 }}
							onPress={closeMap}>
							<Text style={{ color: 'white' }}>Cancel</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={{ backgroundColor: 'green', padding: 10, borderRadius: 5 }}
							onPress={confirmLocation}>
							<Text style={{ color: 'white' }}>Confirm Location</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
		</>
	)
}
