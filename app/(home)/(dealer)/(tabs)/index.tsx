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
	Modal,
	ScrollView
} from 'react-native'
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated'
import { FontAwesome, Ionicons } from '@expo/vector-icons'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import ListingModal from '@/components/ListingModal'
import { SafeAreaView } from 'react-native-safe-area-context'
import SortPicker from '@/components/SortPicker'
import RNPickerSelect from 'react-native-picker-select'
import { debounce } from 'lodash'
import { BlurView } from 'expo-blur'

const ITEMS_PER_PAGE = 10
const SUBSCRIPTION_WARNING_DAYS = 7

const CustomHeader = React.memo(({ title }: { title: string }) => {
	const { isDarkMode } = useTheme()

	return (
		<SafeAreaView className={`bg-${isDarkMode ? 'black' : 'white'} `}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View className='flex-row ml-6'>
				<Text className='text-2xl -mb-5 font-bold text-black dark:text-white'>
					{title}
				</Text>
			</View>
		</SafeAreaView>
	)
})

interface SearchBarProps {
	searchQuery: string
	onSearchChange: (text: string) => void
	onFilterPress: () => void
	onAddPress: () => void
	isDarkMode: boolean
	subscriptionExpired: boolean
}

const ModernSearchBar: React.FC<SearchBarProps> = ({
	searchQuery,
	onSearchChange,
	onFilterPress,
	onAddPress,
	isDarkMode,
	subscriptionExpired
}) => {
	const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery)

	const handleSearchPress = () => {
		onSearchChange(localSearchQuery)
	}

	return (
		<View className='flex-row items-center justify-between px-4 py-2'>
			<View className='flex-1 flex-row  items-center px-4 py-2 mr-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800'>
				<TouchableOpacity
					onPress={handleSearchPress}
					style={{ marginRight: 8 }}>
					<Ionicons
						name='search'
						size={24}
						color={isDarkMode ? '#a3a3a3' : '#666666'}
					/>
				</TouchableOpacity>

				<TextInput
					placeholder='Search inventory...'
					value={localSearchQuery}
					onChangeText={setLocalSearchQuery} // no debouncing here
					placeholderTextColor={isDarkMode ? '#a3a3a3' : '#666666'}
					className={`flex-1 text-base bottom-1 ${
						isDarkMode ? 'text-white' : 'text-black'
					}`}
				/>
			</View>

			<View className='flex-row gap-2'>
				<TouchableOpacity
					onPress={onFilterPress}
					disabled={subscriptionExpired}
					className={`p-2 rounded-xl ${
						subscriptionExpired ? 'opacity-50' : ''
					}`}>
					<Ionicons
						name='filter'
						size={24}
						color={isDarkMode ? '#FFFFFF' : '#000000'}
					/>
				</TouchableOpacity>

				<TouchableOpacity
					onPress={onAddPress}
					disabled={subscriptionExpired}
					className={`p-2 rounded-full border border-emerald-300 ${
						subscriptionExpired ? 'opacity-50' : ''
					}`}>
					<Ionicons
						name='add'
						size={24}
						color={isDarkMode ? '#FFFFFF' : '#000000'}
					/>
				</TouchableOpacity>
			</View>
		</View>
	)
}

interface SoldModalProps {
	visible: boolean
	onClose: () => void
	onConfirm: (data: any) => void
	isDarkMode: boolean
}

const ModernSoldModal: React.FC<SoldModalProps> = ({
	visible,
	onClose,
	onConfirm,
	isDarkMode
}) => {
	const [soldInfo, setSoldInfo] = useState({
		price: '',
		date: '',
		buyer_name: ''
	})

	const handleConfirm = () => {
		if (!soldInfo.price || !soldInfo.date) {
			Alert.alert('Error', 'Please enter both sold price and date.')
			return
		}
		onConfirm(soldInfo)
	}

	const inputStyle = `w-full px-4 py-3.5 rounded-xl border mb-4 ${
		isDarkMode
			? 'border-neutral-700 bg-neutral-800 text-white'
			: 'border-neutral-200 bg-neutral-50 text-black'
	}`

	return (
		<Modal
			visible={visible}
			animationType='slide'
			transparent
			onRequestClose={onClose}>
			<View className='flex-1 justify-center items-center'>
				<BlurView
					intensity={isDarkMode ? 30 : 20}
					tint={isDarkMode ? 'dark' : 'light'}
					className='absolute inset-0'
				/>

				<View
					className={`w-[90%] rounded-3xl ${
						isDarkMode ? 'bg-neutral-900' : 'bg-white'
					} p-6`}>
					{/* Header */}
					<View className='flex-row justify-between items-center mb-6'>
						<Text
							className={`text-xl font-semibold ${
								isDarkMode ? 'text-white' : 'text-black'
							}`}>
							Mark as Sold
						</Text>
						<TouchableOpacity onPress={onClose} className='p-2'>
							<Ionicons
								name='close'
								size={24}
								color={isDarkMode ? '#FFFFFF' : '#000000'}
							/>
						</TouchableOpacity>
					</View>

					{/* Form Fields */}
					<View className='mb-6'>
						<Text
							className={`text-sm font-medium mb-2 ${
								isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
							}`}>
							Sold Price
						</Text>
						<TextInput
							placeholder='Enter sold price'
							value={soldInfo.price}
							onChangeText={text =>
								setSoldInfo(prev => ({ ...prev, price: text }))
							}
							keyboardType='numeric'
							className={inputStyle}
							placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
						/>

						<Text
							className={`text-sm font-medium mb-2 ${
								isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
							}`}>
							Date Sold
						</Text>
						<TextInput
							placeholder='YYYY-MM-DD'
							value={soldInfo.date}
							onChangeText={text =>
								setSoldInfo(prev => ({ ...prev, date: text }))
							}
							className={inputStyle}
							placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
						/>

						<Text
							className={`text-sm font-medium mb-2 ${
								isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
							}`}>
							Buyer Name
						</Text>
						<TextInput
							placeholder='Enter buyer name'
							value={soldInfo.buyer_name}
							onChangeText={text =>
								setSoldInfo(prev => ({ ...prev, buyer_name: text }))
							}
							className={inputStyle}
							placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
						/>
					</View>

					{/* Action Buttons */}
					<View className='flex-row space-x-4'>
						<TouchableOpacity
							onPress={onClose}
							className='flex-1 py-4 rounded-xl bg-neutral-200 dark:bg-neutral-800'>
							<Text
								className={`text-center font-semibold ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								Cancel
							</Text>
						</TouchableOpacity>
						<TouchableOpacity
							onPress={handleConfirm}
							className='flex-1 py-4 rounded-xl bg-red'>
							<Text className='text-white text-center font-semibold'>
								Confirm
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</Modal>
	)
}

interface FilterModalProps {
	visible: boolean
	onClose: () => void
	onApply: (filters: FilterState) => void
	currentFilters: FilterState
	isDarkMode: boolean
}

interface FilterState {
	status: string
	condition: string
	minPrice: string
	maxPrice: string
	minYear: string
	maxYear: string
	transmission: string
}

const ModernFilterModal: React.FC<FilterModalProps> = ({
	visible,
	onClose,
	onApply,
	currentFilters,
	isDarkMode
}) => {
	const [localFilters, setLocalFilters] = useState<FilterState>(currentFilters)

	useEffect(() => {
		setLocalFilters(currentFilters)
	}, [currentFilters, visible])

	const handleChange = (key: keyof FilterState, value: string) => {
		setLocalFilters(prev => ({ ...prev, [key]: value }))
	}

	const validateFilters = () => {
		const numericFields = [
			{ key: 'minPrice', max: 'maxPrice', label: 'Price' },
			{ key: 'minYear', max: 'maxYear', label: 'Year' }
		]

		for (const field of numericFields) {
			const min = Number(localFilters[field.key])
			const max = Number(localFilters[field.max])

			if (min && max && min > max) {
				Alert.alert(
					'Invalid Range',
					`${field.label} minimum cannot be greater than maximum.`
				)
				return false
			}
		}

		return true
	}

	const handleApply = () => {
		if (validateFilters()) {
			onApply(localFilters)
			onClose()
		}
	}

	const handleReset = () => {
		const emptyFilters = {
			status: '',
			condition: '',
			minPrice: '',
			maxPrice: '',
			minYear: '',
			maxYear: '',
			transmission: ''
		}
		setLocalFilters(emptyFilters)
		onApply(emptyFilters)
		onClose()
	}

	const pickerSelectStyles = {
		inputIOS: {
			fontSize: 16,
			paddingVertical: 12,
			paddingHorizontal: 12,
			borderWidth: 1,
			borderColor: isDarkMode ? '#374151' : '#E5E7EB',
			borderRadius: 12,
			color: isDarkMode ? 'white' : 'black',
			backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB'
		},
		inputAndroid: {
			fontSize: 16,
			paddingHorizontal: 12,
			paddingVertical: 8,
			borderWidth: 1,
			borderColor: isDarkMode ? '#374151' : '#E5E7EB',
			borderRadius: 12,
			color: isDarkMode ? 'white' : 'black',
			backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB'
		}
	}

	return (
		<Modal
			visible={visible}
			animationType='slide'
			transparent
			onRequestClose={onClose}>
			<View className='flex-1 justify-end'>
				<BlurView
					intensity={isDarkMode ? 30 : 20}
					tint={isDarkMode ? 'dark' : 'light'}
					className='absolute inset-0'
				/>

				<View
					className={`rounded-t-3xl ${
						isDarkMode ? 'bg-neutral-900' : 'bg-white'
					} max-h-[85%]`}>
					{/* Header */}
					<View className='flex-row justify-between items-center p-4 border-b border-neutral-200 dark:border-neutral-800'>
						<TouchableOpacity onPress={onClose} className='p-2'>
							<Ionicons
								name='close'
								size={24}
								color={isDarkMode ? '#FFFFFF' : '#000000'}
							/>
						</TouchableOpacity>
						<Text
							className={`text-lg font-semibold ${
								isDarkMode ? 'text-white' : 'text-black'
							}`}>
							Filters
						</Text>
						<TouchableOpacity onPress={handleReset}>
							<Text className='text-red font-medium'>Reset</Text>
						</TouchableOpacity>
					</View>

					<ScrollView className='p-4'>
						<View className='space-y-6'>
							{/* Status Filter */}
							<View>
								<Text
									className={`text-sm font-medium mb-2 ${
										isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
									}`}>
									Status
								</Text>
								<RNPickerSelect
									onValueChange={value => handleChange('status', value)}
									items={[
										{ label: 'All', value: '' },
										{ label: 'Available', value: 'available' },
										{ label: 'Pending', value: 'pending' },
										{ label: 'Sold', value: 'sold' }
									]}
									value={localFilters.status}
									style={pickerSelectStyles}
								/>
							</View>

							{/* Condition Filter */}
							<View>
								<Text
									className={`text-sm font-medium mb-2 ${
										isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
									}`}>
									Condition
								</Text>
								<RNPickerSelect
									onValueChange={value => handleChange('condition', value)}
									items={[
										{ label: 'All', value: '' },
										{ label: 'New', value: 'New' },
										{ label: 'Used', value: 'Used' }
									]}
									value={localFilters.condition}
									style={pickerSelectStyles}
								/>
							</View>

							{/* Price Range */}
							<View>
								<Text
									className={`text-sm font-medium mb-2 ${
										isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
									}`}>
									Price Range
								</Text>
								<View className='flex-row space-x-4'>
									<TextInput
										placeholder='Min Price'
										value={localFilters.minPrice}
										onChangeText={value => handleChange('minPrice', value)}
										keyboardType='numeric'
										className={`flex-1 px-4 py-3 rounded-xl border ${
											isDarkMode
												? 'border-neutral-700 bg-neutral-800 text-white'
												: 'border-neutral-200 bg-neutral-50 text-black'
										}`}
										placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
									/>
									<TextInput
										placeholder='Max Price'
										value={localFilters.maxPrice}
										onChangeText={value => handleChange('maxPrice', value)}
										keyboardType='numeric'
										className={`flex-1 px-4 py-3 rounded-xl border ${
											isDarkMode
												? 'border-neutral-700 bg-neutral-800 text-white'
												: 'border-neutral-200 bg-neutral-50 text-black'
										}`}
										placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
									/>
								</View>
							</View>

							{/* Year Range */}
							<View>
								<Text
									className={`text-sm font-medium mb-2 ${
										isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
									}`}>
									Year Range
								</Text>
								<View className='flex-row space-x-4'>
									<TextInput
										placeholder='Min Year'
										value={localFilters.minYear}
										onChangeText={value => handleChange('minYear', value)}
										keyboardType='numeric'
										className={`flex-1 px-4 py-3 rounded-xl border ${
											isDarkMode
												? 'border-neutral-700 bg-neutral-800 text-white'
												: 'border-neutral-200 bg-neutral-50 text-black'
										}`}
										placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
									/>
									<TextInput
										placeholder='Max Year'
										value={localFilters.maxYear}
										onChangeText={value => handleChange('maxYear', value)}
										keyboardType='numeric'
										className={`flex-1 px-4 py-3 rounded-xl border ${
											isDarkMode
												? 'border-neutral-700 bg-neutral-800 text-white'
												: 'border-neutral-200 bg-neutral-50 text-black'
										}`}
										placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
									/>
								</View>
							</View>

							{/* Transmission Filter */}
							<View>
								<Text
									className={`text-sm font-medium mb-2 ${
										isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
									}`}>
									Transmission
								</Text>
								<RNPickerSelect
									onValueChange={value => handleChange('transmission', value)}
									items={[
										{ label: 'All', value: '' },
										{ label: 'Automatic', value: 'Automatic' },
										{ label: 'Manual', value: 'Manual' }
									]}
									value={localFilters.transmission}
									style={pickerSelectStyles}
								/>
							</View>
						</View>
					</ScrollView>

					{/* Footer */}
					<View className='p-4 border-t border-neutral-200 dark:border-neutral-800'>
						<TouchableOpacity
							onPress={handleApply}
							className='bg-red py-4 rounded-xl'>
							<Text className='text-white text-center font-semibold'>
								Apply Filters
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</Modal>
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
	subscription_end_date: string
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
	const [selectedListing, setSelectedListing] = useState<CarListing | null>(
		null
	)
	const [isListingModalVisible, setIsListingModalVisible] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [hasMoreListings, setHasMoreListings] = useState(true)
	const [isFilterModalVisible, setIsFilterModalVisible] = useState(false)
	const [isSoldModalVisible, setIsSoldModalVisible] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [totalListings, setTotalListings] = useState(0)
	const [filters, setFilters] = useState({
		status: '',
		condition: '',
		minPrice: '',
		maxPrice: '',
		minYear: '',
		maxYear: '',
		transmission: ''
	})
	const isSubscriptionValid = useCallback(() => {
		if (!dealership || !dealership.subscription_end_date) return false
		const endDate = new Date(dealership.subscription_end_date)
		return endDate > new Date()
	}, [dealership])

	const getDaysUntilExpiration = useCallback(() => {
		if (!dealership || !dealership.subscription_end_date) return 0
		const endDate = new Date(dealership.subscription_end_date)
		const today = new Date()
		const diffTime = endDate.getTime() - today.getTime()
		return Math.ceil(diffTime / (1000 * 3600 * 24))
	}, [dealership])

	const fetchDealership = useCallback(async () => {
		if (!user) return
		try {
			const { data, error } = await supabase
				.from('dealerships')
				.select('*')
				.eq('user_id', user.id)
				.single()

			if (error) throw error
			if (data) setDealership(data)
			else setError('No dealership associated with your account')
		} catch (error) {
			setError('Failed to fetch dealership information')
			console.error('Error fetching dealership:', error)
		}
	}, [user])

	const applyFiltersToQuery = (query: any) => {
		if (filters.status) {
			query = query.eq('status', filters.status)
		}
		if (filters.condition) {
			query = query.eq('condition', filters.condition)
		}
		if (filters.minPrice) {
			query = query.gte('price', parseInt(filters.minPrice))
		}
		if (filters.maxPrice) {
			query = query.lte('price', parseInt(filters.maxPrice))
		}
		if (filters.minYear) {
			query = query.gte('year', parseInt(filters.minYear))
		}
		if (filters.maxYear) {
			query = query.lte('year', parseInt(filters.maxYear))
		}
		if (filters.transmission) {
			query = query.eq('transmission', filters.transmission)
		}

		return query
	}

	const fetchListings = useCallback(
		async (page = 1, refresh = false) => {
			if (!dealership) return
			setIsLoading(true)
			try {
				let query = supabase
					.from('cars')
					.select(
						'*, dealerships!inner(name,logo,phone,location,latitude,longitude)',
						{
							count: 'exact'
						}
					)
					.eq('dealership_id', dealership.id)
					.order(sortBy, { ascending: sortOrder === 'asc' })

				// Apply search
				if (searchQuery) {
					query = query.or(
						`make.ilike.%${searchQuery}%,model.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
					)
				}

				// Apply filters
				query = applyFiltersToQuery(query)

				const from = (page - 1) * ITEMS_PER_PAGE
				const to = from + ITEMS_PER_PAGE - 1

				const { data, error, count } = await query.range(from, to)

				if (error) throw error

				const formattedData =
					data?.map(item => ({
						...item,
						dealership_name: item.dealerships.name,
						dealership_logo: item.dealerships.logo,
						dealership_phone: item.dealerships.phone,
						dealership_location: item.dealerships.location,
						dealership_latitude: item.dealerships.latitude,
						dealership_longitude: item.dealerships.longitude
					})) || []

				setListings(prev =>
					refresh ? formattedData : [...prev, ...formattedData]
				)
				setCurrentPage(page)
				setHasMoreListings((count || 0) > page * ITEMS_PER_PAGE)
				setTotalListings(count || 0)
			} catch (error) {
				console.error('Error fetching listings:', error)
				Alert.alert('Error', 'Failed to fetch listings')
			} finally {
				setIsLoading(false)
				setIsRefreshing(false)
			}
		},
		[dealership, searchQuery, filters, sortBy, sortOrder]
	)

	useEffect(() => {
		fetchDealership()
	}, [fetchDealership])

	useEffect(() => {
		if (dealership) {
			setCurrentPage(1)
			fetchListings(1, true)
		}
	}, [dealership, filters, sortBy, sortOrder, searchQuery, fetchListings])

	const handleSearchChange = useCallback(
		(text: string) => {
			setSearchQuery(text)
			setCurrentPage(1)
			fetchListings(1, true)
		},
		[fetchListings]
	)

	// Handle filter changes
	const handleFilterChange = useCallback(
		(newFilters: any) => {
			setFilters(newFilters)
			setCurrentPage(1)
			fetchListings(1, true)
		},
		[fetchListings]
	)

	// Handle refresh
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
			if (!dealership || !isSubscriptionValid()) return
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
		[dealership, isSubscriptionValid]
	)

	const handleSubmitListing = useCallback(
		async (formData: Partial<CarListing>) => {
			if (!dealership || !isSubscriptionValid()) return
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
		[dealership, selectedListing, isSubscriptionValid]
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

	const handleSearch = useMemo(
		() =>
			debounce(() => {
				setCurrentPage(1)
				fetchListings(1, true)
			}, 300),
		[fetchListings]
	)

	const SpecItem = ({ title, icon, value, isDarkMode }) => (
		<View className='flex-1 items-center justify-center'>
			<Text
				className={`text-xs mb-3 ${
					isDarkMode ? 'text-[#e6e6e6]' : 'text-textgray'
				}`}
				style={{ textAlign: 'center' }}>
				{title}
			</Text>
			<Ionicons
				name={icon}
				size={30}
				color={isDarkMode ? '#FFFFFF' : '#000000'}
				style={{ marginVertical: 3 }}
			/>
			<Text
				className={`text-sm font-bold mt-3 ${
					isDarkMode ? 'text-white' : 'text-black'
				}`}
				style={{ textAlign: 'center' }}>
				{value}
			</Text>
		</View>
	)

	const handleMarkAsSold = useCallback(
		async (soldInfo: { price: string; date: string; buyer_name: string }) => {
			if (!selectedListing || !dealership || !isSubscriptionValid()) return
			try {
				const { error } = await supabase
					.from('cars')
					.update({
						status: 'sold',
						sold_price: parseInt(soldInfo.price),
						date_sold: soldInfo.date,
						buyer_name: soldInfo.buyer_name
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
		[selectedListing, dealership, isSubscriptionValid]
	)

	// Add this helper function outside the component
	const getStatusConfig = (status: string) => {
		switch (status.toLowerCase()) {
			case 'available':
				return { color: '#22C55E', dotColor: '#4ADE80' } // Green
			case 'pending':
				return { color: '#EAB308', dotColor: '#FDE047' } // Yellow
			case 'sold':
				return { color: '#EF4444', dotColor: '#FCA5A5' } // Red
			default:
				return { color: '#6B7280', dotColor: '#9CA3AF' } // Gray
		}
	}

	const ListingCard = useMemo(
		() =>
			React.memo(({ item }: { item: CarListing }) => {
				const subscriptionValid = isSubscriptionValid()
				const statusConfig = getStatusConfig(item.status)

				return (
					<Animated.View
						entering={FadeInDown}
						exiting={FadeOutUp}
						className={`m-4 mb-4 ${
							isDarkMode ? 'bg-textgray' : 'bg-[#e6e6e6]'
						} rounded-3xl overflow-hidden shadow-xl`}>
						{/* Image and Overlays */}
						<View className='relative'>
							<Image
								source={{ uri: item.images[0] }}
								className='w-full h-[245px]'
							/>

							{/* Gradient Overlay - Enhanced opacity */}
							<LinearGradient
								colors={['transparent', 'rgba(0,0,0,0.85)']}
								className='absolute bottom-0 left-0 right-0 h-40'
							/>

							{/* Top Actions Row */}
							<View className='absolute top-4 w-full px-4 flex-row justify-between items-center'>
								<View className='flex-row items-center'>
									{/* Enhanced Status Badge with dot indicator */}
									<View
										style={{ backgroundColor: statusConfig.color }}
										className='rounded-full px-3 py-1.5 mr-2 flex-row items-center'>
										<View
											style={{ backgroundColor: statusConfig.dotColor }}
											className='w-2 h-2 rounded-full mr-2 animate-pulse'
										/>
										<Text className='text-white text-xs font-bold uppercase tracking-wider'>
											{item.status}
										</Text>
									</View>

									{/* Enhanced Stats Container */}
									<View className='flex-row space-x-2'>
										{/* Views Counter */}
										<View className='flex-row items-center bg-black/60 backdrop-blur-lg rounded-full px-3 py-1.5'>
											<FontAwesome name='eye' size={12} color='#FFFFFF' />
											<Text className='text-white text-xs font-medium ml-1.5'>
												{item.views || 0}
											</Text>
										</View>

										{/* Likes Counter */}
										<View className='flex-row items-center bg-black/60 backdrop-blur-lg rounded-full px-3 py-1.5'>
											<FontAwesome name='heart' size={12} color='#FFFFFF' />
											<Text className='text-white text-xs font-medium ml-1.5'>
												{item.likes || 0}
											</Text>
										</View>
									</View>
								</View>

								{/* Enhanced Menu Button */}
								<TouchableOpacity
									className='bg-black/60 backdrop-blur-lg rounded-full p-2.5'
									onPress={() => {
										if (!subscriptionValid) {
											Alert.alert(
												'Subscription Expired',
												'Please renew your subscription to manage listings.'
											)
											return
										}
										Alert.alert('Manage Listing', 'Choose an action', [
											{
												text: 'Edit',
												onPress: () => {
													setSelectedListing(item)
													setIsListingModalVisible(true)
												}
											},
											{
												text:
													item.status !== 'sold'
														? 'Mark as Sold'
														: 'Mark as Available',
												onPress: () => {
													setSelectedListing(item)
													setIsSoldModalVisible(true)
												}
											},
											{
												text: 'Delete',
												onPress: () => handleDeleteListing(item.id),
												style: 'destructive'
											},
											{
												text: 'Cancel',
												style: 'cancel'
											}
										])
									}}>
									<Ionicons
										name='ellipsis-horizontal'
										size={20}
										color='#FFFFFF'
									/>
								</TouchableOpacity>
							</View>

							{/* Enhanced Bottom Content */}
							<View className='absolute bottom-0 w-full p-5'>
								<View className='flex-row justify-between items-end'>
									<View className='flex-1'>
										<Text className='text-white/90 text-sm font-medium mb-1'>
											{item.year}
										</Text>
										<Text className='text-white text-2xl font-bold tracking-tight mb-1'>
											{item.make} {item.model}
										</Text>
										<Text className='text-white text-3xl font-extrabold'>
											${item.price.toLocaleString()}
										</Text>
									</View>
								</View>
							</View>
						</View>

						{/* Enhanced Car Specs Section */}
						<View className='px-5 py-4'>
							<View className='flex-row justify-between'>
								<SpecItem
									title='Year'
									icon='calendar-outline'
									value={item.year}
									isDarkMode={isDarkMode}
								/>
								<SpecItem
									title='Mileage'
									icon='speedometer-outline'
									value={`${(item.mileage / 1000).toFixed(1)}k`}
									isDarkMode={isDarkMode}
								/>
								<SpecItem
									title='Transm.'
									icon='cog-outline'
									value={
										item.transmission === 'Automatic'
											? 'Auto'
											: item.transmission === 'Manual'
											? 'Man'
											: item.transmission
									}
									isDarkMode={isDarkMode}
								/>
								<SpecItem
									title='Condition'
									icon='car-sport-outline'
									value={item.condition}
									isDarkMode={isDarkMode}
								/>
							</View>
						</View>
					</Animated.View>
				)
			}),
		[
			isDarkMode,
			handleDeleteListing,
			setSelectedListing,
			setIsListingModalVisible,
			setIsSoldModalVisible,
			isSubscriptionValid
		]
	)

	if (!dealership) {
		return (
			<LinearGradient
				colors={isDarkMode ? ['#000000', '#1A1A1A'] : ['#FFFFFF', '#F5F5F5']}
				className='flex-1 justify-center items-center'>
				<ActivityIndicator size='large' color='#D55004' />
			</LinearGradient>
		)
	}

	const daysUntilExpiration = getDaysUntilExpiration()
	const showWarning =
		daysUntilExpiration <= SUBSCRIPTION_WARNING_DAYS && daysUntilExpiration > 0
	const subscriptionExpired = !isSubscriptionValid()

	return (
		<LinearGradient
			colors={isDarkMode ? ['#000000', '#1A1A1A'] : ['#FFFFFF', '#F5F5F5']}
			className='flex-1'>
			<CustomHeader title='My Cars' />

			{/* Modern Header */}

			{/* Subscription Warning */}
			{(subscriptionExpired || showWarning) && (
				<BlurView
					intensity={isDarkMode ? 30 : 50}
					tint={isDarkMode ? 'dark' : 'light'}
					className={`mx-6 mb-4 rounded-xl overflow-hidden ${
						subscriptionExpired ? 'bg-rose-500/20' : 'bg-amber-500/20'
					}`}>
					<View className='p-4'>
						<Text className='text-center font-medium text-white'>
							{subscriptionExpired
								? 'Your subscription has expired. Please renew to manage listings.'
								: `Your subscription will expire in ${daysUntilExpiration} days. Please renew soon.`}
						</Text>
					</View>
				</BlurView>
			)}

			{/* Search and Filter Bar */}
			<ModernSearchBar
				searchQuery={searchQuery}
				onSearchChange={handleSearchChange}
				onFilterPress={() => setIsFilterModalVisible(true)}
				onAddPress={() => {
					if (subscriptionExpired) {
						Alert.alert(
							'Subscription Expired',
							'Please renew your subscription to add new listings.'
						)
						return
					}
					setSelectedListing(null)
					setIsListingModalVisible(true)
				}}
				isDarkMode={isDarkMode}
				subscriptionExpired={subscriptionExpired}
			/>
			{/* Listings */}
			<FlatList
				data={listings}
				renderItem={({ item }) => <ListingCard item={item} />}
				keyExtractor={item => item.id.toString()}
				showsVerticalScrollIndicator={false}
				onEndReached={handleLoadMore}
				onEndReachedThreshold={0.5}
				refreshControl={
					<RefreshControl
						refreshing={isRefreshing}
						onRefresh={handleRefresh}
						tintColor={isDarkMode ? '#FFFFFF' : '#000000'}
					/>
				}
				ListEmptyComponent={
					<View className='flex-1 justify-center items-center py-20'>
						<Text
							className={`text-lg ${isDarkMode ? 'text-white' : 'text-black'}`}>
							{subscriptionExpired
								? 'Your subscription has expired. Renew to view and manage listings.'
								: 'No listings available.'}
						</Text>
					</View>
				}
				ListFooterComponent={
					isLoading && (
						<ActivityIndicator
							size='large'
							color='#D55004'
							style={{ marginVertical: 20 }}
						/>
					)
				}
			/>

			{!subscriptionExpired && (
				<>
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

					<ModernFilterModal
						visible={isFilterModalVisible}
						onClose={() => setIsFilterModalVisible(false)}
						onApply={handleFilterChange}
						currentFilters={filters}
						isDarkMode={isDarkMode}
					/>

					<ModernSoldModal
						visible={isSoldModalVisible}
						onClose={() => setIsSoldModalVisible(false)}
						onConfirm={handleMarkAsSold}
						isDarkMode={isDarkMode}
					/>
				</>
			)}
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
