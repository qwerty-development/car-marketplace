import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
	View,
	Text,
	Image,
	TouchableOpacity,
	RefreshControl,
	Animated,
	Platform,
	Alert
} from 'react-native'
import { router, useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/app/(home)/(user)/CarDetailModal'
import CarDetailModalIOS from './CarDetailModalIOS'
import { useFavorites } from '@/utils/useFavorites'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'

import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import MapView, { Marker } from 'react-native-maps'
import * as Linking from 'expo-linking'
const ITEMS_PER_PAGE = 10

const OptimizedImage = React.memo(({ source, style, className }: any) => {
	const [isLoading, setIsLoading] = useState(true)
	const [hasError, setHasError] = useState(false)

	return (
		<View className={`relative ${className}`}>
			{hasError && (
				<View className='absolute inset-0 flex items-center justify-center bg-neutral-200 dark:bg-neutral-800 rounded-full'>
					<Ionicons name='image-outline' size={24} color='#D55004' />
				</View>
			)}
			<Image
				source={source}
				className={className}
				style={style}
				onLoadStart={() => setIsLoading(true)}
				onLoadEnd={() => setIsLoading(false)}
				onError={() => {
					setHasError(true)
					setIsLoading(false)
				}}
			/>
		</View>
	)
})

interface Dealership {
	id: number
	name: string
	logo: string
	phone: string
	location: string
	longitude: number
	latitude: number
}

interface Car {
	id: number
	make: string
	model: string
	year: number
	price: number
	images: string[]
	description: string
	condition: 'New' | 'Used'
	mileage: number
	color: string
	transmission: 'Manual' | 'Automatic'
	drivetrain: 'FWD' | 'RWD' | 'AWD' | '4WD' | '4x4'
}

const DealershipMapView = ({ dealership, isDarkMode }: any) => {
	const mapRef = useRef<MapView | null>(null)
	const [isMapReady, setIsMapReady] = useState(false)
	const [mapError, setMapError] = useState(false)
	const [showCallout, setShowCallout] = useState(false)
	const [isMapVisible, setIsMapVisible] = useState(false)

	useEffect(() => {
		const timeout = setTimeout(() => setIsMapVisible(true), 100)
		return () => clearTimeout(timeout)
	}, [])

	if (!dealership?.latitude || !dealership?.longitude || mapError) {
		return (
			<View className='h-64 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800 items-center justify-center'>
				<Ionicons
					name='map-outline'
					size={48}
					color={isDarkMode ? '#666' : '#999'}
				/>
				<Text className='text-neutral-500 dark:text-neutral-400 mt-4 text-center px-4'>
					{mapError ? 'Unable to load map' : 'Location not available'}
				</Text>
			</View>
		)
	}

	const region = {
		latitude: Number(dealership.latitude),
		longitude: Number(dealership.longitude),
		latitudeDelta: 0.01,
		longitudeDelta: 0.01
	}

	const openInMaps = () => {
		if (Platform.OS === 'ios') {
			Alert.alert('Open Maps', 'Choose your preferred maps application', [
				{
					text: 'Apple Maps',
					onPress: () => {
						const appleMapsUrl = `maps:0,0?q=${dealership.latitude},${dealership.longitude}`
						Linking.openURL(appleMapsUrl)
					}
				},
				{
					text: 'Google Maps',
					onPress: () => {
						const googleMapsUrl = `comgooglemaps://?q=${dealership.latitude},${dealership.longitude}&zoom=14`
						Linking.openURL(googleMapsUrl).catch(() => {
							// If Google Maps is not installed, open in browser
							Linking.openURL(
								`https://www.google.com/maps/search/?api=1&query=${dealership.latitude},${dealership.longitude}`
							)
						})
					}
				},
				{
					text: 'Cancel',
					style: 'cancel'
				}
			])
		} else {
			// For Android, directly open Google Maps
			const googleMapsUrl = `geo:${dealership.latitude},${dealership.longitude}?q=${dealership.latitude},${dealership.longitude}`
			Linking.openURL(googleMapsUrl).catch(() => {
				// Fallback to browser if Google Maps app is not installed
				Linking.openURL(
					`https://www.google.com/maps/search/?api=1&query=${dealership.latitude},${dealership.longitude}`
				)
			})
		}
	}

	const handleMapReady = () => {
		setIsMapReady(true)
	}

	return (
		<View className='h-64 rounded-lg overflow-hidden'>
			{isMapVisible && (
				<>
					<MapView
						ref={mapRef}
						style={{ flex: 1 }}
						initialRegion={region}
						onMapReady={handleMapReady}
						onError={() => setMapError(true)}>
						{isMapReady && (
							<Marker
								coordinate={{
									latitude: Number(dealership.latitude),
									longitude: Number(dealership.longitude)
								}}
								onPress={() => setShowCallout(true)}>
								<View className='overflow-hidden rounded-full border-2 border-white shadow-lg'>
									<OptimizedImage
										source={{ uri: dealership.logo }}
										className='w-10 h-10 rounded-full'
										style={{ backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }}
									/>
								</View>
							</Marker>
						)}
					</MapView>
					<TouchableOpacity
						onPress={openInMaps}
						className='absolute bottom-4 right-4 bg-red px-4 py-2 rounded-full flex-row items-center'>
						<Ionicons name='navigate' size={16} color='white' />
						<Text className='text-white ml-2'>Take Me There</Text>
					</TouchableOpacity>
				</>
			)}
		</View>
	)
}

export default function DealershipDetails() {
	const { isDarkMode } = useTheme()
	const { dealershipId } = useLocalSearchParams<{ dealershipId: string }>()
	const [dealership, setDealership] = useState<Dealership | null>(null)
	const [cars, setCars] = useState<Car[]>([])
	const [isDealershipLoading, setIsDealershipLoading] = useState(true)
	const [isCarsLoading, setIsCarsLoading] = useState(true)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [selectedCar, setSelectedCar] = useState<Car | null>(null)
	const [isModalVisible, setIsModalVisible] = useState(false)
	const [currentPage, setCurrentPage] = useState(1)
	const [totalPages, setTotalPages] = useState(1)
	const { toggleFavorite, isFavorite } = useFavorites()
	const scrollY = new Animated.Value(0)

	const bgGradient: [string, string] = isDarkMode
		? ['#000000', '#1c1c1c']
		: ['#FFFFFF', '#F0F0F0']

	const fetchDealershipDetails = useCallback(async () => {
		setIsDealershipLoading(true)
		try {
			const { data, error } = await supabase
				.from('dealerships')
				.select('*')
				.eq('id', dealershipId)
				.single()

			if (error) throw error
			setDealership(data)
			console.log(data)
		} catch (error) {
			console.error('Error fetching dealership details:', error)
		} finally {
			setIsDealershipLoading(false)
		}
	}, [dealershipId])

	const fetchDealershipCars = useCallback(
		async (page = 1, refresh = false) => {
			if (refresh) {
				setIsRefreshing(true)
			} else {
				setIsCarsLoading(true)
			}

			try {
				let query = supabase
					.from('cars')
					.select(
						`*, dealerships (name,logo,phone,location,latitude,longitude)`,
						{ count: 'exact' }
					)
					.eq('status', 'available')
					.eq('dealership_id', dealershipId)
					.order('listed_at', { ascending: false })
				const { count } = await query
				const totalItems = count || 0
				const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)
				const safePageNumber = Math.min(page, totalPages)
				const startRange = (safePageNumber - 1) * ITEMS_PER_PAGE
				const endRange = Math.min(
					safePageNumber * ITEMS_PER_PAGE - 1,
					totalItems - 1
				)

				const { data, error } = await query.range(startRange, endRange)

				if (error) throw error

				const processedCars =
					data?.map(item => ({
						...item,
						dealership_name: item.dealerships.name,
						dealership_logo: item.dealerships.logo,
						dealership_phone: item.dealerships.phone,
						dealership_location: item.dealerships.location,
						dealership_latitude: item.dealerships.latitude,
						dealership_longitude: item.dealerships.longitude
					})) || []

				setCars(prevCars =>
					safePageNumber === 1 ? processedCars : [...prevCars, ...processedCars]
				)
				setTotalPages(totalPages)
				setCurrentPage(safePageNumber)
			} catch (error) {
				console.error('Error fetching dealership cars:', error)
			} finally {
				setIsCarsLoading(false)
				setIsRefreshing(false)
			}
		},
		[dealershipId]
	)

	useEffect(() => {
		fetchDealershipCars(1, true)
	}, [fetchDealershipCars])

	const handleCarPress = useCallback((car: Car) => {
		setSelectedCar(car)
		setIsModalVisible(true)
	}, [])

	const handleFavoritePress = useCallback(
		async (carId: number) => {
			const newLikesCount = await toggleFavorite(carId)
			setCars(prevCars =>
				prevCars.map(car =>
					car.id === carId ? { ...car, likes: newLikesCount } : car
				)
			)
		},
		[toggleFavorite]
	)

	const handleViewUpdate = useCallback(
		(carId: number, newViewCount: number) => {
			setCars(prevCars =>
				prevCars.map(car =>
					car.id === carId ? { ...car, views: newViewCount } : car
				)
			)
		},
		[]
	)

	const handleRefresh = useCallback(() => {
		setIsRefreshing(true)
		Promise.all([fetchDealershipDetails(), fetchDealershipCars(1, true)]).then(
			() => {
				setIsRefreshing(false)
			}
		)
	}, [fetchDealershipDetails, fetchDealershipCars])

	const handleLoadMore = useCallback(() => {
		if (currentPage < totalPages && !isCarsLoading) {
			fetchDealershipCars(currentPage + 1)
		}
	}, [currentPage, totalPages, isCarsLoading, fetchDealershipCars])

	const renderModal = useMemo(() => {
		const ModalComponent =
			Platform.OS === 'ios' ? CarDetailModalIOS : CarDetailModal
		return (
			<ModalComponent
				isVisible={isModalVisible}
				car={selectedCar}
				onClose={() => setIsModalVisible(false)}
				onFavoritePress={() =>
					selectedCar && handleFavoritePress(selectedCar.id)
				}
				isFavorite={!!selectedCar && isFavorite(selectedCar.id)}
				onViewUpdate={handleViewUpdate}
				setSelectedCar={setSelectedCar}
				setIsModalVisible={setIsModalVisible}
			/>
		)
	}, [
		isModalVisible,
		selectedCar,
		handleFavoritePress,
		isFavorite,
		handleViewUpdate
	])

	const renderCarItem = useCallback(
		({ item }: { item: Car }) => (
			<CarCard
				car={item}
				onPress={() => handleCarPress(item)}
				onFavoritePress={() => handleFavoritePress(item.id)}
				isFavorite={isFavorite(item.id)}
			/>
		),
		[handleCarPress, handleFavoritePress, isFavorite]
	)

	const handleCall = useCallback(() => {
		if (dealership?.phone) {
			Linking.openURL(`tel:${dealership.phone}`)
		}
	}, [dealership])

	const handleWhatsApp = useCallback(() => {
		if (dealership?.phone) {
			const whatsappUrl = `https://wa.me/${dealership.phone}`
			Linking.openURL(whatsappUrl)
		}
	}, [dealership])

	return (
		<LinearGradient colors={bgGradient} className='flex-1'>
			{/* Modernized Header */}
			<BlurView
				intensity={80}
				tint={isDarkMode ? 'dark' : 'light'}
				className='absolute top-0 left-0 right-0 z-50 '>
				<SafeAreaView edges={['top']}>
					<View className='flex-row items-center justify-between px-6 py-4'>
						<TouchableOpacity
							onPress={() => router.back()}
							className='w-10 h-10 items-center justify-center rounded-full bg-white/10'>
							<Ionicons
								name='arrow-back'
								size={24}
								color={isDarkMode ? '#fff' : '#000'}
							/>
						</TouchableOpacity>
						<Text
							className={`${
								isDarkMode ? 'text-white' : 'text-black'
							} text-lg font-semibold`}>
							{dealership?.name || 'Dealership'}
						</Text>
						<View className='w-10' /> {/* Spacer for alignment */}
					</View>
				</SafeAreaView>
			</BlurView>

			<Animated.FlatList
				data={cars}
				renderItem={renderCarItem}
				keyExtractor={item => `${item.id}-${item.make}-${item.model}`}
				onEndReached={handleLoadMore}
				onEndReachedThreshold={0.5}
				refreshControl={
					<RefreshControl
						refreshing={isRefreshing}
						onRefresh={handleRefresh}
						tintColor={isDarkMode ? '#fff' : '#000'}
						colors={['#D55004']}
					/>
				}
				ListHeaderComponent={() => (
					<>
						{/* Hero Section */}
						{dealership && (
							<View className='mb-6'>
								{/* Dealership Info Card */}
								<View className='px-6 pt-24 pb-6 mt-7'>
									<View className='items-center'>
										<View className='relative'>
											<Image
												source={{ uri: dealership.logo }}
												className='w-24 h-24 rounded-2xl'
												style={{
													shadowColor: isDarkMode ? '#000' : '#D55004',
													shadowOffset: { width: 0, height: 8 },
													shadowOpacity: 0.3,
													shadowRadius: 12
												}}
											/>
											<LinearGradient
												colors={
													isDarkMode
														? ['rgba(0,0,0,0.8)', 'transparent']
														: ['rgba(255,255,255,0.8)', 'transparent']
												}
												className='absolute inset-0 rounded-2xl opacity-30'
											/>
										</View>

										<Text
											className={`text-2xl font-bold mt-4 ${
												isDarkMode ? 'text-white' : 'text-black'
											}`}>
											{dealership.name}
										</Text>

										<View className='flex-row items-center mt-2'>
											<Ionicons
												name='location-outline'
												size={16}
												color={isDarkMode ? '#fff' : '#000'}
											/>
											<Text
												className={`ml-1 ${
													isDarkMode ? 'text-white/70' : 'text-black/70'
												}`}>
												{dealership.location}
											</Text>
										</View>
									</View>

									{/* Quick Actions */}
									<View className='flex-row justify-center space-x-3 mt-8'>
										<TouchableOpacity
											onPress={handleCall}
											className='flex-1 flex-row items-center justify-center space-x-2 bg-neutral-200 dark:bg-neutral-400 rounded-2xl py-4 px-6'>
											<Ionicons
												name='call-outline'
												size={20}
												color={isDarkMode ? '#fff' : '#000'}
											/>
											<Text
												className={isDarkMode ? 'text-white' : 'text-black'}>
												Call
											</Text>
										</TouchableOpacity>

										<TouchableOpacity
											onPress={handleWhatsApp}
											className='flex-1 flex-row items-center justify-center space-x-2 bg-red rounded-2xl py-4 px-6'>
											<Ionicons name='logo-whatsapp' size={20} color='white' />
											<Text className='text-white'>WhatsApp</Text>
										</TouchableOpacity>
									</View>
								</View>

								{/* Map View */}
								<View className='px-6 mb-8'>
									<DealershipMapView
										dealership={dealership}
										isDarkMode={isDarkMode}
									/>
								</View>

								{/* AutoClips Section */}
								<DealershipAutoClips dealershipId={dealershipId} />
							</View>
						)}

						{/* Available Cars Header */}
						<View className='px-6 mb-4 flex-row items-center justify-between'>
							<Text
								className={`text-xl font-bold ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								Available Cars
							</Text>
							<Text
								className={`${isDarkMode ? 'text-white/60' : 'text-black/60'}`}>
								{cars.length} vehicles
							</Text>
						</View>
					</>
				)}
				contentContainerStyle={{ paddingBottom: 20 }}
				onScroll={Animated.event(
					[{ nativeEvent: { contentOffset: { y: scrollY } } }],
					{ useNativeDriver: false }
				)}
				scrollEventThrottle={16}
			/>

			{renderModal}
		</LinearGradient>
	)
}
