import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	FlatList,
	TextInput,
	TouchableOpacity,
	Modal,
	StyleSheet,
	ScrollView
} from 'react-native'
import { supabase } from '@/utils/supabase'

interface Dealership {
	id: number
	user_id: string
	user_name: string
	name: string
	location: string
	phone: string
	subscription_end_date: string
	cars_listed: number
}

const ITEMS_PER_PAGE = 10

export default function DealershipManagement() {
	const [dealerships, setDealerships] = useState<Dealership[]>([])
	const [searchQuery, setSearchQuery] = useState('')
	const [currentPage, setCurrentPage] = useState(1)
	const [totalPages, setTotalPages] = useState(1)
	const [sortBy, setSortBy] = useState('name')
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
	const [selectedDealership, setSelectedDealership] =
		useState<Dealership | null>(null)
	const [isModalVisible, setIsModalVisible] = useState(false)
	const [editedDealership, setEditedDealership] = useState<Dealership | null>(
		null
	)

	useEffect(() => {
		fetchDealerships()
	}, [currentPage, sortBy, sortOrder])

	const fetchDealerships = async () => {
		let query = supabase
			.from('dealerships')
			.select(
				`
        *,
        users:user_id (name),
        cars:id (count)
      `,
				{ count: 'exact' }
			)
			.range(
				(currentPage - 1) * ITEMS_PER_PAGE,
				currentPage * ITEMS_PER_PAGE - 1
			)
			.order(sortBy, { ascending: sortOrder === 'asc' })

		if (searchQuery) {
			query = query.or(
				`name.ilike.%${searchQuery}%,location.ilike.%${searchQuery}%`
			)
		}

		const { data, count, error } = await query

		if (error) {
			console.error('Error fetching dealerships:', error)
		} else {
			const dealershipsWithCars =
				data?.map(d => ({
					...d,
					user_name: d.users.name,
					cars_listed: d.cars[0].count
				})) || []
			setDealerships(dealershipsWithCars)
			setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE))
		}
	}

	const handleSearch = () => {
		setCurrentPage(1)
		fetchDealerships()
	}

	const handleSort = (column: string) => {
		if (sortBy === column) {
			setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
		} else {
			setSortBy(column)
			setSortOrder('asc')
		}
	}

	const handleUpdateDealership = async () => {
		if (!editedDealership) return

		const { error } = await supabase
			.from('dealerships')
			.update({
				name: editedDealership.name,
				location: editedDealership.location,
				phone: editedDealership.phone,
				subscription_end_date: editedDealership.subscription_end_date
			})
			.eq('id', editedDealership.id)

		if (error) {
			console.error('Error updating dealership:', error)
		} else {
			fetchDealerships()
			setIsModalVisible(false)
		}
	}

	const renderDealershipItem = ({ item }: { item: Dealership }) => (
		<TouchableOpacity
			onPress={() => {
				setSelectedDealership(item)
				setEditedDealership(item)
				setIsModalVisible(true)
			}}>
			<View style={styles.dealershipItem}>
				<Text style={styles.dealershipName}>{item.name}</Text>
				<Text>Owner: {item.user_name}</Text>
				<Text>Location: {item.location}</Text>
				<Text>Cars Listed: {item.cars_listed}</Text>
				<Text>Phone: {item.phone}</Text>
				<Text>Subscription End: {item.subscription_end_date}</Text>
			</View>
		</TouchableOpacity>
	)

	const DealershipModal = () => (
		<Modal visible={isModalVisible} animationType='slide'>
			<ScrollView contentContainerStyle={styles.modalContainer}>
				<Text style={styles.modalTitle}>Edit Dealership</Text>
				<Text>Owner: {selectedDealership?.user_name}</Text>
				<TextInput
					style={styles.input}
					value={editedDealership?.name}
					onChangeText={text =>
						setEditedDealership(prev => ({ ...prev!, name: text }))
					}
					placeholder='Dealership Name'
				/>
				<TextInput
					style={styles.input}
					value={editedDealership?.location}
					onChangeText={text =>
						setEditedDealership(prev => ({ ...prev!, location: text }))
					}
					placeholder='Location'
				/>
				<TextInput
					style={styles.input}
					value={editedDealership?.phone?.toString()}
					onChangeText={text =>
						setEditedDealership(prev => ({ ...prev!, phone: text }))
					}
					placeholder='Phone'
					keyboardType='phone-pad'
				/>
				<TextInput
					style={styles.input}
					value={editedDealership?.subscription_end_date}
					onChangeText={text =>
						setEditedDealership(prev => ({
							...prev!,
							subscription_end_date: text
						}))
					}
					placeholder='Subscription End Date (YYYY-MM-DD)'
				/>
				<TouchableOpacity
					style={styles.button}
					onPress={handleUpdateDealership}>
					<Text style={styles.buttonText}>Update Dealership</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={[styles.button, styles.cancelButton]}
					onPress={() => setIsModalVisible(false)}>
					<Text style={styles.buttonText}>Cancel</Text>
				</TouchableOpacity>
			</ScrollView>
		</Modal>
	)

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Dealership Management</Text>
			<View style={styles.searchContainer}>
				<TextInput
					style={styles.searchInput}
					placeholder='Search dealerships...'
					value={searchQuery}
					onChangeText={setSearchQuery}
					onSubmitEditing={handleSearch}
				/>
				<TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
					<Text style={styles.buttonText}>Search</Text>
				</TouchableOpacity>
			</View>
			<View style={styles.sortContainer}>
				<Text>Sort by: </Text>
				<TouchableOpacity onPress={() => handleSort('name')}>
					<Text
						style={[
							styles.sortButton,
							sortBy === 'name' && styles.activeSortButton
						]}>
						Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
					</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={() => handleSort('location')}>
					<Text
						style={[
							styles.sortButton,
							sortBy === 'location' && styles.activeSortButton
						]}>
						Location{' '}
						{sortBy === 'location' && (sortOrder === 'asc' ? '↑' : '↓')}
					</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={() => handleSort('subscription_end_date')}>
					<Text
						style={[
							styles.sortButton,
							sortBy === 'subscription_end_date' && styles.activeSortButton
						]}>
						Subscription{' '}
						{sortBy === 'subscription_end_date' &&
							(sortOrder === 'asc' ? '↑' : '↓')}
					</Text>
				</TouchableOpacity>
			</View>
			<FlatList
				data={dealerships}
				renderItem={renderDealershipItem}
				keyExtractor={item => item.id.toString()}
			/>
			<View style={styles.paginationContainer}>
				<TouchableOpacity
					onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
					disabled={currentPage === 1}>
					<Text style={styles.paginationButton}>Previous</Text>
				</TouchableOpacity>
				<Text>{`Page ${currentPage} of ${totalPages}`}</Text>
				<TouchableOpacity
					onPress={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
					disabled={currentPage === totalPages}>
					<Text style={styles.paginationButton}>Next</Text>
				</TouchableOpacity>
			</View>
			<DealershipModal />
		</View>
	)
}

// ... (styles remain the same)
// ... (styles remain the same as in the previous version)

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

	sortContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 10
	},
	sortButton: {
		marginLeft: 10,
		color: '#007AFF'
	},
	activeSortButton: {
		fontWeight: 'bold'
	},
	dealershipItem: {
		backgroundColor: 'white',
		padding: 15,
		borderRadius: 5,
		marginBottom: 10
	},
	dealershipName: {
		fontSize: 18,
		fontWeight: 'bold'
	},
	paginationContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginTop: 20
	},
	paginationButton: {
		color: '#007AFF',
		fontSize: 16
	},
	modalContainer: {
		padding: 20,
		backgroundColor: 'white'
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		marginBottom: 20
	},
	input: {
		height: 40,
		borderColor: 'gray',
		borderWidth: 1,
		borderRadius: 5,
		paddingHorizontal: 10,
		marginBottom: 10
	},
	button: {
		backgroundColor: '#007AFF',
		padding: 15,
		borderRadius: 5,
		alignItems: 'center',
		marginTop: 10
	},
	cancelButton: {
		backgroundColor: '#FF3B30'
	},
	buttonText: {
		color: 'white',
		fontWeight: 'bold'
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
		paddingHorizontal: 10,
		marginRight: 10
	},
	searchButton: {
		backgroundColor: '#007AFF',
		padding: 10,
		borderRadius: 5,
		justifyContent: 'center'
	}
})
