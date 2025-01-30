import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
	View,
	FlatList,
	Text,
	ActivityIndicator,
	RefreshControl,
	ListRenderItem,
	StatusBar,
	Platform,
	TouchableOpacity,
	TextInput,
	StyleSheet
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/app/(home)/(user)/CarDetailModal'
import CarDetailModalIOS from '../CarDetailModalIOS'
import { useFavorites } from '@/utils/useFavorites'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FontAwesome } from '@expo/vector-icons'
import SortPicker from '@/components/SortPicker'

// Original CustomHeader (Reverted)
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

interface Car {
	id: number
	make: string
	model: string
	year: number
	price: number
	mileage: number
	likes: number
	views: number
	listed_at: string
	dealerships: {
		name: string
		logo: string
		phone: string
		location: string
		latitude: number
		longitude: number
	}
}

export default function Favorite() {
	const { isDarkMode } = useTheme()
	const { favorites, toggleFavorite, isFavorite } = useFavorites()
	const [favoriteCars, setFavoriteCars] = useState<Car[]>([])
	const [filteredCars, setFilteredCars] = useState<Car[]>([])
	const [sortedCars, setSortedCars] = useState<Car[]>([])
	const [selectedCar, setSelectedCar] = useState<Car | null>(null)
	const [isModalVisible, setIsModalVisible] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [searchQuery, setSearchQuery] = useState('')
	const [sortOption, setSortOption] = useState('')
	const sortOptions = [
		{ label: 'Latest Listed', value: 'date_listed_desc', icon: 'time' },
		{ label: 'Price: Low to High', value: 'price_asc', icon: 'trending-up' },
		{ label: 'Price: High to Low', value: 'price_desc', icon: 'trending-down' },
		{ label: 'Year: New to Old', value: 'year_desc', icon: 'calendar' },
		{ label: 'Year: Old to New', value: 'year_asc', icon: 'calendar-outline' },
		{
			label: 'Mileage: Low to High',
			value: 'mileage_asc',
			icon: 'speedometer'
		},
		{
			label: 'Mileage: High to Low',
			value: 'mileage_desc',
			icon: 'speedometer-outline'
		}
	]

	const fetchFavoriteCars = useCallback(async () => {
		setError(null)
		if (favorites.length === 0) {
			setFavoriteCars([])
			setFilteredCars([])
			setSortedCars([])
			setIsLoading(false)
			return
		}

		try {
			const { data, error } = await supabase
				.from('cars')
				.select(
					`*, dealerships (name, logo, phone, location, latitude, longitude)`
				)
				.eq('status', 'available')
				.in('id', favorites)

			if (error) throw error

			const carsData =
				data?.map(item => ({
					...item,
					dealership_name: item.dealerships.name,
					dealership_logo: item.dealerships.logo,
					dealership_phone: item.dealerships.phone,
					dealership_location: item.dealerships.location,
					dealership_latitude: item.dealerships.latitude,
					dealership_longitude: item.dealerships.longitude
				})) || []

			setFavoriteCars(carsData)
			setFilteredCars(carsData)
		} catch (error) {
			console.error('Error fetching favorite cars:', error)
			setError('Failed to fetch favorite cars. Please try again.')
		} finally {
			setIsLoading(false)
		}
	}, [favorites])

	useEffect(() => {
		fetchFavoriteCars()
	}, [fetchFavoriteCars])

	useEffect(() => {
		let filtered = favoriteCars

		// Apply search filtering
		if (searchQuery) {
			const cleanQuery = searchQuery.trim().toLowerCase()
			filtered = filtered.filter(
				car =>
					car.make.toLowerCase().includes(cleanQuery) ||
					car.model.toLowerCase().includes(cleanQuery) ||
					car.dealerships.name.toLowerCase().includes(cleanQuery)
			)
		}
		setFilteredCars(filtered)
	}, [searchQuery, favoriteCars])

	useEffect(() => {
		// Apply sorting based on sortOption
		let sorted = [...filteredCars]

		if (sortOption) {
			switch (sortOption) {
				case 'price_asc':
					sorted.sort((a, b) => a.price - b.price)
					break
				case 'price_desc':
					sorted.sort((a, b) => b.price - a.price)
					break
				case 'year_asc':
					sorted.sort((a, b) => a.year - b.year)
					break
				case 'year_desc':
					sorted.sort((a, b) => b.year - a.year)
					break
				case 'mileage_asc':
					sorted.sort((a, b) => a.mileage - b.mileage)
					break
				case 'mileage_desc':
					sorted.sort((a, b) => b.mileage - a.mileage)
					break
				case 'date_listed_desc':
					sorted.sort(
						(a, b) =>
							new Date(b.listed_at).getTime() - new Date(a.listed_at).getTime()
					)
					break
				default:
					break
			}
		}

		setSortedCars(sorted)
	}, [sortOption, filteredCars])

	const onRefresh = useCallback(async () => {
		setRefreshing(true)
		await fetchFavoriteCars()
		setRefreshing(false)
	}, [fetchFavoriteCars])

	const handleFavoritePress = useCallback(
		async (carId: number) => {
			const newLikesCount = await toggleFavorite(carId)

			// Update favoriteCars
			setFavoriteCars(prevCars =>
				prevCars
					.map(car =>
						car.id === carId ? { ...car, likes: newLikesCount } : car
					)
					.filter(car => isFavorite(car.id))
			)

			// Also update filteredCars to remove the unfavorited car
			setFilteredCars(prevCars =>
				prevCars
					.map(car =>
						car.id === carId ? { ...car, likes: newLikesCount } : car
					)
					.filter(car => isFavorite(car.id))
			)
		},
		[toggleFavorite, isFavorite]
	)

	const handleCarPress = useCallback((car: Car) => {
		setSelectedCar(car)
		setIsModalVisible(true)
	}, [])

	const handleViewUpdate = useCallback(
		(carId: number, newViewCount: number) => {
			setFavoriteCars(prevCars =>
				prevCars.map(car =>
					car.id === carId ? { ...car, views: newViewCount } : car
				)
			)
			setFilteredCars(prevCars =>
				prevCars.map(car =>
					car.id === carId ? { ...car, views: newViewCount } : car
				)
			)
		},
		[]
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
				isFavorite={true}
				onViewUpdate={handleViewUpdate}
				setSelectedCar={setSelectedCar}
				setIsModalVisible={setIsModalVisible}
			/>
		)
	}, [isModalVisible, selectedCar, handleFavoritePress, handleViewUpdate])

	const renderCarItem: ListRenderItem<Car> = useCallback(
		({ item }) => (
			<CarCard
				car={item}
				onPress={() => handleCarPress(item)}
				onFavoritePress={() => handleFavoritePress(item.id)}
				isFavorite={true}
			/>
		),
		[handleCarPress, handleFavoritePress]
	)

	const keyExtractor = useCallback(
		(item: Car) => `${item.id}-${item.make}-${item.model}`,
		[]
	)

	const EmptyFavorites = useMemo(
		() => (
			<View style={styles.emptyContainer}>
				<Text style={styles.emptyText}>
					{searchQuery
						? 'No cars match your search.'
						: 'No cars added as favorite'}
				</Text>
				{!searchQuery && (
					<Text style={styles.emptySubText}>
						Your favorite cars will appear here
					</Text>
				)}
			</View>
		),
		[isDarkMode, searchQuery]
	)

	const ErrorMessage = useMemo(
		() => (
			<View style={styles.errorContainer}>
				<Text style={styles.errorText}>{error}</Text>
				<Text style={styles.errorSubText}>
					Pull down to refresh and try again
				</Text>
			</View>
		),
		[error, isDarkMode]
	)

	const renderContent = () => {
		if (isLoading) {
			return (
				<View style={styles.loadingContainer}>
					<ActivityIndicator
						size='large'
						color={isDarkMode ? '#ffffff' : '#000000'}
					/>
				</View>
			)
		}

		if (error) {
			return ErrorMessage
		}

		return (
			<FlatList
				data={sortedCars}
				renderItem={renderCarItem}
				keyExtractor={keyExtractor}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 50 }}
				ListEmptyComponent={EmptyFavorites}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						tintColor={isDarkMode ? '#ffffff' : '#000000'}
						colors={['#D55004']}
					/>
				}
			/>
		)
	}

	return (
		<View
			style={{ flex: 1, backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }}>
			<CustomHeader title='Favorites' />
			<View style={styles.headerContainer}>
				<View style={styles.searchContainer}>
					<View style={styles.searchBar}>
						<FontAwesome
							name='search'
							size={20}
							color={isDarkMode ? '#FFFFFF' : '#666666'}
							style={{ marginLeft: 12 }}
						/>
						<TextInput
							style={[
								styles.searchInput,
								{ color: isDarkMode ? '#FFFFFF' : '#000000' }
							]}
							placeholder='Search favorites...'
							placeholderTextColor={isDarkMode ? '#FFFFFF' : '#666666'}
							value={searchQuery}
							onChangeText={setSearchQuery}
						/>
						{searchQuery.length > 0 && (
							<TouchableOpacity
								style={styles.clearButton}
								onPress={() => setSearchQuery('')}>
								<FontAwesome
									name='times-circle'
									size={20}
									color={isDarkMode ? '#FFFFFF' : '#666666'}
								/>
							</TouchableOpacity>
						)}
					</View>
					<View style={styles.sortPickerContainer}>
						<SortPicker
							onValueChange={(value: string) => {
								setSortOption(value)
							}}
							initialValue={sortOption}
						/>
					</View>
				</View>
			</View>

			{renderContent()}
			{renderModal}
		</View>
	)
}

const styles = StyleSheet.create({
	headerContainer: {
		paddingHorizontal: 16
	},
	headerTitle: {
		fontSize: 24,
		fontWeight: 'bold',
		color: '#000000',
		marginBottom: 16
	},
	searchContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 5,
		justifyContent: 'space-between'
	},
	searchBar: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderColor: '#CCCCCC',
		borderRadius: 20
	},
	searchInput: {
		flex: 1,
		paddingVertical: 8,
		paddingRight: 8,
		fontSize: 16
	},
	clearButton: {
		padding: 8
	},
	sortPickerContainer: {
		flex: 0.45,
		justifyContent: 'center'
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20
	},
	emptyText: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#000000',
		marginBottom: 8
	},
	emptySubText: {
		fontSize: 16,
		color: '#666666'
	},
	errorContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20
	},
	errorText: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#000000',
		marginBottom: 8
	},
	errorSubText: {
		fontSize: 16,
		color: '#FF0000'
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center'
	}
})
