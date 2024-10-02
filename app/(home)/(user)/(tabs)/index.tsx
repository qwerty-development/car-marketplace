import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
	View,
	FlatList,
	TextInput,
	TouchableOpacity,
	ActivityIndicator,
	StyleSheet,
	Text,
	Platform,
	Keyboard
} from 'react-native'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import CarDetailModal from '../CarDetailModal'
import CarDetailModalIOS from '../CarDetailModalIOS'
import { useFavorites } from '@/utils/useFavorites'
import { FontAwesome } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import SortPicker from '@/components/SortPicker'
import ByBrands from '@/components/ByBrands'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import CategorySelector from '@/components/Category'
import { RefreshControl } from 'react-native'
import { Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const ITEMS_PER_PAGE = 7

interface Car {
	id: string
	make: string
	model: string
	year: number
	price: number
	mileage: number
	category: string
	dealership_name: string
	dealership_logo: string
	dealership_phone: string
	dealership_location: string
	dealership_latitude: number
	dealership_longitude: number
}

interface Filters {
	dealership?: string
	make?: string
	model?: string
	condition?: string
	yearRange?: [number, number]
	color?: string
	transmission?: string
	drivetrain?: string
	priceRange?: [number, number]
	mileageRange?: [number, number]
	categories?: string[]
}

export default function BrowseCarsPage() {
	const { isDarkMode } = useTheme()
	const { favorites, toggleFavorite, isFavorite } = useFavorites()
	const [cars, setCars] = useState<Car[]>([])
	const [currentPage, setCurrentPage] = useState(1)
	const [totalPages, setTotalPages] = useState(1)
	const [isLoading, setIsLoading] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [sortOption, setSortOption] = useState('')
	const [filters, setFilters] = useState<Filters>({})
	const [selectedCar, setSelectedCar] = useState<Car | null>(null)
	const [isModalVisible, setIsModalVisible] = useState(false)
	const [refreshing, setRefreshing] = useState(false)
	const [showScrollTopButton, setShowScrollTopButton] = useState(false)
	const scrollY = useRef<any>(new Animated.Value(0)).current
	const flatListRef = useRef<any>(null)
	const scrollToTop = () => {
		flatListRef.current?.scrollToOffset({ offset: 0, animated: true })
	}

	const router = useRouter()
	const params = useLocalSearchParams<{ filters: string }>()
	const [isKeyboardVisible, setKeyboardVisible] = useState(false)

	useEffect(() => {
		const keyboardDidShowListener = Keyboard.addListener(
			'keyboardDidShow',
			() => setKeyboardVisible(true)
		)
		const keyboardDidHideListener = Keyboard.addListener(
			'keyboardDidHide',
			() => setKeyboardVisible(false)
		)

		return () => {
			keyboardDidShowListener.remove()
			keyboardDidHideListener.remove()
		}
	}, [])

	useEffect(() => {
		if (params.filters) {
			try {
				const parsedFilters = JSON.parse(params.filters as string)
				setFilters(parsedFilters)
				fetchCars(1, parsedFilters, sortOption, searchQuery)
			} catch (error) {
				console.error('Error parsing filters:', error)
			}
		} else {
			fetchCars(1, {}, sortOption, searchQuery)
		}
	}, [params.filters])

	const fetchCars = useCallback(
		async (
			page = 1,
			currentFilters: Filters = filters,
			currentSortOption = sortOption,
			query = searchQuery
		) => {
			setIsLoading(true)
			try {
				let queryBuilder = supabase
					.from('cars')
					.select(
						`*, dealerships (name,logo,phone,location,latitude,longitude)`,
						{ count: 'exact' }
					)
					.neq('status', 'sold')

				// Apply filters
				if (currentFilters.dealership)
					queryBuilder = queryBuilder.eq(
						'dealership_id',
						currentFilters.dealership
					)
				if (currentFilters.make)
					queryBuilder = queryBuilder.eq('make', currentFilters.make)
				if (currentFilters.model)
					queryBuilder = queryBuilder.eq('model', currentFilters.model)
				if (currentFilters.condition)
					queryBuilder = queryBuilder.eq('condition', currentFilters.condition)
				if (currentFilters.yearRange)
					queryBuilder = queryBuilder
						.gte('year', currentFilters.yearRange[0])
						.lte('year', currentFilters.yearRange[1])
				if (currentFilters.color)
					queryBuilder = queryBuilder.eq('color', currentFilters.color)
				if (currentFilters.transmission)
					queryBuilder = queryBuilder.eq(
						'transmission',
						currentFilters.transmission
					)
				if (currentFilters.drivetrain)
					queryBuilder = queryBuilder.eq(
						'drivetrain',
						currentFilters.drivetrain
					)
				if (currentFilters.priceRange)
					queryBuilder = queryBuilder
						.gte('price', currentFilters.priceRange[0])
						.lte('price', currentFilters.priceRange[1])
				if (currentFilters.mileageRange)
					queryBuilder = queryBuilder
						.gte('mileage', currentFilters.mileageRange[0])
						.lte('mileage', currentFilters.mileageRange[1])
				if (currentFilters.categories && currentFilters.categories.length > 0)
					queryBuilder = queryBuilder.in('category', currentFilters.categories)

				if (query) {
					queryBuilder = queryBuilder.or(
						`make.ilike.%${query}%,model.ilike.%${query}%,description.ilike.%${query}%,color.ilike.%${query}%`
					)
				}

				// Apply sorting
				switch (currentSortOption) {
					case 'price_asc':
						queryBuilder = queryBuilder.order('price', { ascending: true })
						break
					case 'price_desc':
						queryBuilder = queryBuilder.order('price', { ascending: false })
						break
					case 'year_asc':
						queryBuilder = queryBuilder.order('year', { ascending: true })
						break
					case 'year_desc':
						queryBuilder = queryBuilder.order('year', { ascending: false })
						break
					case 'mileage_asc':
						queryBuilder = queryBuilder.order('mileage', { ascending: true })
						break
					case 'mileage_desc':
						queryBuilder = queryBuilder.order('mileage', { ascending: false })
						break
					default:
						queryBuilder = queryBuilder.order('listed_at', { ascending: false })
				}

				const { count } = await queryBuilder
				const totalItems = count || 0
				const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)
				const safePageNumber = Math.min(page, totalPages)
				const startRange = (safePageNumber - 1) * ITEMS_PER_PAGE
				const endRange = Math.min(
					safePageNumber * ITEMS_PER_PAGE - 1,
					totalItems - 1
				)

				const { data, error } = await queryBuilder.range(startRange, endRange)

				if (error) throw error

				const newCars =
					data?.map(item => ({
						...item,
						dealership_name: item.dealerships.name,
						dealership_logo: item.dealerships.logo,
						dealership_phone: item.dealerships.phone,
						dealership_location: item.dealerships.location,
						dealership_latitude: item.dealerships.latitude,
						dealership_longitude: item.dealerships.longitude
					})) || []

				const uniqueCars = Array.from(new Set(newCars.map(car => car.id))).map(
					id => newCars.find(car => car.id === id)
				)

				setCars(prevCars =>
					safePageNumber === 1 ? uniqueCars : [...prevCars, ...uniqueCars]
				)
				setTotalPages(totalPages)
				setCurrentPage(safePageNumber)
			} catch (error) {
				console.error('Error fetching cars:', error)
			} finally {
				setIsLoading(false)
			}
		},
		[filters, sortOption, searchQuery]
	)

	const onRefresh = useCallback(() => {
		setRefreshing(true)
		fetchCars(1, filters, sortOption, searchQuery).then(() =>
			setRefreshing(false)
		)
	}, [filters, sortOption, searchQuery, fetchCars])

	const handleFavoritePress = useCallback(
		async (carId: string) => {
			const newLikesCount = await toggleFavorite(carId)
			setCars(prevCars =>
				prevCars.map(car =>
					car.id === carId ? { ...car, likes: newLikesCount } : car
				)
			)
		},
		[toggleFavorite]
	)

	const handleSortChange = useCallback(
		(value: string) => {
			setSortOption(value)
			fetchCars(1, filters, value, searchQuery)
		},
		[filters, searchQuery, fetchCars]
	)

	const handleCarPress = useCallback((car: Car) => {
		setSelectedCar(car)
		setIsModalVisible(true)
	}, [])

	const renderCarItem = useCallback(
		({ item }: { item: Car }) => (
			<CarCard
				car={item}
				onPress={() => handleCarPress(item)}
				onFavoritePress={() => handleFavoritePress(item.id)}
				isFavorite={isFavorite(Number(item.id))}
			/>
		),
		[handleCarPress, handleFavoritePress, isFavorite]
	)

	const openFilterPage = useCallback(() => {
		router.push({
			pathname: '/(home)/(user)/filter',
			params: { filters: JSON.stringify(filters) }
		})
	}, [router, filters])

	const handleViewUpdate = useCallback(
		(carId: string, newViewCount: number) => {
			setCars(prevCars =>
				prevCars.map(car =>
					car.id === carId ? { ...car, views: newViewCount } : car
				)
			)
		},
		[]
	)

	const keyExtractor = useCallback(
		(item: Car) => `${item.id}-${item.make}-${item.model}`,
		[]
	)

	const handleSearch = useCallback(() => {
		fetchCars(1, filters, sortOption, searchQuery)
	}, [filters, sortOption, searchQuery, fetchCars])

	const handleCategoryPress = useCallback(
		(category: string) => {
			setFilters(prevFilters => {
				const updatedCategories = prevFilters.categories
					? prevFilters.categories.includes(category)
						? prevFilters.categories.filter(c => c !== category)
						: [...prevFilters.categories, category]
					: [category]

				const newFilters = {
					...prevFilters,
					categories: updatedCategories
				}

				fetchCars(1, newFilters, sortOption, searchQuery)
				return newFilters
			})
		},
		[sortOption, searchQuery, fetchCars]
	)

	const handleResetFilters = useCallback(() => {
		setFilters({})
		setSearchQuery('')
		setSortOption('')
		fetchCars(1, {}, '', '')
	}, [fetchCars])

	const renderListHeader = useMemo(
		() => (
			<>
				<ByBrands />
				<CategorySelector
					selectedCategories={filters.categories || []}
					onCategoryPress={handleCategoryPress}
				/>
			</>
		),
		[filters.categories, handleCategoryPress]
	)

	const renderListEmpty = useCallback(
		() =>
			!isLoading && (
				<View style={styles.emptyContainer}>
					<Text style={[styles.emptyText, isDarkMode && styles.darkEmptyText]}>
						No cars available.
					</Text>
					{(Object.keys(filters).length > 0 || searchQuery) && (
						<TouchableOpacity
							onPress={handleResetFilters}
							style={styles.resetButton}>
							<Text style={styles.resetButtonText}>Remove filters</Text>
						</TouchableOpacity>
					)}
				</View>
			),
		[filters, searchQuery, isDarkMode, isLoading, handleResetFilters]
	)

	const renderModal = useCallback(() => {
		const ModalComponent =
			Platform.OS === 'ios' ? CarDetailModalIOS : CarDetailModal
		return (
			<ModalComponent
				isVisible={isModalVisible}
				car={selectedCar}
				onClose={() => {
					setIsModalVisible(false)
					setSelectedCar(null)
				}}
				setSelectedCar={setSelectedCar}
				setIsModalVisible={setIsModalVisible}
				onFavoritePress={() =>
					selectedCar && handleFavoritePress(selectedCar.id)
				}
				isFavorite={!!selectedCar && isFavorite(Number(selectedCar.id))}
				onViewUpdate={handleViewUpdate}
			/>
		)
	}, [
		isModalVisible,
		selectedCar,
		handleFavoritePress,
		isFavorite,
		handleViewUpdate
	])

	return (
		<LinearGradient
			colors={
				isDarkMode
					? ['#000000', '#0D0D0D', '#0D0D0D', '#0D0D0D', '#D55004']
					: ['#FFFFFF', '#FFFFFF', '#F2F2F2', '#FFA07A', '#D55004']
			}
			style={{ flex: 1 }}
			start={{ x: 0, y: 0 }}
			end={{ x: 1, y: 1 }}>
			<SafeAreaView
				style={[
					styles.container,
					isDarkMode && styles.darkContainer,
					{ backgroundColor: 'transparent' }
				]}>
				<View style={styles.searchContainer}>
					<View style={styles.searchInputContainer}>
						<TouchableOpacity
							style={[styles.iconButton, isDarkMode && styles.darkIconButton]}
							onPress={openFilterPage}>
							<FontAwesome
								name='filter'
								size={20}
								color={isDarkMode ? 'white' : 'black'}
							/>
						</TouchableOpacity>
						<View
							style={[styles.searchBar, isDarkMode && styles.darkSearchBar]}>
							<TouchableOpacity
								style={[styles.iconButton, isDarkMode && styles.darkIconButton]}
								onPress={handleSearch}>
								<FontAwesome
									name='search'
									size={20}
									color={isDarkMode ? 'white' : 'black'}
								/>
							</TouchableOpacity>
							<TextInput
								style={[
									styles.searchInput,
									isDarkMode && styles.darkSearchInput
								]}
								placeholder='Search cars...'
								placeholderTextColor={isDarkMode ? 'white' : 'gray'}
								value={searchQuery}
								onChangeText={setSearchQuery}
								onSubmitEditing={handleSearch}
							/>
							{searchQuery.length > 0 && (
								<TouchableOpacity
									style={styles.clearButton}
									onPress={() => {
										setSearchQuery('')
										fetchCars(1, {}, '', '')
									}}>
									<FontAwesome
										name='times-circle'
										size={20}
										color={isDarkMode ? 'white' : 'black'}
									/>
								</TouchableOpacity>
							)}
						</View>
						<SortPicker
							onValueChange={handleSortChange}
							initialValue={{ label: 'Sort', value: null }}
						/>
					</View>
				</View>

				<FlatList
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={onRefresh}
							colors={['#D55004']}
							tintColor={isDarkMode ? '#FFFFFF' : '#D55004'}
							title='Pull to refresh'
							titleColor={isDarkMode ? '#FFFFFF' : '#000000'}
						/>
					}
					ref={flatListRef}
					onScroll={Animated.event(
						[{ nativeEvent: { contentOffset: { y: scrollY } } }],
						{
							useNativeDriver: false,
							listener: ({ nativeEvent }: any) => {
								setShowScrollTopButton(nativeEvent.contentOffset.y > 200)
							}
						}
					)}
					scrollEventThrottle={16}
					ListHeaderComponent={renderListHeader}
					data={cars}
					renderItem={renderCarItem}
					keyExtractor={keyExtractor}
					onEndReached={() => {
						if (currentPage < totalPages && !isLoading) {
							fetchCars(currentPage + 1, filters, sortOption, searchQuery)
						}
					}}
					onEndReachedThreshold={0.5}
					ListEmptyComponent={renderListEmpty}
					ListFooterComponent={() =>
						isLoading ? (
							<ActivityIndicator
								size='large'
								color='#FFFFFF'
								style={{ marginVertical: 20 }}
							/>
						) : null
					}
				/>
				{showScrollTopButton && !isKeyboardVisible && (
					<TouchableOpacity
						style={[
							styles.scrollTopButton,
							{ backgroundColor: isDarkMode ? '#333333' : '#FFFFFF' }
						]}
						onPress={() =>
							flatListRef.current?.scrollToOffset({ offset: 0, animated: true })
						}>
						<Ionicons
							name='chevron-up'
							size={24}
							color={isDarkMode ? '#FFFFFF' : '#000000'}
						/>
					</TouchableOpacity>
				)}

				{renderModal()}
			</SafeAreaView>
		</LinearGradient>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1
	},
	darkContainer: {
		backgroundColor: '#000000'
	},
	searchContainer: {
		padding: 10
	},
	scrollTopButton: {
		position: 'absolute',
		right: 20,
		bottom: 70,
		width: 50,
		height: 50,
		borderRadius: 25,
		justifyContent: 'center',
		alignItems: 'center',
		elevation: 5,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84
	},
	searchInputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between'
	},
	iconButton: {
		padding: 10,
		borderRadius: 20,
		backgroundColor: '#f0f0f0'
	},
	darkIconButton: {
		backgroundColor: '#333'
	},
	searchBar: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderColor: '#ccc',
		borderRadius: 20,
		marginHorizontal: 10
	},
	darkSearchBar: {
		borderColor: '#555'
	},
	searchInput: {
		flex: 1,
		paddingVertical: 8,
		paddingHorizontal: 12,
		color: 'black'
	},
	darkSearchInput: {
		color: 'white'
	},
	clearButton: {
		padding: 10
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20
	},
	emptyText: {
		fontSize: 16,
		textAlign: 'center',
		color: '#000'
	},
	darkEmptyText: {
		color: '#fff'
	},
	resetButton: {
		marginTop: 10,
		padding: 10,
		backgroundColor: '#D55004',
		borderRadius: 5
	},
	resetButtonText: {
		color: 'white',
		fontWeight: 'bold'
	}
})
