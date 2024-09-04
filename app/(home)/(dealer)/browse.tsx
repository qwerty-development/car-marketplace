import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
	View,
	FlatList,
	TextInput,
	TouchableOpacity,
	ActivityIndicator,
	Text
} from 'react-native'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import CarDetailModal from '../(user)/CarDetailModal'
import { useFavorites } from '@/utils/useFavorites'
import { FontAwesome } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import SortPicker from '@/components/SortPicker'
import ByBrands from '@/components/ByBrands'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import CategorySelector from '@/components/Category'

const ITEMS_PER_PAGE = 7

export default function BrowseCarsPage() {
	const { isDarkMode } = useTheme()
	const { favorites, toggleFavorite, isFavorite } = useFavorites()
	const [cars, setCars] = useState<any>([])
	const [currentPage, setCurrentPage] = useState<any>(1)
	const [totalPages, setTotalPages] = useState<any>(1)
	const [isLoading, setIsLoading] = useState<any>(false)
	const [searchQuery, setSearchQuery] = useState<any>('')
	const [sortOption, setSortOption] = useState<any>('')
	const [filters, setFilters] = useState<any>({})
	const [selectedCar, setSelectedCar] = useState<any>(null)
	const [isModalVisible, setIsModalVisible] = useState<any>(false)

	const router = useRouter()
	const params = useLocalSearchParams()

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
			currentFilters = filters,
			currentSortOption = sortOption,
			query = searchQuery
		) => {
			setIsLoading(true)
			let queryBuilder = supabase
				.from('cars')
				.select(
					`*, dealerships (name,logo,phone,location,latitude,longitude)`,
					{ count: 'exact' }
				)
				.neq('status', 'sold')

			// Apply filters
			Object.entries(currentFilters).forEach(([key, value]: any) => {
				if (value) {
					if (key.endsWith('Range')) {
						queryBuilder = queryBuilder
							.gte(key.replace('Range', ''), value[0])
							.lte(key.replace('Range', ''), value[1])
					} else if (key === 'categories' && value.length > 0) {
						queryBuilder = queryBuilder.in('category', value)
					} else {
						queryBuilder = queryBuilder.eq(key, value)
					}
				}
			})

			if (query) {
				queryBuilder = queryBuilder.or(
					`make.ilike.%${query}%,model.ilike.%${query}%,description.ilike.%${query}%,color.ilike.%${query}%`
				)
			}

			// Apply sorting
			const sortMap: any = {
				price_asc: { column: 'price', ascending: true },
				price_desc: { column: 'price', ascending: false },
				year_asc: { column: 'year', ascending: true },
				year_desc: { column: 'year', ascending: false },
				mileage_asc: { column: 'mileage', ascending: true },
				mileage_desc: { column: 'mileage', ascending: false }
			}
			const sort = sortMap[currentSortOption] || {
				column: 'listed_at',
				ascending: false
			}
			queryBuilder = queryBuilder.order(sort.column, {
				ascending: sort.ascending
			})

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

	const handleFavoritePress = useCallback(
		async (carId: any) => {
			const newLikesCount = await toggleFavorite(carId)
			setCars((prevCars: any) =>
				prevCars.map((car: { id: any }) =>
					car.id === carId ? { ...car, likes: newLikesCount } : car
				)
			)
		},
		[toggleFavorite]
	)

	const handleSortChange = useCallback(
		(value: any) => {
			setSortOption(value)
			fetchCars(1, filters, value, searchQuery)
		},
		[filters, searchQuery, fetchCars]
	)

	const handleCarPress = useCallback((car: React.SetStateAction<null>) => {
		setSelectedCar(car)
		setIsModalVisible(true)
	}, [])

	const renderCarItem = useCallback(
		({ item }: any) => (
			<CarCard
				car={item}
				onPress={() => handleCarPress(item)}
				onFavoritePress={() => handleFavoritePress(item.id)}
				isFavorite={isFavorite(item.id)}
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

	const handleViewUpdate = useCallback((carId: any, newViewCount: any) => {
		setCars((prevCars: any) =>
			prevCars.map((car: { id: any }) =>
				car.id === carId ? { ...car, views: newViewCount } : car
			)
		)
	}, [])

	const handleSearch = useCallback(() => {
		fetchCars(1, filters, sortOption, searchQuery)
	}, [filters, sortOption, searchQuery, fetchCars])

	const handleCategoryPress = useCallback(
		(category: any) => {
			setFilters((prevFilters: any) => {
				const updatedCategories = prevFilters.categories
					? prevFilters.categories.includes(category)
						? prevFilters.categories.filter((c: any) => c !== category)
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
		() => (
			<View className='flex-1 justify-center items-center p-5'>
				<Text
					className={`text-lg text-center ${
						isDarkMode ? 'text-white' : 'text-black'
					}`}>
					No cars available.
				</Text>
				{(Object.keys(filters).length > 0 || searchQuery) && (
					<TouchableOpacity
						onPress={handleResetFilters}
						className='mt-4 bg-red-500 px-4 py-2 rounded-full'>
						<Text className='text-white font-bold'>Remove filters</Text>
					</TouchableOpacity>
				)}
			</View>
		),
		[filters, searchQuery, isDarkMode, handleResetFilters]
	)

	return (
		<LinearGradient
			colors={isDarkMode ? ['#000000', '#D55004'] : ['#FFFFFF', '#D55004']}
			className='flex-1'
			start={{ x: 1, y: 0.3 }}
			end={{ x: 2, y: 1 }}>
			<View className='p-4'>
				<View className='flex-row items-center justify-between'>
					<TouchableOpacity
						className={`p-2 rounded-full ${
							isDarkMode ? 'bg-gray-800' : 'bg-gray-200'
						}`}
						onPress={openFilterPage}>
						<FontAwesome
							name='filter'
							size={20}
							color={isDarkMode ? 'white' : 'black'}
						/>
					</TouchableOpacity>
					<View
						className={`flex-1 mx-2 border rounded-full flex-row items-center ${
							isDarkMode
								? 'border-gray-600 bg-gray-800'
								: 'border-gray-300 bg-white'
						}`}>
						<TouchableOpacity className='p-2' onPress={handleSearch}>
							<FontAwesome
								name='search'
								size={20}
								color={isDarkMode ? 'white' : 'black'}
							/>
						</TouchableOpacity>
						<TextInput
							className={`flex-1 py-2 px-4 ${
								isDarkMode ? 'text-white' : 'text-black'
							}`}
							placeholder='Search cars...'
							placeholderTextColor={isDarkMode ? 'gray' : 'darkgray'}
							value={searchQuery}
							onChangeText={setSearchQuery}
							onSubmitEditing={handleSearch}
						/>
						{searchQuery.length > 0 && (
							<TouchableOpacity
								className='p-2'
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
						<ActivityIndicator size='large' color='#D55004' className='my-5' />
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
		</LinearGradient>
	)
}
