import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
import ModernPicker from '@/components/ModernPicker'

const ITEMS_PER_PAGE = 10
const SUBSCRIPTION_WARNING_DAYS = 7

const CustomHeader = React.memo(({ title }: { title: string }) => {
	const { isDarkMode } = useTheme()

	return (
		<SafeAreaView className={`bg-${isDarkMode ? 'black' : 'white'} `}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View className='flex-row ml-6'>
				<Text
					className={`text-2xl -mb-5 font-bold ${
						isDarkMode ? 'text-white' : 'text-black'
					} `}>
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
	// Local state for controlled input
	const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery)

	// Synchronize local state with prop changes
	useEffect(() => {
		setLocalSearchQuery(searchQuery)
	}, [searchQuery])

	// Handle text input changes
	const handleTextChange = (text: string) => {
		setLocalSearchQuery(text)
		onSearchChange(text)
	}

	// Handle search clear
	const handleClearSearch = () => {
		setLocalSearchQuery('')
		onSearchChange('')
	}

	return (
		<View className='flex-row items-center justify-between px-4 py-2'>
			{/* Search Input Container */}
			<View
				className={`flex-1 flex-row ${
					isDarkMode ? 'bg-neutral-500' : 'bg-[#e1e1e1]'
				} items-center px-4 py-2 mr-3 rounded-2xl`}>
				{/* Search Icon */}
				<Ionicons
					name='search'
					size={20}
					color={isDarkMode ? '#a3a3a3' : '#666666'}
					className='mr-2'
				/>

				{/* Search Input */}
				<TextInput
					placeholder='Search inventory...'
					value={localSearchQuery}
					onChangeText={handleTextChange}
					placeholderTextColor={isDarkMode ? '#a3a3a3' : '#666666'}
					className={`flex-1 text-base bottom-1 ${
						isDarkMode ? 'text-white' : 'text-black'
					}`}
					returnKeyType='search'
				/>

				{/* Clear Button - Only show when there's text */}
				{localSearchQuery.length > 0 && (
					<TouchableOpacity onPress={handleClearSearch} className='p-2'>
						<Ionicons
							name='close-circle'
							size={20}
							color={isDarkMode ? '#a3a3a3' : '#666666'}
						/>
					</TouchableOpacity>
				)}
			</View>

			{/* Action Buttons */}
			<View className='flex-row gap-2'>
				{/* Filter Button */}
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

				{/* Add Button */}
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
							<ModernPicker
								label='Status'
								value={localFilters.status}
								options={[
									{ label: 'All', value: '' },
									{ label: 'Available', value: 'available' },
									{ label: 'Pending', value: 'pending' },
									{ label: 'Sold', value: 'sold' }
								]}
								onChange={value => handleChange('status', value)}
								isDarkMode={isDarkMode}
							/>

							{/* Condition Filter */}
							<ModernPicker
								label='Condition'
								value={localFilters.condition}
								options={[
									{ label: 'All', value: '' },
									{ label: 'New', value: 'New' },
									{ label: 'Used', value: 'Used' }
								]}
								onChange={value => handleChange('condition', value)}
								isDarkMode={isDarkMode}
							/>

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
							<ModernPicker
								label='Transmission'
								value={localFilters.transmission}
								options={[
									{ label: 'All', value: '' },
									{ label: 'Automatic', value: 'Automatic' },
									{ label: 'Manual', value: 'Manual' }
								]}
								onChange={value => handleChange('transmission', value)}
								isDarkMode={isDarkMode}
							/>
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

	const filtersRef = useRef(filters)
	const sortByRef = useRef(sortBy)
	const sortOrderRef = useRef(sortOrder)
	const searchQueryRef = useRef(searchQuery)
	const [fetchTrigger, setFetchTrigger] = useState(0)

	const applyFiltersToQuery = (query: any, currentFilters: any) => {
		if (currentFilters.status) {
			query = query.eq('status', currentFilters.status)
		}
		if (currentFilters.condition) {
			query = query.eq('condition', currentFilters.condition)
		}
		if (currentFilters.minPrice) {
			query = query.gte('price', parseInt(currentFilters.minPrice))
		}
		if (currentFilters.maxPrice) {
			query = query.lte('price', parseInt(currentFilters.maxPrice))
		}
		if (currentFilters.minYear) {
			query = query.gte('year', parseInt(currentFilters.minYear))
		}
		if (currentFilters.maxYear) {
			query = query.lte('year', parseInt(currentFilters.maxYear))
		}
		if (currentFilters.transmission) {
			query = query.eq('transmission', currentFilters.transmission)
		}

		return query
	}

	const fetchListings = useCallback(
		async (page = 1, refresh = false) => {
			if (!dealership) return
			setIsLoading(true)
			try {
				// 1. Get current values from refs
				const currentFilters = filtersRef.current
				const currentSortBy = sortByRef.current
				const currentSortOrder = sortOrderRef.current
				const currentSearchQuery = searchQueryRef.current

				// 2. Build base query
				let query = supabase
					.from('cars')
					.select(
						'*, dealerships!inner(name,logo,phone,location,latitude,longitude)',
						{
							count: 'exact'
						}
					)
					.eq('dealership_id', dealership.id)
					.order(currentSortBy, { ascending: currentSortOrder === 'asc' })

				// 3. Apply search if exists
				if (currentSearchQuery) {
					query = query.or(
						`make.ilike.%${currentSearchQuery}%,model.ilike.%${currentSearchQuery}%,description.ilike.%${currentSearchQuery}%`
					)
				}

				// 4. Apply filters
				query = applyFiltersToQuery(query, currentFilters)

				// 5. Calculate pagination
				const from = (page - 1) * ITEMS_PER_PAGE
				const to = from + ITEMS_PER_PAGE - 1

				// 6. Execute query
				const { data, error, count } = await query.range(from, to)

				if (error) throw error

				// 7. Format response data (no changes here)
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

				// 8. Update state
				setListings(prev =>
					refresh ? formattedData : [...prev, ...formattedData]
				)
				setCurrentPage(page)

				// **Update hasMoreListings based on the CURRENT page, not the next one**
				setHasMoreListings(count! > page * ITEMS_PER_PAGE)
				setTotalListings(count || 0)
			} catch (error) {
				console.error('Error fetching listings:', error)
				Alert.alert('Error', 'Failed to fetch listings')
			} finally {
				setIsLoading(false)
				setIsRefreshing(false)
			}
		},
		[dealership, hasMoreListings] // Add hasMoreListings as a dependency
	)

	useEffect(() => {
		fetchDealership()
	}, [fetchDealership])

	useEffect(() => {
		if (dealership) {
			setCurrentPage(1)
			fetchListings(1, true)
		}
	}, [dealership, fetchTrigger, fetchListings])
	const debouncedSearch = useCallback(
		debounce(() => {
			setCurrentPage(1)
			setFetchTrigger(prev => prev + 1)
		}, 300),
		[]
	)

	const handleSearchChange = useCallback(
		(text: string) => {
			searchQueryRef.current = text
			setSearchQuery(text)
			debouncedSearch()
		},
		[debouncedSearch]
	)

	useEffect(() => {
		if (searchQuery) {
			debouncedSearch()
		}
	}, [searchQuery, debouncedSearch])

	const handleFilterChange = useCallback((newFilters: any) => {
		// 1. Update ref immediately to ensure latest value for queries
		filtersRef.current = newFilters

		// 2. Update state for UI
		setFilters(newFilters)

		// 3. Reset to first page when applying new filters
		setCurrentPage(1)

		// 4. Trigger fetch with new filters
		setFetchTrigger(prev => prev + 1)

		// 5. Close filter modal
		setIsFilterModalVisible(false)
	}, [])

	const handleRefresh = useCallback(() => {
		setIsRefreshing(true)
		setCurrentPage(1)
		setFetchTrigger(prev => prev + 1)
	}, [])
	const handleLoadMore = useCallback(() => {
		if (!isLoading && hasMoreListings) {
			fetchListings(currentPage + 1, false)
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

	const handleSortChange = useCallback((value: string) => {
		// 1. Split sort value into components
		const [newSortBy, newSortOrder] = value.split('_')

		// 2. Update refs immediately
		sortByRef.current = newSortBy
		sortOrderRef.current = newSortOrder as 'asc' | 'desc'

		// 3. Update state for UI
		setSortBy(newSortBy)
		setSortOrder(newSortOrder as 'asc' | 'desc')

		// 4. Reset to first page
		setCurrentPage(1)

		// 5. Trigger fetch with new sort
		setFetchTrigger(prev => prev + 1)
	}, [])

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

										const actions = [
											{
												text: 'Edit',
												onPress: () => {
													setSelectedListing(item)
													setIsListingModalVisible(true)
												}
											},
											// Only show "Mark as Sold" if the item is NOT sold
											...(item.status !== 'sold'
												? [
														{
															text: 'Mark as Sold',
															onPress: () => {
																setSelectedListing(item)
																setIsSoldModalVisible(true)
															}
														}
												  ]
												: []),
											{
												text: 'Delete',
												onPress: () => handleDeleteListing(item.id),
												style: 'destructive'
											},
											{
												text: 'Cancel',
												style: 'cancel'
											}
										]

										Alert.alert('Manage Listing', 'Choose an action', actions)
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
				className='mb-12'
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
