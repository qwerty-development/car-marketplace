import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	FlatList,
	Image,
	TouchableOpacity,
	StyleSheet,
	Modal,
	TextInput,
	Alert
} from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/components/CarDetailModal'

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
	const [selectedDealership, setSelectedDealership] =
		useState<Dealership | null>(null)
	const [cars, setCars] = useState<Car[]>([])
	const [currentPage, setCurrentPage] = useState(1)
	const [totalPages, setTotalPages] = useState(1)
	const [searchQuery, setSearchQuery] = useState('')
	const [sortBy, setSortBy] = useState('listed_at')
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
	const [filterMake, setFilterMake] = useState('')
	const [filterModel, setFilterModel] = useState('')
	const [makes, setMakes] = useState<string[]>([])
	const [models, setModels] = useState<string[]>([])
	const [selectedCar, setSelectedCar] = useState<Car | null>(null)
	const [isCarModalVisible, setIsCarModalVisible] = useState(false)

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
		searchQuery
	])

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

	const handleDealershipPress = (dealership: Dealership) => {
		setSelectedDealership(dealership)
		setCurrentPage(1)
		setSearchQuery('')
		setFilterMake('')
		setFilterModel('')
		setSortBy('listed_at')
		setSortOrder('desc')
	}

	const handleCarPress = (car: Car) => {
		setSelectedCar(car)
		setIsCarModalVisible(true)
	}

	const handleSearch = (text: string) => {
		setSearchQuery(text)
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

	const renderDealershipItem = ({ item }: { item: Dealership }) => (
		<TouchableOpacity
			style={styles.dealershipItem}
			onPress={() => handleDealershipPress(item)}>
			<Image source={{ uri: item.logo }} style={styles.dealershipLogo} />
			<Text style={styles.dealershipName}>{item.name}</Text>
		</TouchableOpacity>
	)

	const renderCarItem = ({ item }: { item: Car }) => (
		<CarCard car={item} onPress={() => handleCarPress(item)} />
	)

	return (
		<View style={styles.container}>
			{!selectedDealership ? (
				<FlatList
					data={dealerships}
					renderItem={renderDealershipItem}
					keyExtractor={item => item.id.toString()}
					numColumns={2}
				/>
			) : (
				<View style={styles.carListContainer}>
					<TouchableOpacity
						style={styles.backButton}
						onPress={() => setSelectedDealership(null)}>
						<Text style={styles.backButtonText}>← Back to Dealerships</Text>
					</TouchableOpacity>
					<Text style={styles.dealershipTitle}>{selectedDealership.name}</Text>
					<TextInput
						style={styles.searchInput}
						placeholder='Search cars...'
						value={searchQuery}
						onChangeText={handleSearch}
					/>
					<View style={styles.filtersContainer}>
						<Picker
							selectedValue={filterMake}
							onValueChange={handleMakeFilter}
							style={styles.picker}>
							<Picker.Item label='All Makes' value='' />
							{makes.map((make, index) => (
								<Picker.Item
									key={`${make}-${index}`}
									label={make}
									value={make}
								/>
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

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 20,
		backgroundColor: '#f5f5f5'
	},
	dealershipItem: {
		flex: 1,
		alignItems: 'center',
		margin: 10,
		padding: 10,
		backgroundColor: 'white',
		borderRadius: 10,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3
	},
	dealershipLogo: {
		width: 100,
		height: 100,
		resizeMode: 'contain'
	},
	dealershipName: {
		marginTop: 10,
		fontSize: 16,
		fontWeight: 'bold',
		textAlign: 'center'
	},
	carListContainer: {
		flex: 1
	},
	backButton: {
		marginBottom: 10
	},
	backButtonText: {
		fontSize: 16,
		color: '#007AFF'
	},
	dealershipTitle: {
		fontSize: 24,
		fontWeight: 'bold',
		marginBottom: 10
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
