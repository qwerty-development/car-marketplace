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
import { Ionicons } from '@expo/vector-icons'

interface Listing {
	id: number
	make: string
	model: string
	year: number
	price: number
	status: string
	dealership_id: number
	dealership_name: string
}

const ITEMS_PER_PAGE = 10

export default function AdminListingsPage() {
	const [listings, setListings] = useState<Listing[]>([])
	const [currentPage, setCurrentPage] = useState(1)
	const [totalPages, setTotalPages] = useState(1)
	const [searchQuery, setSearchQuery] = useState('')
	const [sortBy, setSortBy] = useState('listed_at')
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
	const [filterDealership, setFilterDealership] = useState('')
	const [filterMake, setFilterMake] = useState('')
	const [filterModel, setFilterModel] = useState('')
	const [dealerships, setDealerships] = useState<
		{ id: number; name: string }[]
	>([])
	const [makes, setMakes] = useState<string[]>([])
	const [models, setModels] = useState<string[]>([])

	useEffect(() => {
		fetchListings()
		fetchDealerships()
		fetchMakes()
	}, [
		currentPage,
		sortBy,
		sortOrder,
		filterDealership,
		filterMake,
		filterModel,
		searchQuery
	])
	const fetchListings = async () => {
		let query = supabase
			.from('cars')
			.select(
				`
      *,
      dealerships (name)
    `,
				{ count: 'exact' }
			)
			.range(
				(currentPage - 1) * ITEMS_PER_PAGE,
				currentPage * ITEMS_PER_PAGE - 1
			)
			.order(sortBy, { ascending: sortOrder === 'asc' })

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

		const { data, count, error } = await query

		if (error) {
			console.error('Error fetching listings:', error)
			Alert.alert('Error', 'Failed to fetch listings')
		} else {
			setListings(
				data?.map(item => ({
					...item,
					dealership_name: item.dealerships.name
				})) || []
			)
			setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE))
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
	const handleDeleteListing = async (id: number) => {
		const { error } = await supabase.from('cars').delete().eq('id', id)
		if (error) {
			console.error('Error deleting listing:', error)
			Alert.alert('Error', 'Failed to delete listing')
		} else {
			Alert.alert('Success', 'Listing deleted successfully')
			fetchListings()
		}
	}

	const renderListingItem = ({ item }: { item: Listing }) => (
		<View style={styles.listingItem}>
			<Text style={styles.listingTitle}>
				{item.year} {item.make} {item.model}
			</Text>
			<Text>Price: ${item.price}</Text>
			<Text>Status: {item.status}</Text>
			<Text>Dealership: {item.dealership_name}</Text>
			<TouchableOpacity
				style={styles.deleteButton}
				onPress={() => handleDeleteListing(item.id)}>
				<Text style={styles.deleteButtonText}>Delete</Text>
			</TouchableOpacity>
		</View>
	)

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Admin Listings</Text>

			<View style={styles.searchContainer}>
				<TextInput
					style={styles.searchInput}
					placeholder='Search listings...'
					value={searchQuery}
					onChangeText={setSearchQuery}
				/>
				<TouchableOpacity style={styles.searchButton} onPress={fetchListings}>
					<Ionicons name='search' size={24} color='white' />
				</TouchableOpacity>
			</View>

			<View style={styles.filterContainer}>
				<Picker
					selectedValue={filterDealership}
					onValueChange={itemValue => setFilterDealership(itemValue)}
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
					onValueChange={itemValue => {
						setFilterMake(itemValue)
						fetchModels(itemValue)
					}}
					style={styles.picker}>
					<Picker.Item label='All Makes' value='' />
					{makes.map(make => (
						<Picker.Item key={make} label={make} value={make} />
					))}
				</Picker>

				<Picker
					selectedValue={filterModel}
					onValueChange={itemValue => setFilterModel(itemValue)}
					style={styles.picker}>
					<Picker.Item label='All Models' value='' />
					{models.map(model => (
						<Picker.Item key={model} label={model} value={model} />
					))}
				</Picker>
			</View>

			<View style={styles.sortContainer}>
				<TouchableOpacity onPress={() => setSortBy('listed_at')}>
					<Text style={styles.sortButton}>
						Sort by Date{' '}
						{sortBy === 'listed_at' && (sortOrder === 'asc' ? '↑' : '↓')}
					</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={() => setSortBy('price')}>
					<Text style={styles.sortButton}>
						Sort by Price{' '}
						{sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
					</Text>
				</TouchableOpacity>
				<TouchableOpacity
					onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
					<Text style={styles.sortButton}>Toggle Order</Text>
				</TouchableOpacity>
			</View>

			<FlatList
				data={listings}
				renderItem={renderListingItem}
				keyExtractor={item => {
					const id = item.id?.toString() || ''
					const make = item.make || ''
					const model = item.model || ''
					return `${id}-${make}-${model}-${Math.random()}`
				}}
			/>

			<View style={styles.paginationContainer}>
				<TouchableOpacity
					onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}>
					<Text style={styles.paginationButton}>Previous</Text>
				</TouchableOpacity>
				<Text>{`Page ${currentPage} of ${totalPages}`}</Text>
				<TouchableOpacity
					onPress={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}>
					<Text style={styles.paginationButton}>Next</Text>
				</TouchableOpacity>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 20,
		backgroundColor: '#f5f5f5'
	},
	title: {
		fontSize: 24,
		fontWeight: 'bold',
		marginBottom: 20
	},
	searchContainer: {
		flexDirection: 'row',
		marginBottom: 10
	},
	searchInput: {
		flex: 1,
		height: 40,
		borderColor: 'gray',
		borderWidth: 1,
		borderRadius: 5,
		paddingHorizontal: 10
	},
	searchButton: {
		backgroundColor: '#007AFF',
		padding: 10,
		borderRadius: 5,
		marginLeft: 10
	},
	filterContainer: {
		marginBottom: 10
	},
	picker: {
		height: 50,
		width: '100%'
	},
	sortContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 10
	},
	sortButton: {
		color: '#007AFF'
	},
	listingItem: {
		backgroundColor: 'white',
		padding: 15,
		borderRadius: 5,
		marginBottom: 10
	},
	listingTitle: {
		fontSize: 18,
		fontWeight: 'bold'
	},
	deleteButton: {
		backgroundColor: '#FF3B30',
		padding: 5,
		borderRadius: 5,
		alignSelf: 'flex-start',
		marginTop: 5
	},
	deleteButtonText: {
		color: 'white',
		fontWeight: 'bold'
	},
	paginationContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginTop: 20
	},
	paginationButton: {
		color: '#007AFF'
	}
})
