import React, { useCallback, useEffect, useState, useRef, memo } from 'react'
import {
	StyleSheet,
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	FlatList,
	Dimensions,
	Linking,
	Alert,
	Share,
	Platform
} from 'react-native'
import { Ionicons, FontAwesome, MaterialIcons } from '@expo/vector-icons'
import { useUser } from '@clerk/clerk-expo'
import { supabase } from '@/utils/supabase'
import { debounce } from '@/utils/debounce'
import { useFavorites } from '@/utils/useFavorites'
import MapView, { Marker } from 'react-native-maps'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useTheme } from '@/utils/ThemeContext'

import Animated, {
	useSharedValue,
	useAnimatedStyle,
	withTiming,
	runOnJS,
	useAnimatedGestureHandler
} from 'react-native-reanimated'
import { PanGestureHandler } from 'react-native-gesture-handler'

const { width, height } = Dimensions.get('window')

const OptimizedImage = memo(({ source, style, onLoad }: any) => {
	const [loaded, setLoaded] = useState(false)

	const handleLoad = useCallback(() => {
		setLoaded(true)
		onLoad && onLoad()
	}, [onLoad])

	return (
		<View style={style}>
			{!loaded && (
				<View
					style={[style, { backgroundColor: '#E0E0E0', position: 'absolute' }]}
				/>
			)}
			<Animated.Image
				source={source}
				style={style}
				onLoad={handleLoad}
				resizeMode='cover'
			/>
		</View>
	)
})

const CarDetailModalIOS = memo(
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
		const { user } = useUser()
		const { isFavorite } = useFavorites()
		const [similarCars, setSimilarCars] = useState<any>([])
		const [dealerCars, setDealerCars] = useState<any>([])
		const scrollViewRef = useRef<any>(null)
		const translateY = useSharedValue(0)
		const [activeImageIndex, setActiveImageIndex] = useState<any>(0)

		const handleDealershipPress = useCallback(() => {
			onClose()
			router.push({
				pathname: '/(home)/(user)/DealershipDetails',
				params: { dealershipId: car.dealership_id }
			})
		}, [onClose, router, car.dealership_id])

		useEffect(() => {
			if (isVisible && car && user) {
				trackCarView(car.id, user.id)
				fetchSimilarCars()
				fetchDealerCars()

				if (scrollViewRef.current) {
					scrollViewRef.current.scrollTo({ y: 0, animated: false })
				}
			}
		}, [isVisible, car, user])

		const closeModal = useCallback(() => {
			translateY.value = withTiming(height, {}, () => {
				runOnJS(onClose)()
			})
		}, [onClose])

		const fetchSimilarCars = useCallback(async () => {
			const { data, error } = await supabase
				.from('cars')
				.select('*, dealerships (name,logo,phone,location,latitude,longitude)')
				.neq('id', car.id)
				.gte('price', Math.floor(car.price * 0.8))
				.lte('price', Math.floor(car.price * 1.2))
				.limit(5)

			if (data) {
				const newCars = data.map(item => ({
					...item,
					dealership_name: item.dealerships.name,
					dealership_logo: item.dealerships.logo,
					dealership_phone: item.dealerships.phone,
					dealership_location: item.dealerships.location,
					dealership_latitude: item.dealerships.latitude,
					dealership_longitude: item.dealerships.longitude,
					listed_at: item.listed_at
				}))
				setSimilarCars(newCars)
			}
			if (error) console.error('Error fetching similar cars:', error)
		}, [car.id, car.price])

		const fetchDealerCars = useCallback(async () => {
			const { data, error } = await supabase
				.from('cars')
				.select('*, dealerships (name,logo,phone,location,latitude,longitude)')
				.eq('dealership_id', car.dealership_id)
				.neq('id', car.id)
				.limit(5)

			if (data) {
				const newCars = data.map(item => ({
					...item,
					dealership_name: item.dealerships.name,
					dealership_logo: item.dealerships.logo,
					dealership_phone: item.dealerships.phone,
					dealership_location: item.dealerships.location,
					dealership_latitude: item.dealerships.latitude,
					dealership_longitude: item.dealerships.longitude,
					listed_at: item.listed_at
				}))
				setDealerCars(newCars)
			}
			if (error) console.error('Error fetching dealer cars:', error)
		}, [car.dealership_id, car.id])

		const trackCarView = useCallback(
			async (carId: any, userId: any) => {
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
			debounce((carId: any, userId: any) => {
				trackCarView(carId, userId)
			}, 1000),
			[trackCarView]
		)

		useEffect(() => {
			if (isVisible && car && user) {
				debouncedTrackCarView(car.id, user.id)
			}
		}, [isVisible, car, user, debouncedTrackCarView])

		const mapRegion = {
			latitude: car.dealership_latitude || 37.7749,
			longitude: car.dealership_longitude || -122.4194,
			latitudeDelta: 0.01,
			longitudeDelta: 0.01
		}

		const handleCall = useCallback(() => {
			if (car.dealership_phone) {
				Linking.openURL(`tel:${car.dealership_phone}`)
			} else {
				Alert.alert('Phone number not available')
			}
		}, [car.dealership_phone])

		const handleWhatsApp = useCallback(() => {
			if (car.dealership_phone) {
				const message = `Hi, I'm interested in the ${car.make} ${car.model}.`
				const url = `https://wa.me/${
					car.dealership_phone
				}?text=${encodeURIComponent(message)}`
				Linking.openURL(url)
			} else {
				Alert.alert('WhatsApp number not available')
			}
		}, [car.dealership_phone, car.make, car.model])

		const handleChat = useCallback(() => {
			Alert.alert('Chat feature coming soon!')
		}, [])

		const handleShare = useCallback(async () => {
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
		}, [car])

		const renderCarItem = useCallback(
			({ item }: any) => (
				<TouchableOpacity
					className={`${
						isDarkMode ? 'bg-gray-800' : 'bg-gray-200'
					} rounded-lg p-2 mr-4 w-48`}
					onPress={() => {
						onClose()
						setSelectedCar(item)
						setIsModalVisible(true)
					}}>
					<OptimizedImage
						source={{ uri: item.images[0] }}
						style={{ width: '100%', height: 128, borderRadius: 8 }}
					/>
					<Text
						className={`${
							isDarkMode ? 'text-white' : 'text-black'
						} font-bold mt-2`}>
						{item.year} {item.make} {item.model}
					</Text>
					<Text className='text-red mt-1'>${item.price.toLocaleString()}</Text>
				</TouchableOpacity>
			),
			[isDarkMode, onClose, setSelectedCar, setIsModalVisible]
		)

		const animatedStyle = useAnimatedStyle(() => ({
			transform: [{ translateY: translateY.value }]
		}))

		const gestureHandler = useAnimatedGestureHandler({
			onStart: (_, context) => {
				context.startY = translateY.value
			},
			onActive: (event, context: any) => {
				translateY.value = Math.max(0, context.startY + event.translationY)
			},
			onEnd: event => {
				if (event.velocityY > 500 || translateY.value > height * 0.2) {
					runOnJS(closeModal)()
				} else {
					translateY.value = withTiming(0)
				}
			}
		})

		const renderImageItem = useCallback(
			({ item, index }: any) => (
				<OptimizedImage
					source={{ uri: item }}
					style={styles.image}
					onLoad={() => {
						if (index === 0) setActiveImageIndex(0)
					}}
				/>
			),
			[]
		)

		const renderPaginationDots = () => {
			return (
				<View style={styles.paginationContainer}>
					{car.images.map((_: any, index: React.Key | null | undefined) => (
						<View
							key={index}
							style={[
								styles.paginationDot,
								index === activeImageIndex
									? styles.activeDot
									: styles.inactiveDot
							]}
						/>
					))}
				</View>
			)
		}

		useEffect(() => {
			if (isVisible) {
				translateY.value = withTiming(0)
			}
		}, [isVisible])

		const handleOpenInGoogleMaps = useCallback(() => {
			const latitude = car.dealership_latitude || 37.7749;
			const longitude = car.dealership_longitude || -122.4194;
			const url = `https://www.google.com/maps?q=${latitude},${longitude}`;

			Linking.openURL(url).catch(err => {
				Alert.alert('Error', 'Could not open Google Maps');
			});
		}, [car.dealership_latitude, car.dealership_longitude]);

		return (
			<PanGestureHandler onGestureEvent={gestureHandler}>
				<Animated.View
					className={`${isDarkMode ? 'bg-black' : 'bg-white'}`}
					style={[styles.modalOverlay, animatedStyle]}>
					<LinearGradient
						colors={
							isDarkMode ? ['#333', '#222', '#111'] : ['#FFFFFF', '#F5F5F5']
						}
						style={styles.gradientContainer}>
						<ScrollView ref={scrollViewRef} style={styles.scrollView}>
							<TouchableOpacity style={styles.closeButton} onPress={closeModal}>
								<Ionicons name='close' size={50} color='#D55004' />
							</TouchableOpacity>
							<View style={styles.imageContainer}>
								<FlatList
									data={car.images}
									renderItem={renderImageItem}
									keyExtractor={(item, index) => `${car.id}-image-${index}`}
									horizontal
									pagingEnabled
									showsHorizontalScrollIndicator={false}
									onMomentumScrollEnd={event => {
										const newIndex = Math.round(
											event.nativeEvent.contentOffset.x / width
										)
										setActiveImageIndex(newIndex)
									}}
									initialNumToRender={1}
									maxToRenderPerBatch={2}
									windowSize={3}
								/>
								{renderPaginationDots()}
							</View>
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
									{[
										{
											label: 'Mileage',
											value: `${car.mileage.toLocaleString()} km`
										},
										{ label: 'Transmission', value: car.transmission },
										{ label: 'Condition', value: car.condition },
										{ label: 'Color', value: car.color },
										{ label: 'Drive Train', value: car.drivetrain }
									].map((item, index) => (
										<View
											key={index}
											className={`flex-row p-2 ${
												index !== 4
													? `border-b ${
															isDarkMode ? 'border-white' : 'border-black'
													  }`
													: ''
											} justify-between py-2`}>
											<Text
												className={`text-l ${
													isDarkMode ? 'text-white' : 'text-black'
												} font-bold`}>
												{item.label}
											</Text>
											<Text className='text-l' style={{ color: '#D55004' }}>
												{item.value}
											</Text>
										</View>
									))}
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
												<OptimizedImage
													source={{ uri: car.dealership_logo }}
													style={{ width: 128, height: 128, borderRadius: 64 }}
												/>
											</TouchableOpacity>
										)}
										<Text
											className={`text-xl font-bold ${
												isDarkMode ? 'text-white' : 'text-black'
											} mb-2 mt-4`}
											onPress={handleDealershipPress}>
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
												latitude: car.dealership_latitude || 37.7749,
												longitude: car.dealership_longitude || -122.4194
											}}
											title={car.dealership_name}
											description={car.dealership_location}
										/>
									</MapView>
									<TouchableOpacity
										onPress={handleOpenInGoogleMaps}
										className={`flex-row items-center justify-center p-3 mt-2 rounded-lg bg-red`}>
										<Ionicons name="navigate-outline" size={24} color="white" />
										<Text className="text-white font-semibold ml-2">
											Open in Google Maps
										</Text>
									</TouchableOpacity>
								</View>

								<Text
									className={`text-xl font-bold ${
										isDarkMode ? 'text-white' : 'text-black'
									} mt-8 mb-4`}>
									Similarly Priced Cars
								</Text>
								<FlatList
									data={similarCars}
									renderItem={renderCarItem}
									keyExtractor={item =>
										`${item.id}-${item.make}-${item.model}-${Math.random()}`
									}
									horizontal
									showsHorizontalScrollIndicator={false}
								/>

								<Text
									className={`text-xl font-bold ${
										isDarkMode ? 'text-white' : 'text-black'
									} mt-8 mb-4`}>
									More from {car.dealership_name}
								</Text>
								<FlatList
									data={dealerCars}
									renderItem={renderCarItem}
									keyExtractor={item =>
										`${item.id}-${item.make}-${item.model}-${Math.random()}`
									}
									horizontal
									showsHorizontalScrollIndicator={false}
								/>
							</View>
							<View
							style={styles.callToActionContainer}
							className={isDarkMode ? 'bg-night' : 'bg-light-background'}>
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
						</ScrollView>

					</LinearGradient>
				</Animated.View>
			</PanGestureHandler>
		)
	}
)

const styles = StyleSheet.create({
	modalOverlay: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		justifyContent: 'flex-end'
	},
	gradientContainer: {
		height: '100%',
		width: '100%'
	},
	scrollView: {
		flex: 1
	},
	callToActionContainer: {
		width: '100%',
		flexDirection: 'row',
		justifyContent: 'space-around',
		marginBottom:64,
		paddingVertical: 10,
	},
	callToActionButton: {
		alignItems: 'center',
		justifyContent: 'center',
		width: 50,
		height: 50
	},
	imageContainer: {
		position: 'relative',
		height: 300 // Adjust this value as needed
	},
	image: {
		width: width,
		height: 300,
		resizeMode: 'cover'
	},
	paginationContainer: {
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
		position: 'absolute',
		bottom: 10,
		left: 0,
		right: 0,
		zIndex: 1
	},
	paginationDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		marginHorizontal: 4
	},
	activeDot: {
		backgroundColor: '#D55004'
	},
	inactiveDot: {
		backgroundColor: 'rgba(255, 255, 255, 0.5)'
	},
	closeButton: {
		position: 'absolute',
		top: 30,
		right: 10,
		zIndex: 2
	},
	contentContainer: {
		padding: 16,
		paddingBottom: 96 // Adjust this value to ensure content is not hidden behind the action buttons
	}
})

export default CarDetailModalIOS
