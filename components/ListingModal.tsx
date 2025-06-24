import React, {
	useState,
	useCallback,
	useEffect,
	memo,
	useRef,
	useMemo
} from 'react'
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	Modal,
	ScrollView,
	KeyboardAvoidingView,
	Platform,
	Alert,
	Dimensions,
	Pressable,
	ActivityIndicator,
	FlatList
} from 'react-native'
import {
	FontAwesome,
	Ionicons,
	MaterialCommunityIcons
} from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { supabase } from '@/utils/supabase'
import { Buffer } from 'buffer'
import DraggableFlatList from 'react-native-draggable-flatlist'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useTheme } from '@/utils/ThemeContext'
import DateTimePicker from '@react-native-community/datetimepicker'
import { BlurView } from 'expo-blur'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import DateTimePickerModal from 'react-native-modal-datetime-picker'
import * as Haptics from 'expo-haptics'

import { format } from 'date-fns'
import { getLogoUrl } from '@/hooks/getLogoUrl'

const { width } = Dimensions.get('window')

// Constants
export const VEHICLE_TYPES = [
	{ value: 'Benzine', label: 'Benzine', icon: 'gas-station' },
	{ value: 'Diesel', label: 'Diesel', icon: 'fuel' },
	{ value: 'Electric', label: 'Electric', icon: 'lightning-bolt' },
	{ value: 'Hybrid', label: 'Hybrid', icon: 'leaf' }
]

export const CATEGORIES = [
	{ value: 'Sedan', label: 'Sedan', icon: 'car-side' },
	{ value: 'SUV', label: 'SUV', icon: 'car-estate' },
	{ value: 'Coupe', label: 'Coupe', icon: 'car-sports' },
	{ value: 'Convertible', label: 'Convertible', icon: 'car-convertible' },
	{ value: 'Hatchback', label: 'Hatchback', icon: 'car-hatchback' },
	{ value: 'Sports', label: 'Sports', icon: 'car-sports' },
	{ value: 'Classic', label: 'Classic', icon: 'car-convertible' }
]

export const TRANSMISSIONS = [
	{ value: 'Automatic', label: 'Automatic', icon: 'cog-clockwise' },
	{ value: 'Manual', label: 'Manual', icon: 'cog' }
]

export const DRIVE_TRAINS = [
	{ value: 'FWD', label: 'Front Wheel Drive', icon: 'car-traction-control' },
	{ value: 'RWD', label: 'Rear Wheel Drive', icon: 'car-traction-control' },
	{ value: 'AWD', label: 'All Wheel Drive', icon: 'car-traction-control' },
	{ value: '4WD', label: '4 Wheel Drive', icon: 'car-traction-control' },
	{ value: '4x4', label: '4x4', icon: 'car-traction-control' }
]

export const CONDITIONS = [
	{ value: 'New', label: 'New', icon: 'star' },
	{ value: 'Used', label: 'Used', icon: 'star-half' }
]

export const BrandSelector = memo(
	({ selectedBrand, onSelectBrand, isDarkMode }: any) => {
		// State Management
		const [brands, setBrands] = useState<any[]>([])
		const [showAllBrands, setShowAllBrands] = useState(false)
		const [searchQuery, setSearchQuery] = useState('')
		const [isLoading, setIsLoading] = useState(true)
		const [error, setError] = useState<string | null>(null)
		const [currentPage, setCurrentPage] = useState(0)
		const [hasMore, setHasMore] = useState(true)
		const PAGE_SIZE = 20


		// Fetch ALL Brands Data
		useEffect(() => {
			const fetchAllBrands = async () => {
				setIsLoading(true)
				setError(null)

				try {
					let allMakes = new Set<string>()
					let hasMoreRecords = true
					let page = 0
					const recordsPerBatch = 1000

					while (hasMoreRecords) {
						console.log(`Fetching batch ${page + 1}...`)

						const { data, error: supabaseError } = await supabase
							.from('allcars')
							.select('make')
							.range(page * recordsPerBatch, (page + 1) * recordsPerBatch - 1)
							.order('make')

						if (supabaseError) {
							console.error('Supabase error:', supabaseError)
							throw supabaseError
						}

						if (!data || data.length === 0) {
							console.log('No more records found')
							hasMoreRecords = false
							break
						}

						console.log(`Received ${data.length} records in batch ${page + 1}`)

						data.forEach(item => {
							if (
								item.make &&
								typeof item.make === 'string' &&
								item.make.trim()
							) {
								allMakes.add(item.make.trim())
							}
						})

						page++
						hasMoreRecords = data.length === recordsPerBatch
					}

					const uniqueBrands = Array.from(allMakes).sort((a, b) =>
						a.localeCompare(b)
					)
					console.log('Total unique brands found:', uniqueBrands.length)

					const brandsData = uniqueBrands.map(make => ({
						name: make,
						logoUrl: getLogoUrl(make, !isDarkMode)
					}))

					setBrands(brandsData)
				} catch (err) {
					const errorMessage =
						err instanceof Error ? err.message : 'Failed to fetch brands'
					setError(errorMessage)
					console.error('Error fetching brands:', err)
				} finally {
					setIsLoading(false)
				}
			}

			fetchAllBrands()
		}, [isDarkMode, getLogoUrl])

		// Filter brands based on search query
		const filteredBrands = useMemo(
			() =>
				brands.filter(brand =>
					brand.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
				),
			[brands, searchQuery]
		)

		// Get paginated brands for the modal
		const paginatedBrands = useMemo(() => {
			const start = currentPage * PAGE_SIZE
			const end = start + PAGE_SIZE
			return filteredBrands.slice(0, end) // Include all previous pages plus current page
		}, [filteredBrands, currentPage])

		// Load more function for pagination
		const loadMore = useCallback(() => {
			if ((currentPage + 1) * PAGE_SIZE < filteredBrands.length) {
				setCurrentPage(prev => prev + 1)
				setHasMore(true)
			} else {
				setHasMore(false)
			}
		}, [currentPage, filteredBrands.length])

		// Reset pagination when search query changes
		useEffect(() => {
			setCurrentPage(0)
			setHasMore(true)
		}, [searchQuery])

		// Render brand item component
		const BrandItem = useCallback(
			({ brand, isSelected, onPress, size = 'normal' }: any) => (
				<TouchableOpacity
					onPress={onPress}
					className={`${size === 'normal' ? 'mr-3' : ''} ${
						isSelected ? 'scale-110' : ''
					}`}>
					<BlurView
						intensity={isDarkMode ? 20 : 40}
						tint={isDarkMode ? 'dark' : 'light'}
						className={`rounded-2xl p-4 ${
							size === 'normal'
								? 'w-[110px] h-[150px]'
								: 'flex-row items-center p-4 mb-2'
						} justify-between items-center`}>
						<View
							className={`${
								size === 'normal' ? 'w-[60px] h-[60px]' : 'w-12 h-12'
							} justify-center items-center`}>
							<Image
								source={{ uri: brand.logoUrl }}
								style={{
									width: size === 'normal' ? 60 : 40,
									height: size === 'normal' ? 60 : 40
								}}
								contentFit='contain'
							/>
						</View>
						<Text
							className={`${
								size === 'normal' ? 'text-center' : 'flex-1 ml-3'
							} text-sm font-medium
			  ${isSelected ? 'text-red' : isDarkMode ? 'text-white' : 'text-black'}`}
							numberOfLines={2}>
							{brand.name}
						</Text>
					</BlurView>
				</TouchableOpacity>
			),
			[isDarkMode]
		)

		if (isLoading) {
			return (
				<View className='flex-1 justify-center items-center'>
					<ActivityIndicator size='large' color='#FF0000' />
				</View>
			)
		}

		if (error) {
			return (
				<View className='p-4'>
					<Text className='text-red-500'>Error: {error}</Text>
					<TouchableOpacity
						onPress={() => window.location.reload()}
						className='mt-2 bg-red-500 p-2 rounded'>
						<Text className='text-white text-center'>Retry</Text>
					</TouchableOpacity>
				</View>
			)
		}

		return (
			<View>
				{/* Header */}
				<View className='flex-row items-center justify-between mb-4'>
					<Text
						className={`text-lg font-bold ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
						{brands.length} Brands Available
					</Text>
					<TouchableOpacity
						onPress={() => {
							setShowAllBrands(true)
							setCurrentPage(0)
							setHasMore(true)
						}}
						className='ml-auto bg-red px-3 py-1 rounded-full'>
						<Text className='text-white'>View All</Text>
					</TouchableOpacity>
				</View>

				{/* Horizontal Scrollable List */}
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					className='mb-6'
					contentContainerStyle={{ paddingRight: 20 }}>
					{brands.map(brand => (
						<BrandItem
							key={brand.name}
							brand={brand}
							isSelected={selectedBrand === brand.name}
							onPress={() =>
								onSelectBrand(selectedBrand === brand.name ? '' : brand.name)
							}
						/>
					))}
				</ScrollView>

				{/* All Brands Modal with Pagination */}
				<Modal
					visible={showAllBrands}
					animationType='slide'
					transparent={true}
					onRequestClose={() => setShowAllBrands(false)}>
					<BlurView
						intensity={isDarkMode ? 20 : 40}
						tint={isDarkMode ? 'dark' : 'light'}
						className='flex-1'>
						<TouchableOpacity
							className='flex-1'
							
							onPress={() => setShowAllBrands(false)}
						/>
						<View
							
							className={`h-[85%] rounded-t-3xl ${
								isDarkMode ? 'bg-black' : 'bg-white'
							}`}>
							<View className='p-4'>
								{/* Modal Header */}
								<View className='items-center mb-2'>
									<View className='w-16 h-1 rounded-full bg-gray-300' />
								</View>

								<View className='flex-row justify-between items-center mb-4'>
									<Text
										className={`text-xl font-bold ${
											isDarkMode ? 'text-white' : 'text-black'
										}`}>
										All Brands ({filteredBrands.length})
									</Text>
									<TouchableOpacity
										onPress={() => setShowAllBrands(false)}
										className='p-2'>
										<Ionicons
											name='close'
											size={24}
											color={isDarkMode ? 'white' : 'black'}
										/>
									</TouchableOpacity>
								</View>

								{/* Search Bar */}
								<View
									className={`flex-row items-center rounded-full border border-[#ccc] dark:border-[#555] px-4 h-12 mb-4`}>
									<FontAwesome
										name='search'
										size={20}
										color={isDarkMode ? 'white' : 'black'}
									/>
									<TextInput
                   textAlignVertical="center"
										className={`flex-1 px-3 h-full ${
											isDarkMode ? 'text-white' : 'text-black'
										}`}
										style={{ textAlignVertical: 'center' }}
										placeholder='Search brands...'
										placeholderTextColor={isDarkMode ? 'lightgray' : 'gray'}
										value={searchQuery}
										onChangeText={text => {
											setSearchQuery(text)
											setCurrentPage(0)
										}}
									/>
									{searchQuery ? (
										<TouchableOpacity
											onPress={() => {
												setSearchQuery('')
												setCurrentPage(0)
											}}>
											<Ionicons
												name='close-circle'
												size={20}
												color={isDarkMode ? 'white' : 'black'}
											/>
										</TouchableOpacity>
									) : null}
								</View>

								{/* Brands List with Infinite Scroll */}
								<FlatList
									data={paginatedBrands}
									renderItem={({ item: brand }) => (
										<BrandItem
											key={brand.name}
											brand={brand}
											isSelected={selectedBrand === brand.name}
											onPress={() => {
												onSelectBrand(
													selectedBrand === brand.name ? '' : brand.name
												)
												setShowAllBrands(false)
											}}
											size='large'
										/>
									)}
									keyExtractor={item => item.name}
									onEndReached={loadMore}
									onEndReachedThreshold={0.5}
									ListFooterComponent={() =>
										hasMore ? (
											<View className='py-4'>
												<ActivityIndicator size='small' color='#FF0000' />
											</View>
										) : (
											<View className='h-32' />
										)
									}
								/>
							</View>
						</View>
					</BlurView>
				</Modal>
			</View>
		)
	}
)

export const VEHICLE_COLORS = [
  { name: 'Black', gradient: ['#000000', '#1a1a1a'] },
  { name: 'White', gradient: ['#ffffff', '#f5f5f5'] },
  { name: 'Silver', gradient: ['#C0C0C0', '#A8A8A8'] },
  { name: 'Neutral', gradient: ['#808080', '#666666'] },
  { name: 'Red', gradient: ['#FF0000', '#CC0000'] },
  { name: 'Blue', gradient: ['#0000FF', '#0000CC'] },
  { name: 'Green', gradient: ['#008000', '#006600'] },
  { name: 'Brown', gradient: ['#8B4513', '#723A0F'] },
  { name: 'Beige', gradient: ['#F5F5DC', '#E8E8D0'] },
  { name: 'Gold', gradient: ['#FFD700', '#CCAC00'] },
  { name: 'Yellow', gradient: ['#FFFF00', '#CCCC00'] },
  { name: 'Orange', gradient: ['#FFA500', '#CC8400'] },
  { name: 'Purple', gradient: ['#800080', '#660066'] },
  { name: 'Maroon', gradient: ['#800000', '#660000'] },
  { name: 'Teal', gradient: ['#008080', '#006666'] },
  { name: 'Pink', gradient: ['#FFC0CB', '#FF99A9'] },
  { name: 'Navy', gradient: ['#000080', '#000066'] },
  { name: 'Charcoal', gradient: ['#333333', '#1a1a1a'] },
  { name: 'Champagne', gradient: ['#F7E7CE', '#E6D5B8'] },
  { name: 'Dark Green', gradient: ['#006400', '#004d00'] },
  { name: 'Burgundy', gradient: ['#800020', '#660019'] },
  { name: 'Light Blue', gradient: ['#ADD8E6', '#87CEEB'] },
];

// Model Dropdown Component
export const ModelDropdown = memo(
	({ make, value, onChange, error, isDarkMode }: any) => {
		const [isOpen, setIsOpen] = useState(false)
		const [models, setModels] = useState<string[]>([])
		const [isLoading, setIsLoading] = useState(false)

		useEffect(() => {
			const fetchModels = async () => {
				if (!make) return

				setIsLoading(true)
				try {
					const { data, error } = await supabase
						.from('allcars')
						.select('model')
						.eq('make', make)
						.order('model')

					if (error) throw error

					// Extract unique models
					const uniqueModels = Array.from(new Set(data.map(item => item.model)))
					setModels(uniqueModels)
				} catch (err) {
					console.error('Error fetching models:', err)
				} finally {
					setIsLoading(false)
				}
			}

			fetchModels()
		}, [make])

		return (
			<View className='mb-6'>
				<Text
					className={`text-sm font-medium mb-2 ${
						isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
					}`}>
					Model {error && <Text className='text-red'>*</Text>}
				</Text>

				<TouchableOpacity
					onPress={() => setIsOpen(true)}
					className={`
          rounded-2xl overflow-hidden
          ${error ? 'border border-red' : ''}
        `}>
					<BlurView
						intensity={isDarkMode ? 20 : 40}
						tint={isDarkMode ? 'dark' : 'light'}
						className='p-4'>
						<View className='flex-row justify-between items-center'>
							<View className='flex-row items-center flex-1'>
								<MaterialCommunityIcons
									name='car-info'
									size={20}
									color={isDarkMode ? '#fff' : '#000'}
								/>
								<Text
									className={`
                ml-3 text-base
                ${isDarkMode ? 'text-white' : 'text-black'}
              `}>
									{value || 'Select Model'}
								</Text>
							</View>
							{isLoading ? (
								<ActivityIndicator size='small' color='#D55004' />
							) : (
								<Ionicons
									name='chevron-down'
									size={20}
									color={isDarkMode ? '#fff' : '#000'}
								/>
							)}
						</View>
					</BlurView>
				</TouchableOpacity>

				<Modal
					visible={isOpen}
					transparent
					onRequestClose={() => setIsOpen(false)}>
					<TouchableOpacity
						className='flex-1 bg-black/50'
						onPress={() => setIsOpen(false)}>
						<BlurView
							intensity={isDarkMode ? 30 : 20}
							tint={isDarkMode ? 'dark' : 'light'}
							className='flex-1'>
							<View
								
								className={`
                mt-auto rounded-t-3xl overflow-hidden
                ${isDarkMode ? 'bg-black' : 'bg-white'}
              `}>
								<View className='p-4 border-b border-neutral-200/10'>
									<Text
										className={`
                  text-xl font-bold text-center
                  ${isDarkMode ? 'text-white' : 'text-black'}
                `}>
										Select {make} Model
									</Text>
								</View>

								<ScrollView className='max-h-96 p-4'>
									{models.map(model => (
										<TouchableOpacity
											key={model}
											onPress={() => {
												onChange(model)
												setIsOpen(false)
											}}
											className={`
                      p-4 rounded-xl mb-2
                      ${
												value === model
													? 'bg-red'
													: isDarkMode
													? 'bg-[#1c1c1c]'
													: 'bg-[#f5f5f5]'
											}
                    `}>
											<Text
												className={`
                      text-base
                      ${
												value === model
													? 'text-white font-medium'
													: isDarkMode
													? 'text-white'
													: 'text-black'
											}
                    `}>
												{model}
											</Text>
										</TouchableOpacity>
									))}
								</ScrollView>
							</View>
						</BlurView>
					</TouchableOpacity>
				</Modal>
			</View>
		)
	}
)

// Enhanced Color Selector Component
export const EnhancedColorSelector = memo(({ value, onChange, isDarkMode }: any) => {
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			className='mb-6'>
			{VEHICLE_COLORS.map(color => (
				<TouchableOpacity
					key={color.name}
					onPress={() => onChange(color.name)}
					className={`mr-4 ${value === color.name ? 'scale-110' : ''}`}>
					<BlurView
						intensity={isDarkMode ? 20 : 40}
						tint={isDarkMode ? 'dark' : 'light'}
						className='p-2 rounded-2xl'>
						<LinearGradient
							colors={color.gradient}
							className='w-16 h-16 rounded-xl mb-2'
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 1 }}
						/>
						<Text
							className={`
              text-center text-sm font-medium
              ${
								value === color.name
									? 'text-red'
									: isDarkMode
									? 'text-white'
									: 'text-black'
							}
            `}>
							{color.name}
						</Text>
					</BlurView>
				</TouchableOpacity>
			))}
		</ScrollView>
	)
})

// Futuristic Input Component
export const NeumorphicInput = memo(
	({
		label,
		value,
		onChangeText,
		placeholder,
		keyboardType = 'default',
		multiline = false,
		required = false,
		error,
		isDarkMode,
		icon,
		prefix,
		suffix
	}: any) => (
		<View className='mb-6'>
			<Text
				className={`
      text-sm font-medium mb-2
      ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}
    `}>
				{label} {required && <Text className='text-red'>*</Text>}
			</Text>

			<View
				className={`
      rounded-2xl overflow-hidden
      ${isDarkMode ? 'bg-[#1c1c1c]' : 'bg-[#f5f5f5]'}
    `}>
				<BlurView
					intensity={isDarkMode ? 20 : 40}
					tint={isDarkMode ? 'dark' : 'light'}
					className='flex-row items-center p-1'>
					{icon && (
						<View
							className={`
            p-3 rounded-xl mr-2
            ${isDarkMode ? 'bg-black/30' : 'bg-white/30'}
          `}>
							<MaterialCommunityIcons
								name={icon}
								size={20}
								color={isDarkMode ? '#fff' : '#000'}
							/>
						</View>
					)}

					<View className='flex-1 flex-row items-center'>
						{prefix && (
							<Text
								className={`
              mr-2 font-medium
              ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}
            `}>
								{prefix}
							</Text>
						)}

						<TextInput
             textAlignVertical="center"
							value={value?.toString()}
							onChangeText={onChangeText}
							placeholder={placeholder}
							placeholderTextColor={isDarkMode ? '#666' : '#999'}
							keyboardType={keyboardType}
							multiline={multiline}
							numberOfLines={multiline ? 4 : 1}
							className={`
              flex-1 text-base px-2 py-3
              ${isDarkMode ? 'text-white' : 'text-black'}
            `}
							style={{
								height: multiline ? 100 : 50,
								textAlignVertical: multiline ? 'top' : 'center'
							}}
						/>

						{suffix && (
							<Text
								className={`
              ml-2 font-medium
              ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}
            `}>
								{suffix}
							</Text>
						)}
					</View>
				</BlurView>
			</View>

			{error && <Text className='text-red text-xs mt-1 ml-1'>{error}</Text>}
		</View>
	)
)

// Selection Option Component
export const SelectionCard = memo(
	({
		label = '',
		icon = 'car',
		isSelected = false,
		onSelect = () => {},
		isDarkMode = false,
		imageUrl = null
	}: any) => (
		<TouchableOpacity onPress={onSelect} className='mr-3 mb-3 w-28 h-28'>
			<BlurView
				intensity={isDarkMode ? 20 : 40}
				tint={isDarkMode ? 'dark' : 'light'}
				className='rounded-2xl h-full'>
				<LinearGradient
					colors={
						isSelected
							? ['#D55004', '#FF6B00']
							: isDarkMode
							? ['#1c1c1c', '#2d2d2d']
							: ['#f5f5f5', '#e5e5e5']
					}
					className='p-4 rounded-2xl items-center justify-center h-full'
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 1 }}>
					{imageUrl ? (
						<Image
							source={{ uri: imageUrl }}
							style={{ width: 40, height: 40 }}
							contentFit='contain'
							className='mb-2'
						/>
					) : (
						<MaterialCommunityIcons
							name={icon}
							size={24}
							color={isSelected ? '#fff' : isDarkMode ? '#fff' : '#000'}
						/>
					)}
					<Text
						className={`mt-2 text-sm font-medium text-center ${
							isSelected
								? 'text-white'
								: isDarkMode
								? 'text-white'
								: 'text-black'
						}`}>
						{label}
					</Text>
				</LinearGradient>
			</BlurView>
		</TouchableOpacity>
	)
)

export const FuturisticGallery = memo(
	({ images, onRemove, onReorder, onAdd, isDarkMode, isUploading }: any) => {
		// 1. Enhanced animation configuration
		const activationDistance = 20
		const animationConfig = {
			damping: 20,
			mass: 0.2,
			stiffness: 100
		}

		// 2. Optimized drag state management
		const [isDragging, setIsDragging] = useState(false)
		const dragTimeout = useRef<any>(null)

		// 3. Enhanced scale animation


		// 4. Optimized item rendering
		const renderImageItem = useCallback(
			({ item, drag, isActive, getIndex }: any) => {
				const index = getIndex()

				return (
					<View>
						<TouchableOpacity
							onLongPress={() => {
								hapticFeedback()
								setIsDragging(true)
								drag()
							}}
							onPressOut={() => {
								if (dragTimeout.current) {
									clearTimeout(dragTimeout.current)
								}
							}}
							className='mr-4'
							delayLongPress={150}
							>
							<BlurView
								intensity={isDarkMode ? 20 : 40}
								tint={isDarkMode ? 'dark' : 'light'}
								className='rounded-2xl overflow-hidden'>
								<View className='relative'>
									<Image
										source={{ uri: item }}
										style={{
											width: width * 0.6,
											height: width * 0.4,
											borderRadius: 16
										}}
										contentFit='cover'
									/>

									{/* Gradient overlay */}
									<LinearGradient
										colors={['transparent', 'rgba(0,0,0,0.7)']}
										className='absolute inset-0 rounded-2xl'
										start={{ x: 0, y: 0 }}
										end={{ x: 0, y: 1 }}
									/>

									{/* Image counter badge */}

									{/* Delete button */}
									<TouchableOpacity
										onPress={() => {
											hapticFeedback('light')
											onRemove(item)
										}}
										className='absolute top-2 right-2 bg-black/50 rounded-full p-2'
										style={{
											shadowColor: '#000',
											shadowOffset: { width: 0, height: 2 },
											
											shadowRadius: 3.84,
											elevation: 5
										}}>
										<Ionicons name='close' size={20} color='white' />
									</TouchableOpacity>

									{/* Drag handle */}
									<View
										className={`
                absolute bottom-2 right-2
                bg-black/50 rounded-full p-2
                ${isActive ? 'bg-red/50' : ''}
              `}>
										<MaterialCommunityIcons
											name={isActive ? 'drag' : 'drag-horizontal-variant'}
											size={20}
											color='white'
										/>
									</View>
								</View>
							</BlurView>
						</TouchableOpacity>
					</View>
				)
			},
			[isDarkMode, onRemove, images.length]
		)

		// 5. Enhanced drag event handlers
		const handleDragStart = useCallback(() => {
			hapticFeedback('medium')
			setIsDragging(true)
		}, [])

		const handleDragEnd = useCallback(
			({ data }: any) => {
				hapticFeedback('light')
				setIsDragging(false)
				onReorder(data)
			},
			[onReorder]
		)

		// 6. Optimized list configuration
		const listProps = {
			data: images,
			horizontal: true,
			scrollEnabled: !isDragging,
			showsHorizontalScrollIndicator: false,
			renderItem: renderImageItem,
			keyExtractor: (item: string) => item,
			onDragBegin: handleDragStart,
			onDragEnd: handleDragEnd,
			activationDistance,
			autoscrollSpeed: 150,
			autoscrollThreshold: 50,
			containerStyle: { flexGrow: 0 },
			dragItemOverflow: true,
			dragHitSlop: {
				top: 10,
				bottom: 10,
				left: 10,
				right: 10
			}
		}

		// 7. Haptic feedback utility
		const hapticFeedback = useCallback(
			(style: 'light' | 'medium' | 'heavy' = 'medium') => {
				switch (style) {
					case 'light':
						Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
						break
					case 'medium':
						Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
						break
					case 'heavy':
						Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
						break
				}
			},
			[]
		)

		return (
			<View className='mb-6'>
				{images.length > 0 && (
					<View className='mb-4'>
						<DraggableFlatList {...listProps} />
					</View>
				)}

				<TouchableOpacity
					onPress={() => {
						hapticFeedback('light')
						onAdd()
					}}
					disabled={isUploading}
					className={`rounded-2xl overflow-hidden ${
						isUploading ? 'opacity-50' : ''
					}`}>
					<BlurView
						intensity={isDarkMode ? 20 : 40}
						tint={isDarkMode ? 'dark' : 'light'}
						className='p-1'>
						<LinearGradient
							colors={
								isDarkMode ? ['#1c1c1c', '#2d2d2d'] : ['#f5f5f5', '#e5e5e5']
							}
							className='p-8 items-center justify-center rounded-xl'
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 1 }}>
							{isUploading ? (
								<ActivityIndicator color='#D55004' />
							) : (
								<>
									<View className='bg-red/10 rounded-full p-4 mb-3'>
										<MaterialCommunityIcons
											name='camera-plus'
											size={32}
											color='#D55004'
										/>
									</View>
									<Text
										className={`
                  font-medium text-base
                  ${isDarkMode ? 'text-white' : 'text-black'}
                `}>
										Add Vehicle Photos
									</Text>
									<Text
										className={`
                  mt-1 text-xs
                  ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}
                `}>
										Drag to reorder • Up to 10 photos
									</Text>
								</>
							)}
						</LinearGradient>
					</BlurView>
				</TouchableOpacity>
			</View>
		)
	}
)

// Section Header Component
export const SectionHeader = memo(({ title, subtitle, isDarkMode }: any) => (
	<View className='mb-4'>
		<LinearGradient
			colors={isDarkMode ? ['#D55004', '#FF6B00'] : ['#000', '#333']}
			start={{ x: 0, y: 0 }}
			end={{ x: 1, y: 0 }}
			className='w-12 h-1 rounded-full mb-2'
		/>
		<Text
			className={`
      text-xl font-bold
      ${isDarkMode ? 'text-white' : 'text-black'}
    `}>
			{title}
		</Text>
		{subtitle && (
			<Text
				className={`
        text-sm mt-1
        ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}
      `}>
				{subtitle}
			</Text>
		)}
	</View>
))

// Main Modal Component
const ListingModal = ({
	isVisible,
	onClose,
	onSubmit,
	initialData,
	dealership
}: any) => {
	const { isDarkMode } = useTheme()
	const [formData, setFormData] = useState<any>(
		initialData || {
			bought_price: null,
			date_bought: new Date(),
			seller_name: null
		}
	)
	const [showDatePicker, setShowDatePicker] = useState(false)

	const handleInputChange = useCallback(
		(key: string, value: any, customValue?: any) => {
			setFormData((prev: any) => {
				const newData = { ...prev, [key]: value }
				if (key === 'make' && !value) {
					newData.model = null
				}
				if (key === 'color' && value === 'Other' && customValue) {
					newData.color = customValue
				}

				if (key === 'mileage') {
					const parsedMileage = parseInt(value)
					newData[key] = isNaN(parsedMileage) ? 0 : parsedMileage
				}

				return newData
			})
		},
		[]
	)

	useEffect(() => {
		if (isVisible && initialData) {
			setFormData({
				...initialData,
				date_bought: initialData.date_bought
					? new Date(initialData.date_bought)
					: new Date()
			})
			setModalImages(initialData.images || [])
		}
	}, [isVisible, initialData])

	const handleClose = useCallback(() => {
		if (!initialData) {
			setFormData({
				bought_price: null,
				date_bought: new Date(),
				seller_name: null,
				make: '',
				model: '',
				price: '',
				year: '',
				description: '',
				images: [],
				condition: '',
				transmission: '',
				color: '',
				mileage: '',
				drivetrain: '',
				type: '',
				category: ''
			})
			setModalImages([])
		}
		onClose()
	}, [initialData, onClose])

	const [isUploading, setIsUploading] = useState(false)
	const [modalImages, setModalImages] = useState<string[]>(
		initialData?.images || []
	)

	// Image handling functions
	const handleImagePick = useCallback(async () => {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
		if (status !== 'granted') {
			Alert.alert(
				'Permission Denied',
				'Sorry, we need camera roll permissions to make this work!'
			)
			return
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsMultipleSelection: true,
			quality: 0.8
		})

		if (!result.canceled && result.assets && result.assets.length > 0) {
			setIsUploading(true)
			try {
				await handleMultipleImageUpload(result.assets)
			} catch (error) {
				console.error('Error uploading images:', error)
				Alert.alert(
					'Upload Failed',
					'Failed to upload images. Please try again.'
				)
			} finally {
				setIsUploading(false)
			}
		}
	}, [dealership])

	const handleMultipleImageUpload = useCallback(
		async (assets: any[]) => {
			if (!dealership) return

			const uploadPromises = assets.map(
				async (asset: { uri: string }, index: number) => {
					try {
						const fileName = `${Date.now()}_${Math.random()
							.toString(36)
							.substring(7)}_${index}.jpg`
						const filePath = `${dealership.id}/${fileName}`

						const base64 = await FileSystem.readAsStringAsync(asset.uri, {
							encoding: FileSystem.EncodingType.Base64
						})

						const { data, error } = await supabase.storage
							.from('cars')
							.upload(filePath, Buffer.from(base64, 'base64'), {
								contentType: 'image/jpeg'
							})

						if (error) throw error

						const { data: publicURLData } = supabase.storage
							.from('cars')
							.getPublicUrl(filePath)

						if (!publicURLData) throw new Error('Error getting public URL')

						return publicURLData.publicUrl
					} catch (error) {
						console.error('Error uploading image:', error)
						return null
					}
				}
			)

			const uploadedUrls = await Promise.all(uploadPromises)
			const successfulUploads = uploadedUrls.filter(url => url !== null)

			setModalImages(prev => [...successfulUploads, ...prev])
			setFormData((prev: { images: any }) => ({
				...prev,
				images: [...successfulUploads, ...(prev.images || [])]
			}))
		},
		[dealership]
	)

	const handleImageRemove = useCallback(async (imageUrl: string) => {
		try {
			const urlParts = imageUrl.split('/')
			const filePath = urlParts.slice(urlParts.indexOf('cars') + 1).join('/')

			const { error } = await supabase.storage.from('cars').remove([filePath])

			if (error) throw error

			setModalImages(prevImages => prevImages.filter(url => url !== imageUrl))
			setFormData((prev: { images: any[] }) => ({
				...prev,
				images: prev.images?.filter((url: string) => url !== imageUrl) || []
			}))
		} catch (error) {
			console.error('Error removing image:', error)
			Alert.alert('Error', 'Failed to remove image. Please try again.')
		}
	}, [])

	const handleImageReorder = useCallback((newOrder: string[]) => {
		setModalImages(newOrder)
		setFormData((prev: any) => ({
			...prev,
			images: newOrder
		}))
	}, [])

	const validateFormData = (data: any) => {
		const requiredFields = [
			'make',
			'model',
			'price',
			'year',
			'condition',
			'transmission',
			'mileage',
			'drivetrain',
			'type',
			'category'
		]

		const missingFields = requiredFields.filter(field => {
			// Special handling for mileage which can be 0
			if (field === 'mileage') {
				return (
					data[field] === null ||
					data[field] === undefined ||
					data[field] === ''
				)
			}
			// For other fields, check if they're empty/null/undefined
			return !data[field]
		})

		if (missingFields.length > 0) {
			Alert.alert(
				'Missing Fields',
				`Please fill in: ${missingFields.join(', ')}`
			)
			return false
		}

		return true
	}

	const handleSubmit = useCallback(() => {
		if (!validateFormData(formData)) return

		// Preserve id and dealership_id when editing an existing car
		const submissionData = {
			...formData,
			images: modalImages,
			date_bought: formData.date_bought
				? formData.date_bought.toISOString()
				: new Date().toISOString(),
			// Keep the original id and dealership_id if this is an edit
			id: initialData?.id,
			dealership_id: initialData?.dealership_id
		}

		onSubmit(submissionData)
    handleClose();

	}, [formData, modalImages, onSubmit, initialData])

	return (
		<Modal
			visible={isVisible}
			animationType='none'
			transparent
			statusBarTranslucent>
			<View
				className='flex-1'
				style={{ zIndex: 999 }} // Ensure highest z-index
			>
				
					<View
					
						className='flex-1 bg-black/50'>
						<BlurView
							intensity={isDarkMode ? 30 : 20}
							tint={isDarkMode ? 'dark' : 'light'}
							className='flex-1'>
							<View
							
								className={`
                  flex-1 mt-12 rounded-t-3xl overflow-hidden
                  ${isDarkMode ? 'bg-black' : 'bg-white'}
                `}>
								{/* Modal content structure */}
								<View className='flex-row items-center justify-between px-6 py-4'>
									<TouchableOpacity onPress={handleClose} className='p-2 -ml-2'>
										<Ionicons
											name='close'
											size={24}
											color={isDarkMode ? '#fff' : '#000'}
										/>
									</TouchableOpacity>
									<Text
										className={`text-xl font-bold ${
											isDarkMode ? 'text-white' : 'text-black'
										}`}>
										{initialData ? 'Edit Vehicle' : 'Add New Vehicle'}
									</Text>
									<TouchableOpacity
										onPress={handleSubmit}
										className='bg-red px-4 py-2 rounded-full'>
										<Text className='text-white font-medium'>
											{initialData ? 'Update' : 'Publish'}
										</Text>
									</TouchableOpacity>
								</View>

								<ScrollView
									className='flex-1 px-6'
									showsVerticalScrollIndicator={false}>
									<View className='py-4'>
										<SectionHeader
											title='Vehicle Images'
											subtitle='Add up to 10 high-quality photos of your vehicle'
											isDarkMode={isDarkMode}
										/>
										<FuturisticGallery
											images={modalImages}
											onAdd={handleImagePick}
											onRemove={handleImageRemove}
											onReorder={handleImageReorder}
											isDarkMode={isDarkMode}
											isUploading={isUploading}
										/>
									</View>

									{/* Basic Information */}
									<View className='mb-8'>
										<SectionHeader
											title='Vehicle Brand & Model'
											subtitle="Select your vehicle's make and model"
											isDarkMode={isDarkMode}
										/>

										<Text
											className={`text-sm font-medium mb-3 ${
												isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
											}`}>
											Brand
										</Text>
										<BrandSelector
											selectedBrand={formData.make}
											onSelectBrand={(make: any) => {
												handleInputChange('make', make)
												handleInputChange('model', '') // Reset model when make changes
											}}
											isDarkMode={isDarkMode}
										/>

										{formData.make && (
											<ModelDropdown
												make={formData.make}
												value={formData.model}
												onChange={(model: any) =>
													handleInputChange('model', model)
												}
												isDarkMode={isDarkMode}
											/>
										)}

										<View className='n'>
											<NeumorphicInput
												label='Year'
												value={formData.year}
												onChangeText={(text: any) =>
													handleInputChange('year', text)
												}
												placeholder='Enter vehicle year'
												keyboardType='numeric'
												required
												icon='calendar'
												isDarkMode={isDarkMode}
											/>

											<NeumorphicInput
												label='Price'
												value={formData.price}
												onChangeText={(text: any) =>
													handleInputChange('price', text)
												}
												placeholder='Enter vehicle price'
												keyboardType='numeric'
												required
												isDarkMode={isDarkMode}
												icon='cash'
											/>
										</View>
									</View>

									{/* Color Selection */}

									<View className='mb-8'>
										<SectionHeader
											title='Vehicle Color'
											subtitle='Select the exterior color'
											isDarkMode={isDarkMode}
										/>
										<EnhancedColorSelector
											value={formData.color}
											onChange={(color: any) =>
												handleInputChange('color', color)
											}
											isDarkMode={isDarkMode}
										/>
									</View>

									{/* Vehicle Category & Type */}
									<View className='mb-8'>
										<SectionHeader
											title='Vehicle Classification'
											subtitle="Select your vehicle's category and type"
											isDarkMode={isDarkMode}
										/>

										<Text
											className={`text-sm font-medium mb-3 ${
												isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
											}`}>
											Category
										</Text>
										<ScrollView
											horizontal
											showsHorizontalScrollIndicator={false}
											className='mb-6'>
											{CATEGORIES.map(cat => (
												<SelectionCard
													key={cat.value}
													label={cat.label}
													icon={cat.icon}
													isSelected={formData.category === cat.value}
													onSelect={() =>
														handleInputChange('category', cat.value)
													}
													isDarkMode={isDarkMode}
												/>
											))}
										</ScrollView>

										<Text
											className={`text-sm font-medium mb-3 ${
												isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
											}`}>
											Fuel Type
										</Text>
										<ScrollView
											horizontal
											showsHorizontalScrollIndicator={false}
											className='mb-6'>
											{VEHICLE_TYPES.map(type => (
												<SelectionCard
													key={type.value}
													label={type.label}
													icon={type.icon}
													isSelected={formData.type === type.value}
													onSelect={() => handleInputChange('type', type.value)}
													isDarkMode={isDarkMode}
												/>
											))}
										</ScrollView>
									</View>

									{/* Technical Specifications */}
									<View className='mb-8'>
										<SectionHeader
											title='Technical Specifications'
											subtitle='Detailed technical information'
											isDarkMode={isDarkMode}
										/>

										<NeumorphicInput
											label='Mileage'
											value={formData.mileage}
											onChangeText={(text: any) =>
												handleInputChange('mileage', text)
											}
											placeholder='Enter vehicle mileage'
											keyboardType='numeric'
											icon='speedometer'
											suffix='km'
											required
											isDarkMode={isDarkMode}
										/>

										<Text
											className={`text-sm font-medium mb-3 ${
												isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
											}`}>
											Transmission
										</Text>
										<View className='flex-row mb-6'>
											{TRANSMISSIONS.map(trans => (
												<SelectionCard
													key={trans.value}
													label={trans.label}
													icon={trans.icon}
													isSelected={formData.transmission === trans.value}
													onSelect={() =>
														handleInputChange('transmission', trans.value)
													}
													isDarkMode={isDarkMode}
												/>
											))}
										</View>

										<Text
											className={`text-sm font-medium mb-3 ${
												isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
											}`}>
											Drive Train
										</Text>
										<ScrollView
											horizontal
											showsHorizontalScrollIndicator={false}
											className='mb-6'>
											{DRIVE_TRAINS.map(drive => (
												<SelectionCard
													key={drive.value}
													label={drive.label}
													icon={drive.icon}
													isSelected={formData.drivetrain === drive.value}
													onSelect={() =>
														handleInputChange('drivetrain', drive.value)
													}
													isDarkMode={isDarkMode}
												/>
											))}
										</ScrollView>

										<Text
											className={`text-sm font-medium mb-3 ${
												isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
											}`}>
											Condition
										</Text>
										<View className='flex-row mb-6'>
											{CONDITIONS.map(cond => (
												<SelectionCard
													key={cond.value}
													label={cond.label}
													icon={cond.icon}
													isSelected={formData.condition === cond.value}
													onSelect={() =>
														handleInputChange('condition', cond.value)
													}
													isDarkMode={isDarkMode}
												/>
											))}
										</View>
									</View>

									{/* Purchase Information */}
									<View className='mb-8'>
										<SectionHeader
											title='Purchase Information'
											subtitle='Details about vehicle acquisition'
											isDarkMode={isDarkMode}
										/>

										<NeumorphicInput
											label='Purchase Price'
											value={formData.bought_price}
											onChangeText={(text: any) =>
												handleInputChange('bought_price', text)
											}
											placeholder='Enter purchase price'
											keyboardType='numeric'
											icon='cash-multiple'
											prefix='$'
											required
											isDarkMode={isDarkMode}
										/>

										{/* Date Picker Implementation */}
										<TouchableOpacity
											onPress={() => setShowDatePicker(true)}
											className='mb-6'>
											<Text
												className={`text-sm font-medium mb-2 ${
													isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
												}`}>
												Purchase Date
											</Text>
											<View
												className={`rounded-2xl overflow-hidden ${
													isDarkMode ? 'bg-[#1c1c1c]' : 'bg-[#f5f5f5]'
												}`}>
												<BlurView
													intensity={isDarkMode ? 20 : 40}
													tint={isDarkMode ? 'dark' : 'light'}
													className='flex-row items-center p-4'>
													<MaterialCommunityIcons
														name='calendar'
														size={24}
														color={isDarkMode ? '#fff' : '#000'}
													/>
													<Text
														className={`ml-3 text-base ${
															isDarkMode ? 'text-white' : 'text-black'
														}`}>
														{formData.date_bought
															? format(new Date(formData.date_bought), 'PPP')
															: 'Select purchase date'}
													</Text>
												</BlurView>
											</View>
										</TouchableOpacity>

										<DateTimePickerModal
											isVisible={showDatePicker}
											mode='date'
											date={
												formData.date_bought
													? new Date(formData.date_bought)
													: new Date()
											}
											onConfirm={selectedDate => {
												handleInputChange(
													'date_bought',
													selectedDate.toISOString()
												)
												setShowDatePicker(false)
											}}
											onCancel={() => setShowDatePicker(false)}
										/>

										<NeumorphicInput
											label='Bought From'
											value={formData.seller_name}
											onChangeText={(text: any) =>
												handleInputChange('seller_name', text)
											}
											placeholder="Enter bought from name"
											icon='account'
											isDarkMode={isDarkMode}
										/>
									</View>

									{/* Bottom Spacing */}
									<View className='h-20' />
								</ScrollView>


							</View>
						</BlurView>
					</View>
			
			</View>
		</Modal>
	)
}

export default ListingModal
