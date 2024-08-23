import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	FlatList,
	Image,
	TouchableOpacity,
	Modal,
	TextInput,
	ScrollView,
	Alert
} from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
import { styled } from 'nativewind'
import { FontAwesome } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { ActivityIndicator } from 'react-native'
import * as FileSystem from 'expo-file-system'
import { decode } from 'base-64'
import { Buffer } from 'buffer'
import DraggableFlatList from 'react-native-draggable-flatlist'
import ListingModal from '@/components/ListingModal'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
if (!global.atob) {
	global.atob = decode
}

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledTextInput = styled(TextInput)
const StyledImage = styled(Image)
const StyledPicker = styled(Picker)

interface CarListing {
	id: number
	make: string
	model: string
	year: number
	price: number
	description: string
	images: string[]
	views: number
	likes: number
	dealership_id: number
	condition: 'New' | 'Used'
	color: string
	transmission: 'Manual' | 'Automatic'
	drivetrain: 'FWD' | 'RWD' | 'AWD' | '4WD' | '4x4'
	mileage: number
	status: 'available' | 'pending' | 'sold'
}

interface Dealership {
	id: number
	name: string
	user_id: string
}

const ITEMS_PER_PAGE = 10

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
	const [selectedListing, setSelectedListing] = useState<CarListing | null>(
		null
	)
	const [newListing, setNewListing] = useState<Partial<CarListing>>({})
	const [isListingModalVisible, setIsListingModalVisible] = useState(false)
	const [isSoldModalVisible, setIsSoldModalVisible] = useState(false)
	const [soldInfo, setSoldInfo] = useState({ price: '', date: '' })
	const [error, setError] = useState<string | null>(null)

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
			setError('Failed to fetch dealership information')
		} else if (data) {
			setDealership(data)
		} else {
			setError('You do not have a dealership associated with your account')
		}
	}

	const handleDeleteListing = async (id: number) => {
		if (!dealership) return

		try {
			// First, fetch the listing to get the image URLs
			const { data: listing, error: fetchError } = await supabase
				.from('cars')
				.select('images')
				.eq('id', id)
				.eq('dealership_id', dealership.id)
				.single()

			if (fetchError) {
				console.error('Error fetching listing:', fetchError)
				throw fetchError
			}

			if (listing && listing.images && listing.images.length > 0) {
				// Delete images from storage
				const imagePaths = listing.images.map((url: string) => {
					const urlParts = url.split('/')
					return urlParts.slice(urlParts.indexOf('cars') + 1).join('/')
				})

				const { error: storageError } = await supabase.storage
					.from('cars')
					.remove(imagePaths)

				if (storageError) {
					console.error('Error deleting images from storage:', storageError)
					// Continue with listing deletion even if image deletion fails
				}
			}

			// Delete the listing from the database
			const { error: deleteError } = await supabase
				.from('cars')
				.delete()
				.eq('id', id)
				.eq('dealership_id', dealership.id)

			if (deleteError) {
				console.error('Error deleting listing:', deleteError)
				throw deleteError
			}

			console.log('Listing and associated images deleted successfully')
			fetchListings()
		} catch (error) {
			console.error('Error in handleDeleteListing:', error)
			setError('Failed to delete listing: ' + (error as Error).message)
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
			setError('Failed to fetch car listings')
		} else {
			setListings(data || [])
			setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE))
		}
	}

	const handleSubmitListing = async (formData: Partial<CarListing>) => {
		if (!dealership) return

		try {
			if (selectedListing) {
				// Update existing listing
				const { error } = await supabase
					.from('cars')
					.update(formData)
					.eq('id', selectedListing.id)
					.eq('dealership_id', dealership.id)

				if (error) throw error

				Alert.alert('Success', 'Listing updated successfully')
			} else {
				// Create new listing
				const { error } = await supabase.from('cars').insert({
					...formData,
					dealership_id: dealership.id,
					viewed_users: [],
					liked_users: []
				})

				if (error) throw error

				Alert.alert('Success', 'New listing created successfully')
			}

			fetchListings()
			setIsListingModalVisible(false)
			setSelectedListing(null)
		} catch (error) {
			console.error('Error submitting listing:', error)
			Alert.alert('Error', 'Failed to submit listing. Please try again.')
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
			setError('Failed to mark listing as sold')
		} else {
			fetchListings()
			setIsSoldModalVisible(false)
			setSelectedListing(null)
			setSoldInfo({ price: '', date: '' })
		}
	}

	const ListingCard = ({ item }: { item: CarListing }) => (
		<StyledView className='bg-white rounded-lg shadow-md mb-4 overflow-hidden'>
			<StyledImage
				source={{ uri: item.images?.[0] || 'default_image_url' }}
				className='w-full h-48'
			/>
			<StyledView className='p-4'>
				<StyledText className='text-xl font-bold mb-2'>{`${
					item.year || 'N/A'
				} ${item.make || 'N/A'} ${item.model || 'N/A'}`}</StyledText>
				<StyledText className='text-xl text-red mb-2'>
					${item.price != null ? item.price.toLocaleString() : 'N/A'}
				</StyledText>
				<StyledText className='text-sm text-gray-600 mb-1'>
					Condition: {item.condition || 'N/A'}
				</StyledText>
				<StyledText className='text-sm text-gray-600 mb-1'>
					Color: {item.color || 'N/A'}
				</StyledText>
				<StyledText className='text-sm text-gray-600 mb-1'>
					Transmission: {item.transmission || 'N/A'}
				</StyledText>
				<StyledText className='text-sm text-gray-600 mb-1'>
					Drivetrain: {item.drivetrain || 'N/A'}
				</StyledText>
				<StyledText className='text-sm text-gray-600 mb-1'>
					Mileage:{' '}
					{item.mileage != null ? item.mileage.toLocaleString() : 'N/A'} miles
				</StyledText>
				<StyledView className='flex-row justify-between mt-2'>
					<StyledView className='flex-row items-center'>
						<FontAwesome name='eye' size={16} color='gray' />
						<StyledText className='text-sm text-gray-500 ml-1'>
							{item.views || 0}
						</StyledText>
					</StyledView>
					<StyledView className='flex-row items-center'>
						<FontAwesome name='heart' size={16} color='gray' />
						<StyledText className='text-sm text-gray-500 ml-1'>
							{item.likes || 0}
						</StyledText>
					</StyledView>
				</StyledView>
				<StyledView className='flex-row justify-between mt-4'>
					<StyledTouchableOpacity
						className='bg-black py-2 px-4 rounded flex-1 mr-2 items-center'
						onPress={() => {
							setSelectedListing(item)
							setIsListingModalVisible(true)
						}}>
						<StyledText className='text-white'>Edit</StyledText>
					</StyledTouchableOpacity>
					{item.status !== 'sold' && (
						<StyledTouchableOpacity
							className='bg-gray py-2 px-4 rounded flex-1 mx-2 items-center'
							onPress={() => {
								setSelectedListing(item)
								setIsSoldModalVisible(true)
							}}>
							<StyledText className='text-white'>Mark Sold</StyledText>
						</StyledTouchableOpacity>
					)}
					<StyledTouchableOpacity
						className='bg-red py-2 px-4 rounded flex-1 ml-2 items-center'
						onPress={() => handleDeleteListing(item.id)}>
						<StyledText className='text-white'>Delete</StyledText>
					</StyledTouchableOpacity>
				</StyledView>
			</StyledView>
		</StyledView>
	)

	const SoldModal = () => (
		<Modal
			visible={isSoldModalVisible}
			animationType='slide'
			transparent={true}>
			<StyledView className='flex-1 justify-center items-center bg-black bg-opacity-50'>
				<StyledView className='bg-white p-6 rounded-lg w-5/6'>
					<StyledText className='text-2xl bg-gray font-bold mb-4'>
						Mark as Sold
					</StyledText>
					<StyledTextInput
						className='border border-gray-300 rounded p-2 mb-4'
						placeholder='Sold Price'
						value={soldInfo.price}
						onChangeText={text => setSoldInfo({ ...soldInfo, price: text })}
						keyboardType='numeric'
					/>
					<StyledTextInput
						className='border border-gray-300 rounded p-2 mb-4'
						placeholder='Date Sold (YYYY-MM-DD)'
						value={soldInfo.date}
						onChangeText={text => setSoldInfo({ ...soldInfo, date: text })}
					/>
					<StyledView className='flex-row justify-end mt-4'>
						<StyledTouchableOpacity
							className='bg-gray-300 py-2 px-4 rounded mr-2'
							onPress={() => setIsSoldModalVisible(false)}>
							<StyledText>Cancel</StyledText>
						</StyledTouchableOpacity>
						<StyledTouchableOpacity
							className='bg-red py-2 px-4 rounded'
							onPress={handleMarkAsSold}>
							<StyledText className='text-white'>Confirm</StyledText>
						</StyledTouchableOpacity>
					</StyledView>
				</StyledView>
			</StyledView>
		</Modal>
	)

	if (!dealership) {
		return (
			<StyledView className='flex-1 justify-center items-center'>
				<StyledText className='text-xl'>
					Loading dealership information...
				</StyledText>
			</StyledView>
		)
	}

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<StyledView className='flex-1 bg-gray-100 p-4'>
				{error && (
					<StyledText className='text-red-500 mb-4'>{error}</StyledText>
				)}

				<StyledView className='mb-4 flex-row justify-between items-center'>
					<StyledTextInput
						className='bg-white border border-gray-300 rounded-lg p-2 flex-1 mr-2'
						placeholder='Search listings...'
						value={searchQuery}
						onChangeText={setSearchQuery}
					/>
					<StyledTouchableOpacity
						className='bg-red py-2 px-4 rounded-lg items-center justify-center'
						onPress={() => {
							setSelectedListing(null)
							setNewListing({})
							setIsListingModalVisible(true)
						}}>
						<FontAwesome name='plus' size={20} color='white' />
					</StyledTouchableOpacity>
				</StyledView>

				<StyledView className='flex-row justify-between items-center mb-4'>
					<StyledTouchableOpacity
						className='bg-gray py-2 px-4 rounded flex-1 mr-2 items-center'
						onPress={() => {
							setFilterStatus(filterStatus === 'all' ? 'available' : 'all')
						}}>
						<StyledText className='text-white'>
							{filterStatus === 'all' ? 'Show Available' : 'Show All'}
						</StyledText>
					</StyledTouchableOpacity>

					<StyledTouchableOpacity
						className='bg-gray py-2 px-4 rounded flex-1 ml-2 items-center'
						onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
						<StyledText className='text-white'>
							Sort: {sortBy} {sortOrder === 'asc' ? '↑' : '↓'}
						</StyledText>
					</StyledTouchableOpacity>
				</StyledView>

				<FlatList
					data={listings}
					renderItem={({ item }) => <ListingCard item={item} />}
					keyExtractor={item => item.id.toString()}
					className='mb-4'
				/>

				<StyledView className='flex-row justify-between items-center'>
					<StyledTouchableOpacity
						className='bg-red py-1 px-3 rounded flex-1 mr-1 items-center'
						onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
						disabled={currentPage === 1}>
						<StyledText className='text-white text-sm'>Previous</StyledText>
					</StyledTouchableOpacity>
					<StyledText className='mx-2 text-sm'>{` ${currentPage} of ${totalPages}`}</StyledText>
					<StyledTouchableOpacity
						className='bg-red py-1 px-3 rounded flex-1 ml-1 items-center'
						onPress={() =>
							setCurrentPage(prev => Math.min(totalPages, prev + 1))
						}
						disabled={currentPage === totalPages}>
						<StyledText className='text-white text-sm'>Next</StyledText>
					</StyledTouchableOpacity>
				</StyledView>

				<ListingModal
					isVisible={isListingModalVisible}
					onClose={() => {
						setIsListingModalVisible(false)
						setSelectedListing(null)
					}}
					onSubmit={handleSubmitListing}
					initialData={selectedListing}
					dealership={dealership}
				/>
				<SoldModal />
			</StyledView>
		</GestureHandlerRootView>
	)
}
