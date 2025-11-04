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
	ScrollView,
  Platform,
  StyleSheet,
  Dimensions
} from 'react-native'
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated'
import { FontAwesome, Ionicons } from '@expo/vector-icons'
import { supabase } from '@/utils/supabase'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import { useTranslation } from 'react-i18next'

import { SafeAreaView } from 'react-native-safe-area-context'
import { useScrollToTop } from '@react-navigation/native'
import { debounce } from 'lodash'
import { BlurView } from 'expo-blur'
import ModernPicker from '@/components/ModernPicker'
import { useRouter } from 'expo-router'
  import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/utils/AuthContext'
import { ListingSkeletonLoader } from '../Skeleton'
import DealerOnboardingModal from '../DealerOnboardingModal'

const ITEMS_PER_PAGE = 10
const SUBSCRIPTION_WARNING_DAYS = 7

type ViewMode = 'sale' | 'rent'

interface SegmentedControlProps {
	mode: ViewMode
	onModeChange: (mode: ViewMode) => void
	isDarkMode: boolean
	t: (key: string) => string
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({
	mode,
	onModeChange,
	isDarkMode,
	t
}) => {
	const screenWidth = Dimensions.get('window').width

	return (
		<View
			style={{
				flexDirection: 'row',
				backgroundColor: isDarkMode ? '#1F1F1F' : '#F3F4F6',
				borderRadius: 12,
				padding: 4,
				marginHorizontal: 16,
				marginVertical: 12
			}}>
			<TouchableOpacity
				onPress={() => onModeChange('sale')}
				style={{
					flex: 1,
					paddingVertical: 10,
					borderRadius: 8,
					backgroundColor: mode === 'sale' ? '#D55004' : 'transparent'
				}}>
				<Text
					style={{
						textAlign: 'center',
						fontWeight: '600',
						fontSize: 15,
						color: mode === 'sale' ? '#FFFFFF' : isDarkMode ? '#9CA3AF' : '#6B7280'
					}}>
					{t('profile.inventory.for_sale')}
				</Text>
			</TouchableOpacity>
			<TouchableOpacity
				onPress={() => onModeChange('rent')}
				style={{
					flex: 1,
					paddingVertical: 10,
					borderRadius: 8,
					backgroundColor: mode === 'rent' ? '#D55004' : 'transparent'
				}}>
				<Text
					style={{
						textAlign: 'center',
						fontWeight: '600',
						fontSize: 15,
						color: mode === 'rent' ? '#FFFFFF' : isDarkMode ? '#9CA3AF' : '#6B7280'
					}}>
					{t('profile.inventory.for_rent')}
				</Text>
			</TouchableOpacity>
		</View>
	)
}

const CustomHeader = ({ title, dealership }:any) => {
  const { isDarkMode } = useTheme();

  const styles = StyleSheet.create({
    container: { // For SafeAreaView
      backgroundColor: isDarkMode ? 'black' : 'white',
      zIndex: 10,
      paddingBottom: 12, // Unified bottom padding for the header area
    },
    titleContentWrapper: { // Wrapper for logo and title text
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16, // Horizontal padding for the content
      paddingTop: Platform.OS === 'ios' ? 8 : 12, // Top padding for the content
    },
    dealershipLogo: {
      width: 28, // Slightly larger logo
      height: 28,
      borderRadius: 14, // Half of width/height
      marginRight: 10, // Space between logo and text
    },
    headerText: { // Style for the main display text (dealership name or fallback)
      fontSize: 24, // Prominent font size
      fontWeight: 'bold',
      color: isDarkMode ? 'white' : 'black',
      flexShrink: 1, // Allow text to shrink if row is crowded
    }
  });

  // Determine the text to display: dealership name if available, otherwise the original title prop.
  const displayTitleText = dealership?.name ? dealership.name : title;

  return (
    // Apply SafeAreaView to the top edge; styles.container handles background and bottom padding.
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.titleContentWrapper}>
        {dealership?.logo && ( // Conditionally render logo if available
          <Image
            source={{ uri: dealership.logo }}
            style={styles.dealershipLogo}
          />
        )}
        {/* Display the determined title text, allowing it to ellipsize if too long */}
        <Text style={styles.headerText} numberOfLines={1} ellipsizeMode="tail">
          {displayTitleText}
        </Text>
      </View>
    </SafeAreaView>
  );
};

interface SearchBarProps {
	searchQuery: string
	onSearchChange: (text: string) => void
	onFilterPress: () => void
	onAddPress: () => void
	isDarkMode: boolean
	subscriptionExpired: boolean
	t: (key: string) => string
}

const ModernSearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  onSearchChange,
  onFilterPress,
  onAddPress,
  isDarkMode,
  subscriptionExpired,
  t
}) => {
  // Local state for controlled input
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  // Synchronize local state with prop changes
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  // Handle text input changes
  const handleTextChange = (text: string) => {
    setLocalSearchQuery(text);
    onSearchChange(text);
  };

  // Handle search clear
  const handleClearSearch = () => {
    setLocalSearchQuery('');
    onSearchChange('');
  };

  // Platform-specific styles for the TextInput
  const inputStyles = Platform.select({
    ios: {
      height: 40,
      paddingVertical: 0 // iOS handles vertical centering well
    },
    android: {
      height: 40,
      paddingVertical: 0,
      paddingTop: 0,
      paddingBottom: 0
    }
  });

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 8
    }}>
      {/* Search Input Container */}
      <View style={{
        flex: 1,
        flexDirection: 'row',
        backgroundColor: isDarkMode ? '#505050' : '#e1e1e1',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 0,
        marginRight: 12,
        borderRadius: 16,
        height: 44
      }}>
        {/* Search Icon */}
        <Ionicons
          name='search'
          size={20}
          color={isDarkMode ? '#a3a3a3' : '#666666'}
          style={{ marginRight: 8 }}
        />

        {/* Search Input */}
        <TextInput
          placeholder={t('profile.inventory.search_inventory')}
          value={localSearchQuery}
          onChangeText={handleTextChange}
          placeholderTextColor={isDarkMode ? '#a3a3a3' : '#666666'}
          style={[
            {
              flex: 1,
              fontSize: 16,
              color: isDarkMode ? 'white' : 'black',
              textAlignVertical: 'center',
            },
            inputStyles
          ]}
          returnKeyType='search'
        />

        {/* Clear Button - Only show when there's text */}
        {localSearchQuery.length > 0 && (
          <TouchableOpacity onPress={handleClearSearch} style={{ padding: 8 }}>
            <Ionicons
              name='close-circle'
              size={20}
              color={isDarkMode ? '#a3a3a3' : '#666666'}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Action Buttons */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {/* Filter Button */}
        <TouchableOpacity
          onPress={onFilterPress}
          disabled={subscriptionExpired}
          style={{
            padding: 8,
            borderRadius: 12,
            opacity: subscriptionExpired ? 0.5 : 1
          }}>
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
          style={{
            padding: 8,
            borderRadius: 9999,
            borderWidth: 1,
            borderColor: '#10B981',
            opacity: subscriptionExpired ? 0.5 : 1
          }}>
          <Ionicons
            name='add'
            size={24}
            color={isDarkMode ? '#FFFFFF' : '#000000'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface SoldModalProps {
	visible: boolean
	onClose: () => void
	onConfirm: (data: any) => void
	isDarkMode: boolean
	t: (key: string) => string
}

const ModernSoldModal: React.FC<SoldModalProps> = ({
	visible,
	onClose,
	onConfirm,
	isDarkMode,
	t
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
							{t('profile.inventory.mark_as_sold')}
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
							{t('profile.inventory.sold_price')}
						</Text>
						<TextInput
             textAlignVertical="center"
							placeholder={t('profile.inventory.enter_sold_price')}
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
							{t('profile.inventory.date_sold')}
						</Text>
						<TextInput
             textAlignVertical="center"
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
							{t('profile.inventory.buyer_name')}
						</Text>
						<TextInput
             textAlignVertical="center"
							placeholder={t('profile.inventory.enter_buyer_name')}
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
	t: (key: string) => string
	viewMode: ViewMode // Add viewMode to filter based on sale/rent
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
	isDarkMode,
	t,
	viewMode
}) => {
	const [localFilters, setLocalFilters] = useState<FilterState>(currentFilters)

	useEffect(() => {
		setLocalFilters(currentFilters)
	}, [currentFilters, visible])

	const handleChange = (key: keyof FilterState, value: string) => {
		setLocalFilters(prev => ({ ...prev, [key]: value }))
	}

	const validateFilters = () => {
		const numericFields: Array<{ key: keyof FilterState; max: keyof FilterState; label: string }> = [
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
								label={t('profile.inventory.status')}
								value={localFilters.status}
								options={
									viewMode === 'sale'
										? [
												{ label: t('profile.inventory.all'), value: '' },
												{ label: t('profile.inventory.available'), value: 'available' },
												{ label: t('profile.inventory.pending'), value: 'pending' },
												{ label: t('profile.inventory.sold'), value: 'sold' }
										  ]
										: [
												{ label: t('profile.inventory.all'), value: '' },
												{ label: t('profile.inventory.available'), value: 'available' },
												{ label: t('profile.inventory.pending'), value: 'pending' },
												{ label: t('profile.inventory.rented'), value: 'rented' }
										  ]
								}
								onChange={value => handleChange('status', value)}
								isDarkMode={isDarkMode}
							/>

							{/* Condition Filter - Only show for sale mode */}
							{viewMode === 'sale' && (
								<ModernPicker
									label={t('profile.inventory.condition')}
									value={localFilters.condition}
									options={[
										{ label: t('profile.inventory.all'), value: '' },
										{ label: t('profile.inventory.new'), value: 'New' },
										{ label: t('profile.inventory.used'), value: 'Used' }
									]}
									onChange={value => handleChange('condition', value)}
									isDarkMode={isDarkMode}
								/>
							)}

							{/* Price Range */}
							<View className='-top-6'>
								<Text
									className={`text-sm font-medium mb-2 ${
										isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
									}`}>
									Price Range
								</Text>
								<View className='flex-row space-x-4'>
									<TextInput
                   textAlignVertical="center"
										placeholder={t('profile.inventory.min_price')}
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
                   textAlignVertical="center"
										placeholder={t('profile.inventory.max_price')}
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
							<View className='-top-9 -mb-7'>
								<Text
									className={`text-sm font-medium mb-2 ${
										isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
									}`}>
									Year Range
								</Text>
								<View className='flex-row space-x-4'>
									<TextInput
                   textAlignVertical="center"
										placeholder={t('profile.inventory.min_year')}
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
                   textAlignVertical="center"
										placeholder={t('profile.inventory.max_year')}
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
								label={t('profile.inventory.transmission')}
								value={localFilters.transmission}
								options={[
									{ label: t('profile.inventory.all'), value: '' },
									{ label: t('profile.inventory.automatic'), value: 'Automatic' },
									{ label: t('profile.inventory.manual'), value: 'Manual' }
								]}
								onChange={value => handleChange('transmission', value)}
								isDarkMode={isDarkMode}
							/>
						</View>
					</ScrollView>

					{/* Footer */}
					<View className='p-4 border-t mb-3 border-neutral-200 dark:border-neutral-800'>
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
	status: 'available' | 'pending' | 'sold' | 'rented'
	condition?: 'New' | 'Used' // Optional - not present in cars_rent
	mileage?: number // Optional - not present in cars_rent
	transmission: 'Manual' | 'Automatic'
	rental_period?: string // Optional - for rent listings (daily, weekly, monthly, hourly)
}

interface Dealership {
	id: number
	name: string
	user_id: string
	subscription_end_date: string
	first_login: boolean | null
}

export default function DealerListings() {
	const { isDarkMode } = useTheme()
	const { user,profile } = useAuth()
	const { t } = useTranslation()
	const [initialLoading, setInitialLoading] = useState(true)
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
	const [viewMode, setViewMode] = useState<ViewMode>('sale')
  const router=useRouter()
	const [isListingModalVisible, setIsListingModalVisible] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [hasMoreListings, setHasMoreListings] = useState(true)
	const [isFilterModalVisible, setIsFilterModalVisible] = useState(false)
	const [isSoldModalVisible, setIsSoldModalVisible] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [totalListings, setTotalListings] = useState(0)
	const [showOnboardingModal, setShowOnboardingModal] = useState(false)
	const [filters, setFilters] = useState({
		status: '',
		condition: '',
		minPrice: '',
		maxPrice: '',
		minYear: '',
		maxYear: '',
		transmission: ''
	})
	const scrollRef = useRef(null)

	useScrollToTop(scrollRef)

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
			if (data) {
				setDealership(data)

				const requiresOnboarding =
					data.first_login === true ||
					data.first_login === null ||
					typeof data.first_login === 'undefined'

				if (requiresOnboarding) {
					setShowOnboardingModal(true)
				} else {
					setShowOnboardingModal(false)
				}
			}
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
	const viewModeRef = useRef(viewMode)
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
				
				// Only set loading true for pagination, not for initial load
				if (!refresh && page > 1) {
					setIsLoading(true)
				}
				
				// For initial load or refresh, set initialLoading
				if (refresh || page === 1) {
					setInitialLoading(true)
				}
			try {
				const currentFilters = filtersRef.current
				const currentSortBy = sortByRef.current
				const currentSortOrder = sortOrderRef.current
				const currentSearchQuery = searchQueryRef.current
				const currentViewMode = viewModeRef.current

				// Determine which table to query based on view mode
				const tableName = currentViewMode === 'sale' ? 'cars' : 'cars_rent'

				// Helper to build a fresh query with all conditions
				const buildBaseQuery = () => {
					let query = supabase
						.from(tableName)
						.select(
							'*, dealerships!inner(name,logo,phone,location,latitude,longitude)',
							{ count: 'exact' }
						)
						.eq('dealership_id', dealership.id)
						.order(currentSortBy, { ascending: currentSortOrder === 'asc' })

					if (currentSearchQuery) {
						const cleanQuery = currentSearchQuery.trim().toLowerCase()
						const searchTerms = cleanQuery.split(/\s+/)
						searchTerms.forEach(term => {
							const numericTerm = parseInt(term)
							let searchConditions = [
								`make.ilike.%${term}%`,
								`model.ilike.%${term}%`,
								`description.ilike.%${term}%`
							]
							if (!isNaN(numericTerm)) {
								// Only search mileage for sale mode (cars table has mileage)
								const numericSearches = [
									`year::text.eq.${numericTerm}`,
									`price::text.ilike.%${numericTerm}%`
								]
								if (currentViewMode === 'sale') {
									numericSearches.push(`mileage::text.ilike.%${numericTerm}%`)
								}
								searchConditions = searchConditions.concat(numericSearches)
							}
							query = query.or(searchConditions.join(','))
						})
					}

					// Apply filters from currentFilters
					query = applyFiltersToQuery(query, currentFilters)
					return query
				}

				// Get count by rebuilding the query
				const countQuery = buildBaseQuery()
				const { count, error: countError } = await countQuery
				if (countError) throw countError

				if (!count) {
					setListings([])
					setCurrentPage(1)
					setHasMoreListings(false)
					setIsLoading(false)
					return
				}

				const totalItems = count
				const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)
				const safePageNumber = Math.min(page, totalPages)
				const startRange = (safePageNumber - 1) * ITEMS_PER_PAGE
				const endRange = Math.min(
					safePageNumber * ITEMS_PER_PAGE - 1,
					totalItems - 1
				)

				// Rebuild the query again for fetching data
				const dataQuery = buildBaseQuery()
				const { data, error } = await dataQuery.range(startRange, endRange)
				if (error) throw error

				const formattedData = (data || []).map(item => ({
					...item,
					dealership_name: item.dealerships.name,
					dealership_logo: item.dealerships.logo,
					dealership_phone: item.dealerships.phone,
					dealership_location: item.dealerships.location,
					dealership_latitude: item.dealerships.latitude,
					dealership_longitude: item.dealerships.longitude
				}))

				const uniqueListings = Array.from(
					new Set(formattedData.map(car => car.id))
				).map(id => formattedData.find(car => car.id === id))

				setListings(prev =>
					refresh ? uniqueListings : [...prev, ...uniqueListings]
				)
				setTotalListings(totalItems)
				setCurrentPage(safePageNumber)
				setHasMoreListings(totalItems > safePageNumber * ITEMS_PER_PAGE)
			} catch (error) {
				console.error('Error fetching listings:', error)
				Alert.alert('Error', 'Failed to fetch listings')
			} finally {
				setIsLoading(false)
				setIsRefreshing(false)
				setInitialLoading(false) // Always set initialLoading to false when done
			}
		},
		[dealership]
	)

	const handleRefresh = useCallback(() => {
		setIsRefreshing(true)
		setCurrentPage(1)
		fetchListings(1, true)
	}, [fetchListings])



  useFocusEffect(
    React.useCallback(() => {
      handleRefresh();
      return () => {

      };
    }, [handleRefresh])
  );



	const handleLoadMore = useCallback(() => {
		if (!isLoading && hasMoreListings && !isRefreshing) {
			const nextPage = currentPage + 1
			fetchListings(nextPage, false)
		}
	}, [currentPage, isLoading, hasMoreListings, isRefreshing, fetchListings])



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

	const resolveStoragePathFromUrl = useCallback((publicUrl: string, bucket: string): string | null => {
		try {
			const { pathname } = new URL(publicUrl)
			const decodedPath = decodeURIComponent(pathname)
			const bucketPath = `/storage/v1/object/public/${bucket}/`
			if (!decodedPath.startsWith(bucketPath)) {
				return null
			}
			return decodedPath.slice(bucketPath.length)
		} catch (error) {
			return null
		}
	}, [])

	const handleDeleteListing = useCallback(
		async (id: number) => {
			if (!dealership || !isSubscriptionValid()) return
			
			const tableName = viewMode === 'sale' ? 'cars' : 'cars_rent'
			
			Alert.alert(
				'Delete Listing',
				'Are you sure you want to delete this listing?',
				[
					{ text: 'Cancel', style: 'cancel' },
					{
						text: 'Delete',
						onPress: async () => {
							try {
								// First, get the car data to retrieve image URLs
								const { data: carData, error: fetchError } = await supabase
									.from(tableName)
									.select('images')
									.eq('id', id)
									.single()

								if (fetchError) throw fetchError

								// Delete images from storage if they exist
								if (carData?.images && Array.isArray(carData.images) && carData.images.length > 0) {
									for (const imageUrl of carData.images) {
										const filePath = resolveStoragePathFromUrl(imageUrl, 'cars')
										if (filePath) {
											await supabase.storage.from('cars').remove([filePath])
										}
									}
								}

								// Delete from database
								const { error: dbError } = await supabase
									.from(tableName)
									.delete()
									.eq('id', id)
									.eq('dealership_id', dealership.id)

								if (dbError) throw dbError

								setListings(prevListings =>
									prevListings.filter(listing => listing.id !== id)
								)
								Alert.alert('Success', 'Listing and all images deleted successfully')
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
		[dealership, isSubscriptionValid, resolveStoragePathFromUrl, viewMode]
	)



	const SpecItem = ({ title, icon, value, isDarkMode }:any) => (
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
			
			const tableName = viewMode === 'sale' ? 'cars' : 'cars_rent'
			const statusValue = viewMode === 'sale' ? 'sold' : 'rented'
			
			try {
				const { error } = await supabase
					.from(tableName)
					.update({
						status: statusValue,
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
							? { ...listing, status: statusValue }
							: listing
					)
				)
				setIsSoldModalVisible(false)
				setSelectedListing(null)
				Alert.alert('Success', `Listing marked as ${statusValue} successfully`)
			} catch (error) {
				console.error('Error marking as sold/rented:', error)
				Alert.alert('Error', `Failed to mark listing as ${statusValue}`)
			}
		},
		[selectedListing, dealership, isSubscriptionValid, viewMode]
	)

	const handleOnboardingComplete = useCallback(async () => {
		setShowOnboardingModal(false)
		// Refresh dealership data to get updated information
		await fetchDealership()
		// Refresh listings if needed
		handleRefresh()
	}, [fetchDealership, handleRefresh])

	const handleViewModeChange = useCallback((mode: ViewMode) => {
		viewModeRef.current = mode
		setViewMode(mode)
		setCurrentPage(1)
		setFetchTrigger(prev => prev + 1)
	}, [])

	const getStatusConfig = (status: string) => {
		switch (status.toLowerCase()) {
			case 'available':
				return { color: '#22C55E', dotColor: '#4ADE80' } // Green
			case 'pending':
				return { color: '#EAB308', dotColor: '#FDE047' } // Yellow
			case 'sold':
				return { color: '#EF4444', dotColor: '#FCA5A5' } // Red
			case 'rented':
				return { color: '#3B82F6', dotColor: '#93C5FD' } // Blue
			default:
				return { color: '#6B7280', dotColor: '#9CA3AF' } // Gray
		}
	}

const ListingCard = useMemo(
  () =>
    React.memo(({ item }: { item: CarListing }) => {
      const subscriptionValid = isSubscriptionValid();
      const statusConfig = getStatusConfig(item.status);

      // Direct navigation handler with subscription validation
      const handleCardPress = () => {
        if (!subscriptionValid) {
          Alert.alert(
            'Subscription Expired',
            'Please renew your subscription to manage listings.'
          );
          return;
        }

        // Navigate directly to edit page with viewMode
        router.push({
          pathname: '/(home)/(dealer)/AddEditListing',
          params: {
            dealershipId: dealership?.id ?? 0,
            listingId: item.id,
            mode: viewMode
          }
        });
      };

      return (
        // Add TouchableOpacity wrapper here
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleCardPress}
        >
          <Animated.View
            entering={FadeInDown}
            className={`m-4 mb-4 ${
              isDarkMode ? 'bg-textgray' : 'bg-[#e1e1e1]'
            } rounded-3xl overflow-hidden shadow-xl`}>
            {/* Image and Overlays */}
            <View className='relative'>
              <Image
                source={{ uri: item.images[0] }}
                className='w-full aspect-[24/24]'
                resizeMode='cover'
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
                      {t(`profile.inventory.${item.status.toLowerCase()}`)}
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

                {/* Remove ellipsis button here - intentionally deleted */}
              </View>

              {/* Enhanced Bottom Content */}
              <View className='absolute bottom-0 w-full p-5'>
                <View className='flex-row justify-between items-end'>
                  <View className='flex-1'>
                    <Text className='text-white text-2xl font-bold tracking-tight mb-1'>
                      {item.make} {item.model}
                    </Text>
                    <View className='flex-row items-baseline'>
                      <Text className='text-white text-3xl font-extrabold'>
                        ${item.price.toLocaleString()}
                      </Text>
                      {viewMode === 'rent' && item.rental_period && (
                        <Text className='text-white text-lg font-semibold ml-2'>
                          / {item.rental_period}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Enhanced Car Specs Section */}
            <View className='px-5 py-4'>
              <View className='flex-row justify-between'>
                <SpecItem
                  title={t('profile.inventory.year')}
                  icon='calendar-outline'
                  value={item.year}
                  isDarkMode={isDarkMode}
                />
                {/* Show mileage only for sale mode (cars table has mileage) */}
                {viewMode === 'sale' && item.mileage !== undefined && (
                  <SpecItem
                    title={t('profile.inventory.km')}
                    icon='speedometer-outline'
                    value={`${(item.mileage / 1000).toFixed(1)}k`}
                    isDarkMode={isDarkMode}
                  />
                )}
                {/* Show rental period for rent mode */}
                {viewMode === 'rent' && item.rental_period && (
                  <SpecItem
                    title={t('profile.inventory.rental_period') || 'Period'}
                    icon='time-outline'
                    value={item.rental_period.charAt(0).toUpperCase() + item.rental_period.slice(1)}
                    isDarkMode={isDarkMode}
                  />
                )}
                <SpecItem
                  title={t('profile.inventory.transmission')}
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
                {/* Show condition only for sale mode (cars_rent doesn't have condition) */}
                {viewMode === 'sale' && item.condition && (
                  <SpecItem
                    title={t('profile.inventory.condition')}
                    icon='car-sport-outline'
                    value={item.condition}
                    isDarkMode={isDarkMode}
                  />
                )}
              </View>
            </View>
          </Animated.View>
        </TouchableOpacity>
      );
    }),
  [
    isDarkMode,
    router,
    dealership,
    isSubscriptionValid,
    viewMode
  ]
);

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
    style={{ flex: 1 }}>
    {/* Header */}
	<CustomHeader 
  title={`Hello ${dealership?.name || 'Dealer'}`} 
  dealership={dealership} 
/>

    {/* Subscription Warning */}
    {(subscriptionExpired || showWarning) && (
      <BlurView
        intensity={isDarkMode ? 30 : 50}
        tint={isDarkMode ? 'dark' : 'light'}
        style={{
          marginHorizontal: 24,
          marginBottom: 16,
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: subscriptionExpired ? 'rgba(244, 63, 94, 0.2)' : 'rgba(251, 146, 60, 1)'
        }}>
        <View style={{ padding: 16 }}>
          <Text style={{
            textAlign: 'center',
            fontWeight: '800',
            color: 'white',
            textShadowColor: 'black',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 1
          }}>
            {subscriptionExpired
              ? 'Your subscription has expired. Please renew to manage listings.'
              : `Your subscription will expire in ${daysUntilExpiration} days. Please renew soon.`}
          </Text>
        </View>
      </BlurView>
    )}

    {/* Segmented Control for Sale/Rent */}
    <SegmentedControl
      mode={viewMode}
      onModeChange={handleViewModeChange}
      isDarkMode={isDarkMode}
      t={t}
    />

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
      );
      return;
    }
    router.push({
      pathname: '/(home)/(dealer)/AddEditListing',
      params: { 
        dealershipId: dealership.id,
        mode: viewMode
      }
    });
  }}
      isDarkMode={isDarkMode}
      subscriptionExpired={subscriptionExpired}
      t={t}
    />
			{/* Listings */}
			{initialLoading && (
	<ScrollView>
		<ListingSkeletonLoader />
	</ScrollView>
)}

{/* Listings - Show when not initially loading */}
{!initialLoading && (
	<FlatList
		ref={scrollRef}
		data={listings}
		renderItem={({ item }) => <ListingCard item={item} />}
		keyExtractor={item => item.id.toString()}
		showsVerticalScrollIndicator={false}
		onEndReached={handleLoadMore}
		onEndReachedThreshold={0.3}
		refreshControl={
			<RefreshControl
				refreshing={isRefreshing}
				onRefresh={handleRefresh}
				colors={['#D55004']}
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
		ListFooterComponent={() =>
			isLoading && !isRefreshing ? (
				<ActivityIndicator
					size='large'
					color='#D55004'
					style={{ padding: 20 }}
				/>
			) : null
		}
		removeClippedSubviews={true}
		maxToRenderPerBatch={5}
		windowSize={10}
		updateCellsBatchingPeriod={100}
		initialNumToRender={5}
		maintainVisibleContentPosition={{
			minIndexForVisible: 0,
			autoscrollToTopThreshold: 10
		}}
		contentContainerStyle={{
			paddingBottom: 100,
			flexGrow: listings.length === 0 ? 1 : undefined
		}}
	/>
)}

			{!subscriptionExpired && (
				<>


					<ModernFilterModal
						visible={isFilterModalVisible}
						onClose={() => setIsFilterModalVisible(false)}
						onApply={handleFilterChange}
						currentFilters={filters}
						isDarkMode={isDarkMode}
						t={t}
						viewMode={viewMode}
					/>

					<ModernSoldModal
						visible={isSoldModalVisible}
						onClose={() => setIsSoldModalVisible(false)}
						onConfirm={handleMarkAsSold}
						isDarkMode={isDarkMode}
						t={t}
					/>
				</>
			)}

			{/* Onboarding Modal - Always rendered, shown based on first_login */}
			{dealership && (
				<DealerOnboardingModal
					visible={showOnboardingModal}
					dealershipId={dealership.id}
					onComplete={handleOnboardingComplete}
				/>
			)}
		</LinearGradient>
	)
}
