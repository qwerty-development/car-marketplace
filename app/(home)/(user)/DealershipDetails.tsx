import React, { useEffect, useState, useCallback } from 'react'
import {
	View,
	Text,
	Image,
	FlatList,
	ActivityIndicator,
	TouchableOpacity,
	TextInput,
	RefreshControl,
	Animated,
	Dimensions,
	PanResponder,
	StatusBar
} from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/app/(home)/(user)/CarDetailModal'
import { useFavorites } from '@/utils/useFavorites'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import RNPickerSelect from 'react-native-picker-select'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import MapView, { Marker } from 'react-native-maps'

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

const CustomHeader = ({ title, onBack }: any) => {
	const { isDarkMode } = useTheme()
	const iconColor = isDarkMode ? '#D55004' : '#FF8C00'

	return (
		<SafeAreaView
			edges={['top']}
			style={{ backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
				<TouchableOpacity onPress={onBack}>
					<Ionicons name='arrow-back' size={24} color={iconColor} />
				</TouchableOpacity>
				<Text
					style={{
						marginLeft: 16,
						fontSize: 18,
						fontWeight: 'bold',
						color: isDarkMode ? '#FFFFFF' : '#000000'
					}}>
					{title}
				</Text>
			</View>
		</SafeAreaView>
	)
}

export default function DealershipDetails() {
	const { isDarkMode } = useTheme()
	const { dealershipId } = useLocalSearchParams()
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const [dealership, setDealership] = useState<Dealership | null>(null)
	const [cars, setCars] = useState<Car[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [selectedCar, setSelectedCar] = useState<Car | null>(null)
	const [isModalVisible, setIsModalVisible] = useState(false)
	const [currentPage, setCurrentPage] = useState(1)
	const [totalPages, setTotalPages] = useState(1)
	const { favorites, toggleFavorite, isFavorite } = useFavorites()
	const [searchQuery, setSearchQuery] = useState('')
	const [filterMake, setFilterMake] = useState('')
	const [filterModel, setFilterModel] = useState('')
	const [filterCondition, setFilterCondition] = useState('')
	const [sortBy, setSortBy] = useState('listed_at')
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
	const [makes, setMakes] = useState<string[]>([])
	const [models, setModels] = useState<string[]>([])
	const scrollY = new Animated.Value(0)

	useEffect(() => {
		fetchDealershipDetails()
		fetchDealershipCars()
		fetchMakes()
	}, [dealershipId])

	const bgGradient = isDarkMode
		? ['#000000', '#1c1c1c']
		: ['#FFFFFF', '#F0F0F0']
	const textColor = isDarkMode ? 'text-white' : 'text-black'
	const iconColor = isDarkMode ? '#D55004' : '#FF8C00'
	const cardBgColor = isDarkMode ? 'bg-gray-800' : 'bg-white'

	const mapRegion = {
		latitude: dealership?.latitude || 37.7749,
		longitude: dealership?.longitude || -122.4194,
		latitudeDelta: 0.01,
		longitudeDelta: 0.01
	}

	const panResponder = PanResponder.create({
		onMoveShouldSetPanResponder: (_, gestureState) => {
			return gestureState.dx < -30
		},
		onPanResponderRelease: (_, gestureState) => {
			if (gestureState.dx < -50) {
				// Implement close functionality if needed
			}
		}
	})
	const fetchDealershipDetails = async () => {
		const { data, error } = await supabase
			.from('dealerships')
			.select('*')
			.eq('id', dealershipId)
			.single()

		if (error) {
			console.error('Error fetching dealership details:', error)
		} else {
			setDealership(data)
		}
	}

	const fetchDealershipCars = async (page = 1, refresh = false) => {
		if (refresh) {
			setIsRefreshing(true)
		} else {
			setIsLoading(true)
		}

		let query = supabase
			.from('cars')
			.select('*', { count: 'exact' })
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

		if (error) {
			console.error('Error fetching dealership cars:', error)
		} else {
			setCars(prevCars => (page === 1 ? data : [...prevCars, ...data]))
			setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE))
			setCurrentPage(page)
		}

		setIsLoading(false)
		setIsRefreshing(false)
	}

	const fetchMakes = async () => {
		const { data, error } = await supabase
			.from('cars')
			.select('make')
			.eq('dealership_id', dealershipId)
			.order('make')

		if (error) {
			console.error('Error fetching makes:', error)
		} else {
			const uniqueMakes = [...new Set(data?.map(item => item.make))]
			setMakes(uniqueMakes)
		}
	}

	const fetchModels = async (make: string) => {
		const { data, error } = await supabase
			.from('cars')
			.select('model')
			.eq('dealership_id', dealershipId)
			.eq('make', make)
			.order('model')

		if (error) {
			console.error('Error fetching models:', error)
		} else {
			const uniqueModels = [...new Set(data?.map(item => item.model))]
			setModels(uniqueModels)
		}
	}

	const handleCarPress = useCallback((car: Car) => {
		setSelectedCar(car)
		setIsModalVisible(true)
	}, [])

	const handleFavoritePress = async (carId: number) => {
		const newLikesCount = await toggleFavorite(carId)
		setCars(prevCars =>
			prevCars.map(car =>
				car.id === carId ? { ...car, likes: newLikesCount } : car
			)
		)
	}

	const handleViewUpdate = (carId: number, newViewCount: number) => {
		setCars(prevCars =>
			prevCars.map(car =>
				car.id === carId ? { ...car, views: newViewCount } : car
			)
		)
	}

	const handleRefresh = () => {
		setCurrentPage(1)
		fetchDealershipCars(1, true)
	}

	const handleLoadMore = () => {
		if (currentPage < totalPages && !isLoading) {
			fetchDealershipCars(currentPage + 1)
		}
	}

	const handleSearch = () => {
		setCurrentPage(1)
		fetchDealershipCars(1)
	}

	const handleMakeFilter = (value: string) => {
		setFilterMake(value)
		setFilterModel('')
		fetchModels(value)
		setCurrentPage(1)
		fetchDealershipCars(1)
	}

	const handleModelFilter = (value: string) => {
		setFilterModel(value)
		setCurrentPage(1)
		fetchDealershipCars(1)
	}

	const handleConditionFilter = (value: string) => {
		setFilterCondition(value)
		setCurrentPage(1)
		fetchDealershipCars(1)
	}

	const handleSort = (value: string) => {
		const [newSortBy, newSortOrder] = value.split('_')
		setSortBy(newSortBy)
		setSortOrder(newSortOrder as 'asc' | 'desc')
		setCurrentPage(1)
		fetchDealershipCars(1)
	}

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

	const headerOpacity = scrollY.interpolate({
		inputRange: [0, 100],
		outputRange: [0, 1],
		extrapolate: 'clamp'
	})

	if (isLoading && cars.length === 0) {
		return (
			<View
				className={`flex-1 justify-center items-center ${
					isDarkMode ? 'bg-night' : 'bg-white'
				}`}>
				<ActivityIndicator size='large' color='#D55004' />
			</View>
		)
	}

	return (
		<LinearGradient colors={bgGradient} className='flex-1'>
			<CustomHeader
				title={dealership?.name || 'Dealership'}
				onBack={() => router.back()}
			/>
			<Animated.FlatList
				data={cars}
				renderItem={renderCarItem}
				keyExtractor={item => item.id.toString()}
				showsVerticalScrollIndicator={false}
				onEndReached={handleLoadMore}
				onEndReachedThreshold={0.1}
				refreshControl={
					<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
				}
				ListHeaderComponent={
					<>
						{dealership && (
							<View
								className={`${cardBgColor} rounded-lg shadow-md p-4 mb-4 pt-10`}>
								<Image
									source={{ uri: dealership.logo }}
									className='w-24 h-24 rounded-full self-center mb-4'
								/>
								<Text
									className={`text-2xl font-bold ${textColor} text-center mb-2`}>
									{dealership.name}
								</Text>
								<View className='flex-row items-center justify-center mb-2'>
									<Ionicons name='call-outline' size={20} color={iconColor} />
									<Text className={`${textColor} ml-2`}>
										{dealership.phone}
									</Text>
								</View>
								<View className='flex-row items-center justify-center mb-4'>
									<Ionicons
										name='location-outline'
										size={20}
										color={iconColor}
									/>
									<Text className={`${textColor} ml-2`}>
										{dealership.location}
									</Text>
								</View>
								<MapView
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
									}}
									{...panResponder.panHandlers}>
									<Marker
										coordinate={{
											latitude: dealership.latitude || 37.7749,
											longitude: dealership.longitude || -122.4194
										}}
										title={dealership.name}
										description={dealership.location}
									/>
								</MapView>
							</View>
						)}
						<View className={`${cardBgColor} rounded-lg shadow-md p-4 mb-4`}>
							<TextInput
								className={`${textColor} border-b border-gray-300 pb-2 mb-4`}
								placeholder='Search cars...'
								placeholderTextColor={isDarkMode ? '#888' : '#555'}
								value={searchQuery}
								onChangeText={setSearchQuery}
								onSubmitEditing={handleSearch}
							/>
							<View className='flex-row justify-between mb-4'>
								<View className='flex-1 mr-2'>
									<RNPickerSelect
										onValueChange={handleMakeFilter}
										items={makes.map(make => ({ label: make, value: make }))}
										placeholder={{ label: 'All Makes', value: null }}
										value={filterMake}
										style={pickerSelectStyles(isDarkMode)}
									/>
								</View>
								<View className='flex-1 ml-2'>
									<RNPickerSelect
										onValueChange={handleModelFilter}
										items={models.map(model => ({
											label: model,
											value: model
										}))}
										placeholder={{ label: 'All Models', value: null }}
										value={filterModel}
										style={pickerSelectStyles(isDarkMode)}
									/>
								</View>
							</View>
							<View className='flex-row justify-between'>
								<View className='flex-1 mr-2'>
									<RNPickerSelect
										onValueChange={handleConditionFilter}
										items={[
											{ label: 'New', value: 'New' },
											{ label: 'Used', value: 'Used' }
										]}
										placeholder={{ label: 'All Conditions', value: null }}
										value={filterCondition}
										style={pickerSelectStyles(isDarkMode)}
									/>
								</View>
								<View className='flex-1 ml-2'>
									<RNPickerSelect
										onValueChange={handleSort}
										items={[
											{ label: 'Newest', value: 'listed_at_desc' },
											{ label: 'Oldest', value: 'listed_at_asc' },
											{ label: 'Price: Low to High', value: 'price_asc' },
											{ label: 'Price: High to Low', value: 'price_desc' },
											{ label: 'Mileage: Low to High', value: 'mileage_asc' },
											{ label: 'Mileage: High to Low', value: 'mileage_desc' }
										]}
										placeholder={{ label: 'Sort By', value: null }}
										value={`${sortBy}_${sortOrder}`}
										style={pickerSelectStyles(isDarkMode)}
									/>
								</View>
							</View>
						</View>
						<Text className={`text-xl font-bold ${textColor} mb-4`}>
							Available Cars ({cars.length})
						</Text>
					</>
				}
				ListFooterComponent={() =>
					isLoading ? (
						<View className='py-4'>
							<ActivityIndicator size='large' color='#D55004' />
						</View>
					) : null
				}
				contentContainerStyle={{
					paddingHorizontal: 16
				}}
				onScroll={Animated.event(
					[{ nativeEvent: { contentOffset: { y: scrollY } } }],
					{ useNativeDriver: false }
				)}
				scrollEventThrottle={16}
			/>
			<CarDetailModal
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
		</LinearGradient>
	)
}

const pickerSelectStyles = (isDarkMode: boolean) => ({
	inputIOS: {
		fontSize: 16,
		paddingVertical: 12,
		paddingHorizontal: 10,
		borderWidth: 1,
		borderColor: isDarkMode ? '#555' : '#d1d1d1',
		borderRadius: 4,
		color: isDarkMode ? 'white' : 'black',
		paddingRight: 30,
		backgroundColor: isDarkMode ? '#333' : 'white'
	},
	inputAndroid: {
		fontSize: 16,
		paddingHorizontal: 10,
		paddingVertical: 8,
		borderWidth: 1,
		borderColor: isDarkMode ? '#555' : '#d1d1d1',
		borderRadius: 8,
		color: isDarkMode ? 'white' : 'black',
		paddingRight: 30,
		backgroundColor: isDarkMode ? '#333' : 'white'
	},
	placeholderColor: isDarkMode ? '#888' : '#999'
})
