import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	FlatList,
	TextInput,
	TouchableOpacity,
	Modal,
	StyleSheet,
	Image,
	ScrollView,
	Alert
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'

interface CarListing {
	id: number
	make: string
	model: string
	year: number
	price: number
	description: string
	images: string[]
	status: string
	views: number
	likes: number
	dealership_id: number
}

interface Dealership {
	id: number
	name: string
	user_id: string
}

const ITEMS_PER_PAGE = 10

const CustomDropdown = ({ options, value, onChange }: any) => {
	const [isOpen, setIsOpen] = useState(false)

	return (
		<View style={styles.dropdownContainer}>
			<TouchableOpacity
				onPress={() => setIsOpen(!isOpen)}
				style={styles.dropdownButton}>
				<Text>{value}</Text>
			</TouchableOpacity>
			{isOpen && (
				<View style={styles.dropdownList}>
					{options.map((option: any) => (
						<TouchableOpacity
							onPress={() => {
								onChange(option)
								setIsOpen(false)
							}}
							style={styles.dropdownItem}>
							<Text>{option}</Text>
						</TouchableOpacity>
					))}
				</View>
			)}
		</View>
	)
}

export default function DealerListings() {
	const { user } = useUser()
	const [dealership, setDealership] = useState<Dealership | null>(null)
	const [listings, setListings] = useState<CarListing[]>([])
	const [currentPage, setCurrentPage] = useState(1)
	const [totalPages, setTotalPages] = useState(1)
	const [sortBy, setSortBy] = useState('listed_at')
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
	const [filterStatus, setFilterStatus] = useState('all')
	const [searchQuery, setSearchQuery] = useState('')
	const [isModalVisible, setIsModalVisible] = useState(false)
	const [selectedListing, setSelectedListing] = useState<CarListing | null>(
		null
	)
	const [newListing, setNewListing] = useState<Partial<CarListing>>({})
	const [isSoldModalVisible, setIsSoldModalVisible] = useState(false)
	const [soldInfo, setSoldInfo] = useState({ price: '', date: '' })

	useEffect(() => {
		if (user) {
			fetchDealership()
		}
	}, [user])

	useEffect(() => {
		if (dealership) {
			fetchListings()
		}
	}, [dealership, currentPage, sortBy, sortOrder, filterStatus, searchQuery])

	const fetchDealership = async () => {
		if (!user) return

		const { data, error } = await supabase
			.from('dealerships')
			.select('*')
			.eq('user_id', user.id)
			.single()

		if (error) {
			console.error('Error fetching dealership:', error)
			Alert.alert('Error', 'Failed to fetch dealership information')
		} else if (data) {
			setDealership(data)
		} else {
			Alert.alert(
				'No Dealership',
				'You do not have a dealership associated with your account'
			)
		}
	}

	const fetchListings = async () => {
		if (!dealership) return

		let query = supabase
			.from('cars')
			.select('*', { count: 'exact' })
			.eq('dealership_id', dealership.id)
			.range(
				(currentPage - 1) * ITEMS_PER_PAGE,
				currentPage * ITEMS_PER_PAGE - 1
			)
			.order(sortBy, { ascending: sortOrder === 'asc' })

		if (filterStatus !== 'all') {
			query = query.eq('status', filterStatus)
		}

		if (searchQuery) {
			query = query.or(
				`make.ilike.%${searchQuery}%,model.ilike.%${searchQuery}%`
			)
		}

		const { data, count, error } = await query

		if (error) {
			console.error('Error fetching listings:', error)
			Alert.alert('Error', 'Failed to fetch car listings')
		} else {
			setListings(data || [])
			setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE))
		}
	}

	const handleCreateListing = async () => {
		if (!dealership) return

		const { data, error } = await supabase
			.from('cars')
			.insert({ ...newListing, dealership_id: dealership.id })

		if (error) {
			console.error('Error creating listing:', error)
			Alert.alert('Error', 'Failed to create new listing')
		} else {
			fetchListings()
			setIsModalVisible(false)
			setNewListing({})
		}
	}

	const handleUpdateListing = async () => {
		if (!selectedListing || !dealership) return

		const { error } = await supabase
			.from('cars')
			.update(selectedListing)
			.eq('id', selectedListing.id)
			.eq('dealership_id', dealership.id)

		if (error) {
			console.error('Error updating listing:', error)
			Alert.alert('Error', 'Failed to update listing')
		} else {
			fetchListings()
			setIsModalVisible(false)
		}
	}

	const handleDeleteListing = async (id: number) => {
		if (!dealership) return

		const { error } = await supabase
			.from('cars')
			.delete()
			.eq('id', id)
			.eq('dealership_id', dealership.id)

		if (error) {
			console.error('Error deleting listing:', error)
			Alert.alert('Error', 'Failed to delete listing')
		} else {
			fetchListings()
		}
	}

	const handleMarkAsSold = async () => {
		if (!selectedListing || !dealership) return

		const { error } = await supabase
			.from('cars')
			.update({
				status: 'sold',
				sold_price: parseInt(soldInfo.price),
				date_sold: soldInfo.date
			})
			.eq('id', selectedListing.id)
			.eq('dealership_id', dealership.id)

		if (error) {
			console.error('Error marking as sold:', error)
			Alert.alert('Error', 'Failed to mark listing as sold')
		} else {
			fetchListings()
			setIsSoldModalVisible(false)
			setSelectedListing(null)
			setSoldInfo({ price: '', date: '' })
		}
	}

	const renderListingItem = ({ item }: { item: CarListing }) => (
		<View style={styles.listingItem}>
			<TouchableOpacity
				onPress={() => {
					setSelectedListing(item)
					setIsModalVisible(true)
				}}>
				<Image source={{ uri: item.images[0] }} style={styles.listingImage} />
				<View style={styles.listingDetails}>
					<Text
						style={
							styles.listingTitle
						}>{`${item.year} ${item.make} ${item.model}`}</Text>
					<Text style={styles.listingPrice}>${item.price}</Text>
					<Text style={styles.listingStatus}>{item.status}</Text>
					<Text
						style={
							styles.listingStats
						}>{`Views: ${item.views} | Likes: ${item.likes}`}</Text>
				</View>
			</TouchableOpacity>
			<View style={styles.buttonContainer}>
				{item.status !== 'sold' && (
					<TouchableOpacity
						style={styles.soldButton}
						onPress={() => {
							setSelectedListing(item)
							setIsSoldModalVisible(true)
						}}>
						<Text style={styles.buttonText}>Mark as Sold</Text>
					</TouchableOpacity>
				)}
				<TouchableOpacity
					style={styles.deleteButton}
					onPress={() => handleDeleteListing(item.id)}>
					<Text style={styles.buttonText}>Delete</Text>
				</TouchableOpacity>
			</View>
		</View>
	)

	const SoldModal = () => (
		<Modal
			visible={isSoldModalVisible}
			animationType='slide'
			transparent={true}>
			<View style={styles.modalOverlay}>
				<View style={styles.modalContent}>
					<Text style={styles.modalTitle}>Mark as Sold</Text>
					<TextInput
						style={styles.input}
						placeholder='Sold Price'
						value={soldInfo.price}
						onChangeText={text => setSoldInfo({ ...soldInfo, price: text })}
						keyboardType='numeric'
					/>
					<TextInput
						style={styles.input}
						placeholder='Date Sold (YYYY-MM-DD)'
						value={soldInfo.date}
						onChangeText={text => setSoldInfo({ ...soldInfo, date: text })}
					/>
					<TouchableOpacity style={styles.button} onPress={handleMarkAsSold}>
						<Text style={styles.buttonText}>Confirm</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.button, styles.cancelButton]}
						onPress={() => setIsSoldModalVisible(false)}>
						<Text style={styles.buttonText}>Cancel</Text>
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	)

	const ListingModal = () => (
		<Modal visible={isModalVisible} animationType='slide'>
			<ScrollView contentContainerStyle={styles.modalContainer}>
				<Text style={styles.modalTitle}>
					{selectedListing ? 'Edit Listing' : 'Create New Listing'}
				</Text>
				<TextInput
					style={styles.input}
					placeholder='Make'
					value={selectedListing?.make || newListing.make}
					onChangeText={text =>
						selectedListing
							? setSelectedListing({ ...selectedListing, make: text })
							: setNewListing({ ...newListing, make: text })
					}
				/>
				<TextInput
					style={styles.input}
					placeholder='Model'
					value={selectedListing?.model || newListing.model}
					onChangeText={text =>
						selectedListing
							? setSelectedListing({ ...selectedListing, model: text })
							: setNewListing({ ...newListing, model: text })
					}
				/>
				<TextInput
					style={styles.input}
					placeholder='Year'
					value={(selectedListing?.year || newListing.year || '').toString()}
					onChangeText={text => {
						const year = parseInt(text)
						selectedListing
							? setSelectedListing({ ...selectedListing, year })
							: setNewListing({ ...newListing, year })
					}}
					keyboardType='numeric'
				/>
				<TextInput
					style={styles.input}
					placeholder='Price'
					value={(selectedListing?.price || newListing.price || '').toString()}
					onChangeText={text => {
						const price = parseInt(text)
						selectedListing
							? setSelectedListing({ ...selectedListing, price })
							: setNewListing({ ...newListing, price })
					}}
					keyboardType='numeric'
				/>
				<TextInput
					style={styles.input}
					placeholder='Description'
					value={selectedListing?.description || newListing.description}
					onChangeText={text =>
						selectedListing
							? setSelectedListing({ ...selectedListing, description: text })
							: setNewListing({ ...newListing, description: text })
					}
					multiline
				/>
				<CustomDropdown
					options={['available', 'sold', 'pending']}
					value={selectedListing?.status || newListing.status || 'available'}
					onChange={(value: any) =>
						selectedListing
							? setSelectedListing({ ...selectedListing, status: value })
							: setNewListing({ ...newListing, status: value })
					}
				/>
				<TouchableOpacity
					style={styles.button}
					onPress={selectedListing ? handleUpdateListing : handleCreateListing}>
					<Text style={styles.buttonText}>
						{selectedListing ? 'Update Listing' : 'Create Listing'}
					</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={[styles.button, styles.cancelButton]}
					onPress={() => setIsModalVisible(false)}>
					<Text style={styles.buttonText}>Cancel</Text>
				</TouchableOpacity>
			</ScrollView>
		</Modal>
	)

	if (!dealership) {
		return (
			<View style={styles.container}>
				<Text>Loading dealership information...</Text>
			</View>
		)
	}
	return (
		<View style={styles.container}>
			<Text style={styles.title}>{dealership.name} - Car Listings</Text>
			<View style={styles.searchContainer}>
				<TextInput
					style={styles.searchInput}
					placeholder='Search listings...'
					value={searchQuery}
					onChangeText={setSearchQuery}
				/>
				<TouchableOpacity style={styles.searchButton} onPress={fetchListings}>
					<Text style={styles.buttonText}>Search</Text>
				</TouchableOpacity>
			</View>
			<View style={styles.filterContainer}>
				<CustomDropdown
					options={['all', 'available', 'sold', 'pending']}
					value={filterStatus}
					onChange={setFilterStatus}
				/>
				<TouchableOpacity
					onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
					<Text style={styles.sortButton}>
						Sort: {sortBy} {sortOrder === 'asc' ? '↑' : '↓'}
					</Text>
				</TouchableOpacity>
			</View>
			<FlatList
				data={listings}
				renderItem={renderListingItem}
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
			<TouchableOpacity
				style={styles.createButton}
				onPress={() => {
					setSelectedListing(null)
					setIsModalVisible(true)
				}}>
				<Text style={styles.buttonText}>Create New Listing</Text>
			</TouchableOpacity>
			<SoldModal />
			<ListingModal />
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 20,
		backgroundColor: '#f5f5f5'
	},
	dropdownContainer: {
		marginBottom: 10,
		zIndex: 1000 // Ensure the dropdown is above other elements
	},
	dropdownButton: {
		backgroundColor: 'white',
		padding: 10,
		borderRadius: 5,
		borderWidth: 1,
		borderColor: 'gray'
	},
	dropdownList: {
		position: 'absolute',
		top: 40,
		left: 0,
		right: 0,
		backgroundColor: 'white',
		borderWidth: 1,
		borderColor: 'gray',
		borderRadius: 5,
		zIndex: 1001 // Ensure the list is above the button
	},
	dropdownItem: {
		padding: 10,
		borderBottomWidth: 1,
		borderBottomColor: '#eee'
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
		paddingHorizontal: 10,
		marginRight: 10
	},
	searchButton: {
		backgroundColor: '#007AFF',
		padding: 10,
		borderRadius: 5,
		justifyContent: 'center'
	},
	filterContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 10
	},
	filterPicker: {
		flex: 1,
		height: 40
	},
	sortButton: {
		color: '#007AFF'
	},
	listingItem: {
		flexDirection: 'row',
		backgroundColor: 'white',
		padding: 15,
		borderRadius: 5,
		marginBottom: 10
	},
	listingImage: {
		width: 80,
		height: 80,
		borderRadius: 5,
		marginRight: 10
	},
	listingDetails: {
		flex: 1
	},
	listingTitle: {
		fontSize: 18,
		fontWeight: 'bold'
	},
	listingPrice: {
		fontSize: 16,
		color: 'green'
	},
	listingStatus: {
		fontSize: 14,
		color: 'gray'
	},
	listingStats: {
		fontSize: 12,
		color: 'gray'
	},
	paginationContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginTop: 20
	},
	paginationButton: {
		color: '#007AFF'
	},
	createButton: {
		backgroundColor: '#4CAF50',
		padding: 15,
		borderRadius: 5,
		alignItems: 'center',
		marginTop: 20
	},
	modalContainer: {
		flex: 1,
		padding: 20,
		backgroundColor: 'white'
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

	deleteButtonText: {
		color: 'white',
		fontWeight: 'bold'
	},
	buttonContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 10
	},
	soldButton: {
		backgroundColor: '#4CAF50',
		padding: 5,
		borderRadius: 5,
		flex: 1,
		marginRight: 5
	},
	deleteButton: {
		backgroundColor: '#FF3B30',
		padding: 5,
		borderRadius: 5,
		flex: 1,
		marginLeft: 5
	},
	buttonText: {
		color: 'white',
		fontWeight: 'bold',
		textAlign: 'center'
	},
	modalOverlay: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.5)'
	},
	modalContent: {
		backgroundColor: 'white',
		padding: 20,
		borderRadius: 10,
		width: '80%'
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		marginBottom: 15
	}
})
