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
import MapView, { Marker } from 'react-native-maps'
import * as Linking from 'expo-linking'
import DealershipAutoClips from '@/components/DealershipAutoClips'
import SortPicker from '@/components/SortPicker'
import { ChevronLeft } from 'lucide-react-native'
import { ActivityIndicator } from 'react-native'
const ITEMS_PER_PAGE = 10



interface FilterState {
	searchQuery: string
	sortOption: string
	priceRange?: [number, number]
	yearRange?: [number, number]
}



const CustomHeader = React.memo(
  ({ title, onBack }: { title: string; onBack?: () => void }) => {
    const { isDarkMode } = useTheme();

    return (
      <SafeAreaView style={{
        backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',

      }}>
        <StatusBar
          barStyle={isDarkMode ? "light-content" : "dark-content"}
          backgroundColor={isDarkMode ? '#000000' : '#FFFFFF'}
          translucent={true}
        />
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingBottom: 8
        }}>
          {onBack && (
            <TouchableOpacity
              onPress={onBack}
              style={{ padding: 8 }}

            >
              <Ionicons
                name="chevron-back"
                size={28}
                color={isDarkMode ? "#FFFFFF" : "#000000"}
              />
            </TouchableOpacity>
          )}
          <Text style={{
            fontSize: 24,
            fontWeight: 'bold',
            marginLeft: 8,
            color: isDarkMode ? "#FFFFFF" : "#000000"
          }}>
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

// Enhanced DealershipMapView for Android
const DealershipMapView = ({ dealership, isDarkMode }: any) => {
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [isMapVisible, setIsMapVisible] = useState(false);

  useEffect(() => {
    // Delayed rendering prevents initial loading issues
    const timeout = setTimeout(() => setIsMapVisible(true), 300);
    return () => clearTimeout(timeout);
  }, []);

  // Validate coordinates before rendering
  const hasValidCoordinates = useMemo(() => {
    if (!dealership?.latitude || !dealership?.longitude) return false;
    const lat = parseFloat(dealership.latitude);
    const lng = parseFloat(dealership.longitude);
    return !isNaN(lat) && !isNaN(lng);
  }, [dealership]);

  if (!hasValidCoordinates || mapError) {
    return (
      <View style={{
        height: 256,
        borderRadius: 16,
        backgroundColor: isDarkMode ? '#333' : '#f0f0f0',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Ionicons
          name='map-outline'
          size={48}
          color={isDarkMode ? '#666' : '#999'}
        />
        <Text style={{
          color: isDarkMode ? '#999' : '#666',
          marginTop: 16,
          textAlign: 'center',
          paddingHorizontal: 16,
        }}>
          {mapError ? 'Unable to load map' : 'Location not available'}
        </Text>
      </View>
    );
  }

  // Parse coordinates properly
  const lat = parseFloat(dealership.latitude);
  const lng = parseFloat(dealership.longitude);

  const region = {
    latitude: lat,
    longitude: lng,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01
  };

  const handleMapError = () => {
    setMapError(true);
    console.error('Map failed to load');
  };

  return (
    <View style={{
      height: 256,
      borderRadius: 16,
      overflow: 'hidden'
    }}>
      {isMapVisible && (
        <>
          <MapView
            provider="google"
            style={{ flex: 1 }}
            initialRegion={region}
            onMapReady={() => setIsMapReady(true)}
            onError={handleMapError}
            liteMode={true} // Use lite mode on Android for better performance
          >
            {isMapReady && (
              <Marker
                coordinate={{
                  latitude: lat,
                  longitude: lng
                }}
              >
                <View style={{
                  backgroundColor: '#fff',
                  borderRadius: 20,
                  padding: 4,
                  borderWidth: 2,
                  borderColor: '#fff'
                }}>
                  {dealership.logo ? (
                    <Image
                      source={{ uri: dealership.logo }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20
                      }}
                    />
                  ) : (
                    <Ionicons name="business" size={24} color="#D55004" />
                  )}
                </View>
              </Marker>
            )}
          </MapView>

          <TouchableOpacity
            onPress={() => {
              const googleMapsUrl = `geo:${lat},${lng}?q=${lat},${lng}`;
              Linking.openURL(googleMapsUrl).catch(() => {
                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
              });
            }}
            style={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              backgroundColor: '#D55004',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 24,
              flexDirection: 'row',
              alignItems: 'center',
              elevation: 3
            }}
          >
            <Ionicons name='navigate' size={16} color='white' />
            <Text style={{ color: 'white', marginLeft: 8 }}>Take Me There</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

export default function DealershipDetails() {
	const { isDarkMode } = useTheme()
	const { dealershipId } = useLocalSearchParams<{ dealershipId: string }>()
	const [dealership, setDealership] = useState<any>(null)
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
						dealership_name: item.dealerships?.name,
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
			const whatsappUrl = `https://wa.me/+961${dealership.phone}`
			Linking.openURL(whatsappUrl)
		}
	}, [dealership])

	const renderHeader = useCallback(
		() => (
			<>
				{dealership && (
					<View className='mb-6'>
						{/* Dealership Info Card */}
			{/* Dealership Info Card - Modernized */}
 <View style={{
      paddingHorizontal: 16,
      paddingBottom: 24,
      marginTop: 16,
    }}>
      <View style={{
        backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        // Android shadow
        elevation: 4
      }}>
        {/* Logo and Info Row */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Dealership Logo */}
          <View style={{ position: 'relative' }}>
            <View style={{
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              borderRadius: 16,
              padding: 4
            }}>
              <Image
                source={{ uri: dealership.logo }}
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#D55004',
                }}
              />
            </View>
          </View>

          {/* Dealership Information */}
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text style={{
              fontSize: 22,
              fontWeight: 'bold',
              color: isDarkMode ? '#FFFFFF' : '#000000'
            }}>
              {dealership?.name}
            </Text>

            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 4,
              backgroundColor: 'rgba(128,128,128,0.1)',
              borderRadius: 16,
              paddingHorizontal: 12,
              paddingVertical: 4,
              alignSelf: 'flex-start'
            }}>
              <Ionicons
                name='location-outline'
                size={14}
                color='#D55004'
              />
              <Text style={{
                marginLeft: 4,
                fontSize: 14,
                color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'
              }} numberOfLines={1}>
                {dealership.location}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          marginTop: 16,
          marginBottom: 8,
          paddingHorizontal: 8
        }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{
              fontSize: 12,
              color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)'
            }}>
              Available Cars
            </Text>
            <Text style={{
              fontSize: 18,
              fontWeight: 'bold',
              color: isDarkMode ? '#FFFFFF' : '#000000'
            }}>
              {filteredCars.length}
            </Text>
          </View>

          <View style={{
            height: '100%',
            width: 1,
            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'
          }}/>

          <View style={{ alignItems: 'center' }}>
            <Text style={{
              fontSize: 12,
              color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)'
            }}>
              Since
            </Text>
            <Text style={{
              fontSize: 18,
              fontWeight: 'bold',
              color: isDarkMode ? '#FFFFFF' : '#000000'
            }}>
              {dealership.created_at ? new Date(dealership.created_at).getFullYear() : 'N/A'}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 16
        }}>
          <TouchableOpacity
            onPress={handleCall}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              paddingVertical: 12,
              borderRadius: 12,
              marginRight: 8
            }}>
            <View style={{
              backgroundColor: 'rgba(213,80,4,0.1)',
              borderRadius: 999,
              padding: 4
            }}>
              <Ionicons name='call-outline' size={18} color='#D55004' />
            </View>
            <Text style={{
              marginLeft: 4,
              fontWeight: '500',
              color: isDarkMode ? '#FFFFFF' : '#000000'
            }}>
              Call
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleWhatsApp}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#25D366',
              paddingVertical: 12,
              borderRadius: 12,
              marginLeft: 8,
              elevation: 2
            }}>
            <Ionicons name='logo-whatsapp' size={18} color='white' />
            <Text style={{
              marginLeft: 4,
              color: 'white',
              fontWeight: '500'
            }}>
              WhatsApp
            </Text>
          </TouchableOpacity>
        </View>
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
