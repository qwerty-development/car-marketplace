// (home)/(user)/index.tsx
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
import RNPickerSelect from 'react-native-picker-select'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/components/CarDetailModal'
import { useFavorites } from '@/utils/useFavorites'
import { FontAwesome } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'

const ITEMS_PER_PAGE = 10
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window')
const TAB_BAR_HEIGHT = 50 // Adjust this based on your actual tab bar height
const CAR_CARD_HEIGHT = SCREEN_HEIGHT - TAB_BAR_HEIGHT

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
	const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites()
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
		async (page = 1, currentFilters = filters) => {
			setIsLoading(true)
			let query = supabase.from('cars').select(
				`
        *,
        dealerships (name,logo)
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
			switch (sortOption) {
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
						dealership_phone: item.dealerships.phone
					})) || []
				setCars(prevCars => (page === 1 ? newCars : [...prevCars, ...newCars]))
				setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE))
				setCurrentPage(page)
			}
			setIsLoading(false)
		},
		[searchQuery, sortOption, filters]
	)

	const handleFavoritePress = async (carId: number) => {
		if (isFavorite(carId)) {
			await removeFavorite(carId)
		} else {
			await addFavorite(carId)
		}
	}

	const handleCarPress = (car: Car) => {
		setSelectedCar(car)
		setIsModalVisible(true)
	}

	const renderCarItem = ({ item }: { item: Car }) => (
		<CarCard
			car={item}
			onPress={() => handleCarPress(item)}
			onFavoritePress={() => handleFavoritePress(item.id)}
			isFavorite={isFavorite(item.id)}
			cardHeight={CAR_CARD_HEIGHT}
		/>
	)

	const openFilterPage = () => {
		router.push({
			pathname: '/(home)/(user)/filter',
			params: { filters: JSON.stringify(filters) }
		})
	}

	return (
		<View className='flex-1 bg-gray-100'>
			<View className='p-2 bg-white'>
				<View className='flex-row items-center'>
					<TouchableOpacity
						className='bg-red p-2 rounded-full mr-2'
						onPress={openFilterPage}>
						<FontAwesome name='filter' size={19} color='white' />
					</TouchableOpacity>

					<View className='flex-row flex-1 bg-gray-100 rounded-full items-center'>
						<TextInput
							className='flex-1 text-black px-3 py-1'
							placeholder='Search cars...'
							value={searchQuery}
							onChangeText={text => {
								setSearchQuery(text)
								setCurrentPage(1)
							}}
							onSubmitEditing={() => fetchCars(1, filters)}
						/>
						<TouchableOpacity
							className='bg-red p-2 rounded-full mr-2'
							onPress={() => fetchCars(1, filters)}>
							<FontAwesome name='search' size={20} color='white' />
						</TouchableOpacity>
					</View>
				</View>

				<View className='mt-2'>
					<RNPickerSelect
						onValueChange={value => {
							setSortOption(value)
							setCurrentPage(1)
							fetchCars(1, filters)
						}}
						items={[
							{ label: 'Price: Low to High', value: 'price_asc' },
							{ label: 'Price: High to Low', value: 'price_desc' },
							{ label: 'Year: New to Old', value: 'year_desc' },
							{ label: 'Year: Old to New', value: 'year_asc' },
							{ label: 'Mileage: Low to High', value: 'mileage_asc' },
							{ label: 'Mileage: High to Low', value: 'mileage_desc' }
						]}
						placeholder={{ label: 'Sort', value: null }}
						style={{
							inputIOS: {
								fontSize: 14,
								color: 'black',
								padding: 8,
								backgroundColor: 'white',
								borderRadius: 8
							},
							inputAndroid: {
								fontSize: 14,
								color: 'black',
								padding: 8,
								backgroundColor: 'white',
								borderRadius: 8
							},
							iconContainer: {
								top: 10,
								right: 10
							}
						}}
					/>
				</View>
			</View>

			<FlatList
				data={cars}
				renderItem={renderCarItem}
				keyExtractor={item => item.id.toString()}
				snapToAlignment='start'
				decelerationRate='fast'
				snapToInterval={CAR_CARD_HEIGHT}
				showsVerticalScrollIndicator={false}
				onEndReached={() => {
					if (currentPage < totalPages && !isLoading) {
						fetchCars(currentPage + 1)
					}
				}}
				onEndReachedThreshold={0.1}
				ListFooterComponent={() =>
					isLoading ? (
						<View className='py-4'>
							<ActivityIndicator size='large' color='#0000ff' />
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
			/>
		</View>
	)
}
