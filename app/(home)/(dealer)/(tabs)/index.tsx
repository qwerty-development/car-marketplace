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
import * as Sentry from '@sentry/react-native'
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
import { formatMileage } from '@/utils/formatMileage';
import { ListingSkeletonLoader } from '../Skeleton'
import DealerOnboardingModal from '../DealerOnboardingModal'
import { LicensePlateTemplate } from '@/components/NumberPlateCard'
import { useWindowDimensions } from 'react-native'
/* CREDIT_DISABLED: Boost system temporarily disabled
import { BoostListingModal } from '@/components/BoostListingModal'
import { BoostInsightsWidget } from '@/components/BoostInsightsWidget'
*/

const ITEMS_PER_PAGE = 10
const SUBSCRIPTION_WARNING_DAYS = 7

type ViewMode = 'sale' | 'rent'
type Category = 'cars' | 'plates' | 'bikes' | 'trucks' | 'license'

interface SegmentedControlProps {
	mode: ViewMode
	onModeChange: (mode: ViewMode) => void
	isDarkMode: boolean
	t: (key: string) => string
}

interface CategoryProps {
    category: Category
    onCategoryChange: (category: Category) => void
    isDarkMode: boolean
}

const CategorySelector: React.FC<CategoryProps & { mode: ViewMode }> = ({
	category,
	onCategoryChange,
	isDarkMode,
	mode
}) => {
	const allCategories: { id: Category; label: string; icon: any }[] = [
		{ id: 'cars', label: 'Cars', icon: 'car-sport' },
		{ id: 'bikes', label: 'Bikes', icon: 'bicycle' },
		{ id: 'trucks', label: 'Trucks', icon: 'bus' },
		{ id: 'license', label: 'License', icon: 'card' },
	]

	// Do not show the 'license' category when in rent mode (can't rent number plates)
	const categories = mode === 'rent' ? allCategories.filter(c => c.id !== 'license') : allCategories
    return (
        <View style={{ height: 48, marginBottom: 8 }}>
            <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ 
                    paddingHorizontal: 16, 
                    gap: 8, 
                    alignItems: 'center',
                    height: '100%'
                }}
            >
            {categories.map((item) => {
                const isSelected = category === item.id;
                // Smaller rectangular pill style
                const bgColor = isSelected 
                    ? (isDarkMode ? '#FFFFFF' : '#000000') 
                    : (isDarkMode ? '#1C1C1E' : '#FFFFFF');
                
                const textColor = isSelected
                    ? (isDarkMode ? '#000000' : '#FFFFFF')
                    : (isDarkMode ? '#FFFFFF' : '#000000');

                return (
                    <TouchableOpacity
                        key={item.id}
                        onPress={() => onCategoryChange(item.id)}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 12, // Rectangular pill
                            backgroundColor: bgColor,
                            borderWidth: isSelected ? 0 : 1,
                            borderColor: isDarkMode ? '#333' : '#E5E7EB',
                            gap: 6
                        }}
                    >
                        <Ionicons 
                            name={item.icon} 
                            size={14} // Smaller icon
                            color={textColor} 
                        />
                        <Text style={{
                            fontWeight: '600',
                            fontSize: 13,
                            color: textColor
                        }}>
                            {item.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
            </ScrollView>
        </View>
    )
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({
	mode,
	onModeChange,
	isDarkMode,
	t
}) => {
	return (
		<View
			style={{
				flexDirection: 'row',
				backgroundColor: isDarkMode ? '#1C1C1E' : '#F3F4F6',
				borderRadius: 12,
				padding: 4,
				marginHorizontal: 16,
				marginBottom: 16 // Adjusted margin
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

const CustomHeader = ({ title, dealership, onAddPress, subscriptionExpired }:any) => {
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
      justifyContent: 'space-between',
      paddingHorizontal: 16, // Horizontal padding for the content
      paddingTop: Platform.OS === 'ios' ? 8 : 12, // Top padding for the content
    },
    leftContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    dealershipLogo: {
      width: 32, // Slightly larger logo
      height: 32,
      borderRadius: 16, // Half of width/height
      marginRight: 10, // Space between logo and text
    },
    headerText: { // Style for the main display text (dealership name or fallback)
      fontSize: 20, // Prominent font size
      fontWeight: 'bold',
      color: isDarkMode ? 'white' : 'black',
      flexShrink: 1, // Allow text to shrink if row is crowded
    },
    addButton: {
        backgroundColor: '#D55004',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        opacity: subscriptionExpired ? 0.5 : 1
    },
    addButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    }
  });

  // Determine the text to display: dealership name if available, otherwise the original title prop.
  const displayTitleText = dealership?.name ? dealership.name : title;

  return (
    // Apply SafeAreaView to the top edge; styles.container handles background and bottom padding.
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.titleContentWrapper}>
        <View style={styles.leftContent}>
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
        
        <TouchableOpacity 
            style={styles.addButton} 
            onPress={onAddPress}
            disabled={subscriptionExpired}
        >
            <Text style={styles.addButtonText}>Add new +</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ... (intermediate code omitted)

interface SearchBarProps {
	searchQuery: string
	onSearchChange: (query: string) => void
	onFilterPress: () => void
    onAddPress: () => void
	isDarkMode: boolean
    subscriptionExpired: boolean
	t: (key: string) => string
}

// ... (Search bar impl omitted)

// ...

// ...

// Inside the component return (around 1655+):

        /*
        onAddPress={() => {
            if (subscriptionExpired) {
            Alert.alert(
                'Subscription Expired',
                'Please renew your subscription to add new listings.'
            );
            return;
            }
            if (category === 'license') {
                router.push('/(home)/(dealer)/NumberPlatesManager');
                return;
            }
            
            // Map category to specific vehicle category if applicable
            let vehicleCategoryParam: string | undefined;
            if (category === 'bikes') vehicleCategoryParam = 'Motorcycle';
            if (category === 'trucks') vehicleCategoryParam = 'Truck';
            // For 'cars', we don't pass a specific category to allow user to choose Sedan/SUV/etc
            
            router.push({
            pathname: '/(home)/(dealer)/AddEditListing',
            params: { 
                dealershipId: dealership.id,
                mode: viewMode,
                // Pass the mapped category
                vehicleCategory: vehicleCategoryParam
            }
            });
        }}
        */

// ... (omitting intermediate code not relevant to this replacement chuck to stay focused, but need to be careful with range)
// Actually, I need to update the parent component usage of onAddPress too.
// I will start a separate chunk for the parent component logic to keep it clean if possible, or include it if range permits.
// The file is huge, let's look at where CategorySelector is defined. It was around line 59 in previous edit.
// I'll replace CategorySelector and SegmentedControl definitions first.


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
        backgroundColor: isDarkMode ? '#1F1F1F' : '#F3F4F6',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 0,
        borderRadius: 9999, // Pill shape
        height: 48 // Slightly taller
      }}>
        {/* Search Icon */}
        <Ionicons
          name='search-outline'
          size={20}
          color={isDarkMode ? '#a3a3a3' : '#9CA3AF'}
          style={{ marginRight: 8 }}
        />

        {/* Search Input */}
        <TextInput
          placeholder="Search..."
          value={localSearchQuery}
          onChangeText={handleTextChange}
          placeholderTextColor={isDarkMode ? '#a3a3a3' : '#9CA3AF'}
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

        {/* Clear Button or Filter Button */}
        {localSearchQuery.length > 0 ? (
          <TouchableOpacity onPress={handleClearSearch} style={{ padding: 4 }}>
            <Ionicons
              name='close-circle'
              size={20}
              color={isDarkMode ? '#a3a3a3' : '#9CA3AF'}
            />
          </TouchableOpacity>
        ) : null}

        <View style={{ width: 1, height: 24, backgroundColor: isDarkMode ? '#333' : '#E5E7EB', marginHorizontal: 8 }} />

         {/* Filter Button integrated */}
         <TouchableOpacity
          onPress={onFilterPress}
          disabled={subscriptionExpired}
          style={{
            padding: 4,
            opacity: subscriptionExpired ? 0.5 : 1
          }}>
          <Ionicons
            name='options-outline' // Or 'filter'
            size={20}
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
	status: 'available' | 'pending' | 'sold' | 'rented' | 'deleted'
	condition?: 'New' | 'Used' // Optional - not present in cars_rent
	mileage?: number // Optional - not present in cars_rent
	transmission: 'Manual' | 'Automatic'
	rental_period?: string // Optional - for rent listings (daily, weekly, monthly, hourly)
	is_boosted?: boolean // Optional - boost status
	boost_priority?: number // Optional - boost priority level
	boost_end_date?: string // Optional - boost end date
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
    const [category, setCategory] = useState<Category>('cars')
    const router=useRouter()
    const { width: windowWidth } = useWindowDimensions()
	const [plates, setPlates] = useState<any[]>([])
	const [isListingModalVisible, setIsListingModalVisible] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [hasMoreListings, setHasMoreListings] = useState(true)
	const [isFilterModalVisible, setIsFilterModalVisible] = useState(false)
	const [isSoldModalVisible, setIsSoldModalVisible] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [totalListings, setTotalListings] = useState(0)
	const [showOnboardingModal, setShowOnboardingModal] = useState(false)
	/* CREDIT_DISABLED: Boost state disabled
	const [showBoostModal, setShowBoostModal] = useState(false)
	const [selectedCarForBoost, setSelectedCarForBoost] = useState<number | null>(null)
	*/
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
    const categoryRef = useRef(category)
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
				
				const currentViewMode = viewModeRef.current
                const currentCategory = categoryRef.current

				if (currentCategory === 'license') { // Or 'plates' if you kept that value
					setIsLoading(true)
					try {
						const { data, error } = await supabase
							.from('number_plates')
							.select('*')
							.eq('dealership_id', dealership.id)
							.neq('status', 'deleted')
							.order('created_at', { ascending: false })

						if (error) throw error
						setPlates(data || [])
						setListings([])
						// Plates don't support pagination yet in this implementation
						setHasMoreListings(false)
					} catch (error) {
						console.error('Error fetching plates:', error)
						Alert.alert('Error', 'Failed to fetch number plates')
					} finally {
						setIsLoading(false)
						setIsRefreshing(false)
						setInitialLoading(false)
					}
					return
				}

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

				// Determine which table to query based on view mode (only for cars currently)
				const tableName = currentViewMode === 'sale' ? 'cars' : 'cars_rent'

				// Helper to build a fresh query with all conditions
				const buildBaseQuery = () => {
					// Build select string based on view mode
					// cars_rent only has dealerships, no users relationship
					// Use explicit FK hint for users since there are multiple relationships (user_id and deleted_by)
					const selectString = currentViewMode === 'sale'
						? '*, dealerships!inner(name,logo,phone,location,latitude,longitude), users!cars_user_id_fkey(name, id, phone_number)'
						: '*, dealerships!inner(name,logo,phone,location,latitude,longitude)'
					
					let query = supabase
						.from(tableName)
						.select(selectString, { count: 'exact' })
						.eq('dealership_id', dealership.id)
						.neq('status', 'deleted')
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

				const formattedData = (data || []).map((item: any) => {
					// For dealer listings, always dealer type
					// In sale mode, check if it's a dealer or user listing
					const isDealer = !!item.dealership_id;
					return {
						...item,
						seller_type: 'dealer',
						seller_name: item.dealerships?.name || null,
						dealership_name: item.dealerships?.name || null,
						dealership_logo: item.dealerships?.logo || null,
						dealership_phone: item.dealerships?.phone || null,
						dealership_location: item.dealerships?.location || null,
						dealership_latitude: item.dealerships?.latitude || null,
						dealership_longitude: item.dealerships?.longitude || null
					};
				})

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
			
			if (category === 'license') {
		        Alert.alert(
		          'Delete Plate',
		          'Are you sure you want to delete this number plate? It will be hidden from all users.',
		          [
		            { text: 'Cancel', style: 'cancel' },
		            {
		              text: 'Delete',
		              style: 'destructive',
		              onPress: async () => {
		                try {
		                  const { error: dbError } = await supabase
		                    .from('number_plates')
		                    .update({ status: 'deleted' })
		                    .eq('id', id)

		                  if (dbError) throw dbError

		                  setPlates(prev => prev.filter(p => p.id !== id))
		                  Alert.alert('Success', 'Number plate deleted successfully')
		                } catch (error) {
		                  console.error('Error deleting plate:', error)
		                  Alert.alert('Error', 'Failed to delete number plate')
		                }
		              }
		            }
		          ]
		        )
				return
			}

			const tableName = viewMode === 'sale' ? 'cars' : 'cars_rent'
			
			Alert.alert(
				'Delete Listing',
				'Are you sure you want to delete this listing? It will be hidden from all users but conversations will be preserved.',
				[
					{ text: 'Cancel', style: 'cancel' },
					{
						text: 'Delete',
						onPress: async () => {
							try {
								// Soft delete: update status to 'deleted' instead of hard delete
								// The database trigger will automatically set deleted_at and deleted_by
								const { error: updateError } = await supabase
									.from(tableName)
									.update({ status: 'deleted' })
									.eq('id', id)
									.eq('dealership_id', dealership.id)

								if (updateError) throw updateError

								setListings(prevListings =>
									prevListings.filter(listing => listing.id !== id)
								)
								Alert.alert('Success', 'Listing deleted successfully')
							} catch (error) {
								console.error('Error in handleDeleteListing:', error)
								
								// Capture error to Sentry with context
								Sentry.captureException(error, {
									tags: {
										action: 'delete_listing',
										view_mode: viewMode,
									},
									contexts: {
										listing: {
											listing_id: id,
											table_name: tableName,
											dealership_id: dealership?.id,
										},
									},
								})
								
								Alert.alert('Error', 'Failed to delete listing')
							}
						},
						style: 'destructive'
					}
				]
			)
		},
		[dealership, isSubscriptionValid, viewMode]
	)



	const SpecItem = ({ title, icon, value, isDarkMode }:any) => (
		<View className='flex-1 items-center justify-center'>
            <Text
				className={`text-[10px] uppercase font-bold text-center mb-1 ${
					isDarkMode ? 'text-neutral-500' : 'text-neutral-400'
				}`}
            >
                {title}
            </Text>
			<Ionicons
				name={icon}
				size={20}
				color={isDarkMode ? '#FFFFFF' : '#000000'}
				style={{ marginVertical: 2 }}
			/>
			<Text
				className={`text-xs font-bold mt-1 ${
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
				
				// Capture error to Sentry with context for debugging client-specific issues
				Sentry.captureException(error, {
					tags: {
						action: 'mark_as_sold_from_listing',
						view_mode: viewMode,
						status_value: statusValue,
					},
					contexts: {
						listing: {
							listing_id: selectedListing?.id,
							table_name: tableName,
							dealership_id: dealership?.id,
							make: selectedListing?.make,
							model: selectedListing?.model,
						},
						sold_info: {
							price: soldInfo?.price,
							date: soldInfo?.date,
							buyer_name: soldInfo?.buyer_name,
						},
					},
				})
				
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

		// If switching to rent mode, ensure we don't stay on the 'license' category
		if (mode === 'rent' && categoryRef.current === 'license') {
			categoryRef.current = 'cars'
			setCategory('cars')
		}

		setCurrentPage(1)
		setFetchTrigger(prev => prev + 1)
	}, [])

    const handleCategoryChange = useCallback((newCategory: Category) => {
        categoryRef.current = newCategory
        setCategory(newCategory)
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

	/* CREDIT_DISABLED: Boost handler disabled
	const handleBoostPress = useCallback((carId: number) => {
		if (!isSubscriptionValid()) {
			Alert.alert(
				'Subscription Expired',
				'Please renew your subscription to boost listings.'
			);
			return;
		}
		setSelectedCarForBoost(carId);
		setShowBoostModal(true);
	}, [isSubscriptionValid]);
	*/

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
              isDarkMode ? 'bg-[#1a1a1a]' : 'bg-white'
            } rounded-3xl overflow-hidden shadow-sm border ${isDarkMode ? 'border-neutral-800' : 'border-gray-100'}`}>
            {/* Image and Overlays */}
            <View className='relative'>
              <Image
                source={{ uri: item.images[0] }}
                className='w-full aspect-[4/3]'
                resizeMode='cover'
              />

            {/* Gradient Overlay for Text Readability */}
              <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.8)']}
                  style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: '50%',
                  }}
              />

              {/* Top Actions Row */}
              <View className='absolute top-4 w-full px-4 flex-row justify-between items-center'>
                <View className='flex-row items-center'>
                  {/* Enhanced Status Badge with dot indicator */}
                  <View
                    style={{ backgroundColor: statusConfig.color }}
                    className='rounded-full px-3 py-1.5 flex-row items-center'>
                    <View
                      style={{ backgroundColor: statusConfig.dotColor }}
                      className='w-1.5 h-1.5 rounded-full mr-2'
                    />
                    <Text className='text-white text-[10px] font-bold uppercase tracking-wider'>
                      {/* {t(`profile.inventory.${item.status.toLowerCase()}`)} */}
                      AVAILABLE
                    </Text>
                  </View>
                </View>

                 {/* Enhanced Stats Container */}
                <View className='flex-row space-x-2'>
                    <View className='flex-row items-center bg-black/40 backdrop-blur-md rounded-full px-3 py-1.5'>
                        <FontAwesome name='eye' size={10} color='#FFFFFF' style={{ marginRight: 4 }} />
                        <Text className='text-white text-[10px] font-bold'>
                            {item.views || 0}
                        </Text>
                        <Text className="text-white/50 mx-1">|</Text>
                        <FontAwesome name='heart' size={10} color='#FFFFFF' style={{ marginRight: 4 }} />
                        <Text className='text-white text-[10px] font-bold'>
                            {item.likes || 0}
                        </Text>
                    </View>
                </View>
              </View>

              {/* Enhanced Bottom Content */}
              <View className='absolute bottom-0 w-full p-4'>
                    <Text className='text-white text-xl font-bold tracking-tight mb-0.5' numberOfLines={1}>
                      {item.make} {item.model}
                    </Text>
                    <View className='flex-row items-baseline'>
                      <Text className='text-white text-2xl font-extrabold'>
                        ${item.price.toLocaleString()}
                      </Text>
                      {viewMode === 'rent' && item.rental_period && (
                        <Text className='text-white/80 text-sm font-semibold ml-1'>
                          / {item.rental_period}
                        </Text>
                      )}
                    </View>
              </View>
            </View>

            {/* Enhanced Car Specs Section */}
            <View className={`px-4 py-4 ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-gray-50'}`}>
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
                    value={formatMileage(item.mileage)}
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

            {/* CREDIT_DISABLED: Boost Button Section - Only for available listings in sale mode
            {item.status === 'available' && viewMode === 'sale' && (
              <View className='px-5 pb-4'>
                {item.is_boosted && item.boost_end_date && new Date(item.boost_end_date) > new Date() ? (
                  <View className={`flex-row items-center justify-between p-3 rounded-xl ${isDarkMode ? 'bg-orange-900/20 border border-orange-500/30' : 'bg-orange-50 border border-orange-200'}`}>
                    <View className='flex-row items-center flex-1'>
                      <Ionicons name="rocket" size={20} color="#D55004" />
                      <View className='ml-2 flex-1'>
                        <Text className={`font-semibold ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                          Boosted - Priority {item.boost_priority}
                        </Text>
                        <Text className={`text-xs ${isDarkMode ? 'text-orange-300/70' : 'text-orange-500'}`}>
                          Until {new Date(item.boost_end_date).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleBoostPress(item.id);
                      }}
                      className='bg-orange-500 px-3 py-2 rounded-lg'
                    >
                      <Text className='text-white font-semibold text-xs'>Extend</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleBoostPress(item.id);
                    }}
                    className='bg-orange-500 p-3 rounded-xl flex-row items-center justify-center'
                  >
                    <Ionicons name="rocket-outline" size={20} color="white" />
                    <Text className='text-white font-bold ml-2'>Boost Listing</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            */}
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
    /* CREDIT_DISABLED: , handleBoostPress */
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
        subscriptionExpired={subscriptionExpired}
        onAddPress={() => {
            if (subscriptionExpired) {
            Alert.alert(
                'Subscription Expired',
                'Please renew your subscription to add new listings.'
            );
            return;
            }
            if (category === 'license') {
                router.push('/(home)/(dealer)/NumberPlatesManager');
                return;
            }

            let vehicleCategoryParam: string | undefined;
            if (category === 'bikes') vehicleCategoryParam = 'Motorcycle';
            if (category === 'trucks') vehicleCategoryParam = 'Truck';

            router.push({
            pathname: '/(home)/(dealer)/AddEditListing',
            params: { 
                dealershipId: dealership.id,
                mode: viewMode,
                vehicleCategory: vehicleCategoryParam
            }
            });
        }}
    />

    {/* Search and Filter Bar */}
    <ModernSearchBar
      searchQuery={searchQuery}
      onSearchChange={handleSearchChange}
      onFilterPress={() => setIsFilterModalVisible(true)}
      onAddPress={() => {}} // Not used anymore but kept for prop interface
      isDarkMode={isDarkMode}
      subscriptionExpired={subscriptionExpired}
      t={t}
    />

    {/* Segmented Control for Sale/Rent */}
    <SegmentedControl
      mode={viewMode}
      onModeChange={handleViewModeChange}
      isDarkMode={isDarkMode}
      t={t}
    />
    
    {/* Category Selector */}
    <CategorySelector
        category={category}
				onCategoryChange={handleCategoryChange}
				isDarkMode={isDarkMode}
				mode={viewMode}
    />
			{/* Listings */}
			{initialLoading && (
                <ScrollView 
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 100 }}
                >
                    <ListingSkeletonLoader />
                </ScrollView>
            )}

{/* Listings - Show when not initially loading */}
{!initialLoading && (
	<FlatList
		ref={scrollRef}
		data={category === 'license' ? plates : listings}
		renderItem={({ item }) => {
			if (category === 'license') {
				// Calculate width for consistency with NumberPlatesManager
				const platePreviewWidth = windowWidth - 64; // Account for padding
				
				return (
					<View className={`m-4 mb-2 ${isDarkMode ? 'bg-neutral-900' : 'bg-gray-50'} rounded-2xl overflow-hidden`}>
						<View
							style={{
								paddingVertical: 16,
								paddingHorizontal: 12,
								backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
								justifyContent: 'center',
								alignItems: 'center',
							}}
						>
							<LicensePlateTemplate
								letter={item.letter}
								digits={item.digits}
								width={platePreviewWidth}
							/>
						</View>
						<View className="p-4">
							<View className="flex-row items-center justify-between">
								<View className="flex-1">
									<Text className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-black'}`} style={{ letterSpacing: 2 }}>
										{item.letter} {item.digits}
									</Text>
									<Text className={`text-lg text-orange-600 font-semibold mt-1`}>
										${parseFloat(item.price).toLocaleString()}
									</Text>
								</View>
								<TouchableOpacity
									onPress={() => handleDeleteListing(item.id)}
									className="justify-center p-2"
								>
									<Ionicons name="trash-outline" size={24} color="#ef4444" />
								</TouchableOpacity>
							</View>
						</View>
					</View>
				)
			}
			return <ListingCard item={item} />
		}}
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

			{/* CREDIT_DISABLED: Boost Listing Modal
			{selectedCarForBoost && (
				<BoostListingModal
					visible={showBoostModal}
					onClose={() => {
						setShowBoostModal(false);
						setSelectedCarForBoost(null);
					}}
					carId={selectedCarForBoost}
					isDarkMode={isDarkMode}
					onSuccess={() => {
						setShowBoostModal(false);
						setSelectedCarForBoost(null);
						// Refresh listings to show updated boost status
						fetchListings();
					}}
				/>
			)}
			*/}
		</LinearGradient>
	)
}
