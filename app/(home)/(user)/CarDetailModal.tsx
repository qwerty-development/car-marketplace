import React, { useCallback, useEffect, useState, useRef } from 'react'
import {
	StyleSheet,
	View,
	Text,
	TouchableOpacity,
	Modal,
	ScrollView,
	FlatList,
	Dimensions,
	Linking,
	Alert,
	Share,
	PanResponder,
	Platform
} from 'react-native'
import { Animated } from 'react-native'
import { Ionicons, FontAwesome, MaterialIcons } from '@expo/vector-icons'
import { useUser } from '@clerk/clerk-expo'
import { supabase } from '@/utils/supabase'
import { debounce } from '@/utils/debounce'
import { useFavorites } from '@/utils/useFavorites'
import MapView, { Marker } from 'react-native-maps'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useTheme } from '@/utils/ThemeContext'
import { Image } from 'expo-image'

const { width } = Dimensions.get('window')

const CarDetailModal = React.memo(
	({
		isVisible,
		car,
		onClose,
		onFavoritePress,
		onViewUpdate,
		setSelectedCar,
		setIsModalVisible
	}: any) => {
		if (!car) return null
		const { isDarkMode } = useTheme()
		const router = useRouter()
		const slideAnimation = useRef(new Animated.Value(0)).current
		const { user } = useUser()
		const { isFavorite } = useFavorites()
		const [similarCars, setSimilarCars] = useState<any>([])
		const [dealerCars, setDealerCars] = useState<any>([])
		const scrollViewRef = useRef<ScrollView>(null)
		const handleDealershipPress = () => {
			onClose()
			router.push({
				pathname: '/(home)/(user)/DealershipDetails',
				params: { dealershipId: car.dealership_id }
			})
		}
		useEffect(() => {
			Animated.timing(slideAnimation, {
				toValue: isVisible ? 1 : 0,
				duration: 300,
				useNativeDriver: true
			}).start()
		}, [isVisible])
		useEffect(() => {
			if (isVisible && car && user) {
				trackCarView(car.id, user.id)
				fetchSimilarCars()
				fetchDealerCars()

				// Scroll to the top of the ScrollView
				if (scrollViewRef.current) {
					scrollViewRef.current.scrollTo({ y: 0, animated: true })
				}
			}
		}, [isVisible, car, user])

		const fetchSimilarCars = async () => {
			console.log(car.price)
			const { data, error } = await supabase
				.from('cars')
				.select(
					`
        *,
        dealerships (name,logo,phone,location,latitude,longitude)
        `
				)
				.neq('id', car.id)
				.gte('price', Math.floor(car.price * 0.8))
				.lte('price', Math.floor(car.price * 1.2))
				.limit(5)

			if (data) {
				const newCars =
					data?.map(item => ({
						...item,
						dealership_name: item.dealerships.name,
						dealership_logo: item.dealerships.logo,
						dealership_phone: item.dealerships.phone,
						dealership_location: item.dealerships.location,
						dealership_latitude: item.dealerships.latitude,
						dealership_longitude: item.dealerships.longitude,
						listed_at: item.listed_at
					})) || []
				setSimilarCars(newCars)
			}
			if (error) console.error('Error fetching similar cars:', error)
		}

		const fetchDealerCars = async () => {
			const { data, error } = await supabase
				.from('cars')
				.select(
					`
        *,
        dealerships (name,logo,phone,location,latitude,longitude)
        `
				)
				.eq('dealership_id', car.dealership_id)
				.neq('id', car.id)
				.limit(5)

			if (data) {
				const newCars =
					data?.map(item => ({
						...item,
						dealership_name: item.dealerships.name,
						dealership_logo: item.dealerships.logo,
						dealership_phone: item.dealerships.phone,
						dealership_location: item.dealerships.location,
						dealership_latitude: item.dealerships.latitude,
						dealership_longitude: item.dealerships.longitude,
						listed_at: item.listed_at
					})) || []
				setDealerCars(newCars)
			}
			if (error) console.error('Error fetching dealer cars:', error)
		}

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

		const randomLatitude = 37.7749
		const randomLongitude = -122.4194

		const mapRegion = {
			latitude: car.dealership_latitude || randomLatitude,
			longitude: car.dealership_longitude || randomLongitude,
			latitudeDelta: 0.01,
			longitudeDelta: 0.01
		}

		const panResponder = PanResponder.create({
			onMoveShouldSetPanResponder: (_, gestureState) => {
				return gestureState.dx < -30
			},
			onPanResponderRelease: (_, gestureState) => {
				if (gestureState.dx < -50) {
					handleCloseModal()
				}
			}
		})

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

		const handleCloseModal = () => {
			onClose()
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

		const renderCarItem = ({ item }: any) => (
			<TouchableOpacity
				className={`${
					isDarkMode ? 'bg-gray-800' : 'bg-gray-200'
				} rounded-lg p-2 mr-4 w-48`}
				onPress={() => {
					onClose()
					setSelectedCar(item)
					setIsModalVisible(true)
				}}>
				<Image
					source={{ uri: item.images[0] }}
					className='w-full h-32 rounded-lg mb-2'
					resizeMode='cover'
				/>
				<Text
					className={`${isDarkMode ? 'text-white' : 'text-black'} font-bold`}>
					{item.year} {item.make} {item.model}
				</Text>

				<Text className='text-red'>${item.price.toLocaleString()}</Text>
			</TouchableOpacity>
		)

		return (
			<Modal visible={isVisible} animationType='slide' transparent={true}>
				<View style={styles.modalOverlay}>
					<Animated.View
						style={[
							styles.modalContent,
							{
								transform: [
									{
										translateY: slideAnimation.interpolate({
											inputRange: [0, 1],
											outputRange: [300, 0]
										})
									}
								]
							}
						]}>
						<LinearGradient
							colors={
								isDarkMode ? ['#333', '#222', '#111'] : ['#FFFFFF', '#F5F5F5']
							}
							style={styles.gradientContainer}>
							<TouchableOpacity
								style={styles.closeButton}
								onPress={handleCloseModal}>
								<Ionicons name='close' size={30} color='#D55004' />
							</TouchableOpacity>
							<ScrollView className='flex-1' ref={scrollViewRef}>
								<FlatList
									data={car.images}
									renderItem={({ item }) => (
										<Image source={{ uri: item }} style={styles.image} />
									)}
									keyExtractor={(item, index) => index.toString()}
									horizontal
									pagingEnabled
									showsHorizontalScrollIndicator={false}
								/>
								<View className='p-4 mb-24'>
									<Text
										className={`text-2xl ${
											isDarkMode ? 'text-white' : 'text-black'
										}`}>
										{car.year} {car.make} {car.model}
									</Text>
									<Text className='text-xl font-extrabold text-red mt-2'>
										${car.price.toLocaleString()}
									</Text>
									<View className='flex-row justify-between mt-4 mb-4'>
										<Text
											className={`text-l ${
												isDarkMode ? 'text-white' : 'text-black'
											}`}>
											Views: {car.views || 0}
										</Text>
										<Text
											className={`text-l ${
												isDarkMode ? 'text-white' : 'text-black'
											}`}>
											Likes: {car.likes || 0}
										</Text>
									</View>

									<View style={{ flexDirection: 'row', alignItems: 'center' }}>
										<View
											style={{ flex: 1, height: 1, backgroundColor: '#D55004' }}
										/>
										<View
											style={{ flex: 1, height: 1, backgroundColor: '#D55004' }}
										/>
									</View>
									<Text
										className={`text-s mt-4 ${
											isDarkMode ? 'text-white' : 'text-black'
										} font-bold text-l mb-3`}>
										Description
									</Text>
									<Text
										className={`text-s mb-4 font-light ${
											isDarkMode ? 'text-white' : 'text-black'
										}`}>
										{car.description}
									</Text>

									<View style={{ flexDirection: 'row', alignItems: 'center' }}>
										<View
											style={{ flex: 1, height: 1, backgroundColor: '#D55004' }}
										/>
										<View
											style={{ flex: 1, height: 1, backgroundColor: '#D55004' }}
										/>
									</View>

									<Text
										className={`text-l mt-4 ${
											isDarkMode ? 'text-white' : 'text-black'
										} mb-3 font-bold`}>
										Technical Data
									</Text>
									<View
										className={`mb-6 mt-3 border ${
											isDarkMode ? 'border-white' : 'border-black'
										} rounded-lg`}>
										<View
											className={`flex-row p-2 border-b ${
												isDarkMode ? 'border-white' : 'border-black'
											} justify-between py-2`}>
											<Text
												className={`text-l ${
													isDarkMode ? 'text-white' : 'text-black'
												} font-bold`}>
												Mileage
											</Text>
											<Text className='text-l' style={{ color: '#D55004' }}>
												{`${car.mileage.toLocaleString()} km`}
											</Text>
										</View>
										<View
											className={`flex-row p-2 border-b ${
												isDarkMode ? 'border-white' : 'border-black'
											} justify-between py-2`}>
											<Text
												className={`text-l ${
													isDarkMode ? 'text-white' : 'text-black'
												} font-bold`}>
												Transmission
											</Text>
											<Text className='text-l' style={{ color: '#D55004' }}>
												{car.transmission}
											</Text>
										</View>
										<View
											className={`flex-row p-2 border-b ${
												isDarkMode ? 'border-white' : 'border-black'
											} justify-between py-2`}>
											<Text
												className={`text-l ${
													isDarkMode ? 'text-white' : 'text-black'
												} font-bold`}>
												Condition
											</Text>
											<Text className='text-l' style={{ color: '#D55004' }}>
												{car.condition}
											</Text>
										</View>
										<View
											className={`flex-row p-2 border-b ${
												isDarkMode ? 'border-white' : 'border-black'
											} justify-between py-2`}>
											<Text
												className={`text-l ${
													isDarkMode ? 'text-white' : 'text-black'
												} font-bold`}>
												Color
											</Text>
											<Text className='text-l' style={{ color: '#D55004' }}>
												{car.color}
											</Text>
										</View>
										<View
											className={`flex-row p-2 border-b ${
												isDarkMode ? 'border-white' : 'border-black'
											} justify-between py-2`}>
											<Text
												className={`text-l ${
													isDarkMode ? 'text-white' : 'text-black'
												} font-bold`}>
												Drive Train
											</Text>
											<Text className='text-l' style={{ color: '#D55004' }}>
												{car.drivetrain}
											</Text>
										</View>
									</View>

									<TouchableOpacity
										className={`flex-row items-center justify-center ${
											isDarkMode ? 'bg-gray-800' : 'bg-gray-200'
										} p-3 rounded-lg mb-6`}
										onPress={() => onFavoritePress(car.id)}>
										<Ionicons
											name={isFavorite(car.id) ? 'heart' : 'heart-outline'}
											size={24}
											color={
												isFavorite(car.id)
													? 'red'
													: isDarkMode
													? 'white'
													: 'black'
											}
										/>
										<Text
											className={`text-lg font-bold ${
												isDarkMode ? 'text-white' : 'text-black'
											} ml-3`}>
											{isFavorite(car.id) ? 'Unlike' : 'Like'}
										</Text>
									</TouchableOpacity>

									<View style={{ flexDirection: 'row', alignItems: 'center' }}>
										<View
											style={{ flex: 1, height: 1, backgroundColor: '#D55004' }}
										/>
										<View
											style={{ flex: 1, height: 1, backgroundColor: '#D55004' }}
										/>
									</View>

									<Text
										className={`text-lg font-bold ${
											isDarkMode ? 'text-white' : 'text-black'
										} mt-2 mb-2`}>
										Dealer Information
									</Text>
									<View className='border-t border-gray-600 pt-4'>
										<View className='items-center'>
											{car.dealership_logo && (
												<TouchableOpacity onPress={handleDealershipPress}>
													<Image
														source={{ uri: car.dealership_logo }}
														className='w-32 rounded-full h-32 mb-4'
														resizeMode='contain'
													/>
												</TouchableOpacity>
											)}
											<Text
												className={`text-xl font-bold ${
													isDarkMode ? 'text-white' : 'text-black'
												} mb-2`}>
												{car.dealership_name}
											</Text>
										</View>

										<MapView
											style={{
												height: 200,
												borderRadius: 10,
												marginVertical: 10
											}}
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
									</View>

									{/* Similar Cars Section */}
									<Text
										className={`text-xl font-bold ${
											isDarkMode ? 'text-white' : 'text-black'
										} mt-8 mb-4`}>
										Similarly Priced Cars
									</Text>
									<FlatList
										data={similarCars}
										renderItem={renderCarItem}
										keyExtractor={(item: any) => item.id.toString()}
										horizontal
										showsHorizontalScrollIndicator={false}
									/>

									{/* Other Cars from Same Dealer Section */}
									<Text
										className={`text-xl font-bold ${
											isDarkMode ? 'text-white' : 'text-black'
										} mt-8`}>
										More from {car.dealership_name}
									</Text>
									<FlatList
										data={dealerCars}
										renderItem={renderCarItem}
										keyExtractor={(item: any) => item.id.toString()}
										horizontal
										showsHorizontalScrollIndicator={false}
									/>
								</View>
							</ScrollView>
							<View
								style={styles.callToActionContainer}
								className={`${
									isDarkMode ? 'bg-night' : 'bg-light-background'
								}`}>
								{car.dealership_phone && (
									<TouchableOpacity
										style={styles.callToActionButton}
										onPress={handleCall}>
										<Ionicons name='call-outline' size={24} color='#D55004' />
									</TouchableOpacity>
								)}
								<TouchableOpacity
									style={styles.callToActionButton}
									onPress={handleWhatsApp}>
									<FontAwesome name='whatsapp' size={24} color='#D55004' />
								</TouchableOpacity>
								<TouchableOpacity
									style={styles.callToActionButton}
									onPress={handleChat}>
									<Ionicons
										name='chatbubbles-outline'
										size={24}
										color='#D55004'
									/>
								</TouchableOpacity>
								<TouchableOpacity
									style={styles.callToActionButton}
									onPress={handleShare}>
									<MaterialIcons name='share' size={24} color='#D55004' />
								</TouchableOpacity>
							</View>
						</LinearGradient>
					</Animated.View>
				</View>
			</Modal>
		)
	}
)

const styles = StyleSheet.create({
	modalOverlay: {
		flex: 1,
		justifyContent: 'flex-end',
		backgroundColor: 'rgba(0, 0, 0, 0.5)'
	},
	modalContent: {
		backgroundColor: 'white',
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		height: '90%',
		paddingTop: Platform.OS === 'ios' ? 40 : 20
	},
	gradientContainer: {
		flex: 1,
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20
	},
	closeButton: {
		position: 'absolute',
		top: 10,
		right: 10,
		zIndex: 10,
		padding: 10
	},
	image: {
		width: width,
		height: 300,
		resizeMode: 'cover'
	},
	callToActionContainer: {
		position: 'absolute',
		bottom: 0,
		width: '100%',
		flexDirection: 'row',
		justifyContent: 'space-around',
		paddingVertical: 10,
		borderTopWidth: 1
	},
	callToActionButton: {
		alignItems: 'center',
		justifyContent: 'center',
		width: 50,
		height: 50
	}
})

export default CarDetailModal
