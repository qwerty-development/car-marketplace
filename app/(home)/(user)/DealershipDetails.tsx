import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
	View,
	Text,
	Image,
	TouchableOpacity,
	Animated,
	Platform,
	Alert,
	TextInput,
	ActivityIndicator,
	Pressable,
	Keyboard
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/app/(home)/(user)/CarDetailModal'
import CarDetailModalIOS from './CarDetailModal.ios'
import { useFavorites } from '@/utils/useFavorites'
import { FontAwesome, Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView, { Marker } from 'react-native-maps'
import * as Linking from 'expo-linking'
import DealershipAutoClips from '@/components/DealershipAutoClips'
import SortPicker from '@/components/SortPicker'
import { ChevronLeft } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { I18nManager } from 'react-native'

// **CONFIGURATION CONSTANTS**
const ITEMS_PER_PAGE = 10
const SEARCH_DEBOUNCE_MS = 500
const MIN_SEARCH_LENGTH = 2

// **TYPE DEFINITIONS**
interface FilterState {
	searchQuery: string
	sortOption: string
	priceRange?: [number, number]
	yearRange?: [number, number]
}

interface Dealership {
	id: number
	name: string
	logo: string
	phone: string
	location: string
	longitude: number
	latitude: number
	created_at?: string
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
	views?: number
	likes?: number
	listed_at: string
	dealership_name?: string
	dealership_logo?: string
	dealership_phone?: string
	dealership_location?: string
}

interface LoadingState {
	dealership: boolean
	cars: boolean
	search: boolean
	refresh: boolean
}

// **OPTIMIZED IMAGE COMPONENT**
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

// **SEARCH BAR COMPONENT - ISOLATED FOR PERFORMANCE**
const SearchBar = React.memo(({ 
	onSearch, 
	onClear, 
	isSearching,
	isDarkMode 
}: {
	onSearch: (query: string) => void
	onClear: () => void
	isSearching: boolean
	isDarkMode: boolean
}) => {
	const { t } = useTranslation()
	const [localSearchQuery, setLocalSearchQuery] = useState('')
	const searchTimeoutRef = useRef<NodeJS.Timeout>()

	const handleSearch = useCallback(() => {
		if (localSearchQuery.trim().length >= MIN_SEARCH_LENGTH) {
			onSearch(localSearchQuery.trim())
		} else if (localSearchQuery.trim().length === 0) {
			onClear()
		}
		Keyboard.dismiss()
	}, [localSearchQuery, onSearch, onClear])

	const handleClear = useCallback(() => {
		setLocalSearchQuery('')
		onClear()
		Keyboard.dismiss()
	}, [onClear])

	// **DEBOUNCED SEARCH ON ENTER**
	const handleSubmitEditing = useCallback(() => {
		handleSearch()
	}, [handleSearch])

	// **AUTO-SEARCH AFTER DEBOUNCE**
	useEffect(() => {
		if (searchTimeoutRef.current) {
			clearTimeout(searchTimeoutRef.current)
		}

		searchTimeoutRef.current = setTimeout(() => {
			if (localSearchQuery.trim().length >= MIN_SEARCH_LENGTH) {
				onSearch(localSearchQuery.trim())
			} else if (localSearchQuery.trim().length === 0) {
				onClear()
			}
		}, SEARCH_DEBOUNCE_MS)

		return () => {
			if (searchTimeoutRef.current) {
				clearTimeout(searchTimeoutRef.current)
			}
		}
	}, [localSearchQuery, onSearch, onClear])

	return (
		<View className='flex-row items-center space-x-2 mb-4'>
			<View className={`flex-1 flex-row items-center rounded-full border border-[#ccc] dark:border-[#555] px-4`}>
				<FontAwesome
					name="search"
					size={20}
					color={isDarkMode ? "white" : "black"}
				/>
				<TextInput
					className={`flex-1 p-3 ${isDarkMode ? "text-white" : "text-black"}`}
					placeholder={t('dealership.search_cars_placeholder', { min: MIN_SEARCH_LENGTH })}
					placeholderTextColor={isDarkMode ? '#999999' : '#666666'}
					textAlignVertical="center"
					value={localSearchQuery}
					onChangeText={setLocalSearchQuery}
					onSubmitEditing={handleSubmitEditing}
					returnKeyType="search"
					style={{ color: isDarkMode ? '#FFFFFF' : '#000000' }}
					editable={!isSearching}
				/>
				{localSearchQuery.length > 0 && (
					<TouchableOpacity
						className='px-2'
						onPress={handleClear}
						disabled={isSearching}
					>
						<Ionicons
							name='close-circle'
							size={20}
							color={isDarkMode ? '#FFFFFF' : '#666666'}
						/>
					</TouchableOpacity>
				)}
				{isSearching && (
					<ActivityIndicator 
						size="small" 
						color="#D55004" 
						style={{ marginLeft: 8 }}
					/>
				)}
			</View>
			
			{/* **EXPLICIT SEARCH BUTTON** */}
			<TouchableOpacity
				onPress={handleSearch}
				disabled={isSearching || localSearchQuery.trim().length < MIN_SEARCH_LENGTH}
				className={`w-12 h-12 rounded-full items-center justify-center ${
					isSearching || localSearchQuery.trim().length < MIN_SEARCH_LENGTH
						? 'bg-gray-300 dark:bg-gray-600'
						: 'bg-[#D55004]'
				}`}
			>
				{isSearching ? (
					<ActivityIndicator size="small" color="white" />
				) : (
					<Ionicons 
						name="search" 
						size={20} 
						color="white"
					/>
				)}
			</TouchableOpacity>
		</View>
	)
})

// **MAP COMPONENT - MEMOIZED FOR PERFORMANCE**
const DealershipMapView = React.memo(({ dealership, isDarkMode }: any) => {
	const { t } = useTranslation()
	const mapRef = useRef<MapView | null>(null)
	const [isMapReady, setIsMapReady] = useState(false)
	const [mapError, setMapError] = useState(false)
	const [isMapVisible, setIsMapVisible] = useState(false)

	useEffect(() => {
		const timeout = setTimeout(() => setIsMapVisible(true), 100)
		return () => clearTimeout(timeout)
	}, [])

	const openInMaps = useCallback(() => {
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
			const googleMapsUrl = `geo:${dealership.latitude},${dealership.longitude}?q=${dealership.latitude},${dealership.longitude}`
			Linking.openURL(googleMapsUrl).catch(() => {
				Linking.openURL(
					`https://www.google.com/maps/search/?api=1&query=${dealership.latitude},${dealership.longitude}`
				)
			})
		}
	}, [dealership])

	if (!dealership?.latitude || !dealership?.longitude || mapError) {
		return (
			<View className='h-64 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800 items-center justify-center'>
				<Ionicons
					name='map-outline'
					size={48}
					color={isDarkMode ? '#666' : '#999'}
				/>
				<Text className='text-neutral-500 dark:text-neutral-400 mt-4 text-center px-4'>
					{mapError ? t('dealership.unable_to_load_map') : t('dealership.location_not_available')}
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

	return (
		<View className='h-64 rounded-lg overflow-hidden'>
			{isMapVisible && (
				<>
					<MapView
						ref={mapRef}
						style={{ flex: 1 }}
						initialRegion={region}
						onMapReady={() => setIsMapReady(true)}
						onError={() => setMapError(true)}
					>
						{isMapReady && (
							<Marker
								coordinate={{
									latitude: Number(dealership.latitude),
									longitude: Number(dealership.longitude)
								}}
							>
								<View className='overflow-hidden rounded-full border-2 border-white shadow-lg'>
									<OptimizedImage
										source={{ uri: dealership.logo }}
										className='w-20 h-20 rounded-full'
										style={{ backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }}
									/>
								</View>
							</Marker>
						)}
					</MapView>
					<TouchableOpacity
						onPress={openInMaps}
						className='absolute bottom-4 right-4 bg-red px-4 py-2 rounded-full flex-row items-center'
					>
						<Ionicons name='navigate' size={16} color='white' />
						<Text className='text-white ml-2'>{t('dealership.take_me_there')}</Text>
					</TouchableOpacity>
				</>
			)}
		</View>
	)
})

// **MAIN COMPONENT**
export default function DealershipDetails() {
	const { isDarkMode } = useTheme()
	const { dealershipId } = useLocalSearchParams<{ dealershipId: string }>()
	const router = useRouter()
	const { t } = useTranslation()
	const isRTL = I18nManager.isRTL

	// **STATE MANAGEMENT - OPTIMIZED**
	const [dealership, setDealership] = useState<Dealership | null>(null)
	const [allCars, setAllCars] = useState<Car[]>([]) // **ALL FETCHED CARS**
	const [filteredCars, setFilteredCars] = useState<Car[]>([]) // **DISPLAYED CARS**
	const [loadingState, setLoadingState] = useState<LoadingState>({
		dealership: true,
		cars: true,
		search: false,
		refresh: false
	})
	const [selectedCar, setSelectedCar] = useState<Car | null>(null)
	const [isModalVisible, setIsModalVisible] = useState(false)
	const [currentPage, setCurrentPage] = useState(1)
	const [totalPages, setTotalPages] = useState(1)
	const [activeSearchQuery, setActiveSearchQuery] = useState('')
	const [sortOption, setSortOption] = useState('')
	
	const { toggleFavorite, isFavorite } = useFavorites()
	const scrollY = new Animated.Value(0)

	// **MEMOIZED VALUES**
	const bgGradient: [string, string] = useMemo(() => 
		isDarkMode ? ['#000000', '#1c1c1c'] : ['#FFFFFF', '#F0F0F0']
	, [isDarkMode])

	// **DEALERSHIP DATA FETCHING - STABLE**
	const fetchDealershipDetails = useCallback(async () => {
		setLoadingState(prev => ({ ...prev, dealership: true }))
		try {
			const { data, error } = await supabase
				.from('dealerships')
				.select('*')
				.eq('id', dealershipId)
				.single()

			if (error) throw error
			setDealership(data)
		} catch (error) {
			console.error('Error fetching dealership details:', error)
			Alert.alert('Error', 'Failed to load dealership details')
		} finally {
			setLoadingState(prev => ({ ...prev, dealership: false }))
		}
	}, [dealershipId])

	// **CARS DATA FETCHING - OPTIMIZED**
	const fetchAllCars = useCallback(async (refresh = false) => {
		setLoadingState(prev => ({ 
			...prev, 
			cars: !refresh, 
			refresh: refresh 
		}))

		try {
			let query = supabase
				.from('cars')
				.select(
					`*, dealerships (name,logo,phone,location,latitude,longitude)`,
					{ count: 'exact' }
				)
				.eq('status', 'available')
				.eq('dealership_id', dealershipId)

			// **APPLY SORTING ON SERVER SIDE**
			switch (sortOption) {
				case 'price_asc':
					query = query.order('price', { ascending: true })
					break
				case 'price_desc':
					query = query.order('price', { ascending: false })
					break
				case 'year_asc':
					query = query.order('year', { ascending: true })
					break
				case 'year_desc':
					query = query.order('year', { ascending: false })
					break
				case 'mileage_asc':
					query = query.order('mileage', { ascending: true })
					break
				case 'mileage_desc':
					query = query.order('mileage', { ascending: false })
					break
				default:
					query = query.order('listed_at', { ascending: false })
			}

			const { data, error, count } = await query

			if (error) throw error

			let processedCars: Car[] = data?.map(item => ({
				...item,
				dealership_name: item.dealerships.name,
				dealership_logo: item.dealerships.logo,
				dealership_phone: item.dealerships.phone,
				dealership_location: item.dealerships.location,
			})) || []

			// **APPLY BOOST PRIORITY - Boosted cars always appear first**
			// Separate boosted and non-boosted cars
			const boostedCars = processedCars.filter(car => {
				return car.is_boosted && car.boost_priority && car.boost_end_date &&
					   new Date(car.boost_end_date) > new Date();
			});
			const nonBoostedCars = processedCars.filter(car => {
				return !car.is_boosted || !car.boost_priority || !car.boost_end_date ||
					   new Date(car.boost_end_date) <= new Date();
			});

			// Sort boosted cars by priority (highest first)
			boostedCars.sort((a, b) => {
				return (b.boost_priority || 0) - (a.boost_priority || 0);
			});

			// Combine: boosted first, then non-boosted (maintaining their sort order)
			processedCars = [...boostedCars, ...nonBoostedCars];

			setAllCars(processedCars)
			setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE))
			
		} catch (error) {
			console.error('Error fetching cars:', error)
			Alert.alert('Error', 'Failed to load cars')
		} finally {
			setLoadingState(prev => ({ 
				...prev, 
				cars: false, 
				refresh: false 
			}))
		}
	}, [dealershipId, sortOption])

	// **CLIENT-SIDE SEARCH FUNCTION**
	const performSearch = useCallback((searchQuery: string) => {
		setLoadingState(prev => ({ ...prev, search: true }))
		setActiveSearchQuery(searchQuery)

		setTimeout(() => {
			let result = [...allCars]

			if (searchQuery.trim()) {
				const searchTerms = searchQuery.toLowerCase().split(' ')
				result = result.filter(car => {
					const searchableFields = [
						car.make,
						car.model,
						car.year.toString(),
						car.condition,
						car.transmission,
						car.color
					]
					return searchTerms.every(term =>
						searchableFields.some(field =>
							field.toLowerCase().includes(term)
						)
					)
				})
			}

			// **PRIORITIZE BOOSTED CARS IN SEARCH RESULTS**
			const boostedResults = result.filter(car => {
				return car.is_boosted && car.boost_priority && car.boost_end_date &&
					   new Date(car.boost_end_date) > new Date();
			});
			const nonBoostedResults = result.filter(car => {
				return !car.is_boosted || !car.boost_priority || !car.boost_end_date ||
					   new Date(car.boost_end_date) <= new Date();
			});

			// Sort boosted by priority
			boostedResults.sort((a, b) => (b.boost_priority || 0) - (a.boost_priority || 0));

			// Combine with boosted first
			result = [...boostedResults, ...nonBoostedResults];

			setFilteredCars(result)
			setLoadingState(prev => ({ ...prev, search: false }))
		}, 300) // **SIMULATE SEARCH PROCESSING**
	}, [allCars])

	// **CLEAR SEARCH FUNCTION**
	const clearSearch = useCallback(() => {
		setActiveSearchQuery('')
		setFilteredCars(allCars)
	}, [allCars])

	// **SORT CHANGE HANDLER**
	const handleSortChange = useCallback((newSortOption: string) => {
		setSortOption(newSortOption)
	}, [])

	// **EFFECT: INITIALIZE DATA**
	useEffect(() => {
		fetchDealershipDetails()
	}, [fetchDealershipDetails])

	// **EFFECT: FETCH CARS WHEN SORT CHANGES**
	useEffect(() => {
		fetchAllCars()
	}, [fetchAllCars])

	// **EFFECT: UPDATE FILTERED CARS WHEN ALL CARS CHANGE**
	useEffect(() => {
		if (activeSearchQuery) {
			performSearch(activeSearchQuery)
		} else {
			setFilteredCars(allCars)
		}
	}, [allCars, activeSearchQuery, performSearch])

	// **EVENT HANDLERS - MEMOIZED**
	const handleCarPress = useCallback((car: Car) => {
		setSelectedCar(car)
		setIsModalVisible(true)
	}, [])

	const handleFavoritePress = useCallback(async (carId: number) => {
		try {
			const newLikesCount = await toggleFavorite(carId)
			setAllCars(prevCars =>
				prevCars.map(car =>
					car.id === carId ? { ...car, likes: newLikesCount } : car
				)
			)
		} catch (error) {
			console.error('Error toggling favorite:', error)
		}
	}, [toggleFavorite])

	const handleRefresh = useCallback(() => {
		Promise.all([
			fetchDealershipDetails(),
			fetchAllCars(true)
		])
	}, [fetchDealershipDetails, fetchAllCars])

	const handleCall = useCallback(() => {
		if (dealership?.phone) {
			Linking.openURL(`tel:${dealership.phone}`)
		}
	}, [dealership])

	const handleWhatsApp = useCallback(() => {
		if (dealership?.phone) {
			const cleanedPhoneNumber = dealership.phone.toString().replace(/\D/g, '')
			const webURL = `https://wa.me/961${cleanedPhoneNumber}`
			
			Linking.openURL(webURL).catch(() => {
				Alert.alert(
					'Error',
					'Unable to open WhatsApp. Please make sure it is installed on your device.'
				)
			})
		} else {
			Alert.alert('Contact', 'Phone number not available')
		}
	}, [dealership])

	// **RENDER FUNCTIONS - MEMOIZED**
	const renderCarItem = useCallback(({ item }: { item: Car }) => (
		<CarCard
			car={item}
			onPress={() => handleCarPress(item)}
			onFavoritePress={() => handleFavoritePress(item.id)}
			isFavorite={isFavorite(item.id)}
		/>
	), [handleCarPress, handleFavoritePress, isFavorite])

	const renderModal = useMemo(() => {
		const ModalComponent = Platform.OS === 'ios' ? CarDetailModalIOS : CarDetailModal
		return (
			<ModalComponent
				isVisible={isModalVisible}
				car={selectedCar}
				onClose={() => setIsModalVisible(false)}
				onFavoritePress={() => selectedCar && handleFavoritePress(selectedCar.id)}
				isFavorite={!!selectedCar && isFavorite(selectedCar.id)}
				setSelectedCar={setSelectedCar}
				setIsModalVisible={setIsModalVisible}
			/>
		)
	}, [isModalVisible, selectedCar, handleFavoritePress, isFavorite])

	const renderHeader = useMemo(() => (
		<>
			{/* **DEALERSHIP INFO SECTION** */}
			{dealership && (
				<View className='mb-6'>
					<View className='px-4 pb-6 mt-4'>
						<View className='rounded-3xl overflow-hidden shadow-lg'>
							<LinearGradient
								colors={isDarkMode ? ['#1A1A1A', '#121212'] : ['#FFFFFF', '#F9F9F9']}
								start={{x: 0, y: 0}}
								end={{x: 1, y: 1}}
								className='p-6 rounded-3xl'
							>
								{/* **LOGO AND INFO** */}
								<View className='flex-row items-center'>
									<View className='relative'>
										<View 
											className='rounded-2xl p-0.5 shadow-lg'
											style={{
												backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
											}}
										>
											<Image
												source={{ uri: dealership.logo }}
												className='w-20 h-20 rounded-xl'
												style={{
													borderWidth: 1,
													borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
												}}
												resizeMode="cover"
											/>
										</View>
										<View 
											className='absolute -bottom-1 -right-1 w-5 h-5 rounded-full'
											style={{ backgroundColor: '#D55004' }}
										/>
									</View>

									<View className='ml-4 flex-1'>
										<Text
											className={`text-xl font-bold ${
												isDarkMode ? 'text-white' : 'text-neutral-800'
											}`}
											numberOfLines={1}
											adjustsFontSizeToFit
										>
											{dealership.name}
										</Text>

										<View className='flex-row items-center mt-1.5'>
											<View 
												className='flex-row items-center rounded-full px-3 py-1'
												style={{
													backgroundColor: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)'
												}}
											>
												<Ionicons
													name='location-outline'
													size={14}
													color='#D55004'
												/>
												<Text
													className={`ml-1 text-sm ${
														isDarkMode ? 'text-white/60' : 'text-black/60'
													}`}
													numberOfLines={1}
												>
													{dealership.location}
												</Text>
											</View>
										</View>
									</View>
								</View>

								{/* **STATISTICS** */}
								<View 
									className='flex-row justify-around mt-5 mb-3 mx-1 p-3 rounded-2xl'
									style={{
										backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)'
									}}
								>
									<View className='items-center'>
										<Text className={`text-xs font-medium ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
											{t('dealership.inventory')}
										</Text>
										<Text className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
											{filteredCars.length}
										</Text>
									</View>

									<View 
										className='h-full w-px'
										style={{
											backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
										}}
									/>

									<View className='items-center'>
										<Text className={`text-xs font-medium ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
											{t('dealership.established')}
										</Text>
										<Text className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
											{dealership.created_at ? new Date(dealership.created_at).getFullYear() : 'N/A'}
										</Text>
									</View>
								</View>

								{/* **CONTACT ACTIONS** */}
								<View className='flex-row justify-between space-x-4 mt-4'>
									<TouchableOpacity
										onPress={handleCall}
										className='flex-1 flex-row items-center justify-center py-3.5 rounded-xl'
										style={{
											backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
											borderWidth: 1,
											borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
										}}
									>
										<Ionicons
											name='call-outline'
											size={16}
											color='#D55004'
											style={{ marginRight: 8 }}
										/>
										<Text 
											className={`font-medium ${isDarkMode ? 'text-white' : 'text-black'}`}
											style={{ fontSize: 15 }}
										>
											{t('dealership.call_dealer')}
										</Text>
									</TouchableOpacity>

									<TouchableOpacity
										onPress={handleWhatsApp}
										className='flex-1 flex-row items-center justify-center py-3.5 rounded-xl'
										style={{
											backgroundColor: '#25D366',
											shadowColor: '#25D366',
											shadowOffset: { width: 0, height: 4 },
											shadowOpacity: isDarkMode ? 0.3 : 0.2,
											shadowRadius: 8,
											elevation: 4
										}}
									>
										<Ionicons 
											name='logo-whatsapp' 
											size={16} 
											color='white'
											style={{ marginRight: 8 }}
										/>
										<Text 
											className='text-white font-medium'
											style={{ fontSize: 15 }}
										>
											{t('dealership.whatsapp')}
										</Text>
									</TouchableOpacity>
								</View>
							</LinearGradient>
						</View>
					</View>

					{/* **MAP VIEW** */}
					<View className='px-6 mb-8'>
						<DealershipMapView
							dealership={dealership}
							isDarkMode={isDarkMode}
						/>
					</View>

					{/* **AUTOCLIPS SECTION** */}
					<DealershipAutoClips dealershipId={dealershipId} />
				</View>
			)}

			{/* **SEARCH AND FILTER SECTION** */}
			<View className='px-5 mb-4'>
				<SearchBar
					onSearch={performSearch}
					onClear={clearSearch}
					isSearching={loadingState.search}
					isDarkMode={isDarkMode}
				/>
				
				<View className='flex-row items-center justify-between mb-4'>
					<Text className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}>
						{t('dealership.sort_options')}
					</Text>
					<View className='items-center justify-center'>
						<SortPicker
							onValueChange={handleSortChange}
							initialValue={sortOption}
						/>
					</View>
				</View>
			</View>

			{/* **RESULTS HEADER** */}
			<View className='px-6 mb-4 flex-row items-center justify-between'>
				<Text className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
					{activeSearchQuery ? t('dealership.search_results') : t('dealership.available_cars')}
				</Text>
				<View className='flex-row items-center space-x-2'>
					{loadingState.search && (
						<ActivityIndicator size="small" color="#D55004" />
					)}
					<Text className={`${isDarkMode ? 'text-white/60' : 'text-black/60'}`}>
						{t('dealership.vehicles_count', { count: filteredCars.length })}
					</Text>
				</View>
			</View>

			{/* **ACTIVE SEARCH INDICATOR** */}
			{activeSearchQuery && (
				<View className='px-6 mb-4'>
					<View 
						className='flex-row items-center justify-between p-3 rounded-xl'
						style={{
							backgroundColor: isDarkMode ? 'rgba(213, 80, 4, 0.1)' : 'rgba(213, 80, 4, 0.05)',
							borderWidth: 1,
							borderColor: 'rgba(213, 80, 4, 0.2)'
						}}
					>
						<View className='flex-row items-center flex-1'>
							<Ionicons name="search" size={16} color="#D55004" />
							<Text 
								className={`ml-2 ${isDarkMode ? 'text-white' : 'text-black'} font-medium`}
								numberOfLines={1}
							>
								{t('dealership.searching_for', { query: activeSearchQuery })}
							</Text>
						</View>
						<TouchableOpacity onPress={clearSearch} className='ml-2'>
							<Ionicons name="close-circle" size={20} color="#D55004" />
						</TouchableOpacity>
					</View>
				</View>
			)}
		</>
	), [
		dealership, 
		isDarkMode, 
		filteredCars.length, 
		activeSearchQuery, 
		loadingState.search,
		performSearch,
		clearSearch,
		handleCall,
		handleWhatsApp,
		handleSortChange,
		sortOption,
		dealershipId
	])

	// **LOADING STATE COMPONENT**
	if (loadingState.dealership || loadingState.cars) {
		return (
			<LinearGradient colors={bgGradient} className='flex-1'>
				<SafeAreaView className='flex-1 justify-center items-center'>
					<ActivityIndicator size="large" color="#D55004" />
					<Text className={`mt-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>
						{loadingState.dealership ? t('dealership.loading_dealership') : t('dealership.loading_cars')}
					</Text>
				</SafeAreaView>
			</LinearGradient>
		)
	}

	// **MAIN RENDER**
	return (
		<LinearGradient colors={bgGradient} className='flex-1'>
			<SafeAreaView className='flex-1'>
				<Animated.FlatList
					data={filteredCars}
					renderItem={renderCarItem}
					keyExtractor={(item) => `car-${item.id}`}
					ListHeaderComponent={renderHeader}
					contentContainerStyle={{ paddingBottom: 20 }}
					onScroll={Animated.event(
						[{ nativeEvent: { contentOffset: { y: scrollY } } }],
						{ useNativeDriver: false }
					)}
					scrollEventThrottle={16}
					refreshing={loadingState.refresh}
					onRefresh={handleRefresh}
					showsVerticalScrollIndicator={false}
					ListEmptyComponent={() => (
						<View className='items-center justify-center py-12'>
							<Ionicons 
								name="car-outline" 
								size={64} 
								color={isDarkMode ? '#666' : '#999'} 
							/>
							<Text className={`mt-4 text-lg ${isDarkMode ? 'text-white/60' : 'text-black/60'}`}>
								{activeSearchQuery ? t('dealership.no_cars_match_search') : t('dealership.no_cars_available')}
							</Text>
							{activeSearchQuery && (
								<TouchableOpacity 
									onPress={clearSearch}
									className='mt-4 bg-[#D55004] px-6 py-2 rounded-full'
								>
									<Text className='text-white font-medium'>{t('dealership.clear_search')}</Text>
								</TouchableOpacity>
							)}
						</View>
					)}
				/>
				{renderModal}
			</SafeAreaView>
		</LinearGradient>
	)
}