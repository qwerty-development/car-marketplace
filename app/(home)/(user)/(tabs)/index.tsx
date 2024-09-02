import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
	View,
	FlatList,
	TextInput,
	TouchableOpacity,
	ActivityIndicator,
	StyleSheet,
	Text
} from 'react-native'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import CarDetailModal from '../CarDetailModal'
import { useFavorites } from '@/utils/useFavorites'
import { FontAwesome } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import SortPicker from '@/components/SortPicker'
import ByBrands from '@/components/ByBrands'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import CategorySelector from '@/components/Category'

const ITEMS_PER_PAGE = 7

interface Car {
	id: string
	make: string
	model: string
	year: number
	price: number
	mileage: number
	category: stringr
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

	const router = useRouter()
	const params = useLocalSearchParams<{ filters: string }>()

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
			let queryBuilder = supabase
				.from('cars')
				.select(
					`
          *,
          dealerships (name,logo,phone,location,latitude,longitude)
        `,
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
				queryBuilder = queryBuilder.eq('drivetrain', currentFilters.drivetrain)
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

			if (error) {
				console.error('Error fetching cars:', error)
			} else {
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
				setCars((prevCars: any) =>
					safePageNumber === 1 ? newCars : [...prevCars, ...newCars]
				)
				setTotalPages(totalPages)
				setCurrentPage(safePageNumber)
			}
			setIsLoading(false)
		},
		[filters, sortOption, searchQuery]
	)

	const handleFavoritePress = async (carId: string) => {
		const newLikesCount = await toggleFavorite(carId)
		setCars(prevCars =>
			prevCars.map(car =>
				car.id === carId ? { ...car, likes: newLikesCount } : car
			)
		)
	}

	const handleSortChange = (value: string) => {
		setSortOption(value)
		fetchCars(1, filters, value, searchQuery)
	}

	const handleCarPress = (car: Car) => {
		setSelectedCar(car)
		setIsModalVisible(true)
	}

	const renderCarItem = useCallback(({ item }: { item: Car }) => (
		<CarCard
			car={item}
			onPress={() => handleCarPress(item)}
			onFavoritePress={() => handleFavoritePress(item.id)}
			isFavorite={isFavorite(item.id)}
		/>
	), [handleCarPress, handleFavoritePress, isFavorite])

	const openFilterPage = () => {
		router.push({
			pathname: '/(home)/(user)/filter',
			params: { filters: JSON.stringify(filters) }
		})
	}

	const handleViewUpdate = (carId: string, newViewCount: number) => {
		setCars(prevCars =>
			prevCars.map(car =>
				car.id === carId ? { ...car, views: newViewCount } : car
			)
		)
	}

	const handleSearch = () => {
		fetchCars(1, filters, sortOption, searchQuery)
	}

	const handleCategoryPress = (category: string) => {
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
	}

	const handleResetFilters = () => {
		setFilters({})
		setSearchQuery('')
		setSortOption('')
		fetchCars(1, {}, '', '')
	}

	const renderListHeader = useMemo(() => (
		<>
			<ByBrands />
			<CategorySelector
				selectedCategories={filters.categories || []}
				onCategoryPress={handleCategoryPress}
			/>
		</>
	), [filters.categories, handleCategoryPress])

	const renderListEmpty = useCallback(() => (
		<View style={styles.emptyContainer}>
			<Text style={[styles.emptyText, isDarkMode && styles.darkEmptyText]}>
				No cars available.
			</Text>
			{(Object.keys(filters).length > 0 || searchQuery) && (
				<TouchableOpacity onPress={handleResetFilters} style={styles.resetButton}>
					<Text style={styles.resetButtonText}>Remove filters</Text>
				</TouchableOpacity>
			)}
		</View>
	), [filters, searchQuery, isDarkMode, handleResetFilters])

	return (
		<LinearGradient
			colors={isDarkMode ? ['#000000', '#D55004'] : ['#FFFFFF', '#D55004']}
			style={{ flex: 1 }}
			start={{ x: 1, y: 0.3 }}
			end={{ x: 2, y: 1 }}>
			<SafeAreaView style={[styles.container, isDarkMode && styles.darkContainer]}>
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
						<View style={[styles.searchBar, isDarkMode && styles.darkSearchBar]}>
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
								style={[styles.searchInput, isDarkMode && styles.darkSearchInput]}
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
										fetchCars(1, filters, sortOption, '')
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
					ListHeaderComponent={renderListHeader}
					data={cars}
					renderItem={renderCarItem}
					keyExtractor={item => item.id.toString()}
					onEndReached={() => {
						if (currentPage < totalPages) {
							fetchCars(currentPage + 1, filters, sortOption, searchQuery)
						}
					}}
					onEndReachedThreshold={0.1}
					ListEmptyComponent={renderListEmpty}
					ListFooterComponent={() =>
						isLoading ? (
							<ActivityIndicator
								size='large'
								color='#D55004'
								style={{ marginVertical: 20 }}
							/>
						) : null
					}
				/>

				<CarDetailModal
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
					isFavorite={!!selectedCar && isFavorite(selectedCar.id)}
					onViewUpdate={handleViewUpdate}
				/>
			</SafeAreaView>
		</LinearGradient>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	darkContainer: {
		backgroundColor: '#121212',
	},
	searchContainer: {
		padding: 10,
	},
	searchInputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	iconButton: {
		padding: 10,
		borderRadius: 20,
		backgroundColor: '#f0f0f0',
	},
	darkIconButton: {
		backgroundColor: '#333',
	},
	searchBar: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderColor: '#ccc',
		borderRadius: 20,
		marginHorizontal: 10,
	},
	darkSearchBar: {
		borderColor: '#555',
	},
	searchInput: {
		flex: 1,
		paddingVertical: 8,
		paddingHorizontal: 12,
		color: 'black',
	},
	darkSearchInput: {
		color: 'white',
	},
	clearButton: {
		padding: 10,
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
	},
	emptyText: {
		fontSize: 16,
		textAlign: 'center',
		color: '#000',
	},
	darkEmptyText: {
		color: '#fff',
	},
})