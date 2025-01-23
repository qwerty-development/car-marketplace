import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
	View,
	Text,
	Image,
	ActivityIndicator,
	TouchableOpacity,
	TextInput,
	RefreshControl,
	Animated,
	StatusBar,
	Platform,
	StyleSheet,
	Alert,
	Dimensions
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/app/(home)/(user)/CarDetailModal'
import CarDetailModalIOS from './CarDetailModalIOS'
import { useFavorites } from '@/utils/useFavorites'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import RNPickerSelect from 'react-native-picker-select'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import MapView, { Marker } from 'react-native-maps'
import * as Linking from 'expo-linking'
const { width } = Dimensions.get('window')
const ITEMS_PER_PAGE = 10
import DealershipAutoClips from '@/components/DealershipAutoClips'

const OptimizedImage = React.memo(({ source, style, className }: any) => {
	const [isLoading, setIsLoading] = useState(true)
	const [hasError, setHasError] = useState(false)

	return (
		<View className={`relative ${className}`}>
			{hasError && (
				<View className='absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-800 rounded-full'>
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

const CustomHeader = React.memo(({ title }: { title: string }) => {
	const { isDarkMode } = useTheme()

	return (
		<SafeAreaView className={`bg-${isDarkMode ? 'black' : 'white'} `}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View className='flex-row ml-6'>
				<Text className='text-2xl -mb-5 font-bold text-black dark:text-white'>
					{title}
				</Text>
			</View>
		</SafeAreaView>
	)
})

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
			<View className='h-64 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800 items-center justify-center'>
				<Ionicons
					name='map-outline'
					size={48}
					color={isDarkMode ? '#666' : '#999'}
				/>
				<Text className='text-gray-500 dark:text-gray-400 mt-4 text-center px-4'>
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
	const [searchQuery, setSearchQuery] = useState('')
	const [filterMake, setFilterMake] = useState('')
	const [filterModel, setFilterModel] = useState('')
	const [filterCondition, setFilterCondition] = useState('')
	const [sortBy, setSortBy] = useState('listed_at')
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
	const [makes, setMakes] = useState<any[]>([])
	const [models, setModels] = useState<string[]>([])
	const scrollY = new Animated.Value(0)

	const bgGradient: [string, string] = isDarkMode
		? ['#000000', '#1c1c1c']
		: ['#FFFFFF', '#F0F0F0']
	const textColor = isDarkMode ? 'text-white' : 'text-black'
	const iconColor = isDarkMode ? '#D55004' : '#FF8C00'
	const cardBgColor = isDarkMode ? 'bg-night' : 'bg-white'

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

				if (searchQuery) {
					query = query.or(
						`make.ilike.%${searchQuery}%,model.ilike.%${searchQuery}%`
					)
				}
				if (filterMake) query = query.eq('make', filterMake)
				if (filterModel) query = query.eq('model', filterModel)
				if (filterCondition) query = query.eq('condition', filterCondition)

				// Get total count for pagination
				const { count } = await query
				const totalItems = count || 0
				const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)
				const safePageNumber = Math.min(page, totalPages)
				const startRange = (safePageNumber - 1) * ITEMS_PER_PAGE
				const endRange = Math.min(
					safePageNumber * ITEMS_PER_PAGE - 1,
					totalItems - 1
				)

				// Get paginated data with sorting
				const { data, error } = await query
					.order(sortBy, { ascending: sortOrder === 'asc' })
					.range(startRange, endRange)

				if (error) throw error

				// Process the data to include dealership information
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

				// Remove duplicates
				const uniqueCars = Array.from(
					new Set(processedCars.map(car => car.id))
				).map(id => processedCars.find(car => car.id === id))

				// Update state
				setCars(prevCars =>
					safePageNumber === 1 ? uniqueCars : [...prevCars, ...uniqueCars]
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
		[
			dealershipId,
			searchQuery,
			filterMake,
			filterModel,
			filterCondition,
			sortBy,
			sortOrder
		]
	)

	const fetchMakes = useCallback(async () => {
		try {
			const { data, error } = await supabase
				.from('cars')
				.select('make')
				.eq('dealership_id', dealershipId)
				.order('make')

			if (error) throw error

			const uniqueMakes = [...new Set(data?.map(item => item.make))]
			setMakes(uniqueMakes)
		} catch (error) {
			console.error('Error fetching makes:', error)
		}
	}, [dealershipId])

	const fetchModels = useCallback(
		async (make: string) => {
			try {
				const { data, error } = await supabase
					.from('cars')
					.select('model')
					.eq('dealership_id', dealershipId)
					.eq('make', make)
					.order('model')

				if (error) throw error

				const uniqueModels = [...new Set(data?.map(item => item.model))]
				setModels(uniqueModels)
			} catch (error) {
				console.error('Error fetching models:', error)
			}
		},
		[dealershipId]
	)

	useEffect(() => {
		fetchDealershipDetails()
		fetchMakes()
	}, [fetchDealershipDetails, fetchMakes])

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
		Promise.all([
			fetchDealershipDetails(),
			fetchDealershipCars(1, true),
			fetchMakes()
		]).then(() => {
			setIsRefreshing(false)
		})
	}, [fetchDealershipDetails, fetchDealershipCars, fetchMakes])

	const handleLoadMore = useCallback(() => {
		if (currentPage < totalPages && !isCarsLoading) {
			fetchDealershipCars(currentPage + 1)
		}
	}, [currentPage, totalPages, isCarsLoading, fetchDealershipCars])

	const handleSearch = useCallback(() => {
		setCurrentPage(1)
		fetchDealershipCars(1, true)
	}, [fetchDealershipCars])

	const handleMakeFilter = useCallback(
		(value: any) => {
			setFilterMake(value)
			setFilterModel('')
			fetchModels(value)
			setCurrentPage(1)
			fetchDealershipCars(1, true)
		},
		[fetchModels, fetchDealershipCars]
	)

	const handleModelFilter = useCallback(
		(value: string) => {
			setFilterModel(value)
			setCurrentPage(1)
			fetchDealershipCars(1, true)
		},
		[fetchDealershipCars]
	)

	const handleConditionFilter = useCallback(
		(value: string) => {
			setFilterCondition(value)
			setCurrentPage(1)
			fetchDealershipCars(1, true)
		},
		[fetchDealershipCars]
	)

	const handleSort = useCallback(
		(value: string) => {
			if (value === null) {
				setSortBy('listed_at')
				setSortOrder('desc')
			} else {
				const [newSortBy, newSortOrder] = value.split('_')
				setSortBy(newSortBy)
				setSortOrder(newSortOrder as 'asc' | 'desc')
			}
			setCurrentPage(1)
			fetchDealershipCars(1, true)
		},
		[fetchDealershipCars]
	)

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

	const FilterSection = () => {
		const [isExpanded, setIsExpanded] = useState(false)
		const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery)

		const handleLocalSearch = () => {
			setSearchQuery(localSearchQuery)
			handleSearch()
		}

		const handleCancelSearch = () => {
			setLocalSearchQuery('')
			setSearchQuery('')
			handleSearch()
		}

		return (
			<BlurView
				intensity={80}
				tint={isDarkMode ? 'dark' : 'light'}
				style={styles.container}>
				<View style={styles.searchContainer}>
					<TextInput
						style={[styles.searchInput, isDarkMode && styles.darkText]}
						placeholder='Search cars...'
						placeholderTextColor={isDarkMode ? '#888' : '#555'}
						value={localSearchQuery}
						onChangeText={setLocalSearchQuery}
						className='border border-red '
					/>
					{localSearchQuery !== '' && (
						<TouchableOpacity
							onPress={handleCancelSearch}
							style={styles.cancelButton}>
							<Ionicons
								name='close-circle'
								size={24}
								color={isDarkMode ? '#fff' : '#000'}
							/>
						</TouchableOpacity>
					)}
					<TouchableOpacity
						onPress={handleLocalSearch}
						style={styles.searchButton}>
						<Ionicons name='search' size={24} color='white' />
					</TouchableOpacity>
					<TouchableOpacity
						onPress={() => setIsExpanded(!isExpanded)}
						style={styles.expandButton}>
						<Ionicons
							name={isExpanded ? 'chevron-up' : 'chevron-down'}
							size={24}
							color='white'
						/>
					</TouchableOpacity>
				</View>

				{isExpanded && (
					<View style={styles.filtersContainer}>
						<View style={styles.filterRow}>
							<FilterPicker
								label='Make'
								value={filterMake}
								items={makes.map(make => ({ label: make, value: make }))}
								onValueChange={handleMakeFilter}
								isDarkMode={isDarkMode}
							/>
							<FilterPicker
								label='Model'
								value={filterModel}
								items={models.map(model => ({ label: model, value: model }))}
								onValueChange={handleModelFilter}
								isDarkMode={isDarkMode}
							/>
						</View>
						<View style={styles.filterRow}>
							<FilterPicker
								label='Condition'
								value={filterCondition}
								items={[
									{ label: 'New', value: 'New' },
									{ label: 'Used', value: 'Used' }
								]}
								onValueChange={handleConditionFilter}
								isDarkMode={isDarkMode}
							/>
							<FilterPicker
								label='Sort By'
								value={`${sortBy}_${sortOrder}`}
								items={[
									{ label: 'Price: Low to High', value: 'price_asc' },
									{ label: 'Price: High to Low', value: 'price_desc' },
									{ label: 'Mileage: Low to High', value: 'mileage_asc' },
									{ label: 'Mileage: High to Low', value: 'mileage_desc' }
								]}
								onValueChange={handleSort}
								isDarkMode={isDarkMode}
							/>
						</View>
					</View>
				)}
			</BlurView>
		)
	}

	const FilterPicker = ({
		label,
		value,
		items,
		onValueChange,
		isDarkMode
	}: any) => (
		<View style={styles.pickerContainer}>
			<Text style={[styles.pickerLabel, isDarkMode && styles.darkText]}>
				{label}
			</Text>
			<RNPickerSelect
				onValueChange={onValueChange}
				items={items}
				placeholder={{ label: `All ${label}s`, value: null }}
				value={value}
				style={pickerSelectStyles(isDarkMode)}
				useNativeAndroidPickerStyle={false}
				Icon={() => (
					<Ionicons
						name='chevron-down'
						size={24}
						color={isDarkMode ? '#fff' : '#000'}
					/>
				)}
			/>
		</View>
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

	const renderHeader = useMemo(
		() => (
			<>
				{dealership && (
					<View
						className={`${
							isDarkMode ? 'bg-light-text' : 'bg-white'
						} rounded-lg shadow-md p-4 mb-4 border border-red`}>
						<OptimizedImage
							source={{
								uri: dealership.logo || 'https://via.placeholder.com/150'
							}}
							className='w-24 h-24 rounded-full self-center mb-4'
							style={{
								shadowColor: isDarkMode ? '#D55004' : '#000',
								shadowOffset: { width: 0, height: 2 },
								shadowOpacity: 0.25,
								shadowRadius: 3.84,
								elevation: 5
							}}
						/>
						<Text
							className={`text-2xl font-bold ${textColor} text-center mb-2`}>
							{dealership.name}
						</Text>
						<View className='flex-row justify-center space-x-4 mb-4'>
							<TouchableOpacity
								onPress={handleCall}
								className='bg-green-500 px-4 py-2 rounded-full flex-row items-center'>
								<Ionicons name='call-outline' size={20} color='white' />
								<Text className='text-white ml-2'>Call</Text>
							</TouchableOpacity>
							<TouchableOpacity
								onPress={handleWhatsApp}
								className='bg-blue-500 px-4 py-2 rounded-full flex-row items-center'>
								<Ionicons name='logo-whatsapp' size={20} color='white' />
								<Text className='text-white ml-2'>WhatsApp</Text>
							</TouchableOpacity>
						</View>
						<View className='flex-row items-center justify-center mb-4'>
							<Ionicons name='location-outline' size={20} color={iconColor} />
							<Text className={`${textColor} ml-2`}>{dealership.location}</Text>
						</View>
						<DealershipMapView
							dealership={dealership}
							isDarkMode={isDarkMode}
						/>
						<DealershipAutoClips dealershipId={dealershipId} />
					</View>
				)}
				<FilterSection />
				<Text className={`text-xl font-bold ${textColor} mb-4`}>
					Available Cars ({cars?.length})
				</Text>
			</>
		),
		[
			dealership,
			cardBgColor,
			textColor,
			iconColor,
			isDarkMode,
			searchQuery,
			handleSearch,
			makes,
			models,
			filterMake,
			filterModel,
			filterCondition,
			sortBy,
			sortOrder,
			handleMakeFilter,
			handleModelFilter,
			handleConditionFilter,
			handleSort,
			cars?.length,
			dealershipId
		]
	)

	return (
		<LinearGradient colors={bgGradient} className='flex-1'>
			<CustomHeader title={dealership?.name || 'Dealership'} />
			<Animated.FlatList
				data={cars}
				renderItem={renderCarItem}
				keyExtractor={item => `${item.id}-${item.make}-${item.model}`}
				showsVerticalScrollIndicator={false}
				onEndReached={handleLoadMore}
				onEndReachedThreshold={0.1}
				refreshControl={
					<RefreshControl
						refreshing={isRefreshing}
						onRefresh={handleRefresh}
						tintColor={isDarkMode ? '#ffffff' : '#000000'}
						colors={['#D55004']}
					/>
				}
				ListHeaderComponent={renderHeader}
				ListFooterComponent={() =>
					isCarsLoading ? (
						<View className='py-4'>
							<ActivityIndicator size='large' color='#D55004' />
						</View>
					) : null
				}
				contentContainerStyle={{
					paddingHorizontal: 0
				}}
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

const pickerSelectStyles = (isDarkMode: any) =>
	StyleSheet.create({
		inputIOS: {
			fontSize: 16,
			paddingVertical: 12,
			paddingHorizontal: 10,
			borderWidth: 1,
			borderColor: isDarkMode ? '#555' : '#d1d1d1',
			borderRadius: 8,
			color: isDarkMode ? '#fff' : '#000',
			paddingRight: 30,
			backgroundColor: isDarkMode
				? 'rgba(80, 80, 80, 0.5)'
				: 'rgba(255, 255, 255, 0.5)'
		},
		inputAndroid: {
			fontSize: 16,
			paddingHorizontal: 10,
			paddingVertical: 8,
			borderWidth: 1,
			borderColor: isDarkMode ? '#555' : '#d1d1d1',
			borderRadius: 8,
			color: isDarkMode ? '#fff' : '#000',
			paddingRight: 30,
			backgroundColor: isDarkMode
				? 'rgba(80, 80, 80, 0.5)'
				: 'rgba(255, 255, 255, 0.5)'
		},
		iconContainer: {
			top: 10,
			right: 12
		}
	})

const styles = StyleSheet.create({
	container: {
		borderRadius: 16,
		overflow: 'hidden',
		marginBottom: 16
	},
	searchContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 12
	},
	searchInput: {
		flex: 1,
		height: 40,
		backgroundColor: 'rgba(255, 255, 255, 0.2)',
		borderRadius: 20,
		paddingHorizontal: 16,
		paddingRight: 40, // Add space for the cancel button
		marginRight: 8,
		color: '#000'
	},
	cancelButton: {
		position: 'absolute',
		right: 110, // Adjust this value to position the cancel button correctly
		top: 20,
		zIndex: 1
	},
	searchButton: {
		backgroundColor: '#D55004',
		borderRadius: 20,
		padding: 8,
		marginRight: 8
	},
	expandButton: {
		backgroundColor: '#D55004',
		borderRadius: 20,
		padding: 8
	},
	filtersContainer: {
		padding: 12
	},
	filterRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 12
	},
	pickerContainer: {
		flex: 1,
		marginHorizontal: 4
	},
	pickerLabel: {
		fontSize: 14,
		marginBottom: 4,
		color: '#000'
	},
	darkText: {
		color: '#fff'
	},
	clipContainer: {
		width: width * 0.45,
		height: 240,
		marginRight: 10,
		borderRadius: 10,
		overflow: 'hidden',
		backgroundColor: '#f0f0f0'
	},
	video: {
		width: '100%',
		height: '100%'
	},
	clipInfoContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		padding: 10,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		borderBottomLeftRadius: 10,
		borderBottomRightRadius: 10
	},
	clipTitle: {
		color: 'white',
		fontSize: 14,
		fontWeight: 'bold'
	},
	clipDescription: {
		color: '#E0E0E0',
		fontSize: 12
	},
	clipPostDate: {
		color: '#E0E0E0',
		fontSize: 10,
		marginTop: 5
	},
	controlsContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 5
	},
	modalClipInfoContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		padding: 20,
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20
	},
	playPauseIcon: {
		position: 'absolute',
		top: '50%',
		left: '50%',
		transform: [{ translateX: -25 }, { translateY: -25 }],
		backgroundColor: 'rgba(0,0,0,0.5)',
		borderRadius: 30,
		padding: 10,
		zIndex: 10
	},
	heartAnimation: {
		position: 'absolute',
		top: '50%',
		left: '50%',
		transform: [{ translateX: -40 }, { translateY: -40 }],
		zIndex: 11
	}
})
