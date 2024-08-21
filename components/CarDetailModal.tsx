import React, { useCallback, useEffect } from 'react'
import {
	StyleSheet,
	View,
	Text,
	Image,
	TouchableOpacity,
	Modal,
	ScrollView,
	FlatList,
	Dimensions,
	Linking,
	Alert,
	Share,
	PanResponder
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { FontAwesome } from '@expo/vector-icons' // For WhatsApp icon
import { MaterialIcons } from '@expo/vector-icons' // For Share icon
import { useUser } from '@clerk/clerk-expo'
import { supabase } from '@/utils/supabase'
import { debounce } from '@/utils/debounce'
import { useFavorites } from '@/utils/useFavorites'
import MapView, { Marker } from 'react-native-maps'
import { SafeAreaView } from 'react-native-safe-area-context'

const { width } = Dimensions.get('window')

export default function CarDetailModal({
	isVisible,
	car,
	onClose,
	onFavoritePress,
	onViewUpdate
}: any) {
	if (!car) return null

	const { user } = useUser()
	const { isFavorite } = useFavorites()

	const renderImageItem = ({ item }: any) => (
		<Image source={{ uri: item }} style={styles.image} />
	)

	useEffect(() => {
		if (isVisible && car && user) {
			trackCarView(car.id, user.id)
		}
	}, [isVisible, car, user])

	const trackCarView = useCallback(
		async (carId: number, userId: string) => {
			try {
				const { data, error } = await supabase.rpc('track_car_view', {
					car_id: carId,
					user_id: userId
				})

				if (error) throw error

				if (data && onViewUpdate) {
					onViewUpdate(carId, data)
				}
			} catch (error) {
				console.error('Error tracking car view:', error)
			}
		},
		[onViewUpdate]
	)

	const debouncedTrackCarView = useCallback(
		debounce((carId: number, userId: string) => {
			trackCarView(carId, userId)
		}, 1000),
		[trackCarView]
	)

	useEffect(() => {
		if (isVisible && car && user) {
			debouncedTrackCarView(car.id, user.id)
		}
	}, [isVisible, car, user, debouncedTrackCarView])

	// Use random latitude and longitude instead of fetching from database
	const randomLatitude = 37.7749
	const randomLongitude = -122.4194

	const mapRegion = {
		latitude: car.dealership_latitude || randomLatitude,
		longitude: car.dealership_longitude || randomLongitude,
		latitudeDelta: 0.01,
		longitudeDelta: 0.01
	}

	// PanResponder to handle the swipe-to-go-back gesture
	const panResponder = PanResponder.create({
		onMoveShouldSetPanResponder: (_, gestureState) => {
			// Detect left swipe (negative dx) with a significant movement
			return gestureState.dx < -30
		},
		onPanResponderRelease: (_, gestureState) => {
			// If the gesture was a significant left swipe, trigger the onClose
			if (gestureState.dx < -50) {
				onClose()
			}
		}
	})

	// Function to share the car details
	const handleCall = () => {
		if (car.dealership_phone) {
			Linking.openURL(`tel:${car.dealership_phone}`)
		} else {
			Alert.alert('Phone number not available')
		}
	}

	const handleWhatsApp = () => {
		if (car.dealership_phone) {
			const message = `Hi, I'm interested in the ${car.make} ${car.model}.`
			const url = `https://wa.me/${
				car.dealership_phone
			}?text=${encodeURIComponent(message)}`
			Linking.openURL(url)
		} else {
			Alert.alert('WhatsApp number not available')
		}
	}

	const handleChat = () => {
		Alert.alert('Chat feature coming soon!')
	}

	const handleShare = async () => {
		try {
			const result = await Share.share({
				message: `Check out this ${car.year} ${car.make} ${
					car.model
				} for $${car.price.toLocaleString()}!`,
				url: car.images[0]
			})
			if (result.action === Share.sharedAction) {
				if (result.activityType) {
					// shared with activity type of result.activityType
				} else {
					// shared
				}
			} else if (result.action === Share.dismissedAction) {
				// dismissed
			}
		} catch (error: any) {
			Alert.alert(error.message)
		}
	}

	return (
		<SafeAreaView>
			<Modal visible={isVisible} animationType='slide'>
				<View style={styles.header} {...panResponder.panHandlers}></View>
				<ScrollView className='flex-1 bg-black'>
					<TouchableOpacity
						className='absolute top-0 right-0 z-10 p-2 bg-red-600 rounded-full'
						onPress={onClose}>
						<Ionicons name='close' size={30} color='#D55004' />
					</TouchableOpacity>
					<FlatList
						data={car.images}
						renderItem={renderImageItem}
						keyExtractor={(item, index) => index.toString()}
						horizontal
						pagingEnabled
						showsHorizontalScrollIndicator={false}
					/>
					<View className='p-4'>
						<Text className='text-2xl font-bold text-white'>
							{car.year} {car.make} {car.model}
						</Text>
						<Text className='text-xl font-bold text-red mt-2'>
							${car.price.toLocaleString()}
						</Text>
						<View className='flex-row justify-between mt-4 mb-4'>
							<Text className='text-l text-white'>Views: {car.views || 0}</Text>
							<Text className='text-l text-white'>Likes: {car.likes || 0}</Text>
						</View>

						<View style={{ flexDirection: 'row', alignItems: 'center' }}>
							<View style={{ flex: 1, height: 1, backgroundColor: 'white' }} />
							<View style={{ flex: 1, height: 1, backgroundColor: 'white' }} />
						</View>
						<Text className='text-xl mt-6 text-white font-semibold text-l mb-4'>
							{car.description}
						</Text>

						<View className='mb-6 border'>
							{/* Car Details in a Table */}
							<View className='flex-row p-2 bg-gray justify-between py-2'>
								<Text className='text-xl text-gray-400'>Mileage</Text>
								<Text className='text-xl' style={{ color: '#D55004' }}>
									{`${car.mileage.toLocaleString()} km`}
								</Text>
							</View>
							<View className='flex-row p-2 justify-between py-2'>
								<Text className='text-xl text-gray-400'>Color</Text>
								<Text className='text-xl' style={{ color: '#D55004' }}>
									{car.color}
								</Text>
							</View>
							<View className='flex-row p-2  bg-gray justify-between py-2'>
								<Text className='text-xl text-gray-400'>Transmission</Text>
								<Text className='text-xl' style={{ color: '#D55004' }}>
									{car.transmission}
								</Text>
							</View>
							<View className='flex-row p-2 justify-between py-2'>
								<Text className='text-xl text-gray-400'>Drivetrain</Text>
								<Text className='text-xl' style={{ color: '#D55004' }}>
									{car.drivetrain}
								</Text>
							</View>
							<View className='flex-row p-2 bg-gray justify-between py-2'>
								<Text className='text-xl text-gray-400'>Condition</Text>
								<Text className='text-xl' style={{ color: '#D55004' }}>
									{car.condition}
								</Text>
							</View>
						</View>

						<TouchableOpacity
							className='flex-row items-center justify-center bg-gray-800 p-3 rounded-lg mb-6'
							onPress={() => onFavoritePress(car.id)}>
							<Ionicons
								name={isFavorite(car.id) ? 'heart' : 'heart-outline'}
								size={24}
								color={isFavorite(car.id) ? 'red' : 'white'}
							/>
							<Text className='text-lg font-bold text-white ml-3'>
								{isFavorite(car.id) ? 'Unlike' : 'Like'}
							</Text>
						</TouchableOpacity>

						<View style={{ flexDirection: 'row', alignItems: 'center' }}>
							<View style={{ flex: 1, height: 1, backgroundColor: 'white' }} />
							<View style={{ flex: 1, height: 1, backgroundColor: 'white' }} />
						</View>

						{/* Dealer Information */}
						<Text className='text-lg font-bold text-white mt-2  mb-2'>
							Dealer Information
						</Text>
						<View className='border-t border-gray-600 pt-4'>
							<View className='items-center'>
								{car.dealership_logo && (
									<Image
										source={{ uri: car.dealership_logo }}
										className='w-32 rounded-full h-32 mb-4'
										resizeMode='contain'
									/>
								)}
								<Text className='text-xl font-bold text-white mb-2'>
									{car.dealership_name}
								</Text>
							</View>

							{/* Dealer Phone */}

							{/* Embedded Google Map */}
							<MapView
								style={{ height: 200, borderRadius: 10 }}
								region={mapRegion}>
								<Marker
									coordinate={{
										latitude: randomLatitude,
										longitude: randomLongitude
									}}
									title={car.dealership_name}
									description={car.dealership_location}
								/>
							</MapView>

							<View className='flex-row border mt-12 mb-12  justify-around'>
								{car.dealership_phone && (
									<TouchableOpacity
										className='rounded-lg items-center justify-center'
										style={{ width: 50, height: 50 }}
										onPress={handleCall}>
										<Ionicons name='call-outline' size={24} color='#D55004' />
									</TouchableOpacity>
								)}

								{/* WhatsApp Button */}
								<TouchableOpacity
									className='rounded-lg items-center justify-center'
									style={{ width: 50, height: 50 }}
									onPress={handleWhatsApp}>
									<FontAwesome name='whatsapp' size={24} color='#D55004' />
								</TouchableOpacity>

								{/* Chat Button (Coming Soon) */}
								<TouchableOpacity
									className='rounded-lg items-center justify-center'
									style={{ width: 50, height: 50 }}
									onPress={handleChat}>
									<Ionicons
										name='chatbubbles-outline'
										size={24}
										color='#D55004'
									/>
								</TouchableOpacity>

								{/* Share Button */}
								<TouchableOpacity
									className='rounded-lg items-center justify-center'
									style={{ width: 50, height: 50 }}
									onPress={handleShare}>
									<MaterialIcons name='share' size={24} color='#D55004' />
								</TouchableOpacity>
							</View>
						</View>
					</View>
				</ScrollView>
			</Modal>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	header: {
		backgroundColor: '#D55004',
		paddingVertical: 30,
		paddingHorizontal: 20,
		alignItems: 'center',
		justifyContent: 'center',
		borderTopLeftRadius: 10,
		borderTopRightRadius: 10
	},
	headerText: {
		color: 'white',
		fontSize: 18,
		fontWeight: 'bold'
	},
	image: {
		width: width,
		height: 300,
		resizeMode: 'cover'
	}
})
