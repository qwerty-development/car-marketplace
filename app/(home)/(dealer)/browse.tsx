import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	FlatList,
	TextInput,
	TouchableOpacity,
	StyleSheet,
	Alert
} from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/components/CarDetailModal'

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
}

interface Dealership {
	id: number
	name: string
}

export default function BrowseCarsPage() {
	const { user } = useUser()
	const [cars, setCars] = useState<Car[]>([])
	const [currentPage, setCurrentPage] = useState(1)
	const [totalPages, setTotalPages] = useState(1)
	const [searchQuery, setSearchQuery] = useState('')
	const [sortBy, setSortBy] = useState('listed_at')
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
	const [filterDealership, setFilterDealership] = useState('')
	const [filterMake, setFilterMake] = useState('')
	const [filterModel, setFilterModel] = useState('')
	const [dealerships, setDealerships] = useState<Dealership[]>([])
	const [makes, setMakes] = useState<string[]>([])
	const [models, setModels] = useState<string[]>([])
	const [selectedCar, setSelectedCar] = useState<Car | null>(null)
	const [isModalVisible, setIsModalVisible] = useState(false)
	const [filtersChanged, setFiltersChanged] = useState(false)

	useEffect(() => {
		if (filtersChanged) {
			setCurrentPage(1)
			setFiltersChanged(false)
		}
		fetchCars()
		fetchDealerships()
		fetchMakes()
	}, [
		currentPage,
		sortBy,
		sortOrder,
		filterDealership,
		filterMake,
		filterModel,
		searchQuery,
		user,
		filtersChanged
	])
	const handleViewUpdate = (carId: number, newViewCount: number) => {
		setCars(prevCars =>
			prevCars.map(car =>
				car.id === carId ? { ...car, views: newViewCount } : car
			)
		)
	}

	const fetchCars = async () => {
		let query = supabase.from('cars').select(
			`
        *,
        dealerships (name)
      `,
			{ count: 'exact' }
		)

		if (filterDealership) query = query.eq('dealership_id', filterDealership)
		if (filterMake) query = query.eq('make', filterMake)
		if (filterModel) query = query.eq('model', filterModel)

		if (searchQuery) {
			const numericSearch = !isNaN(Number(searchQuery))

			let searchConditions = [
				`make.ilike.%${searchQuery}%`,
				`model.ilike.%${searchQuery}%`
			]

			if (numericSearch) {
				searchConditions.push(`year.eq.${searchQuery}`)
				searchConditions.push(`price.eq.${searchQuery}`)
			}

			query = query.or(searchConditions.join(','))
		}

		// Get the total count first
		const { count, error: countError } = await query

		if (countError) {
			console.error('Error fetching count:', countError)
			Alert.alert('Error', 'Failed to fetch listings count')
			return
		}

		// Calculate the correct range
		const totalPages = Math.ceil((count || 0) / ITEMS_PER_PAGE)
		const safeCurrentPage = Math.min(currentPage, totalPages || 1)
		const from = (safeCurrentPage - 1) * ITEMS_PER_PAGE
		const to = from + ITEMS_PER_PAGE - 1

		// Now fetch the actual data
		query = query
			.range(from, to)
			.order(sortBy, { ascending: sortOrder === 'asc' })

		const { data, error } = await query

		if (error) {
			console.error('Error fetching listings:', error)
			Alert.alert('Error', 'Failed to fetch listings')
		} else {
			setCars(
				data?.map(item => ({
					...item,
					dealership_name: item.dealerships.name
				})) || []
			)
			setTotalPages(totalPages)
			setCurrentPage(safeCurrentPage)
		}
	}

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

	const handleCarPress = (car: Car) => {
		setSelectedCar(car)
		setIsModalVisible(true)
	}

	const handleSearch = (text: string) => {
		setSearchQuery(text)
		setFiltersChanged(true)
	}

	const handleDealershipFilter = (value: string) => {
		setFilterDealership(value)
		setFiltersChanged(true)
	}

	const handleMakeFilter = (value: string) => {
		setFilterMake(value)
		fetchModels(value)
		setFiltersChanged(true)
	}

	const handleModelFilter = (value: string) => {
		setFilterModel(value)
		setFiltersChanged(true)
	}

	const handleSort = (newSortBy: string) => {
		if (sortBy === newSortBy) {
			setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
		} else {
			setSortBy(newSortBy)
			setSortOrder('asc')
		}
		setFiltersChanged(true)
	}

	const handlePageChange = (newPage: number) => {
		setCurrentPage(newPage)
	}

	const renderCarItem = ({ item }: { item: Car }) => (
		<CarCard car={item} onPress={() => handleCarPress(item)} />
	)

	return (
		<View style={styles.container}>
			<TextInput
				style={styles.searchInput}
				placeholder='Search cars...'
				value={searchQuery}
				onChangeText={handleSearch}
			/>
			<View style={styles.filtersContainer}>
				<Picker
					selectedValue={filterDealership}
					onValueChange={handleDealershipFilter}
					style={styles.picker}>
					<Picker.Item label='All Dealerships' value='' />
					{dealerships.map(dealership => (
						<Picker.Item
							key={dealership.id}
							label={dealership.name}
							value={dealership.id.toString()}
						/>
					))}
				</Picker>
				<Picker
					selectedValue={filterMake}
					onValueChange={handleMakeFilter}
					style={styles.picker}>
					<Picker.Item label='All Makes' value='' />
					{makes.map((make, index) => (
						<Picker.Item key={`${make}-${index}`} label={make} value={make} />
					))}
				</Picker>
				<Picker
					selectedValue={filterModel}
					onValueChange={handleModelFilter}
					style={styles.picker}>
					<Picker.Item label='All Models' value='' />
					{models.map((model, index) => (
						<Picker.Item
							key={`${model}-${index}`}
							label={model}
							value={model}
						/>
					))}
				</Picker>
			</View>
			<View style={styles.sortContainer}>
				<TouchableOpacity onPress={() => handleSort('price')}>
					<Text style={styles.sortButton}>
						Price {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
					</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={() => handleSort('year')}>
					<Text style={styles.sortButton}>
						Year {sortBy === 'year' && (sortOrder === 'asc' ? '↑' : '↓')}
					</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={() => handleSort('listed_at')}>
					<Text style={styles.sortButton}>
						Date Listed{' '}
						{sortBy === 'listed_at' && (sortOrder === 'asc' ? '↑' : '↓')}
					</Text>
				</TouchableOpacity>
			</View>
			<FlatList
				data={cars}
				renderItem={renderCarItem}
				keyExtractor={item => item.id.toString()}
			/>
			<View style={styles.paginationContainer}>
				<TouchableOpacity
					onPress={() => handlePageChange(currentPage - 1)}
					disabled={currentPage === 1}>
					<Text
						style={[
							styles.paginationButton,
							currentPage === 1 && styles.disabledButton
						]}>
						Previous
					</Text>
				</TouchableOpacity>
				<Text style={styles.pageInfo}>
					Page {currentPage} of {totalPages}
				</Text>
				<TouchableOpacity
					onPress={() => handlePageChange(currentPage + 1)}
					disabled={currentPage === totalPages}>
					<Text
						style={[
							styles.paginationButton,
							currentPage === totalPages && styles.disabledButton
						]}>
						Next
					</Text>
				</TouchableOpacity>
			</View>
			<CarDetailModal
				isVisible={isModalVisible}
				car={selectedCar}
				onClose={() => setIsModalVisible(false)}
				onViewUpdate={handleViewUpdate}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 20,
		backgroundColor: '#f5f5f5'
	},
	searchInput: {
		backgroundColor: 'white',
		padding: 10,
		borderRadius: 5,
		marginBottom: 10
	},
	filtersContainer: {
		marginBottom: 10
	},
	picker: {
		backgroundColor: 'white',
		marginBottom: 5
	},
	sortContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 10
	},
	sortButton: {
		color: '#007AFF'
	},
	paginationContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginTop: 10
	},
	paginationButton: {
		color: '#007AFF',
		fontSize: 16
	},
	disabledButton: {
		color: '#999'
	},
	pageInfo: {
		fontSize: 16
	}
})
