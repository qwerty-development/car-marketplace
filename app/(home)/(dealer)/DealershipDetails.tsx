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
	Dimensions,
	StatusBar,
	Platform,
	StyleSheet,
	FlatList
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
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps'
import * as Linking from 'expo-linking'
import { Video, ResizeMode } from 'expo-av'
import { formatDistanceToNow } from 'date-fns'

const ITEMS_PER_PAGE = 10
const { width } = Dimensions.get('window')

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
interface AutoClip {
	id: number
	title: string
	description: string
	video_url: string
	status: 'published' | 'draft'
	car_id: number
	dealership_id: number
	created_at: Date
	car: {
		year: number
		make: string
		model: string
	}
}

const CustomHeader = React.memo(
	({ title, onBack }: { title: string; onBack: () => void }) => {
		const { isDarkMode } = useTheme()
		const iconColor = isDarkMode ? '#D55004' : '#FF8C00'

		return (
			<SafeAreaView
				edges={['top']}
				className={`${isDarkMode ? 'bg-black' : 'bg-white'}`}>
				<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
				<View className='flex-row items-center px-4 mb-1'>
					<TouchableOpacity onPress={onBack}>
						<Ionicons name='arrow-back' size={24} color={iconColor} />
					</TouchableOpacity>
					<Text
						className={`ml-4 text-lg font-bold mx-auto ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
						{title}
					</Text>
				</View>
			</SafeAreaView>
		)
	}
)

// Modified DealershipMapView component
const DealershipMapView = ({ dealership, isDarkMode }: any) => {
	const mapRef = useRef<any>(null)
	const [mapReady, setMapReady] = useState(false)
	const isIOS = Platform.OS === 'ios'

	const handleMapReady = () => {
		setMapReady(true)
		if (mapRef.current) {
			mapRef.current.fitToSuppliedMarkers(['dealershipMarker'], {
				edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
				animated: true
			})
		}
	}

	const openInMaps = () => {
		const scheme = Platform.select({
			ios: 'maps:0,0?q=',
			android: 'geo:0,0?q='
		})
		const latLng = `${dealership.latitude},${dealership.longitude}`
		const label = encodeURIComponent(dealership.name)
		const url: any = Platform.select({
			ios: `${scheme}${label}@${latLng}`,
			android: `${scheme}${latLng}(${label})`
		})
		Linking.openURL(url)
	}

	return (
		<View className='h-64 rounded-lg overflow-hidden'>
			<MapView
				ref={mapRef}
				provider={Platform.OS === 'ios' ? undefined : PROVIDER_GOOGLE}
				style={{ flex: 1 }}
				initialRegion={{
					latitude: dealership.latitude || 37.7749,
					longitude: dealership.longitude || -122.4194,
					latitudeDelta: 0.02,
					longitudeDelta: 0.02
				}}
				onMapReady={handleMapReady}
				showsUserLocation={true}
				showsMyLocationButton={isIOS ? false : true}
				showsCompass={true}
				mapType={isDarkMode ? 'mutedStandard' : 'standard'}
				className={isDarkMode ? 'opacity-90' : 'opacity-100'}>
				{mapReady && (
					<Marker
						identifier='dealershipMarker'
						coordinate={{
							latitude: dealership.latitude || 37.7749,
							longitude: dealership.longitude || -122.4194
						}}>
						<View className='items-center'>
							<Image
								source={{ uri: dealership.logo }}
								className='w-12 h-12 rounded-full border-2 border-red'
							/>
							{isIOS && (
								<View className='bg-white/90 dark:bg-gray/90 px-3 py-2 rounded-lg mt-2 shadow-lg'>
									<Text className='text-sm font-bold text-red text-center'>
										{dealership.name}
									</Text>
								</View>
							)}
						</View>
						{!isIOS && (
							<Callout tooltip>
								<BlurView
									intensity={90}
									tint={isDarkMode ? 'dark' : 'light'}
									className='rounded-xl overflow-hidden shadow-lg'>
									<View className='p-4 min-w-[250px]'>
										<View className='flex-row items-center mb-2'>
											<Image
												source={{ uri: dealership.logo }}
												className='w-8 h-8 rounded-full mr-2'
											/>
											<Text className='text-lg font-bold text-red flex-1'>
												{dealership.name}
											</Text>
										</View>

										<View className='flex-row items-center mb-2'>
											<Ionicons
												name='location-outline'
												size={16}
												color={isDarkMode ? '#fff' : '#000'}
												className='mr-2'
											/>
											<Text
												className={`text-sm ${
													isDarkMode ? 'text-white' : 'text-black'
												} flex-1`}>
												{dealership.location}
											</Text>
										</View>

										{dealership.phone && (
											<View className='flex-row items-center'>
												<Ionicons
													name='call-outline'
													size={16}
													color={isDarkMode ? '#fff' : '#000'}
													className='mr-2'
												/>
												<Text
													className={`text-sm ${
														isDarkMode ? 'text-white' : 'text-black'
													}`}>
													{dealership.phone}
												</Text>
											</View>
										)}

										<TouchableOpacity
											className='bg-red mt-3 py-2 rounded-lg'
											onPress={openInMaps}>
											<Text className='text-white text-center font-semibold'>
												Get Directions
											</Text>
										</TouchableOpacity>
									</View>
								</BlurView>
							</Callout>
						)}
					</Marker>
				)}
			</MapView>

			<TouchableOpacity
				onPress={openInMaps}
				className='absolute bottom-4 right-4 bg-red/90 px-4 py-2 rounded-full
                  flex-row items-center shadow-lg border border-white/20'>
				<Ionicons name='navigate' size={20} color='white' />
				<Text className='text-white text-sm font-semibold ml-2'>
					Directions
				</Text>
			</TouchableOpacity>
		</View>
	)
}

const DealershipAutoClips = ({ dealershipId }: { dealershipId: string }) => {
	const [autoClips, setAutoClips] = useState<AutoClip[]>([])
	const [isPlaying, setIsPlaying] = useState<{ [key: number]: boolean }>({})
	const videoRefs = useRef<{ [key: number]: any }>({})
	const isFocused = useLocalSearchParams()
	const getFormattedPostDate = useCallback((createdAt: any) => {
		return formatDistanceToNow(new Date(createdAt), { addSuffix: true })
	}, [])

	useEffect(() => {
		const fetchDealershipClips = async () => {
			try {
				const { data: clipsData, error: clipsError } = await supabase
					.from('auto_clips')
					.select('*,cars(year,make,model)')
					.eq('dealership_id', dealershipId)
					.eq('status', 'published')
					.limit(5) // Limit to 5 clips

				if (clipsError) throw clipsError

				setAutoClips(clipsData || [])
			} catch (error) {
				console.error('Error fetching dealership clips:', error)
			}
		}

		if (dealershipId) {
			fetchDealershipClips()
		}
	}, [dealershipId])

	useEffect(() => {
		// Pause all videos when the screen is not focused
		if (!isFocused) {
			Object.values(videoRefs.current).forEach(async ref => {
				try {
					await ref?.pauseAsync()
				} catch (error) {
					console.error('Error pausing video:', error)
				}
			})
		}
	}, [isFocused])

	const handleVideoPress = async (clipId: number) => {
		const videoRef = videoRefs.current[clipId]
		if (!videoRef) return

		const newPlayingState = !isPlaying[clipId]
		setIsPlaying(prev => ({ ...prev, [clipId]: newPlayingState }))

		try {
			if (newPlayingState) {
				await videoRef.playAsync()
			} else {
				await videoRef.pauseAsync()
			}
		} catch (error) {
			console.error('Error handling video playback:', error)
		}
	}

	const renderItem = ({ item, index }: { item: AutoClip; index: number }) => {
		const formattedPostDate = getFormattedPostDate(item.created_at)

		return (
			<TouchableOpacity
				activeOpacity={1}
				onPress={() => handleVideoPress(item.id)}
				style={styles.clipContainer}>
				<Video
					ref={ref => (videoRefs.current[item.id] = ref)}
					source={{ uri: item.video_url }}
					style={styles.video}
					resizeMode={ResizeMode.COVER}
					shouldPlay={isPlaying[item.id]}
					isLooping
					isMuted={false} // Or manage mute state as needed
				/>
				<View style={styles.infoContainer}>
					<Text style={styles.title}>
						{item?.car?.year} {item?.car?.make} {item?.car?.model}
					</Text>
					<Text style={styles.description}>{item.description}</Text>
					<Text style={styles.postDate}>{formattedPostDate}</Text>
				</View>
			</TouchableOpacity>
		)
	}

	return (
		<View style={styles.container}>
			<Text style={styles.header}>AutoClips</Text>
			<FlatList
				data={autoClips}
				renderItem={renderItem}
				keyExtractor={item => item.id.toString()}
				horizontal
				showsHorizontalScrollIndicator={false}
			/>
		</View>
	)
}

export default function DealershipDetails() {
	const { isDarkMode } = useTheme()
	const { dealershipId } = useLocalSearchParams<{ dealershipId: string }>()
	const router = useRouter()
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
	const [makes, setMakes] = useState<string[]>([])
	const [models, setModels] = useState<string[]>([])
	const scrollY = new Animated.Value(0)

	const bgGradient = isDarkMode
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
					.select('*', { count: 'exact' })
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

				query = query
					.order(sortBy, { ascending: sortOrder === 'asc' })
					.range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1)

				const { data, count, error } = await query

				if (error) throw error

				setCars(prevCars => (page === 1 ? data : [...prevCars, ...data]))
				setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE))
				setCurrentPage(page)
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
				isDealer
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
           textAlignVertical="center"
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
			const whatsappUrl = `https://wa.me/+961${dealership.phone}`
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
						<Image
							source={{ uri: dealership.logo }}
							className='w-24 h-24 rounded-full self-center mb-4'
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
						{/* <MapView
							style={{
								height: 200,
								borderRadius: 10,
								marginVertical: 10,
								width: width - 64
							}}
							region={{
								latitude: dealership.latitude || 37.7749,
								longitude: dealership.longitude || -122.4194,
								latitudeDelta: 0.01,
								longitudeDelta: 0.01
							}}>
							<Marker
								coordinate={{
									latitude: dealership.latitude || 37.7749,
									longitude: dealership.longitude || -122.4194
								}}
								title={dealership.name}
								description={dealership.location}
							/>
						</MapView> */}

						<DealershipMapView
							dealership={dealership}
							isDarkMode={isDarkMode}
						/>
					</View>
				)}
				<DealershipAutoClips dealershipId={dealershipId} />
				<FilterSection />
				<Text className={`text-xl font-bold ${textColor} mb-4`}>
					Available Cars ({cars.length})
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
			cars.length,
			dealershipId
		]
	)

	return (
		<LinearGradient colors={bgGradient} className='flex-1'>
			<CustomHeader
				title={dealership?.name || 'Dealership'}
				onBack={() => router.back()}
			/>
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
	header: {
		fontSize: 18,
		fontWeight: 'bold',
		marginBottom: 10,
		marginLeft: 10
	},
	clipContainer: {
		width: width * 0.6, // Adjust width as needed
		height: 200, // Adjust height as needed
		marginRight: 10,
		borderRadius: 10,
		overflow: 'hidden'
	},
	video: {
		width: '100%',
		height: '100%'
	},
	infoContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		padding: 10
	},
	title: {
		color: '#D55004',
		fontSize: 16,
		fontWeight: 'bold'
	},
	description: {
		color: 'white',
		fontSize: 14
	},
	postDate: {
		color: 'white',
		fontSize: 12,
		marginTop: 5
	}
})
