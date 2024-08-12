import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	FlatList,
	Image,
	TouchableOpacity,
	Modal,
	TextInput,
	ScrollView
} from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
import { styled } from 'nativewind'
import { FontAwesome } from '@expo/vector-icons'

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

	const handleCreateListing = async () => {
		if (!dealership) return

		const { data, error } = await supabase
			.from('cars')
			.insert({ ...newListing, dealership_id: dealership.id })

		if (error) {
			console.error('Error creating listing:', error)
			setError('Failed to create new listing')
		} else {
			fetchListings()
			setIsListingModalVisible(false)
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
			setError('Failed to update listing')
		} else {
			fetchListings()
			setIsListingModalVisible(false)
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
			setError('Failed to delete listing')
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
			<StyledImage source={{ uri: item.images[0] }} className='w-full h-48' />
			<StyledView className='p-4'>
				<StyledText className='text-xl font-bold mb-2'>{`${item.year} ${item.make} ${item.model}`}</StyledText>
				<StyledText className='text-xl text-red mb-2'>
					${item.price.toLocaleString()}
				</StyledText>
				<StyledText className='text-sm text-gray-600 mb-1'>
					Condition: {item.condition}
				</StyledText>
				<StyledText className='text-sm text-gray-600 mb-1'>
					Color: {item.color}
				</StyledText>
				<StyledText className='text-sm text-gray-600 mb-1'>
					Transmission: {item.transmission}
				</StyledText>
				<StyledText className='text-sm text-gray-600 mb-1'>
					Drivetrain: {item.drivetrain}
				</StyledText>
				<StyledText className='text-sm text-gray-600 mb-1'>
					Mileage: {item.mileage.toLocaleString()} miles
				</StyledText>
				<StyledView className='flex-row justify-between mt-2'>
					<StyledView className='flex-row items-center'>
						<FontAwesome name='eye' size={16} color='gray' />
						<StyledText className='text-sm text-gray-500 ml-1'>
							{item.views}
						</StyledText>
					</StyledView>
					<StyledView className='flex-row items-center'>
						<FontAwesome name='heart' size={16} color='gray' />
						<StyledText className='text-sm text-gray-500 ml-1'>
							{item.likes}
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

	const ListingModal = () => (
		<Modal
			visible={isListingModalVisible}
			animationType='slide'
			transparent={true}>
			<StyledView className='flex-1 justify-center items-center bg-black bg-opacity-50'>
				<StyledView className='bg-white p-6 rounded-lg w-5/6'>
					<StyledText className='text-2xl font-bold mb-4'>
						{selectedListing ? 'Edit Listing' : 'Create New Listing'}
					</StyledText>
					<ScrollView>
						<StyledTextInput
							className='border border-gray-300 rounded p-2 mb-4'
							placeholder='Make'
							value={selectedListing?.make || newListing.make || ''}
							onChangeText={text =>
								selectedListing
									? setSelectedListing({ ...selectedListing, make: text })
									: setNewListing({ ...newListing, make: text })
							}
						/>
						<StyledTextInput
							className='border border-gray-300 rounded p-2 mb-4'
							placeholder='Model'
							value={selectedListing?.model || newListing.model || ''}
							onChangeText={text =>
								selectedListing
									? setSelectedListing({ ...selectedListing, model: text })
									: setNewListing({ ...newListing, model: text })
							}
						/>
						<StyledTextInput
							className='border border-gray-300 rounded p-2 mb-4'
							placeholder='Year'
							value={(
								selectedListing?.year ||
								newListing.year ||
								''
							).toString()}
							onChangeText={text => {
								const year = parseInt(text)
								selectedListing
									? setSelectedListing({ ...selectedListing, year })
									: setNewListing({ ...newListing, year })
							}}
							keyboardType='numeric'
						/>
						<StyledTextInput
							className='border border-gray-300 rounded p-2 mb-4'
							placeholder='Price'
							value={(
								selectedListing?.price ||
								newListing.price ||
								''
							).toString()}
							onChangeText={text => {
								const price = parseInt(text)
								selectedListing
									? setSelectedListing({ ...selectedListing, price })
									: setNewListing({ ...newListing, price })
							}}
							keyboardType='numeric'
						/>
						<StyledTextInput
							className='border border-gray-300 rounded p-2 mb-4'
							placeholder='Description'
							value={
								selectedListing?.description || newListing.description || ''
							}
							onChangeText={text =>
								selectedListing
									? setSelectedListing({
											...selectedListing,
											description: text
									  })
									: setNewListing({ ...newListing, description: text })
							}
							multiline
						/>
						<StyledPicker
							selectedValue={
								selectedListing?.status || newListing.status || 'Available'
							}
							onValueChange={(itemValue: any) =>
								selectedListing
									? setSelectedListing({
											...selectedListing,
											status: itemValue
									  })
									: setNewListing({ ...newListing, status: itemValue })
							}
							style={{ height: 50, width: '100%', marginBottom: 16 }}>
							<Picker.Item label='Available' value='available' />
							<Picker.Item label='Pending' value='pending' />
							<Picker.Item label='Sold' value='sold' />
						</StyledPicker>
						<StyledPicker
							selectedValue={
								selectedListing?.condition || newListing.condition || 'Used'
							}
							onValueChange={(itemValue: any) =>
								selectedListing
									? setSelectedListing({
											...selectedListing,
											condition: itemValue
									  })
									: setNewListing({ ...newListing, condition: itemValue })
							}
							style={{ height: 50, width: '100%' }}>
							<Picker.Item label='New' value='New' />
							<Picker.Item label='Used' value='Used' />
						</StyledPicker>
						<StyledTextInput
							className='border border-gray-300 rounded p-2 mb-4'
							placeholder='Color'
							value={selectedListing?.color || newListing.color || ''}
							onChangeText={text =>
								selectedListing
									? setSelectedListing({ ...selectedListing, color: text })
									: setNewListing({ ...newListing, color: text })
							}
						/>
						<StyledPicker
							selectedValue={
								selectedListing?.transmission ||
								newListing.transmission ||
								'Automatic'
							}
							onValueChange={(itemValue: any) =>
								selectedListing
									? setSelectedListing({
											...selectedListing,
											transmission: itemValue
									  })
									: setNewListing({ ...newListing, transmission: itemValue })
							}
							style={{ height: 50, width: '100%' }}>
							<Picker.Item label='Automatic' value='Automatic' />
							<Picker.Item label='Manual' value='Manual' />
						</StyledPicker>
						<StyledPicker
							selectedValue={
								selectedListing?.drivetrain || newListing.drivetrain || 'FWD'
							}
							onValueChange={(itemValue: any) =>
								selectedListing
									? setSelectedListing({
											...selectedListing,
											drivetrain: itemValue
									  })
									: setNewListing({ ...newListing, drivetrain: itemValue })
							}
							style={{ height: 50, width: '100%' }}>
							<Picker.Item label='FWD' value='FWD' />
							<Picker.Item label='RWD' value='RWD' />
							<Picker.Item label='AWD' value='AWD' />
							<Picker.Item label='4WD' value='4WD' />
							<Picker.Item label='4x4' value='4x4' />
						</StyledPicker>
						<StyledTextInput
							className='border border-gray-300 rounded p-2 mb-4'
							placeholder='Mileage'
							value={(
								selectedListing?.mileage ||
								newListing.mileage ||
								''
							).toString()}
							onChangeText={text => {
								const mileage = parseInt(text)
								selectedListing
									? setSelectedListing({ ...selectedListing, mileage })
									: setNewListing({ ...newListing, mileage })
							}}
							keyboardType='numeric'
						/>
					</ScrollView>
					<StyledView className='flex-row justify-end mt-4'>
						<StyledTouchableOpacity
							className='bg-gray-300 py-2 px-4 rounded mr-2'
							onPress={() => setIsListingModalVisible(false)}>
							<StyledText>Cancel</StyledText>
						</StyledTouchableOpacity>
						<StyledTouchableOpacity
							className='bg-red py-2 px-4 rounded'
							onPress={
								selectedListing ? handleUpdateListing : handleCreateListing
							}>
							<StyledText className='text-white'>
								{selectedListing ? 'Update' : 'Create'}
							</StyledText>
						</StyledTouchableOpacity>
					</StyledView>
				</StyledView>
			</StyledView>
		</Modal>
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
		<StyledView className='flex-1 bg-gray-100 p-4'>
			{error && <StyledText className='text-red-500 mb-4'>{error}</StyledText>}

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
					onPress={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
					disabled={currentPage === totalPages}>
					<StyledText className='text-white text-sm'>Next</StyledText>
				</StyledTouchableOpacity>
			</StyledView>

			<ListingModal />
			<SoldModal />
		</StyledView>
	)
}
