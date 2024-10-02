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
	StatusBar,
	Platform
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
			className={`${isDarkMode ? 'bg-black' : 'bg-white'}`}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View className='flex-row items-center pb-4 px-4'>
				<TouchableOpacity onPress={onBack}>
					<Ionicons name='arrow-back' size={24} color={iconColor} />
				</TouchableOpacity>
				<Text
					className={`ml-4 text-lg font-bold ${
						isDarkMode ? 'text-white' : 'text-black'
					}`}>
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

	useEffect(() => {
		fetchDealershipDetails()
		fetchMakes()
	}, [dealershipId])

	useEffect(() => {
		fetchDealershipCars(1, true)
	}, [
		dealershipId,
		filterMake,
		filterModel,
		filterCondition,
		sortBy,
		sortOrder,
		searchQuery
	])

	const bgGradient = isDarkMode
		? ['#000000', '#1c1c1c']
		: ['#FFFFFF', '#F0F0F0']
	const textColor = isDarkMode ? 'text-white' : 'text-black'
	const iconColor = isDarkMode ? '#D55004' : '#FF8C00'
	const cardBgColor = isDarkMode ? 'bg-gray' : 'bg-white'

	const panResponder = PanResponder.create({
		onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dx < -30,
		onPanResponderRelease: (_, gestureState) => {
			if (gestureState.dx < -50) {
				// Implement close functionality if needed
			}
		}
	})

	const fetchDealershipDetails = useCallback(async () => {
		setIsDealershipLoading(true)
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
		setIsDealershipLoading(false)
	}, [dealershipId])

	const fetchDealershipCars = useCallback(
		async (page = 1, refresh = false) => {
			if (refresh) {
				setIsRefreshing(true)
			} else {
				setIsCarsLoading(true)
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

			setIsCarsLoading(false)
			setIsRefreshing(false)
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

	const handleRefresh = useCallback(() => {
		setIsRefreshing(true)
		Promise.all([
			fetchDealershipDetails(),
			fetchDealershipCars(1, true),
			fetchMakes()
		]).then(() => {
			setIsRefreshing(false)
		})
	}, [dealershipId])

	const handleLoadMore = () => {
		if (currentPage < totalPages && !isCarsLoading) {
			fetchDealershipCars(currentPage + 1)
		}
	}

	const handleSearch = () => {
		setCurrentPage(1)
		fetchDealershipCars(1, true)
	}

	const handleMakeFilter = (value: string) => {
		setFilterMake(value)
		setFilterModel('')
		fetchModels(value)
	}

	const handleModelFilter = (value: string) => {
		setFilterModel(value)
	}

	const handleConditionFilter = (value: string) => {
		setFilterCondition(value)
	}

	const handleSort = (value: string) => {
		if (value === null) {
			setSortBy('listed_at')
			setSortOrder('desc')
			return
		}
		const [newSortBy, newSortOrder] = value.split('_')
		setSortBy(newSortBy)
		setSortOrder(newSortOrder as 'asc' | 'desc')
	}

	const renderModal = () => {
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

	if (isDealershipLoading || (isCarsLoading && cars.length === 0)) {
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
				keyExtractor={item =>
					`${item.id}-${item.make}-${item.model}-${Math.random()}`
				}
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
				ListHeaderComponent={
					<>
						{dealership && (
							<View className={`${cardBgColor} rounded-lg shadow-md p-4 mb-4`}>
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
								className={`${textColor} border-b border-red pb-2 mb-4`}
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
					isCarsLoading ? (
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
			{renderModal()}
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
