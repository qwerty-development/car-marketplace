import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
	View,
	Text,
	Image,
	TouchableOpacity,
	TextInput,
	SectionList,
	FlatList,
	Alert,
	SectionListData
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useNavigation } from '@react-navigation/native'
import RNPickerSelect from 'react-native-picker-select'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/components/CarDetailModal'
import { FontAwesome } from '@expo/vector-icons'

const ITEMS_PER_PAGE = 10

interface Dealership {
	id: number
	name: string
	logo: string
}

interface Car {
	id: number
	make: string
	model: string
	year: number
	price: number
	dealership_name: string
	images: string[]
	description: string
}

export default function DealershipListPage() {
	const [dealerships, setDealerships] = useState<Dealership[]>([])
	const [searchQuery, setSearchQuery] = useState('')
	const [selectedDealership, setSelectedDealership] =
		useState<Dealership | null>(null)
	const [cars, setCars] = useState<Car[]>([])
	const [currentPage, setCurrentPage] = useState(1)
	const [totalPages, setTotalPages] = useState(1)
	const [carSearchQuery, setCarSearchQuery] = useState('')
	const [sortBy, setSortBy] = useState('listed_at')
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
	const [filterMake, setFilterMake] = useState('')
	const [filterModel, setFilterModel] = useState('')
	const [makes, setMakes] = useState<string[]>([])
	const [models, setModels] = useState<string[]>([])
	const [selectedCar, setSelectedCar] = useState<Car | null>(null)
	const [isCarModalVisible, setIsCarModalVisible] = useState(false)
	const navigation = useNavigation()
	const sectionListRef = useRef<SectionList>(null)

	useEffect(() => {
		fetchDealerships()
	}, [])

	useEffect(() => {
		if (selectedDealership) {
			fetchCars()
			fetchMakes()
		}
	}, [
		selectedDealership,
		currentPage,
		sortBy,
		sortOrder,
		filterMake,
		filterModel,
		carSearchQuery
	])

	useEffect(() => {
		if (selectedDealership) {
			navigation.setOptions({
				headerLeft: () => (
					<TouchableOpacity onPress={() => setSelectedDealership(null)}>
						<Text className='text-white text-2xl ml-4'>←</Text>
					</TouchableOpacity>
				),
				headerTitle: selectedDealership.name
			})
		} else {
			navigation.setOptions({
				headerLeft: () => null,
				headerTitle: 'Dealerships'
			})
		}
	}, [selectedDealership, navigation])

	const fetchDealerships = async () => {
		const { data, error } = await supabase
			.from('dealerships')
			.select('id, name, logo')
			.order('name')

		if (error) {
			console.error('Error fetching dealerships:', error)
			Alert.alert('Error', 'Failed to fetch dealerships')
		} else {
			setDealerships(data || [])
		}
	}

	const fetchCars = async () => {
		if (!selectedDealership) return

		let query = supabase
			.from('cars')
			.select('*', { count: 'exact' })
			.eq('dealership_id', selectedDealership.id)

		if (filterMake) query = query.eq('make', filterMake)
		if (filterModel) query = query.eq('model', filterModel)

		if (carSearchQuery) {
			const numericSearch = !isNaN(Number(carSearchQuery))
			let searchConditions = [
				`make.ilike.%${carSearchQuery}%`,
				`model.ilike.%${carSearchQuery}%`
			]
			if (numericSearch) {
				searchConditions.push(`year.eq.${carSearchQuery}`)
				searchConditions.push(`price.eq.${carSearchQuery}`)
			}
			query = query.or(searchConditions.join(','))
		}

		const { count } = await query
		const totalPages = Math.ceil((count || 0) / ITEMS_PER_PAGE)
		const from = (currentPage - 1) * ITEMS_PER_PAGE
		const to = from + ITEMS_PER_PAGE - 1

		query = query
			.range(from, to)
			.order(sortBy, { ascending: sortOrder === 'asc' })

		const { data, error } = await query

		if (error) {
			console.error('Error fetching cars:', error)
			Alert.alert('Error', 'Failed to fetch cars')
		} else {
			setCars(data || [])
			setTotalPages(totalPages)
		}
	}

	const fetchMakes = async () => {
		if (!selectedDealership) return

		const { data, error } = await supabase
			.from('cars')
			.select('make')
			.eq('dealership_id', selectedDealership.id)
			.order('make')

		if (error) {
			console.error('Error fetching makes:', error)
		} else {
			const uniqueMakes = [...new Set(data?.map(item => item.make))]
			setMakes(uniqueMakes)
		}
	}

	const fetchModels = async (make: string) => {
		if (!selectedDealership) return

		const { data, error } = await supabase
			.from('cars')
			.select('model')
			.eq('dealership_id', selectedDealership.id)
			.eq('make', make)
			.order('model')

		if (error) {
			console.error('Error fetching models:', error)
		} else {
			const uniqueModels = [...new Set(data?.map(item => item.model))]
			setModels(uniqueModels)
		}
	}

	const filteredDealerships = useMemo(() => {
		return dealerships.filter(dealership =>
			dealership.name.toLowerCase().includes(searchQuery.toLowerCase())
		)
	}, [dealerships, searchQuery])

	const groupedDealerships = useMemo(() => {
		const groups: { title: string; data: Dealership[] }[] = []
		const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

		alphabet.forEach(letter => {
			const dealershipsForLetter = filteredDealerships.filter(dealership =>
				dealership.name.toUpperCase().startsWith(letter)
			)
			if (dealershipsForLetter.length > 0) {
				groups.push({ title: letter, data: dealershipsForLetter })
			}
		})

		return groups
	}, [filteredDealerships])

	const handleDealershipPress = (dealership: Dealership) => {
		setSelectedDealership(dealership)
		setCurrentPage(1)
		setCarSearchQuery('')
		setFilterMake('')
		setFilterModel('')
		setSortBy('listed_at')
		setSortOrder('desc')
	}

	const handleCarPress = (car: Car) => {
		setSelectedCar(car)
		setIsCarModalVisible(true)
	}

	const handleCarSearch = (text: string) => {
		setCarSearchQuery(text)
		setCurrentPage(1)
	}

	const handleMakeFilter = (value: string) => {
		setFilterMake(value)
		setFilterModel('')
		fetchModels(value)
		setCurrentPage(1)
	}

	const handleModelFilter = (value: string) => {
		setFilterModel(value)
		setCurrentPage(1)
	}

	const handleSort = (newSortBy: string) => {
		if (sortBy === newSortBy) {
			setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
		} else {
			setSortBy(newSortBy)
			setSortOrder('asc')
		}
		setCurrentPage(1)
	}

	const handlePageChange = (newPage: number) => {
		setCurrentPage(newPage)
	}

	const scrollToSection = (sectionIndex: number) => {
		sectionListRef.current?.scrollToLocation({
			sectionIndex,
			itemIndex: 0,
			animated: true,
			viewPosition: 0
		})
	}

	const renderDealershipItem = ({ item }: { item: Dealership }) => (
		<TouchableOpacity
			className='flex-row items-center py-4 border-b border-gray-700'
			onPress={() => handleDealershipPress(item)}>
			<Image source={{ uri: item.logo }} className='w-12 h-12 rounded-full' />
			<Text className='ml-4 text-lg text-white'>{item.name}</Text>
		</TouchableOpacity>
	)

	const renderSectionHeader = ({
		section
	}: {
		section: SectionListData<Dealership>
	}) => (
		<View className='bg-black py-2'>
			<Text className='text-white  font-bold'>{section.title}</Text>
		</View>
	)

	const renderCarItem = ({ item }: { item: Car }) => (
		<CarCard car={item} onPress={() => handleCarPress(item)} />
	)

	const AlphabetIndex = () => (
		<View className='absolute right-2 top-0 bottom-0 justify-center bg-black bg-opacity-50'>
			{groupedDealerships.map((group, index) => (
				<TouchableOpacity
					key={group.title}
					onPress={() => scrollToSection(index)}>
					<Text
						className={`text-white text-xs py-1 ${
							group.data.length > 0 ? 'font-bold' : 'opacity-50'
						}`}>
						{group.title}
					</Text>
				</TouchableOpacity>
			))}
		</View>
	)

	return (
		<View className='flex-1 bg-black'>
			{!selectedDealership ? (
				<>
					<View className=' border mt-4 z-50 border-red rounded-full flex-row  items-center'>
						<FontAwesome size={20} color='black' className='mx-3' />
						<TextInput
							className='p-2 text-white justify-center'
							placeholder='Search dealerships...'
							placeholderTextColor='gray'
							value={searchQuery}
							onChangeText={setSearchQuery}
						/>
					</View>
					<SectionList
						ref={sectionListRef}
						sections={groupedDealerships}
						renderItem={renderDealershipItem}
						renderSectionHeader={renderSectionHeader}
						keyExtractor={item => item.id.toString()}
						stickySectionHeadersEnabled={true}
						className='px-2'
					/>
					<AlphabetIndex />
				</>
			) : (
				<View className='flex-1'>
					<TextInput
						className='bg-gray-800 text-white p-3 mb-2'
						placeholder='Search cars...'
						placeholderTextColor='gray'
						value={carSearchQuery}
						onChangeText={handleCarSearch}
					/>
					<View className='flex-row justify-between mb-2'>
						<View className='flex-1 mr-2'>
							<RNPickerSelect
								onValueChange={handleMakeFilter}
								items={makes.map(make => ({ label: make, value: make }))}
								placeholder={{ label: 'All Makes', value: null }}
								value={filterMake}
								style={pickerSelectStyles}
							/>
						</View>
						<View className='flex-1 ml-2'>
							<RNPickerSelect
								onValueChange={handleModelFilter}
								items={models.map(model => ({ label: model, value: model }))}
								placeholder={{ label: 'All Models', value: null }}
								value={filterModel}
								style={pickerSelectStyles}
							/>
						</View>
					</View>
					<View className='flex-row justify-between mb-2'>
						<TouchableOpacity onPress={() => handleSort('price')}>
							<Text className='text-red-500 text-sm'>
								Price {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
							</Text>
						</TouchableOpacity>
						<TouchableOpacity onPress={() => handleSort('year')}>
							<Text className='text-red-500 text-sm'>
								Year {sortBy === 'year' && (sortOrder === 'asc' ? '↑' : '↓')}
							</Text>
						</TouchableOpacity>
						<TouchableOpacity onPress={() => handleSort('listed_at')}>
							<Text className='text-red-500 text-sm'>
								Date Listed{' '}
								{sortBy === 'listed_at' && (sortOrder === 'asc' ? '↑' : '↓')}
							</Text>
						</TouchableOpacity>
					</View>
					<FlatList
						data={cars}
						renderItem={renderCarItem}
						keyExtractor={item => item.id.toString()}
						className='flex-1'
					/>
					<View className='flex-row justify-between items-center mt-2'>
						<TouchableOpacity
							onPress={() => handlePageChange(currentPage - 1)}
							disabled={currentPage === 1}>
							<Text
								className={`text-red-500 text-sm ${
									currentPage === 1 ? 'opacity-50' : ''
								}`}>
								Previous
							</Text>
						</TouchableOpacity>
						<Text className='text-sm text-white'>
							Page {currentPage} of {totalPages}
						</Text>
						<TouchableOpacity
							onPress={() => handlePageChange(currentPage + 1)}
							disabled={currentPage === totalPages}>
							<Text
								className={`text-red-500 text-sm ${
									currentPage === totalPages ? 'opacity-50' : ''
								}`}>
								Next
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			)}
			<CarDetailModal
				isVisible={isCarModalVisible}
				car={selectedCar}
				onClose={() => setIsCarModalVisible(false)}
			/>
		</View>
	)
}

const pickerSelectStyles = {
	inputIOS: {
		backgroundColor: 'black',
		borderWidth: 1,
		borderColor: '#D55004',
		borderRadius: 8,
		color: 'white',
		paddingHorizontal: 10,
		paddingVertical: 12
	},
	inputAndroid: {
		backgroundColor: 'black',
		borderWidth: 1,
		borderColor: 'white',
		borderRadius: 8,
		color: 'white',
		paddingHorizontal: 10,
		paddingVertical: 8
	},
	placeholder: {
		color: 'white'
	}
}
