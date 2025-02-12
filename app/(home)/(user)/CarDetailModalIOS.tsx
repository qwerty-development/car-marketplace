import React, {
	useCallback,
	useEffect,
	useState,
	useRef,
	memo,
	useMemo
} from 'react'
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
	PanResponder,
	Platform,
	AppState
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useUser } from '@clerk/clerk-expo'
import { supabase } from '@/utils/supabase'
import { debounce } from '@/utils/debounce'
import { useFavorites } from '@/utils/useFavorites'
import MapView, { Marker } from 'react-native-maps'
import { useRouter } from 'expo-router'
import { useTheme } from '@/utils/ThemeContext'
import { Image } from 'expo-image'
import AutoclipModal from '@/components/AutoclipModal'
import { LinearGradient } from 'expo-linear-gradient'

const { width } = Dimensions.get('window')

const OptimizedImage = React.memo(({ source, style, onLoad }: any) => {
	const [loaded, setLoaded] = useState(false)

	const handleLoad = useCallback(() => {
		setLoaded(true)
		onLoad?.()
	}, [onLoad])

	const blurhash =
		'|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj['

	return (
		<View style={[style, { overflow: 'hidden' }]}>
			<Image
				source={source}
				style={[
					style,
					{
						opacity: loaded ? 1 : 0.3
					}
				]}
				onLoad={handleLoad}
				recyclingKey={`${source.uri}`}
				placeholder={blurhash}
				contentFit='cover'
				transition={200}
				cachePolicy='memory-disk'
			/>
		</View>
	)
})

const getLogoUrl = (make: string, isLightMode: boolean) => {
	const formattedMake = make.toLowerCase().replace(/\s+/g, '-')

	switch (formattedMake) {
		case 'range-rover':
			return isLightMode
				? 'https://www.carlogos.org/car-logos/land-rover-logo-2020-green.png'
				: 'https://www.carlogos.org/car-logos/land-rover-logo.png'
		case 'infiniti':
			return 'https://www.carlogos.org/car-logos/infiniti-logo.png'
		case 'audi':
			return 'https://www.freepnglogos.com/uploads/audi-logo-2.png'
		case 'nissan':
			return 'https://cdn.freebiesupply.com/logos/large/2x/nissan-6-logo-png-transparent.png'
		default:
			return `https://www.carlogos.org/car-logos/${formattedMake}-logo.png`
	}
}

const ActionButton = ({ icon, onPress, text, isDarkMode }: any) => (
	<TouchableOpacity onPress={onPress} className='items-center mx-2'>
		<Ionicons
			name={icon}
			size={24}
			color={isDarkMode ? '#FFFFFF' : '#000000'}
		/>
		<Text
			className={`text-xs mt-1 ${isDarkMode ? 'text-white' : 'text-black'}`}>
			{text}
		</Text>
	</TouchableOpacity>
)

const TechnicalDataItem = ({ icon, label, value, isDarkMode, isLast }: any) => (
	<View className={`flex-row items-center p-4 relative`}>
		<View className='w-8'>
			<Ionicons
				name={icon}
				size={24}
				color={isDarkMode ? '#FFFFFF' : '#000000'}
			/>
		</View>
		<Text
			className={`flex-1 text-sm ${isDarkMode ? 'text-white' : 'text-black'}`}>
			{label}
		</Text>
		<Text className='dark:text-white font-semibold text-sm'>{value}</Text>

		{!isLast && (
			<View className='absolute bottom-0 left-[12.5%] w-4/5 h-[1px] bg-[#c9c9c9]' />
		)}
	</View>
)

const CarDetailScreen = ({ car, onFavoritePress, onViewUpdate }: any) => {
	if (!car) return null
	console.log(onFavoritePress)

	const { isDarkMode } = useTheme()
	const router = useRouter()
	const { user } = useUser()
	const { isFavorite } = useFavorites()
	const [similarCars, setSimilarCars] = useState<any>([])
	const [dealerCars, setDealerCars] = useState<any>([])
	const scrollViewRef = useRef<any>(null)
	const [activeImageIndex, setActiveImageIndex] = useState(0)
	const [autoclips, setAutoclips] = useState<any>([])
	const [selectedClip, setSelectedClip] = useState<any>(null)
	const [showClipModal, setShowClipModal] = useState<any>(false)

	// Add fetchAutoclips function
	const fetchAutoclips = useCallback(async () => {
		if (!car) return

		try {
			const { data, error } = await supabase
				.from('auto_clips')
				.select('*')
				.eq('car_id', car.id)
				.eq('status', 'published')
				.order('created_at', { ascending: false })

			if (error) throw error
			setAutoclips(data || [])
		} catch (error) {
			console.error('Error fetching autoclips:', error)
		}
	}, [car])

	// Add to useEffect for initial fetch
	useEffect(() => {
		if (car) {
			fetchAutoclips()
		}
	}, [car, fetchAutoclips])

	const handleClipLike = useCallback(
		async clipId => {
			if (!user) return

			try {
				const { data: newLikesCount, error } = await supabase.rpc(
					'toggle_autoclip_like',
					{
						clip_id: clipId,
						user_id: user.id
					}
				)

				if (error) throw error

				setAutoclips(prev =>
					prev.map(clip =>
						clip.id === clipId
							? {
									...clip,
									likes: newLikesCount,
									liked_users: clip.liked_users?.includes(user.id)
										? clip.liked_users.filter(id => id !== user.id)
										: [...(clip.liked_users || []), user.id]
							  }
							: clip
					)
				)
			} catch (error) {
				console.error('Error toggling autoclip like:', error)
			}
		},
		[user]
	)

	useEffect(() => {
		const subscription = AppState.addEventListener('memoryWarning', () => {
			// Clear non-essential data
			setSimilarCars([])
			setDealerCars([])
		})

		return () => {
			subscription.remove()
		}
	}, [])

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

	useEffect(() => {
		if (car && user) {
			trackCarView(car.id, user.id)
			if (scrollViewRef.current) {
				scrollViewRef.current.scrollTo({ y: 0, animated: false })
			}
		}
	}, [car, user, trackCarView])

	const fetchSimilarCars = useCallback(async () => {
		try {
			// First, try to find cars with same make, model, and year
			let { data: exactMatches, error: exactMatchError } = await supabase
				.from('cars')
				.select('*, dealerships (name,logo,phone,location,latitude,longitude)')
				.eq('make', car.make)
				.eq('model', car.model)
				.eq('year', car.year)
				.neq('id', car.id)
				.eq('status', 'available')
				.limit(5)

			if (exactMatchError) throw exactMatchError

			if (exactMatches && exactMatches.length > 0) {
				const newCars = exactMatches.map(item => ({
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
				return
			}

			// If no exact matches, fall back to similarly priced cars
			const { data: priceMatches, error: priceMatchError } = await supabase
				.from('cars')
				.select('*, dealerships (name,logo,phone,location,latitude,longitude)')
				.neq('id', car.id)
				.eq('status', 'available')
				.gte('price', Math.floor(car.price * 0.8))
				.lte('price', Math.floor(car.price * 1.2))
				.limit(5)

			if (priceMatchError) throw priceMatchError

			if (priceMatches && priceMatches.length > 0) {
				const newCars = priceMatches.map(item => ({
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
			} else {
				setSimilarCars([])
			}
		} catch (error) {
			console.error('Error fetching similar cars:', error)
			setSimilarCars([])
		}
	}, [car.id, car.make, car.model, car.year, car.price])

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

	useEffect(() => {
		return () => {
			// Clear image cache on unmount
			if (Platform.OS === 'ios') {
				Image.clearMemoryCache()
			}
		}
	}, [])

	useEffect(() => {
		if (car) {
			// Optional: Add small delay for smoother transition
			const timer = setTimeout(() => {
				fetchSimilarCars()
			}, 100)
			return () => clearTimeout(timer)
		}
	}, [car, fetchSimilarCars])

	// Fetch dealer cars after initial render (or after a slight delay)
	useEffect(() => {
		if (car) {
			// Optional: Stagger the loading slightly
			const timer = setTimeout(() => {
				fetchDealerCars()
			}, 200)
			return () => clearTimeout(timer)
		}
	}, [car, fetchDealerCars])

	const handleDealershipPress = useCallback(() => {
		router.push({
			pathname: '/(home)/(user)/DealershipDetails',
			params: { dealershipId: car.dealership_id }
		})
	}, [router, car.dealership_id])

	const debouncedTrackCarView = useCallback(
		debounce((carId: any, userId: any) => {
			trackCarView(carId, userId)
		}, 1000),
		[trackCarView]
	)

	const handleCall = useCallback(() => {
		if (car.dealership_phone) {
			Linking.openURL(`tel:${car.dealership_phone}`)
		} else {
			Alert.alert('Phone number not available')
		}
	}, [car.dealership_phone])

	const handleChat = useCallback(() => {
		Alert.alert('Chat feature coming soon!')
	}, [])

	const handleShare = useCallback(async () => {
		try {
			await Share.share({
				message: `Check out this ${car.year} ${car.make} ${
					car.model
				} for $${car.price.toLocaleString()}!`,
				url: car.images[0]
			})
		} catch (error: any) {
			Alert.alert(error.message)
		}
	}, [car])

	const handleOpenInGoogleMaps = useCallback(() => {
		const latitude = car.dealership_latitude || 37.7749
		const longitude = car.dealership_longitude || -122.4194
		const url = `https://www.google.com/maps?q=${latitude},${longitude}`

		Linking.openURL(url).catch(err => {
			Alert.alert('Error', 'Could not open Google Maps')
		})
	}, [car.dealership_latitude, car.dealership_longitude])

	const renderCarItem = useCallback(
		({ item }: any) => (
			<TouchableOpacity
				className={`${
					isDarkMode ? 'bg-gray-800' : 'bg-gray-200'
				} rounded-lg p-2 mr-4 w-48`}
				onPress={() => {
					router.push({
						pathname: '/(home)/(user)/CarDetails',
						params: { carId: item.id }
					})
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
			</TouchableOpacity>
		),
		[isDarkMode, router]
	)

	const mapRegion = {
		latitude: car.dealership_latitude || 37.7749,
		longitude: car.dealership_longitude || -122.4194,
		latitudeDelta: 0.01,
		longitudeDelta: 0.01
	}

	return (
		<View className={`${isDarkMode ? 'bg-black' : 'bg-white'} flex-1`}>
			<TouchableOpacity
				onPress={() => router.back()}
				className='absolute top-12 left-4 z-50 rounded-full p-2'
				style={{
					backgroundColor: isDarkMode
						? 'rgba(255,255,255,0.5)'
						: 'rgba(0,0,0,0.5)',
					shadowColor: '#000',
					shadowOffset: { width: 0, height: 2 },
					shadowOpacity: 0.25,
					shadowRadius: 3.84,
					elevation: 5
				}}>
				<Ionicons
					name='arrow-back'
					size={20}
					color={isDarkMode ? '#FFFFFF' : '#FFFFFF'}
				/>
			</TouchableOpacity>

			<ScrollView
				ref={scrollViewRef}
				className='rounded-b-lg'
				scrollEventThrottle={16}>
				{/* Image Carousel  */}
				<View className='relative mb-6 overflow-visible'>
					<View className='rounded-b-[20px] overflow-hidden'>
						<FlatList
							data={car.images}
							renderItem={({ item }) => (
								<View className='relative'>
									<OptimizedImage
										source={{ uri: item }}
										style={{ width: width, height: 350 }}
									/>
									{/* Eye and heart icons positioned within the image */}
									<View className='absolute    top-12 right-0 flex-row items-center z-10'>
										<View className='flex-row items-center px-3 py-1 '>
											<Ionicons name='eye' size={20} color='#FFFFFF' />
											<Text className='text-white font-bold ml-1'>
												{car.views || 0}
											</Text>
										</View>
										<TouchableOpacity
											className='mr-3 '
											onPress={() => onFavoritePress(car.id)}>
											<Ionicons
												name={isFavorite(car.id) ? 'heart' : 'heart-outline'}
												size={20}
												color={isFavorite(car.id) ? 'red' : 'white'}
											/>
										</TouchableOpacity>
									</View>
								</View>
							)}
							horizontal
							pagingEnabled
							showsHorizontalScrollIndicator={false}
							onMomentumScrollEnd={event => {
								const newIndex = Math.round(
									event.nativeEvent.contentOffset.x / width
								)
								setActiveImageIndex(newIndex)
							}}
						/>
						{/* Pagination Dots */}
						<View className='absolute bottom-8 left-0 right-0 flex-row justify-center z-10'>
							{car.images.map((_: any, index: React.Key | null | undefined) => (
								<View
									key={index}
									className={`w-2 h-2 rounded-full mx-1 ${
										index === activeImageIndex ? 'bg-red' : 'bg-white/50'
									}`}
								/>
							))}
						</View>
					</View>

					{/* Price Badge */}
					<View className='absolute -bottom-6 left-1/2 -translate-x-16 dark:bg-black bg-white rounded-full w-32 h-12 items-center justify-center shadow-lg z-20'>
						<Text className='text-red text-lg font-bold'>
							${car.price.toLocaleString()}
						</Text>
					</View>
				</View>

				<View className='flex-row items-center justify-between px-4'>
					<View className='flex-row items-center'>
						<View
							className='justify-center items-center mt-2'
							style={{ width: 50 }}>
							<OptimizedImage
								source={{ uri: getLogoUrl(car.make, !isDarkMode) }}
								style={{ width: 70, height: 50 }}
								contentFit='contain'
							/>
						</View>
						<View className='ml-3'>
							<Text
								className={`text-xl mt-6 font-bold ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								{car.make} {car.model}
							</Text>
							<Text
								className={`text-sm ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								{car.year}
							</Text>
						</View>
					</View>

					{autoclips.length > 0 && (
						<TouchableOpacity
							onPress={() => {
								setSelectedClip(autoclips[0])
								setShowClipModal(true)
							}}
							className='flex-row items-center bg-red px-4 py-2 rounded-full mt-4'>
							<Ionicons
								name='videocam'
								size={16}
								color='white'
								className='mr-1'
							/>
							<Text className='text-white text-sm font-medium ml-1'>
								View Clip
							</Text>
						</TouchableOpacity>
					)}
				</View>

				{/* Technical Data */}
				<View className='mt-8 mx-4'>
					<Text
						className={`text-lg font-bold mb-2 ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
						Technical Data
					</Text>
					<View
						className={`rounded-lg ${
							isDarkMode ? 'bg-[#1c1c1c]' : 'bg-[#e9e9e9]'
						}`}>
						{[
							{
								icon: 'speedometer-outline',
								label: 'Mileage',
								value: `${(car.mileage / 1000).toFixed(1)}k`
							},
							{
								icon: 'hardware-chip-outline',
								label: 'Trans',
								value: car.transmission.substring(0, 4)
							},
							{
								icon: 'car-sport-outline',
								label: 'Drive',
								value: car.drivetrain
							},
							{
								icon: 'color-palette-outline',
								label: 'Color',
								value: car.color
							},
							{
								icon: 'thermometer-outline',
								label: 'Condition',
								value: car.condition
							}
						].map((item, index, array) => (
							<TechnicalDataItem
								key={item.label}
								icon={item.icon}
								label={item.label}
								value={item.value}
								isDarkMode={isDarkMode}
								isLast={index === array.length - 1}
							/>
						))}
					</View>
				</View>

				{/* Description */}
				<View className='mt-6 px-4'>
					<Text
						className={`text-lg font-bold mb-2 ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
						Description
					</Text>
					<Text className={`${isDarkMode ? 'text-white' : 'text-black'}`}>
						{car.description}
					</Text>
				</View>

				{/* Dealership Section */}
				<View className='mt-8 px-4'>
					<Text
						className={`text-lg font-bold mb-4 ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
						Location
					</Text>

					<MapView style={styles.map} region={mapRegion}>
						<Marker
							coordinate={{
								latitude: car.dealership_latitude || 37.7749,
								longitude: car.dealership_longitude || -122.4194
							}}
							title={car.dealership_name}
							description={car.dealership_location}
						/>
					</MapView>
				</View>

				{/* Similar Cars Section */}
				{similarCars.length > 0 && (
					<View className='mt-8 px-4'>
						<Text
							className={`text-xl font-bold ${
								isDarkMode ? 'text-white' : 'text-black'
							} mb-4`}>
							{similarCars[0].make === car.make &&
							similarCars[0].model === car.model &&
							similarCars[0].year === car.year
								? 'Explore Similar Cars'
								: 'Similarly Priced Cars'}
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
					</View>
				)}

				{/* Dealer Cars Section */}
				<View className='mt-8 px-4 mb-40'>
					<Text
						className={`text-xl font-bold ${
							isDarkMode ? 'text-white' : 'text-black'
						} mb-4`}>
						More from {car.dealership_name}
					</Text>
					<FlatList
						data={dealerCars}
						renderItem={renderCarItem}
						keyExtractor={(item: any) =>
							`${item.id}-${item.make}-${item.model}-${Math.random()}`
						}
						horizontal
						showsHorizontalScrollIndicator={false}
					/>
				</View>
			</ScrollView>

			{/* Bottom Action Bar */}
			<View
				className={`absolute bottom-0 p-8 w-full  flex-col justify-around items-center py-4 border-t  ${
					isDarkMode ? 'bg-black' : 'bg-white'
				}`}>
				<View className='flex-row  items-center justify-between w-full'>
					<View className='flex-row items-center flex-1'>
						<TouchableOpacity onPress={handleDealershipPress}>
							<OptimizedImage
								source={{ uri: car.dealership_logo }}
								style={{ width: 50, height: 50, borderRadius: 25 }}
							/>
						</TouchableOpacity>
						<TouchableOpacity onPress={handleDealershipPress}>
							<View className='flex-1 ml-3'>
								<Text
									className={`text-base font-medium ${
										isDarkMode ? 'text-white' : 'text-black'
									}`}
									numberOfLines={1}>
									{car.dealership_name}
								</Text>

								<Text
									className={`text-sm ${
										isDarkMode ? 'text-white' : 'text-black'
									} mr-7`}
									numberOfLines={2}>
									<Ionicons name='location' size={12} />
									{car.dealership_location}
								</Text>
							</View>
						</TouchableOpacity>
					</View>
					<View className='flex-row'>
						<ActionButton
							icon='call-outline'
							onPress={handleCall}
							text='Call'
							isDarkMode={isDarkMode}
						/>
						<ActionButton
							icon='chatbubble-outline'
							onPress={handleChat}
							text='Chat'
							isDarkMode={isDarkMode}
						/>
						<ActionButton
							icon='share-outline'
							onPress={handleShare}
							text='Share'
							isDarkMode={isDarkMode}
						/>
					</View>
				</View>

				<TouchableOpacity
					onPress={handleOpenInGoogleMaps}
					className='flex-row items-center justify-center p-3 mt-4 rounded-full bg-black dark:bg-white w-full'>
					<Ionicons
						name='navigate-outline'
						size={24}
						color={isDarkMode ? 'black' : 'white'}
					/>
					<Text className='text-white dark:text-black font-semibold ml-2'>
						Open in Google Maps
					</Text>
				</TouchableOpacity>
			</View>
			<AutoclipModal
				isVisible={showClipModal}
				onClose={() => {
					setShowClipModal(false)
					setSelectedClip(null)
				}}
				clip={selectedClip}
				onLikePress={() => selectedClip && handleClipLike(selectedClip.id)}
				isLiked={selectedClip?.liked_users?.includes(user?.id)}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	map: {
		height: 200,
		borderRadius: 10,
		marginVertical: 10
	},
	container: {
		flex: 1,
		backgroundColor: 'transparent'
	},
	scrollContent: {
		flexGrow: 1
	},
	mainImage: {
		width: '100%',
		height: 300
	}
})

export default CarDetailScreen
