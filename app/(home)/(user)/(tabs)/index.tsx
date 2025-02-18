import React, {
	useState,
	useEffect,
	useCallback,
	useMemo,
	useRef
} from 'react'
import {
	View,
	FlatList,
	TextInput,
	TouchableOpacity,
	StyleSheet,
	Text,
	Keyboard,
	StatusBar,
	ActivityIndicator,
	Animated
} from 'react-native'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import { useFavorites } from '@/utils/useFavorites'
import { FontAwesome } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import ByBrands from '@/components/ByBrands'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import CategorySelector from '@/components/Category'
import { RefreshControl } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import SortPicker from '@/components/SortPicker'
import { useScrollToTop } from '@react-navigation/native'
import SkeletonByBrands from '@/components/SkeletonByBrands'
import SkeletonCategorySelector from '@/components/SkeletonCategorySelector'
import SkeletonCarCard from '@/components/SkeletonCarCard'

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
	views?: number
	listed_at?: string
}

interface Filters {
	dealership?: string | string[]
	make?: string | string[]
	model?: string | string[]
	condition?: string | string[]
	yearRange?: [number, number]
	color?: string | string[]
	transmission?: string | string[]
	drivetrain?: string | string[]
	priceRange?: [number, number]
	mileageRange?: [number, number]
	categories?: string[]
	specialFilter?: 'newArrivals' | 'mostPopular' | 'bestDeals'
	sortBy?: string
}

export default function BrowseCarsPage() {
	const { isDarkMode } = useTheme()
	const { favorites, toggleFavorite, isFavorite } = useFavorites()
	const [cars, setCars] = useState<Car[]>([])
	const [currentPage, setCurrentPage] = useState(1)
	const [totalPages, setTotalPages] = useState(1)
	// Instead of one “isLoading” we use two loading states:
	const [isInitialLoading, setIsInitialLoading] = useState(true)
	const [loadingMore, setLoadingMore] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [sortOption, setSortOption] = useState<string | null>(null)
	const [filters, setFilters] = useState<Filters>({})
	const [refreshing, setRefreshing] = useState(false)
	const [showScrollTopButton, setShowScrollTopButton] = useState(false)
	const scrollY = useRef(new Animated.Value(0)).current
	const flatListRef = useRef<any>(null)
	useScrollToTop(flatListRef)
	const fadeAnim = useRef(new Animated.Value(0)).current

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

	useEffect(() => {
		Animated.timing(fadeAnim, {
			toValue: 1,
			duration: 500,
			useNativeDriver: true
		}).start()
	}, [cars])

	const CustomHeader = React.memo(
		({ title, onBack }: { title: string; onBack?: () => void }) => {
			const { isDarkMode } = useTheme()

			return (
				<SafeAreaView className={`bg-${isDarkMode ? 'black' : 'white'}`}>
					<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
					<View className='flex-row items-center ml-2 -mb-6'>
						<Text
							className={`text-2xl ${isDarkMode ? 'text-white' : 'text-black'}  font-bold ml-2`}>
							{title}
						</Text>
					</View>
				</SafeAreaView>
			)
		}
	)

	const fetchCars = useCallback(
		async (
			page = 1,
			currentFilters: Filters = filters,
			currentSortOption = sortOption,
			query = searchQuery
		) => {
			// Use initial-loading only for page 1; for later pages, use loadingMore.
			if (page === 1) {
				setIsInitialLoading(true)
			} else {
				setLoadingMore(true)
			}
			try {
				let queryBuilder = supabase
					.from("cars")
					.select(
						`*, dealerships (name,logo,phone,location,latitude,longitude)`,
						{ count: "exact" }
					)
					.eq("status", "available")

				// Special Filters
				if (currentFilters.specialFilter) {
					switch (currentFilters.specialFilter) {
						case "newArrivals":
							const sevenDaysAgo = new Date()
							sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
							queryBuilder = queryBuilder.gte(
								"listed_at",
								sevenDaysAgo.toISOString()
							)
							break
						case "mostPopular":
							currentSortOption = "views_desc"
							break
					}
				}

				// Categories
				if (currentFilters.categories && currentFilters.categories.length > 0) {
					queryBuilder = queryBuilder.in("category", currentFilters.categories)
				}

				// Multi‑select filters
				if (
					Array.isArray(currentFilters.dealership) &&
					currentFilters.dealership.length > 0
				) {
					queryBuilder = queryBuilder.in("dealership_id", currentFilters.dealership)
				}
				if (Array.isArray(currentFilters.make) && currentFilters.make.length > 0) {
					queryBuilder = queryBuilder.in("make", currentFilters.make)
				}
				if (
					Array.isArray(currentFilters.model) &&
					currentFilters.model.length > 0
				) {
					queryBuilder = queryBuilder.in("model", currentFilters.model)
				}
				if (
					Array.isArray(currentFilters.condition) &&
					currentFilters.condition.length > 0
				) {
					queryBuilder = queryBuilder.in("condition", currentFilters.condition)
				} else if (typeof currentFilters.condition === "string" && currentFilters.condition) {
					queryBuilder = queryBuilder.eq("condition", currentFilters.condition)
				}

				// Year Range
				if (currentFilters.yearRange) {
					queryBuilder = queryBuilder
						.gte("year", currentFilters.yearRange[0])
						.lte("year", currentFilters.yearRange[1])
				}

				if (Array.isArray(currentFilters.color) && currentFilters.color.length > 0) {
					queryBuilder = queryBuilder.in("color", currentFilters.color)
				}
				if (
					Array.isArray(currentFilters.transmission) &&
					currentFilters.transmission.length > 0
				) {
					queryBuilder = queryBuilder.in("transmission", currentFilters.transmission)
				}
				if (
					Array.isArray(currentFilters.drivetrain) &&
					currentFilters.drivetrain.length > 0
				) {
					queryBuilder = queryBuilder.in("drivetrain", currentFilters.drivetrain)
				}

				// Price Range
				if (currentFilters.priceRange) {
					queryBuilder = queryBuilder
						.gte("price", currentFilters.priceRange[0])
						.lte("price", currentFilters.priceRange[1])
				}
				// Mileage Range
				if (currentFilters.mileageRange) {
					queryBuilder = queryBuilder
						.gte("mileage", currentFilters.mileageRange[0])
						.lte("mileage", currentFilters.mileageRange[1])
				}

				// Search query
				if (query) {
					const cleanQuery = query.trim().toLowerCase()
					const searchTerms = cleanQuery.split(/\s+/)
					searchTerms.forEach((term) => {
						const numericTerm = parseInt(term)
						let searchConditions = [
							`make.ilike.%${term}%`,
							`model.ilike.%${term}%`,
							`description.ilike.%${term}%`,
							`color.ilike.%${term}%`,
							`category.ilike.%${term}%`,
							`transmission.ilike.%${term}%`,
							`drivetrain.ilike.%${term}%`,
							`type.ilike.%${term}%`,
							`condition.ilike.%${term}%`,
						]
						if (!isNaN(numericTerm)) {
							searchConditions = searchConditions.concat([
								`year::text.eq.${numericTerm}`,
								`price::text.ilike.%${numericTerm}%`,
								`mileage::text.ilike.%${numericTerm}%`,
							])
						}
						queryBuilder = queryBuilder.or(searchConditions.join(","))
					})
				}

				// Sorting
				switch (currentSortOption) {
					case "price_asc":
						queryBuilder = queryBuilder.order("price", { ascending: true })
						break
					case "price_desc":
						queryBuilder = queryBuilder.order("price", { ascending: false })
						break
					case "year_asc":
						queryBuilder = queryBuilder.order("year", { ascending: true })
						break
					case "year_desc":
						queryBuilder = queryBuilder.order("year", { ascending: false })
						break
					case "mileage_asc":
						queryBuilder = queryBuilder.order("mileage", { ascending: true })
						break
					case "mileage_desc":
						queryBuilder = queryBuilder.order("mileage", { ascending: false })
						break
					case "views_desc":
						queryBuilder = queryBuilder.order("views", { ascending: false })
						break
					default:
						queryBuilder = queryBuilder.order("listed_at", { ascending: false })
				}

				// Pagination calculations
				const { count } = await queryBuilder
				if (!count) {
					setCars([])
					setTotalPages(0)
					setCurrentPage(1)
					return
				}
				const totalItems = count
				const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)
				const safePageNumber = Math.min(page, totalPages)
				const startRange = (safePageNumber - 1) * ITEMS_PER_PAGE
				const endRange = Math.min(
					safePageNumber * ITEMS_PER_PAGE - 1,
					totalItems - 1
				)

				// Fetch data for current page
				let { data, error }: any = await queryBuilder.range(startRange, endRange)
				if (error) throw error

				// If no filters are applied, randomize the order
				if (
					Object.keys(currentFilters).length === 0 &&
					!currentSortOption &&
					!query
				) {
					for (let i = data.length - 1; i > 0; i--) {
						const j = Math.floor(Math.random() * (i + 1))
						[data[i], data[j]] = [data[j], data[i]]
					}
				}

				// Merge dealership info into the car data
				const newCars =
					data?.map((item: { dealerships: { name: any; logo: any; phone: any; location: any; latitude: any; longitude: any } }) => ({
						...item,
						dealership_name: item.dealerships.name,
						dealership_logo: item.dealerships.logo,
						dealership_phone: item.dealerships.phone,
						dealership_location: item.dealerships.location,
						dealership_latitude: item.dealerships.latitude,
						dealership_longitude: item.dealerships.longitude,
					})) || []

				// Deduplicate car entries by id
				const uniqueCars = Array.from(new Set(newCars.map((car: { id: any }) => car.id))).map(
					(id) => newCars.find((car: { id: unknown }) => car.id === id)
				)

				setCars(prevCars =>
					safePageNumber === 1 ? uniqueCars : [...prevCars, ...uniqueCars]
				)
				setTotalPages(totalPages)
				setCurrentPage(safePageNumber)
			} catch (error) {
				console.error("Error fetching cars:", error)
				setCars([])
				setTotalPages(0)
				setCurrentPage(1)
			} finally {
				if (page === 1) {
					setIsInitialLoading(false)
				} else {
					setLoadingMore(false)
				}
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

	const renderCarItem = useCallback(
		({ item, index }: { item: Car; index: number }) => (
			<CarCard
				car={item}
				index={index}
				onFavoritePress={() => handleFavoritePress(item.id)}
				isFavorite={isFavorite(Number(item.id))}
				isDealer={false}
			/>
		),
		[handleFavoritePress, isFavorite]
	)

	const openFilterPage = useCallback(() => {
		router.push({
			pathname: '/(home)/(user)/filter',
			params: { filters: JSON.stringify(filters) }
		})
	}, [router, filters])

	const handleViewUpdate = useCallback((carId: string, newViewCount: number) => {
		setCars(prevCars =>
			prevCars.map(car =>
				car.id === carId ? { ...car, views: newViewCount } : car
			)
		)
	}, [])

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

	// Render header: show skeletons only if we have no cars (i.e. on the very first load)
	const renderListHeader = useMemo(
		() => (
			<>
				{(isInitialLoading && cars.length === 0) ? (
					<SkeletonByBrands />
				) : (
					<Animated.View style={{ opacity: fadeAnim }}>
						<ByBrands />
					</Animated.View>
				)}
				<View style={{ marginBottom: 12, marginTop: 12 }}>
					{(isInitialLoading && cars.length === 0) ? (
						<SkeletonCategorySelector />
					) : (
						<Animated.View style={{ opacity: fadeAnim }}>
							<CategorySelector
								selectedCategories={filters.categories || []}
								onCategoryPress={handleCategoryPress}
							/>
						</Animated.View>
					)}
				</View>
			</>
		),
		[cars, isInitialLoading, fadeAnim, filters.categories, handleCategoryPress]
	)

	const renderListEmpty = useCallback(
		() =>
			(!isInitialLoading && cars.length === 0) && (
				<View style={styles.emptyContainer}>
					<Text style={[styles.emptyText, isDarkMode && styles.darkEmptyText]}>
						{filters.categories && filters.categories.length > 0
							? `No cars available for the selected ${
									filters.categories.length === 1 ? 'category' : 'categories'
							  }:\n${filters.categories.join(', ')}`
							: 'No cars available.'}
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
		[filters, searchQuery, isDarkMode, isInitialLoading, handleResetFilters, cars]
	)

	// When data exists, always pass the loaded cars (even if loadingMore is true)
	const listData = (isInitialLoading && cars.length === 0) ? Array(3).fill(null) : cars

	return (
		<LinearGradient
			colors={isDarkMode ? ['#000000', '#1A1A1A'] : ['#FFFFFF', '#F5F5F5']}
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
						<View style={[styles.searchBar, isDarkMode && styles.darkSearchBar, { flex: 1 }]}>
							<FontAwesome
								name='search'
								size={20}
								color={isDarkMode ? '#FFFFFF' : '#000000'}
								style={{ marginLeft: 12 }}
							/>
							<TextInput
								style={[styles.searchInput, isDarkMode && styles.darkSearchInput]}
								className='p-3'
								placeholder='Search cars...'
								placeholderTextColor={isDarkMode ? '#FFFFFF' : '#666666'}
								value={searchQuery}
								onChangeText={setSearchQuery}
								onSubmitEditing={handleSearch}
								textAlignVertical="center"
							/>

							<TouchableOpacity
								style={[styles.iconButton, isDarkMode && styles.darkIconButton]}
								onPress={openFilterPage}>
								<FontAwesome
									name='sliders'
									size={20}
									color={isDarkMode ? '#000000' : '#ffffff'}
								/>
							</TouchableOpacity>

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
										color={isDarkMode ? '#FFFFFF' : '#666666'}
									/>
								</TouchableOpacity>
							)}
						</View>
						<View style={styles.sortPickerContainer}>
							<SortPicker
								onValueChange={(value: any) => {
									setSortOption(value)
									fetchCars(1, filters, value, searchQuery)
								}}
								initialValue={sortOption}
							/>
						</View>
					</View>
				</View>
				<FlatList
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={onRefresh}
							colors={['#D55004']}
							tintColor={isDarkMode ? '#FFFFFF' : '#D55004'}
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
					data={listData}
					renderItem={
						(isInitialLoading && cars.length === 0)
							? () => <SkeletonCarCard />
							: renderCarItem
					}
					keyExtractor={
						(isInitialLoading && cars.length === 0)
							? (_item, index) => `skeleton-${index}`
							: keyExtractor
					}
					onEndReached={() => {
						if (currentPage < totalPages && !loadingMore) {
							fetchCars(currentPage + 1, filters, sortOption, searchQuery)
						}
					}}
					onEndReachedThreshold={0.5}
					ListEmptyComponent={renderListEmpty}
					ListFooterComponent={
						loadingMore ? (
							<ActivityIndicator
								style={{ margin: 16 }}
								color={isDarkMode ? '#FFFFFF' : '#000000'}
							/>
						) : null
					}
				/>
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
		backgroundColor: '#000000'
	},
	darkIconButton: {
		backgroundColor: '#ffffff'
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
	},
	favoriteButton: {
		padding: 12,
		borderRadius: 20,
		aspectRatio: 1,
		justifyContent: 'center',
		alignItems: 'center'
	},
	sortPickerContainer: {
		paddingHorizontal: 10
	}
})
