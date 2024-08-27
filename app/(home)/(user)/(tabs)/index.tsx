import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
	View,
	Text,
	FlatList,
	TextInput,
	TouchableOpacity,
	ActivityIndicator,
	Dimensions
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
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

const ITEMS_PER_PAGE = 7

interface Car {
	id: number
	make: string
	model: string
	year: number
	price: number
	dealership_name: string
	images: string[]
	description: string
	condition: 'New' | 'Used'
	mileage: number
	color: string
	transmission: 'Manual' | 'Automatic'
	drivetrain: 'FWD' | 'RWD' | 'AWD' | '4WD' | '4x4'
}

export default function BrowseCarsPage() {
	const { isDarkMode } = useTheme()
	const { user } = useUser()
	const { favorites, toggleFavorite, isFavorite } = useFavorites()
	const [cars, setCars] = useState<Car[]>([])
	const [currentPage, setCurrentPage] = useState(1)
	const [totalPages, setTotalPages] = useState(1)
	const [isLoading, setIsLoading] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [sortOption, setSortOption] = useState('')

	const [filters, setFilters] = useState({
		dealership: '',
		make: '',
		model: '',
		condition: '',
		priceRange: [0, 1000000],
		mileageRange: [0, 500000],
		year: '',
		color: '',
		transmission: '',
		drivetrain: ''
	})
	const [selectedCar, setSelectedCar] = useState<Car | null>(null)
	const [isModalVisible, setIsModalVisible] = useState(false)

	const router = useRouter()
	const params = useLocalSearchParams()

	const renderHeader = useMemo(() => {
		return (
			<View>
				<ByBrands />
				<Text
					className={`${
						isDarkMode ? 'text-white' : 'text-light-text'
					} font-bold text-xl mt-4 mb-2 px-4`}>
					All Cars
				</Text>
			</View>
		)
	}, [])
	useEffect(() => {
		fetchInitialData()
	}, [])

	useEffect(() => {
		if (params.filters) {
			const newFilters = JSON.parse(params.filters as string)
			setFilters(newFilters)
			fetchCars(1, newFilters)
		}
	}, [params.filters])

	const fetchInitialData = () => {
		fetchCars()
	}

	const fetchCars = useCallback(
		async (
			page = 1,
			currentFilters = filters,
			currentSortOption = sortOption,
			query = searchQuery
		) => {
			setIsLoading(true)
			let queryBuilder = supabase.from('cars').select(
				`
      *,
      dealerships (name,logo,phone,location,latitude,longitude)
      `,
				{ count: 'exact' }
			)

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
			if (currentFilters.year)
				queryBuilder = queryBuilder.eq('year', currentFilters.year)
			if (currentFilters.color)
				queryBuilder = queryBuilder.eq('color', currentFilters.color)
			if (currentFilters.transmission)
				queryBuilder = queryBuilder.eq(
					'transmission',
					currentFilters.transmission
				)
			if (currentFilters.drivetrain)
				queryBuilder = queryBuilder.eq('drivetrain', currentFilters.drivetrain)

			queryBuilder = queryBuilder
				.gte('price', currentFilters.priceRange[0])
				.lte('price', currentFilters.priceRange[1])
			queryBuilder = queryBuilder
				.gte('mileage', currentFilters.mileageRange[0])
				.lte('mileage', currentFilters.mileageRange[1])

			if (query) {
				const { data: dealershipIds } = await supabase
					.from('dealerships')
					.select('id')
					.ilike('name', `%${query}%`)

				queryBuilder = queryBuilder.or(
					`make.ilike.%${query}%,model.ilike.%${query}%,description.ilike.%${query}%,color.ilike.%${query}%,dealership_id.in.(${dealershipIds!
						.map(d => d.id)
						.join(',')})`
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

			// First, get the total count
			const { count, error: countError } = await queryBuilder

			if (countError) {
				console.error('Error fetching car count:', countError)
				setIsLoading(false)
				return
			}

			// Calculate the correct page and range
			const totalItems = count || 0
			const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)
			const safePageNumber = Math.min(page, totalPages)
			const startRange = (safePageNumber - 1) * ITEMS_PER_PAGE
			const endRange = Math.min(
				safePageNumber * ITEMS_PER_PAGE - 1,
				totalItems - 1
			)

			// Fetch the actual data
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
						dealership_longitude: item.dealerships.longitude,
						listed_at: item.listed_at
					})) || []
				setCars(prevCars =>
					safePageNumber === 1 ? newCars : [...prevCars, ...newCars]
				)
				setTotalPages(totalPages)
				setCurrentPage(safePageNumber)
			}
			setIsLoading(false)
		},
		[filters, sortOption]
	)

	const handleFavoritePress = async (carId: number) => {
		const newLikesCount = await toggleFavorite(carId)
		setCars(prevCars =>
			prevCars.map(car =>
				car.id === carId ? { ...car, likes: newLikesCount } : car
			)
		)
	}

	const handleSortChange = (value: any) => {
		setSortOption(value)
		fetchCars(1, filters, value)
	}

	const handleCarPress = (car: Car) => {
		setSelectedCar(car)
		setIsModalVisible(true)
	}
	const renderCarItem = useCallback(
		({ item, index }: any) => (
			<CarCard
				car={item}
				onPress={() => handleCarPress(item)}
				onFavoritePress={() => handleFavoritePress(item.id)}
				isFavorite={isFavorite(item.id)}
			/>
		),
		[handleCarPress, handleFavoritePress, isFavorite]
	)

	const openFilterPage = () => {
		router.push({
			pathname: '/(home)/(user)/filter',
			params: { filters: JSON.stringify(filters) }
		})
	}

	const handleViewUpdate = (carId: number, newViewCount: number) => {
		setCars(prevCars =>
			prevCars.map(car =>
				car.id === carId ? { ...car, views: newViewCount } : car
			)
		)
	}

	return (
		<LinearGradient
			colors={
				isDarkMode
					? [
							'#000000', // Deep Black
							'#D55004' // Classy Orange
					  ]
					: ['#FFFFFF', '#D55004']
			}
			style={{ flex: 1 }}
			start={{ x: 1, y: 0.3 }}
			end={{ x: 2, y: 1 }}>
			<SafeAreaView
				className={`flex-1 ${isDarkMode ? 'bg-night' : 'bg-light-background'}`}>
				<View className='p-4 rounded-full'>
					<View className='flex-row items-center justify-between'>
						<TouchableOpacity
							className={`${
								isDarkMode ? 'bg-red' : 'bg-light-accent'
							} p-3 rounded-full`}
							onPress={openFilterPage}>
							<FontAwesome
								name='filter'
								size={20}
								color={isDarkMode ? 'white' : 'black'}
							/>
						</TouchableOpacity>
						<View
							className={`flex-grow mx-2 border ${
								isDarkMode ? 'border-red' : 'border-light-accent'
							} rounded-full flex-row items-center`}>
							<TouchableOpacity
								className={`${
									isDarkMode ? 'bg-red' : 'bg-light-accent'
								} p-3 rounded-full`}
								onPress={() => fetchCars(1, filters, sortOption, searchQuery)}>
								<FontAwesome
									name='search'
									size={20}
									color={isDarkMode ? 'white' : 'black'}
								/>
							</TouchableOpacity>
							<TextInput
								className={`py-2 ${
									isDarkMode ? 'text-white' : 'text-light-text'
								} ml-4 justify-center`}
								placeholder='Search cars...'
								placeholderTextColor={isDarkMode ? 'white' : 'gray'}
								value={searchQuery}
								onChangeText={text => {
									setSearchQuery(text)
									setCurrentPage(1)
								}}
								onSubmitEditing={() =>
									fetchCars(1, filters, sortOption, searchQuery)
								}
							/>
							{searchQuery.length > 0 && (
								<TouchableOpacity
									className='p-2'
									onPress={() => {
										setSearchQuery('')
										fetchCars(1, filters, sortOption, '') // Pass empty string as query
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
							className='sort-picker'
							onValueChange={handleSortChange}
							initialValue={{ label: 'Sort', value: null }}
						/>
					</View>
				</View>

				<FlatList
					ListHeaderComponent={renderHeader}
					data={cars}
					renderItem={renderCarItem}
					extraData={cars}
					keyExtractor={(item, index) => `${item.id}_${index}`}
					showsVerticalScrollIndicator={false}
					onEndReached={() => {
						if (currentPage < totalPages && !isLoading) {
							fetchCars(currentPage + 1)
						}
					}}
					scrollEnabled={!isModalVisible}
					onEndReachedThreshold={0.1}
					ListFooterComponent={() =>
						isLoading ? (
							<View className='my-8'>
								<ActivityIndicator size='large' color='#D55004' />
							</View>
						) : null
					}
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
			</SafeAreaView>
		</LinearGradient>
	)
}
