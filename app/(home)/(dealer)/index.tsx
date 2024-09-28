import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
	View,
	Text,
	FlatList,
	Image,
	TouchableOpacity,
	TextInput,
	Alert,
	ActivityIndicator,
	RefreshControl,
	StatusBar,
	Modal
} from 'react-native'
import { FontAwesome } from '@expo/vector-icons'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import ListingModal from '@/components/ListingModal'
import { SafeAreaView } from 'react-native-safe-area-context'
import SortPicker from '@/components/SortPicker'
import RNPickerSelect from 'react-native-picker-select'

const ITEMS_PER_PAGE = 10

const CustomHeader = ({ title }: { title: string }) => {
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

interface CarListing {
	id: number
	make: string
	model: string
	year: number
	price: number
	images: string[]
	views: number
	likes: number
	status: 'available' | 'pending' | 'sold'
	condition: 'New' | 'Used'
	mileage: number
	transmission: 'Manual' | 'Automatic'
}

interface Dealership {
	id: number
	name: string
	user_id: string
}

export default function DealerListings() {
	const { isDarkMode } = useTheme()
	const { user } = useUser()
	const [dealership, setDealership] = useState<Dealership | null>(null)
	const [listings, setListings] = useState<CarListing[]>([])
	const [currentPage, setCurrentPage] = useState(1)
	const [isLoading, setIsLoading] = useState(false)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [sortBy, setSortBy] = useState('listed_at')
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
	const [searchQuery, setSearchQuery] = useState('')
	const [selectedListing, setSelectedListing] = useState<CarListing | null>(
		null
	)
	const [isListingModalVisible, setIsListingModalVisible] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [hasMoreListings, setHasMoreListings] = useState(true)
	const [isFilterModalVisible, setIsFilterModalVisible] = useState(false)
	const [isSoldModalVisible, setIsSoldModalVisible] = useState(false)
	const [soldInfo, setSoldInfo] = useState({ price: '', date: '' })
	const [filters, setFilters] = useState({
		status: '',
		condition: '',
		minPrice: '',
		maxPrice: '',
		minYear: '',
		maxYear: ''
	})

	const fetchDealership = useCallback(async () => {
		if (!user) return
		const { data, error } = await supabase
			.from('dealerships')
			.select('*')
			.eq('user_id', user.id)
			.single()

		if (error) {
			setError('Failed to fetch dealership information')
		} else if (data) {
			setDealership(data)
		} else {
			setError('No dealership associated with your account')
		}
	}, [user])

	const fetchListings = useCallback(
		async (page: number, refresh: boolean = false) => {
			if (!dealership) return
			setIsLoading(true)
			let query = supabase
				.from('cars')
				.select('*', { count: 'exact' })
				.eq('dealership_id', dealership.id)
				.order(sortBy, { ascending: sortOrder === 'asc' })

			if (searchQuery) {
				query = query.or(
					`make.ilike.%${searchQuery}%,model.ilike.%${searchQuery}%`
				)
			}

			// Apply filters
			if (filters.status) query = query.eq('status', filters.status)
			if (filters.condition) query = query.eq('condition', filters.condition)
			if (filters.minPrice)
				query = query.gte('price', parseInt(filters.minPrice))
			if (filters.maxPrice)
				query = query.lte('price', parseInt(filters.maxPrice))
			if (filters.minYear) query = query.gte('year', parseInt(filters.minYear))
			if (filters.maxYear) query = query.lte('year', parseInt(filters.maxYear))

			const { data, error, count } = await query.range(
				(page - 1) * ITEMS_PER_PAGE,
				page * ITEMS_PER_PAGE - 1
			)

			if (error) {
				setError('Failed to fetch car listings')
			} else {
				setListings(prevListings =>
					refresh ? data || [] : [...prevListings, ...(data || [])]
				)
				setCurrentPage(page)
				setHasMoreListings((count || 0) > page * ITEMS_PER_PAGE)
			}
			setIsLoading(false)
			setIsRefreshing(false)
		},
		[dealership, sortBy, sortOrder, searchQuery, filters]
	)

	useEffect(() => {
		fetchDealership()
	}, [fetchDealership])

	useEffect(() => {
		if (dealership) {
			fetchListings(1, true)
		}
	}, [dealership, fetchListings])

	const handleRefresh = useCallback(() => {
		setIsRefreshing(true)
		setCurrentPage(1)
		fetchListings(1, true)
	}, [fetchListings])

	const handleLoadMore = useCallback(() => {
		if (!isLoading && hasMoreListings) {
			fetchListings(currentPage + 1)
		}
	}, [currentPage, isLoading, hasMoreListings, fetchListings])

	const handleDeleteListing = useCallback(
		async (id: number) => {
			if (!dealership) return
			Alert.alert(
				'Delete Listing',
				'Are you sure you want to delete this listing?',
				[
					{ text: 'Cancel', style: 'cancel' },
					{
						text: 'Delete',
						onPress: async () => {
							try {
								await supabase
									.from('cars')
									.delete()
									.eq('id', id)
									.eq('dealership_id', dealership.id)
								setListings(prevListings =>
									prevListings.filter(listing => listing.id !== id)
								)
								Alert.alert('Success', 'Listing deleted successfully')
							} catch (error) {
								console.error('Error in handleDeleteListing:', error)
								Alert.alert('Error', 'Failed to delete listing')
							}
						},
						style: 'destructive'
					}
				]
			)
		},
		[dealership]
	)

	const handleSubmitListing = useCallback(
		async (formData: Partial<CarListing>) => {
			if (!dealership) return
			try {
				if (selectedListing) {
					await supabase
						.from('cars')
						.update(formData)
						.eq('id', selectedListing.id)
						.eq('dealership_id', dealership.id)
					setListings(prevListings =>
						prevListings.map(listing =>
							listing.id === selectedListing.id
								? { ...listing, ...formData }
								: listing
						)
					)
					Alert.alert('Success', 'Listing updated successfully')
				} else {
					const { data, error } = await supabase
						.from('cars')
						.insert({ ...formData, dealership_id: dealership.id })
					if (error) throw error
					if (data)
						setListings(prevListings => [
							...prevListings,
							data[0] as CarListing
						])
					Alert.alert('Success', 'New listing created successfully')
				}
				setIsListingModalVisible(false)
				setSelectedListing(null)
			} catch (error) {
				console.error('Error submitting listing:', error)
				Alert.alert('Error', 'Failed to submit listing. Please try again.')
			}
		},
		[dealership, selectedListing]
	)

	const handleSortChange = useCallback(
		(value: string) => {
			const [newSortBy, newSortOrder] = value.split('_')
			setSortBy(newSortBy)
			setSortOrder(newSortOrder as 'asc' | 'desc')
			setCurrentPage(1)
			fetchListings(1, true)
		},
		[fetchListings]
	)

	const handleSearch = useCallback(() => {
		setCurrentPage(1)
		fetchListings(1, true)
	}, [fetchListings])

	const handleFilterChange = (key: string, value: string) => {
		setFilters(prevFilters => ({ ...prevFilters, [key]: value }))
	}

	const applyFilters = () => {
		setIsFilterModalVisible(false)
		setCurrentPage(1)
		fetchListings(1, true)
	}

	const handleMarkAsSold = useCallback(
		async (soldInfo: { price: string; date: string }) => {
			if (!selectedListing || !dealership) return

			try {
				const { error } = await supabase
					.from('cars')
					.update({
						status: 'sold',
						sold_price: parseInt(soldInfo.price),
						date_sold: soldInfo.date
					})
					.eq('id', selectedListing.id)
					.eq('dealership_id', dealership.id)

				if (error) throw error

				setListings(prevListings =>
					prevListings.map(listing =>
						listing.id === selectedListing.id
							? { ...listing, status: 'sold' }
							: listing
					)
				)
				setIsSoldModalVisible(false)
				setSelectedListing(null)
				Alert.alert('Success', 'Listing marked as sold successfully')
			} catch (error) {
				console.error('Error marking as sold:', error)
				Alert.alert('Error', 'Failed to mark listing as sold')
			}
		},
		[selectedListing, dealership]
	)

	const ListingCard = useMemo(
		() =>
			({ item }: { item: CarListing }) =>
				(
					<View
						className={`border border-red rounded-lg overflow-hidden mb-4 ${
							isDarkMode ? 'bg-gray-800' : 'bg-white'
						}`}>
						<Image source={{ uri: item.images[0] }} className='w-full h-48' />
						<LinearGradient
							colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.6)']}
							className='absolute inset-0'
						/>
						<View className='absolute top-2 right-2 bg-red/60 rounded-full px-2 py-1'>
							<Text className='text-white text-xs font-bold uppercase'>
								{item.status}
							</Text>
						</View>
						<View className='absolute top-2 left-2 flex-row'>
							<View className='flex-row items-center bg-black/50 rounded-full px-2 py-1 mr-2'>
								<FontAwesome name='eye' size={12} color='#FFFFFF' />
								<Text className='text-white text-xs ml-1'>
									{item.views || 0}
								</Text>
							</View>
							<View className='flex-row items-center bg-black/50 rounded-full px-2 py-1'>
								<FontAwesome name='heart' size={12} color='#FFFFFF' />
								<Text className='text-white text-xs ml-1'>
									{item.likes || 0}
								</Text>
							</View>
						</View>
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
							<View className='flex-row justify-between mt-2'>
								<View className='flex-row items-center'>
									<FontAwesome
										name='car'
										size={14}
										color={isDarkMode ? '#FFFFFF' : '#000000'}
									/>
									<Text
										className={`ml-1 ${
											isDarkMode ? 'text-white' : 'text-black'
										}`}>
										{item.condition}
									</Text>
								</View>
								<View className='flex-row items-center'>
									<FontAwesome
										name='tachometer'
										size={14}
										color={isDarkMode ? '#FFFFFF' : '#000000'}
									/>
									<Text
										className={`ml-1 ${
											isDarkMode ? 'text-white' : 'text-black'
										}`}>
										{item.mileage.toLocaleString()} mi
									</Text>
								</View>
								<View className='flex-row items-center'>
									<FontAwesome
										name='gears'
										size={14}
										color={isDarkMode ? '#FFFFFF' : '#000000'}
									/>
									<Text
										className={`ml-1 ${
											isDarkMode ? 'text-white' : 'text-black'
										}`}>
										{item.transmission}
									</Text>
								</View>
							</View>
						</View>
						<View className='flex-row justify-between p-4 border-t border-red'>
							<TouchableOpacity
								className='flex-row items-center justify-center bg-red py-2 px-4 rounded-full'
								onPress={() => {
									setSelectedListing(item)
									setIsListingModalVisible(true)
								}}>
								<FontAwesome name='edit' size={14} color='#FFFFFF' />
								<Text className='text-white font-bold ml-2'>Edit</Text>
							</TouchableOpacity>
							{item.status !== 'sold' && (
								<TouchableOpacity
									className='flex-row items-center justify-center bg-green-500 py-2 px-4 rounded-full'
									onPress={() => {
										setSelectedListing(item)
										setIsSoldModalVisible(true)
									}}>
									<FontAwesome name='check' size={14} color='#FFFFFF' />
									<Text className='text-white font-bold ml-2'>
										Mark as Sold
									</Text>
								</TouchableOpacity>
							)}
							<TouchableOpacity
								className='flex-row items-center justify-center bg-red py-2 px-4 rounded-full'
								onPress={() => handleDeleteListing(item.id)}>
								<FontAwesome name='trash' size={14} color='#FFFFFF' />
								<Text className='text-white font-bold ml-2'>Delete</Text>
							</TouchableOpacity>
						</View>
					</View>
				),
		[isDarkMode, handleDeleteListing]
	)

	const FilterModal = useCallback(() => {
		const [localFilters, setLocalFilters] = useState(filters)

		const handleLocalFilterChange = (key: string, value: string) => {
			setLocalFilters(prev => ({ ...prev, [key]: value }))
		}

		const handleApplyFilters = () => {
			setFilters(localFilters)
			setIsFilterModalVisible(false)
			setCurrentPage(1)
			fetchListings(1, true)
		}

		return (
			<Modal
				visible={isFilterModalVisible}
				animationType='slide'
				transparent={true}
				onRequestClose={() => setIsFilterModalVisible(false)}>
				<View className='flex-1 justify-end bg-black/50'>
					<View
						className={`bg-${isDarkMode ? 'gray' : 'white'} rounded-t-3xl p-6`}>
						<Text
							className={`text-xl font-bold mb-4 ${
								isDarkMode ? 'text-white' : 'text-black'
							}`}>
							Filters
						</Text>

						<Text
							className={`font-semibold mb-2 ${
								isDarkMode ? 'text-white' : 'text-black'
							}`}>
							Status
						</Text>
						<RNPickerSelect
							onValueChange={value => handleLocalFilterChange('status', value)}
							items={[
								{ label: 'All', value: '' },
								{ label: 'Available', value: 'available' },
								{ label: 'Pending', value: 'pending' },
								{ label: 'Sold', value: 'sold' }
							]}
							value={localFilters.status}
							style={pickerSelectStyles(isDarkMode)}
						/>

						<Text
							className={`font-semibold mb-2 mt-4 ${
								isDarkMode ? 'text-white' : 'text-black'
							}`}>
							Condition
						</Text>
						<RNPickerSelect
							onValueChange={value =>
								handleLocalFilterChange('condition', value)
							}
							items={[
								{ label: 'All', value: '' },
								{ label: 'New', value: 'New' },
								{ label: 'Used', value: 'Used' }
							]}
							value={localFilters.condition}
							style={pickerSelectStyles(isDarkMode)}
						/>

						<Text
							className={`font-semibold mb-2 mt-4 ${
								isDarkMode ? 'text-white' : 'text-black'
							}`}>
							Price Range
						</Text>
						<View className='flex-row justify-between'>
							<TextInput
								className={`w-[48%] p-2 rounded-md border-red border-2 ${
									isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
								}`}
								placeholder='Min Price'
								placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
								value={localFilters.minPrice}
								onChangeText={value =>
									handleLocalFilterChange('minPrice', value)
								}
								keyboardType='numeric'
							/>
							<TextInput
								className={`w-[48%] p-2 rounded-md border-red border-2 ${
									isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
								}`}
								placeholder='Max Price'
								placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
								value={localFilters.maxPrice}
								onChangeText={value =>
									handleLocalFilterChange('maxPrice', value)
								}
								keyboardType='numeric'
							/>
						</View>

						<Text
							className={`font-semibold mb-2 mt-4 ${
								isDarkMode ? 'text-white' : 'text-black'
							}`}>
							Year Range
						</Text>
						<View className='flex-row justify-between'>
							<TextInput
								className={`w-[48%] p-2 rounded-md border-red border-2 ${
									isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
								}`}
								placeholder='Min Year'
								placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
								value={localFilters.minYear}
								onChangeText={value =>
									handleLocalFilterChange('minYear', value)
								}
								keyboardType='numeric'
							/>
							<TextInput
								className={`w-[48%] p-2 rounded-md border-red border-2 ${
									isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
								}`}
								placeholder='Max Year'
								placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
								value={localFilters.maxYear}
								onChangeText={value =>
									handleLocalFilterChange('maxYear', value)
								}
								keyboardType='numeric'
							/>
						</View>

						<View className='flex-row justify-between mt-6'>
							<TouchableOpacity
								className='bg-black  py-2 px-4 rounded-full'
								onPress={() => setIsFilterModalVisible(false)}>
								<Text className='text-white font-bold'>Cancel</Text>
							</TouchableOpacity>
							<TouchableOpacity
								className='bg-red py-2 px-4 rounded-full'
								onPress={handleApplyFilters}>
								<Text className='text-white font-bold'>Apply Filters</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>
		)
	}, [
		isFilterModalVisible,
		isDarkMode,
		filters,
		setFilters,
		setIsFilterModalVisible,
		setCurrentPage,
		fetchListings
	])

	const SoldModal = useCallback(() => {
		const [localSoldInfo, setLocalSoldInfo] = useState({ price: '', date: '' })

		const handleConfirm = () => {
			handleMarkAsSold(localSoldInfo)
		}

		return (
			<Modal
				visible={isSoldModalVisible}
				animationType='slide'
				transparent={true}>
				<View className='flex-1 justify-center items-center bg-black/50'>
					<View
						className={`bg-${
							isDarkMode ? 'gray' : 'white'
						} p-6 rounded-lg w-5/6`}>
						<Text
							className={`text-2xl font-bold mb-4 ${
								isDarkMode ? 'text-white' : 'text-black'
							}`}>
							Mark as Sold
						</Text>
						<TextInput
							className={`border border-red rounded p-2 mb-4 ${
								isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
							}`}
							placeholder='Sold Price'
							placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
							value={localSoldInfo.price}
							onChangeText={text =>
								setLocalSoldInfo(prev => ({ ...prev, price: text }))
							}
							keyboardType='numeric'
						/>
						<TextInput
							className={`border border-red rounded p-2 mb-4 ${
								isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
							}`}
							placeholder='Date Sold (YYYY-MM-DD)'
							placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
							value={localSoldInfo.date}
							onChangeText={text =>
								setLocalSoldInfo(prev => ({ ...prev, date: text }))
							}
						/>
						<View className='flex-row justify-end mt-4'>
							<TouchableOpacity
								className='bg-black text-white py-2 px-4 rounded mr-2'
								onPress={() => setIsSoldModalVisible(false)}>
								<Text className='text-white'>Cancel</Text>
							</TouchableOpacity>
							<TouchableOpacity
								className='bg-red py-2 px-4 rounded'
								onPress={handleConfirm}>
								<Text className='text-white'>Confirm</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>
		)
	}, [isSoldModalVisible, isDarkMode, handleMarkAsSold, setIsSoldModalVisible])

	if (!dealership) {
		return (
			<View className='flex-1 justify-center items-center'>
				<Text className='text-lg text-gray-600'>
					Loading dealership information...
				</Text>
			</View>
		)
	}

	return (
		<LinearGradient
			colors={isDarkMode ? ['#000000', '#1A1A1A'] : ['#FFFFFF', '#F0F0F0']}
			className='flex-1'>
			<CustomHeader title='My Cars' />
			{error && <Text className='text-red text-center py-2'>{error}</Text>}
			<View className='px-4 py-2'>
				<View className='flex-row items-center justify-between -mb-1'>
					<View className='flex-1 flex-row items-center bg-white dark:bg-gray-800 rounded-full mr-2'>
						<TextInput
							className='flex-1 py-2 px-4 text-black dark:text-white'
							placeholder='Search listings...'
							placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
							value={searchQuery}
							onChangeText={setSearchQuery}
							onSubmitEditing={handleSearch}
						/>
						<TouchableOpacity className='pr-3' onPress={handleSearch}>
							<FontAwesome
								name='search'
								size={20}
								color={isDarkMode ? '#FFFFFF' : '#000000'}
							/>
						</TouchableOpacity>
					</View>
					<TouchableOpacity
						className='bg-red w-10 h-10 rounded-full items-center justify-center mr-2'
						onPress={() => setIsFilterModalVisible(true)}>
						<FontAwesome name='filter' size={20} color='white' />
					</TouchableOpacity>
					<SortPicker
						onValueChange={handleSortChange}
						initialValue={{ label: 'Sort', value: null }}
					/>
					<TouchableOpacity
						className='bg-red w-10 h-10 rounded-full items-center justify-center ml-2'
						onPress={() => {
							setSelectedListing(null)
							setIsListingModalVisible(true)
						}}>
						<FontAwesome name='plus' size={20} color='white' />
					</TouchableOpacity>
				</View>
			</View>
			<FlatList
				data={listings}
				renderItem={({ item }) => <ListingCard item={item} />}
				keyExtractor={item => `${item.id}`}
				contentContainerStyle={{ padding: 16 }}
				onEndReached={handleLoadMore}
				onEndReachedThreshold={0.1}
				refreshControl={
					<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
				}
				ListEmptyComponent={
					<View className='flex-1 justify-center items-center py-20'>
						<Text
							className={`text-lg ${isDarkMode ? 'text-white' : 'text-black'}`}>
							No listings available.
						</Text>
					</View>
				}
				ListFooterComponent={
					isLoading && hasMoreListings ? (
						<ActivityIndicator size='large' color='#D55004' />
					) : null
				}
			/>
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
			<FilterModal />
			<SoldModal />
		</LinearGradient>
	)
}

const pickerSelectStyles = (isDarkMode: boolean) => ({
	inputIOS: {
		fontSize: 16,
		paddingVertical: 12,
		paddingHorizontal: 10,
		borderWidth: 1,
		borderColor: isDarkMode ? '#4A5568' : '#E2E8F0',
		borderRadius: 4,
		color: isDarkMode ? 'white' : 'black',
		paddingRight: 30,
		backgroundColor: isDarkMode ? '#2D3748' : '#EDF2F7'
	},
	inputAndroid: {
		fontSize: 16,
		paddingHorizontal: 10,
		paddingVertical: 8,
		borderWidth: 1,
		borderColor: isDarkMode ? '#4A5568' : '#E2E8F0',
		borderRadius: 8,
		color: isDarkMode ? 'white' : 'black',
		paddingRight: 30,
		backgroundColor: isDarkMode ? '#2D3748' : '#EDF2F7'
	},
	placeholderColor: isDarkMode ? '#A0AEC0' : '#718096'
})
