import React, { useState, useCallback, useEffect, memo } from 'react'
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
	ActivityIndicator
} from 'react-native'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
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
import Animated, {
	FadeIn,
	FadeOut,
	SlideInUp,
	SlideOutDown,
	withSpring
} from 'react-native-reanimated'
import { format } from 'date-fns'

const { width } = Dimensions.get('window')

// Constants
const VEHICLE_TYPES = [
	{ value: 'Benzine', label: 'Benzine', icon: 'gas-station' },
	{ value: 'Diesel', label: 'Diesel', icon: 'fuel' },
	{ value: 'Electric', label: 'Electric', icon: 'lightning-bolt' },
	{ value: 'Hybrid', label: 'Hybrid', icon: 'leaf' }
]

const CATEGORIES = [
	{ value: 'Sedan', label: 'Sedan', icon: 'car-side' },
	{ value: 'SUV', label: 'SUV', icon: 'car-estate' },
	{ value: 'Coupe', label: 'Coupe', icon: 'car-sports' },
	{ value: 'Convertible', label: 'Convertible', icon: 'car-convertible' },
	{ value: 'Hatchback', label: 'Hatchback', icon: 'car-hatchback' },
	{ value: 'Sports', label: 'Sports', icon: 'car-sports' }
]

const TRANSMISSIONS = [
	{ value: 'Automatic', label: 'Automatic', icon: 'cog-clockwise' },
	{ value: 'Manual', label: 'Manual', icon: 'cog' }
]

const DRIVE_TRAINS = [
	{ value: 'FWD', label: 'Front Wheel Drive', icon: 'car-traction-control' },
	{ value: 'RWD', label: 'Rear Wheel Drive', icon: 'car-traction-control' },
	{ value: 'AWD', label: 'All Wheel Drive', icon: 'car-traction-control' },
	{ value: '4WD', label: '4 Wheel Drive', icon: 'car-4x4' },
	{ value: '4x4', label: '4x4', icon: 'car-4x4' }
]

const CONDITIONS = [
	{ value: 'New', label: 'New', icon: 'star' },
	{ value: 'Used', label: 'Used', icon: 'star-half' }
]

const BrandSelector = memo(
	({ selectedBrand, onSelectBrand, isDarkMode }: any) => {
		const [brands, setBrands] = useState<any[]>([])
		const [isLoading, setIsLoading] = useState(false)

		const getLogoUrl = useCallback((make: string, isLightMode: boolean) => {
			const formattedMake = make.toLowerCase().replace(/\s+/g, '-')
			switch (formattedMake) {
				case 'range-rover':
					return isLightMode
						? 'https://www.carlogos.org/car-logos/land-rover-logo-2020-green.png'
						: 'https://www.carlogos.org/car-logos/land-rover-logo.png'
				case 'infiniti':
					return 'https://www.carlogos.org/car-logos/infiniti-logo.png'
				case 'audi':
					return 'https://www.freepnglogos.com/uploads/audi-logo-2.png'
				case 'nissan':
					return 'https://cdn.freebiesupply.com/logos/large/2x/nissan-6-logo-png-transparent.png'
				default:
					return `https://www.carlogos.org/car-logos/${formattedMake}-logo.png`
			}
		}, [])

		useEffect(() => {
			const fetchBrands = async () => {
				setIsLoading(true)
				try {
					const { data, error } = await supabase
						.from('cars')
						.select('make')
						.order('make')

					if (error) throw error

					const uniqueBrands = Array.from(
						new Set(data.map((item: { make: string }) => item.make))
					)
					const brandsData = uniqueBrands.map((make: string) => ({
						name: make,
						logoUrl: getLogoUrl(make, !isDarkMode)
					}))

					setBrands(brandsData)
				} catch (error) {
					console.error('Error fetching brands:', error)
				}
				setIsLoading(false)
			}

			fetchBrands()
		}, [isDarkMode])

		if (isLoading) {
			return (
				<View className='h-24 justify-center'>
					<ActivityIndicator color='#D55004' />
				</View>
			)
		}

		return (
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				className='mb-6'>
				{brands.map((brand, index) => (
					<TouchableOpacity
						key={index}
						onPress={() => onSelectBrand(brand.name)}
						className={`
            mr-4 p-4 rounded-2xl items-center
            ${
							selectedBrand === brand.name
								? 'bg-red'
								: isDarkMode
								? 'bg-[#1c1c1c]'
								: 'bg-[#f5f5f5]'
						}
          `}>
						<BlurView
							intensity={
								selectedBrand === brand.name ? 0 : isDarkMode ? 20 : 40
							}
							tint={isDarkMode ? 'dark' : 'light'}
							className='rounded-xl p-2'>
							<Image
								source={{ uri: brand.logoUrl }}
								style={{ width: 60, height: 60 }}
								contentFit='contain'
							/>
						</BlurView>
						<Text
							className={`
              mt-2 text-sm font-medium
              ${
								selectedBrand === brand.name
									? 'text-white'
									: isDarkMode
									? 'text-white'
									: 'text-black'
							}
            `}>
							{brand.name}
						</Text>
					</TouchableOpacity>
				))}
			</ScrollView>
		)
	}
)

const VEHICLE_COLORS = [
	{ name: 'Black', gradient: ['#000000', '#1a1a1a'] },
	{ name: 'White', gradient: ['#ffffff', '#f5f5f5'] },
	{ name: 'Silver', gradient: ['#C0C0C0', '#A8A8A8'] },
	{ name: 'Gray', gradient: ['#808080', '#666666'] },
	{ name: 'Red', gradient: ['#FF0000', '#CC0000'] },
	{ name: 'Blue', gradient: ['#0000FF', '#0000CC'] },
	{ name: 'Green', gradient: ['#008000', '#006600'] },
	{ name: 'Brown', gradient: ['#8B4513', '#723A0F'] },
	{ name: 'Beige', gradient: ['#F5F5DC', '#E8E8D0'] },
	{ name: 'Gold', gradient: ['#FFD700', '#CCAC00'] }
]

// Model Dropdown Component
const ModelDropdown = memo(
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
						isDarkMode ? 'text-gray-300' : 'text-gray-700'
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
					animationType='slide'
					onRequestClose={() => setIsOpen(false)}>
					<TouchableOpacity
						className='flex-1 bg-black/50'
						onPress={() => setIsOpen(false)}>
						<BlurView
							intensity={isDarkMode ? 30 : 20}
							tint={isDarkMode ? 'dark' : 'light'}
							className='flex-1'>
							<Animated.View
								entering={SlideInUp}
								className={`
                mt-auto rounded-t-3xl overflow-hidden
                ${isDarkMode ? 'bg-black' : 'bg-white'}
              `}>
								<View className='p-4 border-b border-gray-200/10'>
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
							</Animated.View>
						</BlurView>
					</TouchableOpacity>
				</Modal>
			</View>
		)
	}
)

// Enhanced Color Selector Component
const EnhancedColorSelector = memo(({ value, onChange, isDarkMode }: any) => {
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			className='mb-6'>
			{VEHICLE_COLORS.map(color => (
				<TouchableOpacity
					key={color.name}
					onPress={() => onChange(color.name)}
					className={`mr-4 ${value === color.name ? 'scale-110' : ''}`}
					style={{
						transform: [{ scale: value === color.name ? 1.1 : 1 }]
					}}>
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
const NeumorphicInput = memo(
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
		<Animated.View entering={FadeIn.duration(400)} className='mb-6'>
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
		</Animated.View>
	)
)

// Selection Option Component
const SelectionCard = memo(
	({ label, icon, isSelected, onSelect, isDarkMode }: any) => (
		<Pressable
			onPress={onSelect}
			className={`
      mr-3 mb-3 p-4 rounded-2xl
      ${isSelected ? 'bg-red' : isDarkMode ? 'bg-[#1c1c1c]' : 'bg-[#f5f5f5]'}
    `}>
			<LinearGradient
				colors={
					isSelected
						? ['#D55004', '#FF6B00']
						: isDarkMode
						? ['#1c1c1c', '#2d2d2d']
						: ['#f5f5f5', '#e5e5e5']
				}
				className='absolute inset-0 rounded-2xl'
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}
			/>
			<BlurView
				intensity={isSelected ? 0 : isDarkMode ? 20 : 40}
				tint={isDarkMode ? 'dark' : 'light'}
				className='items-center'>
				<MaterialCommunityIcons
					name={icon}
					size={24}
					color={isSelected ? '#fff' : isDarkMode ? '#fff' : '#000'}
				/>
				<Text
					className={`
        mt-2 text-sm font-medium
        ${isSelected ? 'text-white' : isDarkMode ? 'text-white' : 'text-black'}
      `}>
					{label}
				</Text>
			</BlurView>
		</Pressable>
	)
)

// Image Gallery with Effects
const FuturisticGallery = memo(
	({ images, onRemove, onReorder, onAdd, isDarkMode, isUploading }: any) => (
		<View className='mb-8'>
			{images?.length > 0 && (
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					className='mb-4'>
					<DraggableFlatList
						data={images}
						horizontal
						renderItem={({ item, drag, isActive }) => (
							<Animated.View
								style={{
									opacity: isActive ? 0.5 : 1,
									transform: [
										{
											scale: withSpring(isActive ? 1.05 : 1)
										}
									]
								}}>
								<TouchableOpacity onLongPress={drag} className='mr-4'>
									<View className='rounded-2xl overflow-hidden'>
										<BlurView
											intensity={isDarkMode ? 20 : 40}
											tint={isDarkMode ? 'dark' : 'light'}
											className='p-1'>
											<Image
												source={{ uri: item }}
												style={{
													width: width * 0.6,
													height: width * 0.4,
													borderRadius: 16
												}}
												contentFit='cover'
											/>

											<LinearGradient
												colors={['transparent', 'rgba(0,0,0,0.7)']}
												className='absolute inset-0 rounded-2xl'
											/>

											<TouchableOpacity
												onPress={() => onRemove(item)}
												className='absolute top-2 right-2 p-2 rounded-full bg-black/50'>
												<Ionicons name='close' size={20} color='white' />
											</TouchableOpacity>
										</BlurView>
									</View>
								</TouchableOpacity>
							</Animated.View>
						)}
						keyExtractor={item => item}
						onDragEnd={({ data }) => onReorder(data)}
					/>
				</ScrollView>
			)}

			<TouchableOpacity
				onPress={onAdd}
				disabled={isUploading}
				className={`
        rounded-2xl overflow-hidden
        ${isUploading ? 'opacity-50' : ''}
      `}>
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
)

// Section Header Component
const SectionHeader = memo(({ title, subtitle, isDarkMode }: any) => (
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
	const [modalImages, setModalImages] = useState<any>(initialData?.images || [])
	const [isUploading, setIsUploading] = useState<any>(false)
	const [makes, setMakes] = useState<any>([])
	const [models, setModels] = useState<any>([])
	const [uploadProgress, setUploadProgress] = useState<any>({})

	useEffect(() => {
		if (isVisible) {
			setFormData((prevData: any) => ({
				...prevData,
				...(initialData || {}),
				date_bought: initialData?.date_bought
					? new Date(initialData.date_bought)
					: new Date()
			}))
			setModalImages(initialData?.images || [])
			fetchMakes()
		}
	}, [isVisible, initialData])

	useEffect(() => {
		if (formData.make) {
			fetchModels(formData.make)
		} else {
			setModels([])
		}
	}, [formData.make])

	const fetchMakes = useCallback(async () => {
		try {
			const { data, error } = await supabase
				.from('allcars')
				.select('make')
				.order('make')
			if (error) throw error
			const uniqueMakes = Array.from(new Set(data.map(item => item.make)))
			setMakes(uniqueMakes.map(make => ({ id: make, name: make })))
		} catch (error) {
			console.error('Error fetching makes:', error)
			Alert.alert('Error', 'Failed to fetch car makes. Please try again.')
		}
	}, [])

	const fetchModels = useCallback(async (make: any) => {
		try {
			const { data, error } = await supabase
				.from('allcars')
				.select('model')
				.eq('make', make)
				.order('model')
			if (error) throw error
			const uniqueModels = Array.from(new Set(data.map(item => item.model)))
			setModels(uniqueModels.map(model => ({ id: model, name: model })))
		} catch (error) {
			console.error('Error fetching models:', error)
			Alert.alert('Error', 'Failed to fetch car models. Please try again.')
		}
	}, [])

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
					newData[key] = value === '' ? null : parseInt(value)
				}

				return newData
			})
		},
		[]
	)

	const pickImages = useCallback(async () => {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
		if (status !== 'granted') {
			Alert.alert(
				'Permission Denied',
				'Sorry, we need camera roll permissions to make this work!'
			)
			return
		}

		let result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsMultipleSelection: true,
			quality: 0.8
		})

		if (!result?.canceled && result?.assets && result?.assets?.length > 0) {
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
				setUploadProgress({})
			}
		}
	}, [dealership])

	const handleMultipleImageUpload = useCallback(
		async (assets: any[]) => {
			if (!dealership) return

			const uploadPromises = assets.map(
				async (asset: { uri: string }, index: any) => {
					try {
						const fileName = `${Date.now()}_${Math.random()
							?.toString(36)
							?.substring(7)}_${index}.jpg`
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

						setUploadProgress((prev: any) => ({ ...prev, [asset.uri]: 100 }))

						return publicURLData.publicUrl
					} catch (error) {
						console.error('Error uploading image:', error)
						setUploadProgress((prev: any) => ({ ...prev, [asset.uri]: -1 }))
						return null
					}
				}
			)

			const uploadedUrls = await Promise.all(uploadPromises)
			const successfulUploads = uploadedUrls.filter(url => url !== null)

			setModalImages((prev: any) => [...successfulUploads, ...prev])
			setFormData((prev: { images: any }) => ({
				...prev,
				images: [...successfulUploads, ...(prev.images || [])]
			}))
		},
		[dealership]
	)

	const handleRemoveImage = useCallback(async (imageUrl: string) => {
		try {
			const urlParts = imageUrl.split('/')
			const filePath = urlParts.slice(urlParts.indexOf('cars') + 1).join('/')

			const { error } = await supabase.storage.from('cars').remove([filePath])

			if (error) throw error

			setModalImages((prevImages: any[]) =>
				prevImages.filter((url: any) => url !== imageUrl)
			)
			setFormData((prev: { images: any[] }) => ({
				...prev,
				images: prev.images?.filter((url: any) => url !== imageUrl) || []
			}))
		} catch (error) {
			console.error('Error removing image:', error)
			Alert.alert('Error', 'Failed to remove image. Please try again.')
		}
	}, [])

	const renderDraggableItem = useCallback(
		({ item, drag, isActive }: any) => (
			<TouchableOpacity
				onLongPress={drag}
				disabled={isActive}
				className={`flex-row items-center mb-4 ${
					isActive ? 'opacity-50' : 'opacity-100'
				}`}>
				<Image source={{ uri: item }} className='w-24 h-24 rounded-lg mr-4' />
				<View className='flex-1 flex-row justify-between items-center'>
					<Ionicons
						name='reorder-two'
						size={24}
						color={isDarkMode ? 'white' : 'black'}
					/>
					<TouchableOpacity onPress={() => handleRemoveImage(item)}>
						<Ionicons name='trash-outline' size={24} color='#D55004' />
					</TouchableOpacity>
				</View>
			</TouchableOpacity>
		),
		[isDarkMode, handleRemoveImage]
	)

	const handleSubmit = useCallback(() => {
		if (
			!formData.make ||
			!formData.model ||
			!formData.year ||
			!formData.price
		) {
			Alert.alert('Incomplete Form', 'Please fill in all required fields.')
			return
		}
		onSubmit({
			...formData,
			images: modalImages,
			date_bought: formData.date_bought
				? formData.date_bought.toISOString()
				: new Date().toISOString()
		})
	}, [formData, modalImages, onSubmit])

	return (
		<Modal
			visible={isVisible}
			animationType='none'
			transparent
			statusBarTranslucent>
			<KeyboardAvoidingView
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				className='flex-1'>
				<GestureHandlerRootView className='flex-1'>
					<Animated.View
						entering={FadeIn}
						exiting={FadeOut}
						className='flex-1 bg-black/50'>
						<BlurView
							intensity={isDarkMode ? 30 : 20}
							tint={isDarkMode ? 'dark' : 'light'}
							className='flex-1'>
							<Animated.View
								entering={SlideInUp}
								exiting={SlideOutDown}
								className={`
                  flex-1 mt-12 rounded-t-3xl overflow-hidden
                  ${isDarkMode ? 'bg-black' : 'bg-white'}
                `}>
								{/* Modal content structure */}
								<View className='flex-row items-center justify-between px-6 py-4'>
									<TouchableOpacity onPress={onClose} className='p-2 -ml-2'>
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
									{/* Vehicle Images */}
									<View className='py-4'>
										<SectionHeader
											title='Vehicle Images'
											subtitle='High-quality photos help your listing stand out'
											isDarkMode={isDarkMode}
										/>
										<FuturisticGallery
											images={formData.images}
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
												isDarkMode ? 'text-gray-300' : 'text-gray-700'
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
												className={`
                        rounded-2xl overflow-hidden
                        ${isDarkMode ? 'bg-[#1c1c1c]' : 'bg-[#f5f5f5]'}
                      `}>
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
														className={`
                            ml-3 text-base
                            ${isDarkMode ? 'text-white' : 'text-black'}
                          `}>
														{formData.date_bought
															? format(new Date(formData.date_bought), 'PPP')
															: 'Select purchase date'}
													</Text>
												</BlurView>
											</View>
										</TouchableOpacity>

										<NeumorphicInput
											label='Seller Name'
											value={formData.seller_name}
											onChangeText={(text: any) =>
												handleInputChange('seller_name', text)
											}
											placeholder="Enter seller's name"
											icon='account'
											isDarkMode={isDarkMode}
										/>
									</View>

									{/* Bottom Spacing */}
									<View className='h-20' />
								</ScrollView>

								{/* Date Picker Modal */}
								{showDatePicker && (
									<DateTimePicker
										value={
											formData.date_bought
												? new Date(formData.date_bought)
												: new Date()
										}
										mode='date'
										display='spinner'
										onChange={(event, selectedDate) => {
											setShowDatePicker(false)
											if (selectedDate) {
												handleInputChange(
													'date_bought',
													selectedDate.toISOString()
												)
											}
										}}
									/>
								)}
							</Animated.View>
						</BlurView>
					</Animated.View>
				</GestureHandlerRootView>
			</KeyboardAvoidingView>
		</Modal>
	)
}

export default ListingModal
