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
	StatusBar,
	Pressable
} from 'react-native'
import { router, useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/app/(home)/(user)/CarDetailModal'
import CarDetailModalIOS from './CarDetailModal.ios'
import { useFavorites } from '@/utils/useFavorites'
import { FontAwesome, Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import MapView, { Marker } from 'react-native-maps'
import * as Linking from 'expo-linking'
import DealershipAutoClips from '@/components/DealershipAutoClips'
import SortPicker from '@/components/SortPicker'
import { ChevronLeft } from 'lucide-react-native'
import openWhatsApp from '@/utils/openWhatsapp'
const ITEMS_PER_PAGE = 10

interface FilterState {
	searchQuery: string
	sortOption: string
	priceRange?: [number, number]
	yearRange?: [number, number]
}

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

const CustomHeader = React.memo(
	({ title, onBack }: { title: string; onBack?: () => void }) => {
	  const { isDarkMode } = useTheme();

	  return (
		<SafeAreaView className={`bg-${isDarkMode ? "black" : "white"}`}>

		  <View className="flex-row items-center ml-2 -mb-6">
			{onBack && (
			  <Pressable onPress={onBack} className="p-2">
				<ChevronLeft
				  size={30}
				  className={isDarkMode ? "text-white" : "text-black"}
				/>
			  </Pressable>
			)}
			<Text
			  className={`text-2xl ${
				isDarkMode ? "text-white" : "text-black"
			  }  font-bold ml-2`}
			>
			  {title}
			</Text>
		  </View>
		</SafeAreaView>
	  );
	}
  );

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
										className='w-20 h-20 rounded-full'
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
	const [filters, setFilters] = useState<FilterState>({
		searchQuery: '',
		sortOption: ''
	})
	const [filteredCars, setFilteredCars] = useState<Car[]>([])
	const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearchTerm(filters.searchQuery)
		}, 300)

		return () => clearTimeout(timer)
	}, [filters.searchQuery])

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

	useEffect(() => {
		fetchDealershipDetails()
	}, [])

	const fetchDealershipCars = useCallback(
		async (page = 1, refresh = false, preserveSort = false) => {
			const currentSort = preserveSort ? filters.sortOption : ''
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

				// Apply sorting
				switch (filters.sortOption) {
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
		[dealershipId, filters.sortOption]
	)

	useEffect(() => {
		let result = [...cars]

		// Apply search filter
		if (debouncedSearchTerm) {
			const searchTerms = debouncedSearchTerm.toLowerCase().split(' ')
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
					searchableFields.some(field => field.toLowerCase().includes(term))
				)
			})
		}

		// Apply local sorting if needed
		if (filters.sortOption && result.length > 0) {
			result.sort((a, b) => {
				switch (filters.sortOption) {
					case 'price_asc':
						return a.price - b.price
					case 'price_desc':
						return b.price - a.price
					case 'year_asc':
						return a.year - b.year
					case 'year_desc':
						return b.year - a.year
					case 'mileage_asc':
						return a.mileage - b.mileage
					case 'mileage_desc':
						return b.mileage - a.mileage
					default:
						return (
							new Date(b.listed_at).getTime() - new Date(a.listed_at).getTime()
						)
				}
			})
		}

		setFilteredCars(result)
	}, [cars, debouncedSearchTerm, filters.sortOption])

	useEffect(() => {
		fetchDealershipCars(1, true)
	}, [])

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
		  const cleanedPhoneNumber = dealership.phone.toString().replace(/\D/g, '');
		  const webURL = `https://wa.me/961${cleanedPhoneNumber}`;
	  
		  Linking.openURL(webURL).catch(() => {
			Alert.alert(
			  'Error',
			  'Unable to open WhatsApp. Please make sure it is installed on your device.'
			);
		  });
		} else {
		  Alert.alert('Contact', 'Phone number not available');
		}
	  }, [dealership]);
	  

	const renderHeader = useCallback(
		() => (
			<>
				{dealership && (
					<View className='mb-6'>
			<View className='px-4 pb-6 mt-4'>
  {/* Modern Header Card with Subtle Gradient */}
  <View className='rounded-3xl overflow-hidden shadow-lg'>
    <LinearGradient
      colors={isDarkMode ? ['#1A1A1A', '#121212'] : ['#FFFFFF', '#F9F9F9']}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      className='p-6 rounded-3xl'>

      {/* Logo and Info Section - Refined Layout */}
      <View className='flex-row items-center'>
        {/* Dealership Logo with Professional Styling */}
        <View className='relative'>
          <View 
            className='rounded-2xl p-0.5 shadow-lg'
            style={{
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
            }}>
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

          {/* Subtle Brand Accent */}
          <View 
            className='absolute -bottom-1 -right-1 w-5 h-5 rounded-full'
            style={{ backgroundColor: '#D55004' }}
          />
        </View>

        {/* Dealership Information - Enhanced Typography */}
        <View className='ml-4 flex-1'>
          <Text
            className={`text-xl font-bold ${
              isDarkMode ? 'text-white' : 'text-neutral-800'
            }`}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {dealership.name}
          </Text>

          <View className='flex-row items-center mt-1.5'>
            <View 
              className='flex-row items-center rounded-full px-3 py-1'
              style={{
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)'
              }}>
              <Ionicons
                name='location-outline'
                size={14}
                color='#D55004'
              />
              <Text
                className={`ml-1 text-sm ${
                  isDarkMode ? 'text-white/60' : 'text-black/60'
                }`}
                numberOfLines={1}>
                {dealership.location}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Statistics Section - Elegant Design */}
      <View 
        className='flex-row justify-around mt-5 mb-3 mx-1 p-3 rounded-2xl'
        style={{
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)'
        }}>
        <View className='items-center'>
          <Text className={`text-xs font-medium ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Inventory
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
            Established
          </Text>
          <Text className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
            {dealership.created_at ? new Date(dealership.created_at).getFullYear() : 'N/A'}
          </Text>
        </View>
      </View>

      {/* Contact Actions - Modern & Professional */}
      <View className='flex-row justify-between space-x-4 mt-4'>
        <TouchableOpacity
          onPress={handleCall}
          className='flex-1 flex-row items-center justify-center py-3.5 rounded-xl'
          style={{
            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
            borderWidth: 1,
            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
          }}>
          <Ionicons
            name='call-outline'
            size={16}
            color={isDarkMode ? '#D55004' : '#D55004'}
            style={{ marginRight: 8 }}
          />
          <Text 
            className={`font-medium ${isDarkMode ? 'text-white' : 'text-black'}`}
            style={{ fontSize: 15 }}>
            Call Dealer
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
          }}>
          <Ionicons 
            name='logo-whatsapp' 
            size={16} 
            color='white'
            style={{ marginRight: 8 }}
          />
          <Text 
            className='text-white font-medium'
            style={{ fontSize: 15 }}>
            WhatsApp
          </Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
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

				{/* Search and Sort Section */}
				<View className='px-5 mb-4'>
					<View className='flex-row items-center space-x-2 mb-4'>
		  <View
			className={`flex-1 flex-row items-center rounded-full border border-[#ccc] dark:border-[#555] px-4
								`}
		  >
			<FontAwesome
			  name="search"
			  size={20}
			  color={isDarkMode ? "white" : "black"}
			/>
			<TextInput
			  className={`flex-1 p-3 ${
				isDarkMode ? "text-white" : "text-black"
			  }`}
								placeholder='Search cars...'
								placeholderTextColor={isDarkMode ? '#999999' : '#666666'}
                 textAlignVertical="center"
								value={filters.searchQuery}
								onChangeText={text =>
									setFilters(prev => ({ ...prev, searchQuery: text }))
								}
								style={{ color: isDarkMode ? '#FFFFFF' : '#000000' }}
							/>
							{filters.searchQuery ? (
								<TouchableOpacity
									className='px-3'
									onPress={() =>
										setFilters(prev => ({ ...prev, searchQuery: '' }))
									}>
									<Ionicons
										name='close-circle'
										size={20}
										color={isDarkMode ? '#FFFFFF' : '#666666'}
									/>
								</TouchableOpacity>
							) : null}
						</View>
								  <View className={`items-center justify-center w-12 h-12`}>
							<SortPicker

								onValueChange={(value: any) => {
									setFilters(prev => ({ ...prev, sortOption: value }))
									// Don't trigger a new fetch - let the useEffect handle sorting
								}}
								initialValue={filters.sortOption}
							/>
						</View>
					</View>
				</View>

				{/* Available Cars Header */}
				<View className='px-6 mb-4 flex-row items-center justify-between'>
					<Text
						className={`text-xl font-bold ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
						Available Cars
					</Text>
					<Text className={`${isDarkMode ? 'text-white/60' : 'text-black/60'}`}>
						{filteredCars.length} vehicles
					</Text>
				</View>
			</>
		),
		[dealership, isDarkMode, filters, filteredCars.length, fetchDealershipCars]
	)

	return (
		<LinearGradient colors={bgGradient} className='flex-1'>
			{/* Modernized Header */}
			<CustomHeader title={dealership?.name} onBack={()=>router.back()}/>

			<Animated.FlatList
				data={filteredCars}
				renderItem={renderCarItem}
				keyExtractor={item => `${item.id}-${item.make}-${item.model}`}
				onEndReached={handleLoadMore}
				onEndReachedThreshold={0.5}
				ListHeaderComponent={renderHeader}
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
