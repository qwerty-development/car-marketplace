import React, { useState, useEffect, useCallback } from 'react'
import {
	View,
	Text,
	FlatList,
	TextInput,
	TouchableOpacity,
	Modal,
	ScrollView,
	ActivityIndicator
} from 'react-native'
import RNPickerSelect from 'react-native-picker-select'
import { Slider } from '@rneui/themed'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/components/CarDetailModal'
import { useFavorites } from '@/utils/useFavorites'
import { FontAwesome } from '@expo/vector-icons'
import FilterModal from '@/components/FilterModal'

const ITEMS_PER_PAGE = 10

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

interface Dealership {
	id: number
	name: string
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
	const [tempFilters, setTempFilters] = useState({ ...filters })
	const [dealerships, setDealerships] = useState<Dealership[]>([])
	const [makes, setMakes] = useState<string[]>([])
	const [models, setModels] = useState<string[]>([])
	const [colors, setColors] = useState<string[]>([])
	const [selectedCar, setSelectedCar] = useState<Car | null>(null)
	const [isModalVisible, setIsModalVisible] = useState(false)
	const [isFilterModalVisible, setIsFilterModalVisible] = useState(false)

	const fetchCars = useCallback(
		async (page = 1, loadMore = false) => {
			setIsLoading(true)
			let query = supabase.from('cars').select(
				`
      *,
      dealerships (name)
    `,
				{ count: 'exact' }
			)

			// Apply filters
			if (filters.dealership)
				query = query.eq('dealership_id', filters.dealership)
			if (filters.make) query = query.eq('make', filters.make)
			if (filters.model) query = query.eq('model', filters.model)
			if (filters.condition) query = query.eq('condition', filters.condition)
			if (filters.year) query = query.eq('year', filters.year)
			if (filters.color) query = query.eq('color', filters.color)
			if (filters.transmission)
				query = query.eq('transmission', filters.transmission)
			if (filters.drivetrain) query = query.eq('drivetrain', filters.drivetrain)

			query = query
				.gte('price', filters.priceRange[0])
				.lte('price', filters.priceRange[1])
			query = query
				.gte('mileage', filters.mileageRange[0])
				.lte('mileage', filters.mileageRange[1])

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
						dealership_name: item.dealerships.name
					})) || []
				setCars(prev => (loadMore ? [...prev, ...newCars] : newCars))
				setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE))
				setCurrentPage(page)
			}
			setIsLoading(false)
		},
		[filters, searchQuery, sortOption]
	)

	useEffect(() => {
		fetchCars()
		fetchDealerships()
		fetchMakes()
		fetchColors()
	}, [fetchCars])

	const fetchDealerships = async () => {
		const { data, error } = await supabase
			.from('dealerships')
			.select('id, name')
		if (error) {
			console.error('Error fetching dealerships:', error)
		} else {
			setDealerships(data || [])
		}
	}

	const fetchMakes = async () => {
		const { data, error } = await supabase
			.from('cars')
			.select('make')
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
			.eq('make', make)
			.order('model')
		if (error) {
			console.error('Error fetching models:', error)
		} else {
			const uniqueModels = [...new Set(data?.map(item => item.model))]
			setModels(uniqueModels)
		}
	}

	const fetchColors = async () => {
		const { data, error } = await supabase
			.from('cars')
			.select('color')
			.order('color')
		if (error) {
			console.error('Error fetching colors:', error)
		} else {
			const uniqueColors = [...new Set(data?.map(item => item.color))]
			setColors(uniqueColors)
		}
	}

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

	const handleFilterChange = (key: string, value: any) => {
		setTempFilters(prev => ({ ...prev, [key]: value }))
	}

	const applyFilters = () => {
		setFilters(tempFilters)
		setIsFilterModalVisible(false)
		setCurrentPage(1)
		fetchCars(1)
	}

	const resetFilters = () => {
		setTempFilters({
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
	}

	const renderCarItem = ({ item }: { item: Car }) => (
		<CarCard
			car={item}
			onPress={() => handleCarPress(item)}
			onFavoritePress={() => handleFavoritePress(item.id)}
			isFavorite={isFavorite(item.id)}
		/>
	)

	const renderFooter = () => {
		if (!isLoading) return null
		return (
			<View className='py-4'>
				<ActivityIndicator size='large' color='#0000ff' />
			</View>
		)
	}

	const closeModal = () => {
		setTempFilters(filters)
		setIsFilterModalVisible(false)
	}
	return (
		<View className='flex-1 bg-gray-100'>
			<View className='p-4 bg-white shadow-sm'>
				<TextInput
					className='bg-gray-100 text-black p-3 rounded-full mb-4'
					placeholder='Search cars...'
					value={searchQuery}
					onChangeText={text => {
						setSearchQuery(text)
						setCurrentPage(1)
						fetchCars(1)
					}}
				/>
				<View className='flex-row justify-between space-x-2'>
					<TouchableOpacity
						className='bg-red-500 px-5 py-2 rounded-full items-center justify-center flex-row flex-1'
						onPress={() => {
							setTempFilters(filters)
							setIsFilterModalVisible(true)
						}}>
						<FontAwesome
							name='filter'
							size={20}
							color='white'
							className='mr-2'
						/>
						<Text className='text-white text-sm'>Filter</Text>
					</TouchableOpacity>

					<View className='bg-gray-100 px-2 rounded-full overflow-hidden justify-center flex-row items-center flex-1'>
						<RNPickerSelect
							onValueChange={value => {
								setSortOption(value)
								setCurrentPage(1)
								fetchCars(1)
							}}
							items={[
								{ label: 'Price: Low to High', value: 'price_asc' },
								{ label: 'Price: High to Low', value: 'price_desc' },
								{ label: 'Year: New to Old', value: 'year_desc' },
								{ label: 'Year: Old to New', value: 'year_asc' },
								{ label: 'Mileage: Low to High', value: 'mileage_asc' },
								{ label: 'Mileage: High to Low', value: 'mileage_desc' }
							]}
							placeholder={{ label: 'Sort By', value: null }}
							style={{
								inputIOS: { color: 'black', padding: 10 },
								inputAndroid: { color: 'black', padding: 10 }
							}}
						/>
						<FontAwesome name='sort' size={20} color='black' className='mr-2' />
					</View>
				</View>
			</View>

			<FlatList
				data={cars}
				renderItem={renderCarItem}
				keyExtractor={item => item.id.toString()}
				onEndReached={() => {
					if (currentPage < totalPages && !isLoading) {
						fetchCars(currentPage + 1, true)
					}
				}}
				onEndReachedThreshold={0.1}
				ListFooterComponent={renderFooter}
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
			<FilterModal
				isVisible={isFilterModalVisible}
				tempFilters={tempFilters}
				handleFilterChange={handleFilterChange}
				applyFilters={applyFilters}
				resetFilters={resetFilters}
				closeModal={closeModal}
				dealerships={dealerships}
				makes={makes}
				models={models}
				colors={colors}
			/>
		</View>
	)
}
