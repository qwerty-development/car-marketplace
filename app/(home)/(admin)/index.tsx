import React, { useState, useEffect, useCallback } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	FlatList,
	ActivityIndicator,
	Alert,
	Image,
	RefreshControl,
	StatusBar
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { Ionicons, FontAwesome } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Dropdown } from 'react-native-element-dropdown'
import ListingModal from '@/components/ListingModal'
import { LinearGradient } from 'expo-linear-gradient'
import SortPicker from '@/components/SortPicker'

const ITEMS_PER_PAGE = 10

const CustomHeader = ({ title }: any) => {
	const { isDarkMode } = useTheme()
	return (
		<SafeAreaView
			edges={['top']}
			className={`bg-${isDarkMode ? 'black' : 'white'}`}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View className='flex-row items-center border-b border-red justify-center pb-2'>
				<Text className='text-xl font-semibold text-red'>{title}</Text>
			</View>
		</SafeAreaView>
	)
}

export default function AdminBrowseScreen() {
	const { isDarkMode } = useTheme()
	const [listings, setListings] = useState<any>([])
	const [isLoading, setIsLoading] = useState<any>(true)
	const [sortBy, setSortBy] = useState<any>('listed_at')
	const [sortOrder, setSortOrder] = useState<any>('desc')
	const [filterStatus, setFilterStatus] = useState<any>('all')
	const [isListingModalVisible, setIsListingModalVisible] = useState<any>(false)
	const [selectedListing, setSelectedListing] = useState<any>(null)
	const [dealerships, setDealerships] = useState<any>([])
	const [selectedDealership, setSelectedDealership] = useState<any>(null)
	const [refreshing, setRefreshing] = useState<any>(false)
	const [currentPage, setCurrentPage] = useState<any>(1)
	const [totalPages, setTotalPages] = useState<any>(1)

	useEffect(() => {
		fetchDealerships()
	}, [])

	useEffect(() => {
		fetchListings()
	}, [sortBy, sortOrder, filterStatus, selectedDealership, currentPage])

	const fetchDealerships = async () => {
		try {
			const { data, error } = await supabase.from('dealerships').select('*')
			if (error) throw error
			setDealerships(data)
		} catch (error) {
			console.error('Error fetching dealerships:', error)
			Alert.alert('Error', 'Failed to fetch dealerships')
		}
	}

	const fetchListings = async () => {
		setIsLoading(true)
		try {
			let query = supabase
				.from('cars')
				.select('*', { count: 'exact' })
				.order(sortBy, { ascending: sortOrder === 'asc' })

			if (selectedDealership) {
				query = query.eq('dealership_id', selectedDealership.id)
			}

			if (filterStatus !== 'all') {
				query = query.eq('status', filterStatus)
			}

			const { data, count, error } = await query.range(
				(currentPage - 1) * ITEMS_PER_PAGE,
				currentPage * ITEMS_PER_PAGE - 1
			)

			if (error) throw error

			setListings(data)
			setTotalPages(Math.ceil(count! / ITEMS_PER_PAGE))
		} catch (error) {
			console.error('Error fetching listings:', error)
			Alert.alert('Error', 'Failed to fetch listings')
		} finally {
			setIsLoading(false)
			setRefreshing(false)
		}
	}

	const handleDeleteListing = async (id: any) => {
		Alert.alert(
			'Delete Listing',
			'Are you sure you want to delete this listing?',
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Delete',
					onPress: async () => {
						try {
							const { error } = await supabase
								.from('cars')
								.delete()
								.eq('id', id)
							if (error) throw error
							fetchListings()
							Alert.alert('Success', 'Listing deleted successfully')
						} catch (error) {
							console.error('Error deleting listing:', error)
							Alert.alert('Error', 'Failed to delete listing')
						}
					},
					style: 'destructive'
				}
			]
		)
	}

	const handleEditListing = (listing: any) => {
		setSelectedListing(listing)
		setIsListingModalVisible(true)
	}

	const handleSubmitListing = async (formData: any) => {
		try {
			const { error } = await supabase
				.from('cars')
				.update(formData)
				.eq('id', selectedListing.id)
			if (error) throw error
			fetchListings()
			setIsListingModalVisible(false)
			setSelectedListing(null)
			Alert.alert('Success', 'Listing updated successfully')
		} catch (error) {
			console.error('Error updating listing:', error)
			Alert.alert('Error', 'Failed to update listing')
		}
	}

	const onRefresh = useCallback(() => {
		setRefreshing(true)
		setCurrentPage(1)
		fetchListings()
	}, [])

	const handleSortChange = useCallback(
		(value: { split: (arg0: string) => [any, any] }) => {
			const [newSortBy, newSortOrder] = value.split('_')
			setSortBy(newSortBy === 'date' ? 'listed_at' : newSortBy)
			setSortOrder(newSortOrder)
			setCurrentPage(1)
		},
		[]
	)

	const renderListingItem = ({ item }: any) => (
		<View
			className={`bg-${
				isDarkMode ? 'gray' : 'white'
			} rounded-lg shadow-md mb-4 overflow-hidden`}>
			<Image
				source={{ uri: item.images[0] }}
				className='w-full h-48 object-cover'
			/>
			<View className='p-4'>
				<Text
					className={`text-lg font-bold ${
						isDarkMode ? 'text-white' : 'text-black'
					}`}>
					{item.year} {item.make} {item.model}
				</Text>
				<Text className='text-red text-xl font-semibold mt-1'>
					${item.price.toLocaleString()}
				</Text>
				<Text className={`${isDarkMode ? 'text-white' : 'text-gray'} mt-1`}>
					Status: {item.status}
				</Text>
				<Text className={`${isDarkMode ? 'text-white' : 'text-gray'} mt-1`}>
					Views: {item.views} | Likes: {item.likes}
				</Text>
				<View className='flex-row justify-between mt-4'>
					<TouchableOpacity
						onPress={() => handleEditListing(item)}
						className='bg-blue-500 px-4 py-2 rounded-full flex-row items-center'>
						<FontAwesome name='edit' size={16} color='white' />
						<Text className='text-white ml-2'>Edit</Text>
					</TouchableOpacity>
					<TouchableOpacity
						onPress={() => handleDeleteListing(item.id)}
						className='bg-rose-500 px-4 py-2 rounded-full flex-row items-center'>
						<FontAwesome name='trash' size={16} color='white' />
						<Text className='text-white ml-2'>Delete</Text>
					</TouchableOpacity>
				</View>
			</View>
		</View>
	)

	return (
		<LinearGradient
			colors={isDarkMode ? ['#1A1A1A', '#2D2D2D'] : ['#F5F5F5', '#E0E0E0']}
			className='flex-1'>
			<CustomHeader title='Manage Listings' />
			<View className='flex-1 px-4 pt-4'>
				<View className='mb-4'>
					<Dropdown
						style={[
							styles.dropdown,
							{ backgroundColor: isDarkMode ? '#333' : 'white' }
						]}
						placeholderStyle={styles.placeholderStyle}
						selectedTextStyle={styles.selectedTextStyle}
						inputSearchStyle={styles.inputSearchStyle}
						data={[
							{ label: 'All Dealerships', value: null },
							...dealerships.map((d: { name: any; id: any }) => ({
								label: d.name,
								value: d.id
							}))
						]}
						search
						maxHeight={300}
						labelField='label'
						valueField='value'
						placeholder='Select Dealership'
						searchPlaceholder='Search...'
						value={selectedDealership?.id}
						onChange={item => {
							setSelectedDealership(
								dealerships.find((d: { id: any }) => d.id === item.value) ||
									null
							)
							setCurrentPage(1)
						}}
					/>
				</View>

				<View className='flex-row justify-between mb-4'>
					<Dropdown
						style={[
							styles.dropdown,

							{ backgroundColor: isDarkMode ? '#333' : 'white' }
						]}
						placeholderStyle={styles.placeholderStyle}
						selectedTextStyle={styles.selectedTextStyle}
						inputSearchStyle={styles.inputSearchStyle}
						data={[
							{ label: 'All', value: 'all' },
							{ label: 'Available', value: 'available' },
							{ label: 'Pending', value: 'pending' },
							{ label: 'Sold', value: 'sold' }
						]}
						maxHeight={300}
						labelField='label'
						valueField='value'
						placeholder='Filter Status'
						value={filterStatus}
						onChange={item => {
							setFilterStatus(item.value)
							setCurrentPage(1)
						}}
					/>

					<View className='mt-3'>
						<SortPicker
							onValueChange={handleSortChange}
							initialValue={{ label: 'Newest', value: 'listed_at_desc' }}
						/>
					</View>
				</View>

				<FlatList
					data={listings}
					renderItem={renderListingItem}
					keyExtractor={item => item.id.toString()}
					ListEmptyComponent={
						<Text
							className={`text-center mt-4 ${
								isDarkMode ? 'text-white' : 'text-black'
							}`}>
							No listings found
						</Text>
					}
					refreshControl={
						<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
					}
					ListFooterComponent={() =>
						isLoading ? (
							<ActivityIndicator
								size='large'
								color='#D55004'
								style={{ marginVertical: 20 }}
							/>
						) : null
					}
				/>

				<View className='flex-row justify-between items-center mt-4 mb-4'>
					<TouchableOpacity
						onPress={() =>
							setCurrentPage((prev: number) => Math.max(1, prev - 1))
						}
						disabled={currentPage === 1}
						className={`px-4 py-2 rounded ${
							currentPage === 1 ? 'bg-gray' : 'bg-blue-500'
						}`}>
						<Text
							className={`${currentPage === 1 ? 'text-white' : 'text-white'}`}>
							Previous
						</Text>
					</TouchableOpacity>
					<Text className={isDarkMode ? 'text-white' : 'text-black'}>
						Page {currentPage} of {totalPages}
					</Text>
					<TouchableOpacity
						onPress={() =>
							setCurrentPage((prev: number) => Math.min(totalPages, prev + 1))
						}
						disabled={currentPage === totalPages}
						className={`px-4 py-2 rounded ${
							currentPage === totalPages ? 'bg-gray' : 'bg-blue-500'
						}`}>
						<Text
							className={`${
								currentPage === totalPages ? 'text-white' : 'text-white'
							}`}>
							Next
						</Text>
					</TouchableOpacity>
				</View>
			</View>

			<ListingModal
				isVisible={isListingModalVisible}
				onClose={() => {
					setIsListingModalVisible(false)
					setSelectedListing(null)
				}}
				onSubmit={handleSubmitListing}
				initialData={selectedListing}
				dealership={selectedDealership}
			/>
		</LinearGradient>
	)
}

const styles = {
	dropdown: {
		height: 50,
		borderColor: '#D55004',
		borderWidth: 0.5,
		borderRadius: 8,
		paddingHorizontal: 8,
		marginBottom: 10
	},
	halfWidth: {
		width: '48%'
	},
	placeholderStyle: {
		fontSize: 16,
		color: '#9CA3AF'
	},
	selectedTextStyle: {
		fontSize: 16,
		color: '#D55004'
	},
	inputSearchStyle: {
		height: 40,
		fontSize: 16,
		borderColor: '#D55004'
	}
}
