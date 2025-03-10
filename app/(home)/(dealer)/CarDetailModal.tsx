import React, { useCallback, useEffect, useState, useRef, memo } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	FlatList,
	Dimensions,
	Alert,
	Share,
	StyleSheet,
	Platform,
	Animated
} from 'react-native'
import { Ionicons, FontAwesome, MaterialIcons } from '@expo/vector-icons'
import { useAuth } from '@/utils/AuthContext'
import { supabase } from '@/utils/supabase'
import { debounce } from '@/utils/debounce'
import { useFavorites } from '@/utils/useFavorites'
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'
import * as Linking from 'expo-linking'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useTheme } from '@/utils/ThemeContext'
import Modal from 'react-native-modal'

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

const CarDetailModal = memo(
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
		const { user } = useAuth()
		const { isFavorite } = useFavorites()
		const [similarCars, setSimilarCars] = useState<any>([])
		const [dealerCars, setDealerCars] = useState<any>([])
		const [activeImageIndex, setActiveImageIndex] = useState<any>(0)

		const handleDealershipPress = useCallback(() => {
			onClose()
			router.push({
				pathname: '/(home)/(dealer)/DealershipDetails',
				params: { dealershipId: car.dealership_id }
			})
		}, [onClose, router, car.dealership_id])

		useEffect(() => {
			if (isVisible && car && user) {
				trackCarView(car.id, user.id)
				fetchSimilarCars()
				fetchDealerCars()
			}
		}, [isVisible, car, user])

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
				const url = `https://wa.me/+961${
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

		const DealershipMapView = ({ car, isDarkMode }: any) => {
			const mapRef = useRef<MapView>(null)
			const [showCallout, setShowCallout] = useState(false)

			const zoomToFit = useCallback(() => {
				if (mapRef.current) {
					mapRef.current.fitToSuppliedMarkers(['dealershipMarker'], {
						edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
						animated: true
					})
				}
			}, [])

			const openInMaps = useCallback(() => {
				const scheme = Platform.select({
					ios: 'maps:0,0?q=',
					android: 'geo:0,0?q='
				})
				const latLng = `${car.dealership_latitude},${car.dealership_longitude}`
				const label = encodeURIComponent(car.dealership_name)
				const url: any = Platform.select({
					ios: `${scheme}${label}@${latLng}`,
					android: `${scheme}${latLng}(${label})`
				})
				Linking.openURL(url)
			}, [car])

			const handleMarkerPress = useCallback(() => {
				setShowCallout(true)
			}, [])

			const handleMapPress = useCallback(() => {
				setShowCallout(false)
			}, [])

			return (
				<View className='h-64 rounded-lg overflow-hidden'>
					<MapView
						ref={mapRef}
						provider={PROVIDER_GOOGLE}
						style={{ flex: 1 }}
						initialRegion={{
							latitude: car.dealership_latitude || 37.7749,
							longitude: car.dealership_longitude || -122.4194,
							latitudeDelta: 0.02,
							longitudeDelta: 0.02
						}}
						onMapReady={zoomToFit}
						showsUserLocation={true}
						showsMyLocationButton={true}
						showsCompass={true}
						zoomControlEnabled={true}
						mapType={isDarkMode ? 'mutedStandard' : 'standard'}
						onPress={handleMapPress}>
						<Marker
							identifier='dealershipMarker'
							coordinate={{
								latitude: car.dealership_latitude || 37.7749,
								longitude: car.dealership_longitude || -122.4194
							}}
							onPress={handleMarkerPress}>
							<OptimizedImage
								source={{ uri: car.dealership_logo }}
								style={{ width: 40, height: 40, borderRadius: 20 }}
							/>
						</Marker>
					</MapView>
					{showCallout && (
						<View className='absolute bottom-4 left-4 right-4 bg-white dark:bg-gray-800 rounded-lg p-3 shadow-lg'>
							<Text className='font-bold text-sm text-black dark:text-white'>
								{car.dealership_name}
							</Text>
							<Text className='text-xs mt-1 text-gray-600 dark:text-gray-300'>
								{car.dealership_location}
							</Text>
							<View className='flex-row justify-between mt-2'>
								<TouchableOpacity
									className='bg-red py-2 px-3 rounded-full flex-row items-center'
									onPress={openInMaps}>
									<Ionicons name='map' size={16} color='white' />
									<Text className='text-white text-xs ml-1'>View on Map</Text>
								</TouchableOpacity>
								<TouchableOpacity
									className='bg-gray-200 dark:bg-gray-600 py-2 px-3 rounded-full'
									onPress={() => setShowCallout(false)}>
									<Text className='text-gray-800 dark:text-white text-xs'>
										Close
									</Text>
								</TouchableOpacity>
							</View>
						</View>
					)}
				</View>
			)
		}

		return (
			<Modal
				isVisible={isVisible}
				onBackdropPress={onClose}
				onSwipeComplete={onClose}
				swipeDirection={['down']}
				style={{ margin: 0 }}
				useNativeDriver
				useNativeDriverForBackdrop>
				<View
					style={{ flex: 1, backgroundColor: isDarkMode ? '#111' : '#F5F5F5' }}>
					<ScrollView bounces={false} showsVerticalScrollIndicator={false}>
						<LinearGradient
							colors={
								isDarkMode ? ['#333', '#222', '#111'] : ['#FFFFFF', '#F5F5F5']
							}
							style={{ flex: 1 }}>
							<TouchableOpacity style={styles.closeButton} onPress={onClose}>
								<Ionicons name='close' size={30} color='#D55004' />
							</TouchableOpacity>
							<View style={styles.imageContainer}>
								<FlatList
									data={car.images}
									renderItem={({ item, index }) => (
										<OptimizedImage
											source={{ uri: item }}
											style={styles.image}
											onLoad={() => {
												if (index === 0) setActiveImageIndex(0)
											}}
										/>
									)}
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
								<View style={styles.paginationContainer}>
									{car.images.map(
										(_: any, index: React.Key | null | undefined) => (
											<View
												key={index}
												style={[
													styles.paginationDot,
													index === activeImageIndex
														? styles.activeDot
														: styles.inactiveDot
												]}
											/>
										)
									)}
								</View>
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
										style={{
											flex: 1,
											height: 1,
											backgroundColor: '#D55004'
										}}
									/>
									<View
										style={{
											flex: 1,
											height: 1,
											backgroundColor: '#D55004'
										}}
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
										style={{
											flex: 1,
											height: 1,
											backgroundColor: '#D55004'
										}}
									/>
									<View
										style={{
											flex: 1,
											height: 1,
											backgroundColor: '#D55004'
										}}
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
										style={{
											flex: 1,
											height: 1,
											backgroundColor: '#D55004'
										}}
									/>
									<View
										style={{
											flex: 1,
											height: 1,
											backgroundColor: '#D55004'
										}}
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
													style={{
														width: 128,
														height: 128,
														borderRadius: 64
													}}
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

									<DealershipMapView car={car} isDarkMode={isDarkMode} />
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
						</LinearGradient>
					</ScrollView>
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
							<Ionicons name='chatbubbles-outline' size={24} color='#D55004' />
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.callToActionButton}
							onPress={handleShare}>
							<MaterialIcons name='share' size={24} color='#D55004' />
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
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
		height: '96%',
		width: '100%'
	},
	scrollView: {
		flex: 1
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
		top: 10,
		right: 10,
		zIndex: 2
	},
	contentContainer: {
		padding: 16,
		paddingBottom: 96 // Adjust this value to ensure content is not hidden behind the action buttons
	}
})

export default CarDetailModal
