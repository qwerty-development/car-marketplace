import React, { useState, useEffect, useCallback } from 'react'
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
import CarDetailModal from '@/components/CarDetailModal'
import { useFavorites } from '@/utils/useFavorites'
import { FontAwesome } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import SortPicker from '@/components/SortPicker'
import ByBrands from '@/components/ByBrands'

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

	const renderHeader = () => (
		<View>
			<ByBrands />
			<Text className='text-white font-bold text-xl mt-4 mb-2 px-4'>
				All Cars
			</Text>
		</View>
	)
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
			currentSortOption = sortOption
		) => {
			setIsLoading(true)
			let query = supabase.from('cars').select(
				`
        *,
        dealerships (name,logo,phone,location,latitude,longitude)
        `,
				{ count: 'exact' }
			)

			// Apply filters
			if (currentFilters.dealership)
				query = query.eq('dealership_id', currentFilters.dealership)
			if (currentFilters.make) query = query.eq('make', currentFilters.make)
			if (currentFilters.model) query = query.eq('model', currentFilters.model)
			if (currentFilters.condition)
				query = query.eq('condition', currentFilters.condition)
			if (currentFilters.year) query = query.eq('year', currentFilters.year)
			if (currentFilters.color) query = query.eq('color', currentFilters.color)
			if (currentFilters.transmission)
				query = query.eq('transmission', currentFilters.transmission)
			if (currentFilters.drivetrain)
				query = query.eq('drivetrain', currentFilters.drivetrain)

			query = query
				.gte('price', currentFilters.priceRange[0])
				.lte('price', currentFilters.priceRange[1])
			query = query
				.gte('mileage', currentFilters.mileageRange[0])
				.lte('mileage', currentFilters.mileageRange[1])

			if (searchQuery) {
				query = query.or(
					`make.ilike.%${searchQuery}%,model.ilike.%${searchQuery}%`
				)
			}

			// Apply sorting
			switch (currentSortOption) {
				case 'price_asc':
					query = query.order('price', { ascending: true })
					break
				case 'price_desc':
					query = query.order('price', { ascending: false })
					break
				case 'year_asc':
					query = query.order('year', { ascending: true })
					break
				case 'year_desc':
					query = query.order('year', { ascending: false })
					break
				case 'mileage_asc':
					query = query.order('mileage', { ascending: true })
					break
				case 'mileage_desc':
					query = query.order('mileage', { ascending: false })
					break
				default:
					query = query.order('listed_at', { ascending: false })
			}

			const { data, count, error } = await query.range(
				(page - 1) * ITEMS_PER_PAGE,
				page * ITEMS_PER_PAGE - 1
			)

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
				setCars(prevCars => (page === 1 ? newCars : [...prevCars, ...newCars]))
				setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE))
				setCurrentPage(page)
			}
			setIsLoading(false)
		},
		[searchQuery, filters, sortOption]
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
		<View className='flex-1 bg-black'>
			<View className='p-4 bg-black'>
				<View className='flex-row items-center justify-between'>
					<TouchableOpacity
						className='bg-red p-3 rounded-full'
						onPress={openFilterPage}>
						<FontAwesome name='filter' size={20} color='white' />
					</TouchableOpacity>
					<View className='flex-grow mx-2 border border-red rounded-full flex-row items-center'>
						<TouchableOpacity
							className='bg-red p-3 rounded-full'
							onPress={() => fetchCars(1, filters)}>
							<FontAwesome name='search' size={20} color='white' />
						</TouchableOpacity>
						<FontAwesome size={20} color='black' className='mx-3' />
						<TextInput
							className='py-2 text-white ml-4 justify-center'
							placeholder='Search cars...'
							placeholderTextColor='white'
							value={searchQuery}
							onChangeText={text => {
								setSearchQuery(text)
								setCurrentPage(1)
							}}
							onSubmitEditing={() => fetchCars(1, filters)}
						/>
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
						<View className='py-4'>
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
		</View>
	)
}
