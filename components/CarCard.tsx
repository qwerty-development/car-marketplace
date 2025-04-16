import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import {
	View,
	Text,
	Dimensions,
	Linking,
	Alert,
	FlatList,
	Image,
	ActivityIndicator,
	Pressable,
	Share,
	Animated,
	Platform
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { styled } from 'nativewind'
import { useTheme } from '@/utils/ThemeContext'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { useCarDetails } from '@/hooks/useCarDetails'
import { useAuth } from '@/utils/AuthContext'
import { supabase } from '@/utils/supabase'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledImage = styled(Image)
const StyledPressable = styled(Pressable)

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const MAX_IMAGES = 3

const OptimizedImage = ({ source, style, onLoad }: any) => {
	const [loaded, setLoaded] = useState(false)
	const { isDarkMode } = useTheme()

	const handleLoad = useCallback(() => {
		setLoaded(true)
		onLoad?.()
	}, [onLoad])

	return (
		<View style={[style, { overflow: 'hidden' }]} className='bg-neutral-800'>
			<StyledImage
				source={source}
				className='w-full h-full bg-neutral-800'
				style={{ opacity: loaded ? 1 : 0 }}
				onLoad={handleLoad}
				resizeMode='cover'
			/>
		</View>
	)
}

const SpecItem = ({ icon, title, value, isDarkMode }: any) => (
	<StyledView className='flex-1 items-center justify-center p-2'>
		<Ionicons
			name={icon}
			size={28}
			color={isDarkMode ? '#FFFFFF' : '#000000'}
			className='mb-1.5'
		/>
		<StyledText
			className={`text-xs font-medium ${
				isDarkMode ? 'text-white' : 'text-black'
			} mb-0.5`}
			numberOfLines={1}>
			{title}
		</StyledText>
		<StyledText
			className={`text-sm font-semibold ${
				isDarkMode ? 'text-white' : 'text-black'
			}`}
			numberOfLines={1}>
			{value}
		</StyledText>
	</StyledView>
)

const ActionButton = ({ icon, text, onPress, isDarkMode }: any) => (
	<StyledPressable
		onPress={onPress}
		className='items-center justify-center p-2.5 active:opacity-70'>
		<Ionicons
			name={icon}
			size={24}
			color={isDarkMode ? '#FFFFFF' : '#000000'}
			className='mb-0.5'
		/>
	</StyledPressable>
)

export default function CarCard({
	car,
	onFavoritePress,
	isFavorite,
	isDealer = false,
	index = 0  // Add index prop
  }: any) {
	const { isDarkMode } = useTheme()
	const fadeAnim = useRef(new Animated.Value(0)).current
	const translateY = useRef(new Animated.Value(50)).current
	const { user } = useAuth()
	const router = useRouter()
	const [currentImageIndex, setCurrentImageIndex] = useState(0)
	const flatListRef = useRef(null)
	const { prefetchCarDetails } = useCarDetails()

	// Add animation effect
	useEffect(() => {
	  Animated.parallel([
		Animated.timing(fadeAnim, {
		  toValue: 1,
		  duration: 500,
		  delay: index * 100,
		  useNativeDriver: true,
		}),
		Animated.timing(translateY, {
		  toValue: 0,
		  duration: 500,
		  delay: index * 100,
		  useNativeDriver: true,
		}),
	  ]).start()
	}, [])

	// Track call button clicks
	const trackCallClick = useCallback(
	  async (carId: number) => {
		if (!user) return

		try {
		  const { data, error } = await supabase.rpc("track_car_call", {
			car_id: carId,
			user_id: user.id,
		  })

		  if (error) throw error
		  console.log(`Call count updated: ${data}`)
		} catch (error) {
		  console.error("Error tracking call click:", error)
		}
	  },
	  [user]
	)

	// Track WhatsApp button clicks
	const trackWhatsAppClick = useCallback(
	  async (carId: number) => {
		if (!user) return

		try {
		  const { data, error } = await supabase.rpc("track_car_whatsapp", {
			car_id: carId,
			user_id: user.id,
		  })

		  if (error) throw error
		  console.log(`WhatsApp count updated: ${data}`)
		} catch (error) {
		  console.error("Error tracking WhatsApp click:", error)
		}
	  },
	  [user]
	)

	const handleCardPress = useCallback(async () => {
		try {
			// Start prefetching before navigation
			const prefetchedData = await prefetchCarDetails(car.id)

			router.push({
				pathname: isDealer
					? '/(home)/(dealer)/CarDetails'
					: '/(home)/(user)/CarDetails',
				params: {
					carId: car.id,
					isDealerView: isDealer,
					prefetchedData: JSON.stringify(prefetchedData)
				}
			})
		} catch (error) {
			console.error('Error navigating to car details:', error)
			// Navigate anyway as fallback
			router.push({
				pathname: isDealer
					? '/(home)/(dealer)/CarDetails'
					: '/(home)/(user)/CarDetails',
				params: {
					carId: car.id,
					isDealerView: isDealer
				}
			})
		}
	}, [router, car, isDealer, prefetchCarDetails])

	const handleCall = useCallback(() => {
		if (car.dealership_phone) {
			// Track the call click first
			trackCallClick(car.id)
			// Then proceed with the call
			Linking.openURL(`tel:${car.dealership_phone}`)
		} else {
			Alert.alert('Phone number not available')
		}
	}, [car.dealership_phone, car.id, trackCallClick])

	const handleShare = useCallback(async () => {
		try {
			const message =
			`Check out this ${car.year} ${car.make} ${car.model} on Fleet!\n` +
			`https://www.fleetapp.me/cars/${car.id}`;


			await Share.share({
				message,
				title: `${car.year} ${car.make} ${car.model}`
			})
		} catch (error) {
			Alert.alert('Error', 'Failed to share car details')
		}
	}, [car])

	const handleDealershipPress = useCallback(() => {
		const route = isDealer
			? '/(home)/(dealer)/DealershipDetails'
			: '/(home)/(user)/DealershipDetails'
		router.push({
			pathname: route,
			params: { dealershipId: car.dealership_id }
		})
	}, [isDealer, router, car.dealership_id])

	const formattedLocation = useMemo(() => {
		if (car.dealership_location?.length > 20) {
			return (
				car.dealership_location.slice(0, 20) +
				'\n' +
				car.dealership_location.slice(20)
			)
		}
		return car.dealership_location
	}, [car.dealership_location])

	const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
		if (viewableItems.length > 0) {
			setCurrentImageIndex(viewableItems[0].index)
		}
	}, [])

	const viewabilityConfig = useRef({
		itemVisiblePercentThreshold: 50
	}).current

	const displayedImages = useMemo(
		() => car.images.slice(0, MAX_IMAGES),
		[car.images]
	)

	const renderImage = useCallback(
		({ item }: any) => (
			<Pressable onPress={handleCardPress} className='bg-neutral-800'>
				<View className='relative bg-neutral-800 '>
					<OptimizedImage
						source={{ uri: item }}
						style={{ width: SCREEN_WIDTH - 32, height: 260 }}
					/>

					<LinearGradient
						colors={['transparent', 'rgba(0,0,0,0.8)']}
						className='absolute bottom-0 left-0 right-0 h-40'
					/>

					{/* Price Badge */}
					<View className='absolute top-4 right-4 z-10'>
						<StyledView className='bg-red/90 px-4 py-2.5 rounded-2xl shadow-lg'>
							<StyledText className='text-white text-lg font-extrabold'>
								${car.price.toLocaleString()}
							</StyledText>
						</StyledView>
					</View>

					{/* Image Counter */}
					{displayedImages.length > 1 && (
						<View className='absolute bottom-4 right-4 z-10 bg-night/60 px-3 py-1 rounded-full'>
							<StyledText className='text-white text-sm font-medium'>
								{currentImageIndex + 1}/{displayedImages.length}
							</StyledText>
						</View>
					)}

					{/* Car Info */}
					<View className='absolute bottom-0 w-full p-5'>
						<View className='pr-28'>
							<StyledText
								className='text-white text-2xl font-bold mb-1.5'
								numberOfLines={1}>
								{car.make} {car.model}
							</StyledText>
							<View className='flex-row items-center space-x-4'>
								<View className='flex-row items-center'>
									<Ionicons name='eye-outline' size={18} color='#FFFFFF' />
									<StyledText className='text-neutral-200 text-sm ml-1.5'>
										{car.views || 0}
									</StyledText>
								</View>
								<View className='flex-row items-center'>
									<Ionicons name='heart-outline' size={18} color='#FFFFFF' />
									<StyledText className='text-neutral-200 text-sm ml-1.5'>
										{car.likes || 0}
									</StyledText>
								</View>
							</View>
						</View>
					</View>

					{/* Favorite Button */}
					{!isDealer && (
						<StyledPressable
							onPress={() => onFavoritePress(car.id)}
							className={`absolute top-4 left-4   active:opacity-70  `}>
							<Ionicons
								name={isFavorite ? 'heart-sharp' : 'heart-outline'}
								size={30}
								color={
									isFavorite ? '#D55004' : isDarkMode ? '#9d174d' : '#f43f5e'
								}
							/>
						</StyledPressable>
					)}
				</View>
			</Pressable>
		),
		[
			car,
			isFavorite,
			isDealer,
			onFavoritePress,
			isDarkMode,
			handleCardPress,
			displayedImages.length,
			currentImageIndex
		]
	)

	const handleWhatsAppPress = useCallback(() => {
		if (car?.dealership_phone) {
			// Track the WhatsApp click first
			trackWhatsAppClick(car.id)

			const cleanedPhoneNumber = car.dealership_phone.toString().replace(/\D/g, '')
			const message = `Hi, I'm interested in the ${car.year} ${car.make} ${car.model} listed for $${car.price.toLocaleString()}`
			const webURL = `https://wa.me/961${cleanedPhoneNumber}?text=${encodeURIComponent(message)} on Fleet`

			Linking.openURL(webURL).catch(() => {
				Alert.alert(
					'Error',
					'Unable to open WhatsApp. Please make sure it is installed on your device.'
				)
			})
		} else {
			Alert.alert('Phone number not available')
		}
	}, [car, trackWhatsAppClick])

	return (
		<Animated.View
		style={{
		  opacity: fadeAnim,
		  transform: [{ translateY }],
		}}
	  >
		<StyledView
			className={`mx-4 my-3 ${
				isDarkMode ? 'bg-[#242424]' : 'bg-[#e1e1e1] '
			} rounded-3xl overflow-hidden shadow-xl`}>
			<FlatList
				ref={flatListRef}
				data={displayedImages}
				renderItem={renderImage}
				keyExtractor={(item, index) => index.toString()}
				horizontal
				pagingEnabled
				showsHorizontalScrollIndicator={false}
				onViewableItemsChanged={onViewableItemsChanged}
				viewabilityConfig={viewabilityConfig}
				initialNumToRender={3}
				maxToRenderPerBatch={3}
				windowSize={3}
				removeClippedSubviews={true}
				decelerationRate='fast'
				snapToInterval={SCREEN_WIDTH - 32}
				snapToAlignment='center'
				bounces={false}
			/>

			<StyledPressable onPress={handleCardPress} className='active:opacity-90'>
				{/* Specs Grid */}
				<StyledView className='flex-row justify-between mt-4 mb-2 px-2 '>
					<SpecItem
						title='Year'
						icon='calendar-outline'
						value={car.year}
						isDarkMode={isDarkMode}
					/>
					<SpecItem
						title='Mileage'
						icon='speedometer-outline'
						value={`${(car.mileage / 1000).toFixed(1)}k`}
						isDarkMode={isDarkMode}
					/>
					<SpecItem
						title='Transmission'
						icon='cog-outline'
						value={
							car.transmission === 'Automatic'
								? 'Auto'
								: car.transmission === 'Manual'
								? 'Man'
								: car.transmission
						}
						isDarkMode={isDarkMode}
					/>
					<SpecItem
						title='Condition'
						icon='car-sport-outline'
						value={car.condition}
						isDarkMode={isDarkMode}
					/>
				</StyledView>

				{/* Dealership Info */}
				<StyledView
					className={`p-4 pt-2 ${
						isDarkMode ? 'bg-[#2b2b2b]' : 'bg-[#d1d1d1]'
					}  rounded-t-3xl`}>
					<StyledView className='flex-row items-center justify-between'>
						{car.dealership_logo && (
							<Pressable onPress={handleDealershipPress} className='mr-3'>
								<OptimizedImage
									source={{ uri: car.dealership_logo }}
									style={{ width: 48, height: 48 }}
									className='rounded-full border border-textgray/20'
								/>
							</Pressable>
						)}

						<StyledView className='flex-1 ml-2 '>
							<StyledText
								className={`text-base font-semibold ${
									isDarkMode ? 'text-white' : 'text-black'
								} mb-0.5`}
								numberOfLines={2}>
								{car.dealership_name}
							</StyledText>
							<StyledText
								className={`text-sm ${
									isDarkMode ? 'text-white/80' : 'text-black'
								}`}
								numberOfLines={2}>
								{formattedLocation}
							</StyledText>
						</StyledView>

						<StyledView className='flex-row ml-3'>
  <ActionButton
    icon='call-outline'
    onPress={handleCall}
    isDarkMode={isDarkMode}
  />
  <ActionButton
    icon='logo-whatsapp'  // Using Ionicons WhatsApp logo
    onPress={handleWhatsAppPress}
    isDarkMode={isDarkMode}
  />
  <ActionButton
    icon='share-outline'
    onPress={handleShare}
    isDarkMode={isDarkMode}
  />
</StyledView>
					</StyledView>
				</StyledView>
			</StyledPressable>
		</StyledView>
		</Animated.View>
	)
}