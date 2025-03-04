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
import { useUser } from '@clerk/clerk-expo';
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
import Animated, {
	FadeIn,
	FadeOut,
	SlideInDown,
	SlideInUp,
	SlideOutDown,
	withSpring
} from 'react-native-reanimated'
import { format } from 'date-fns'

const { width } = Dimensions.get('window')
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  BrandSelector,
  ModelDropdown,
  EnhancedColorSelector,
  NeumorphicInput,
  SelectionCard,
  FuturisticGallery,
  SectionHeader,
  CONDITIONS,
  DRIVE_TRAINS,
  CATEGORIES,
  TRANSMISSIONS,
  VEHICLE_TYPES} from '@/components/ListingModal'
import { useLocalSearchParams, useRouter } from 'expo-router'




// Copy the rest of the imports you need...

export default function AddEditListing() {
  const { isDarkMode } = useTheme()
  const { user } = useUser();
  const router = useRouter()
  const params = useLocalSearchParams<{ dealershipId: string; listingId?: string }>()

  const [dealership, setDealership] = useState<any>(null)
  const [initialData, setInitialData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [formData, setFormData] = useState<any>({
    bought_price: null,
    date_bought: new Date(),
    seller_name: null
  })
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [modalImages, setModalImages] = useState<string[]>([])

  const isSubscriptionValid = useCallback(() => {
  if (!dealership) return false;

  // Check if subscription is valid
  const subscriptionEndDate = dealership.subscription_end_date;
  if (!subscriptionEndDate) return false;

  const endDate = new Date(subscriptionEndDate);
  const now = new Date();
  return endDate >= now;
}, [dealership]);

  // Fetch dealership and car data if editing
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        // Fetch dealership data
        if (params.dealershipId) {
          const { data: dealershipData, error: dealershipError } = await supabase
            .from('dealerships')
            .select('*')
            .eq('id', params.dealershipId)
            .single()

          if (dealershipError) throw dealershipError
          setDealership(dealershipData)
        }

        // Fetch car data if editing an existing listing
        if (params.listingId) {
          const { data: carData, error: carError } = await supabase
            .from('cars')
            .select('*')
            .eq('id', params.listingId)
            .single()

          if (carError) throw carError
          setInitialData(carData)
          setFormData({
            ...carData,
            date_bought: carData.date_bought
              ? new Date(carData.date_bought)
              : new Date()
          })
          setModalImages(carData.images || [])
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        Alert.alert('Error', 'Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [params.dealershipId, params.listingId])

  // Copy all the handler functions from your modal
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

			setModalImages((prev:any) => [...successfulUploads, ...prev])
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
  if (!validateFormData(formData)) return;
  if (!dealership || !isSubscriptionValid()) {
    Alert.alert('Subscription Error', 'Your subscription is not valid or has expired.');
    return;
  }

  // Submit the data
  const submitListing = async () => {
    try {
      setIsLoading(true);

      if (initialData?.id) {
        // UPDATING EXISTING LISTING
        // Filter out fields that should not be included in the update
        const {
          // Fields to exclude from update
          id,
          listed_at,
          date_modified,
          views,
          likes,
          viewed_users,
          liked_users,
          sold_price,
          date_sold,
          buyer_name,
          status,
          dealership_name,
          dealership_logo,
          dealership_phone,
          dealership_location,
          dealership_latitude,
          dealership_longitude,
          ...allowedData
        } = formData;

        // Prepare the update data with only valid database fields
        const dataToUpdate = {
          make: allowedData.make,
          model: allowedData.model,
          price: allowedData.price,
          year: allowedData.year,
          description: allowedData.description,
          images: modalImages,
          condition: allowedData.condition,
          transmission: allowedData.transmission,
          color: allowedData.color,
          mileage: allowedData.mileage,
          drivetrain: allowedData.drivetrain,
          type: allowedData.type,
          category: allowedData.category,
          bought_price: allowedData.bought_price,
          date_bought: allowedData.date_bought
            ? new Date(allowedData.date_bought).toISOString()
            : null,
          seller_name: allowedData.seller_name,
          dealership_id: dealership.id
        };

        const { data, error } = await supabase
          .from('cars')
          .update(dataToUpdate)
          .eq('id', initialData.id)
          .eq('dealership_id', dealership.id)
          .select(`
            id,
            listed_at,
            make,
            model,
            price,
            year,
            description,
            images,
            sold_price,
            date_sold,
            status,
            dealership_id,
            date_modified,
            views,
            likes,
            condition,
            transmission,
            color,
            mileage,
            drivetrain,
            viewed_users,
            liked_users,
            type,
            category,
            bought_price,
            date_bought,
            seller_name,
            buyer_name
          `)
          .single();

        if (error) throw error;

        Alert.alert(
          'Success',
          'Listing updated successfully',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        // CREATING NEW LISTING
        // Filter out fields that should not be included in the creation
        const {
          dealership_name,
          dealership_logo,
          dealership_phone,
          dealership_location,
          dealership_latitude,
          dealership_longitude,
          ...allowedData
        } = formData;

        const newListingData = {
          make: allowedData.make,
          model: allowedData.model,
          price: allowedData.price,
          year: allowedData.year,
          description: allowedData.description,
          images: modalImages,
          condition: allowedData.condition,
          transmission: allowedData.transmission,
          color: allowedData.color,
          mileage: allowedData.mileage,
          drivetrain: allowedData.drivetrain,
          type: allowedData.type,
          category: allowedData.category,
          bought_price: allowedData.bought_price,
          date_bought: allowedData.date_bought
            ? new Date(allowedData.date_bought).toISOString()
            : new Date().toISOString(),
          seller_name: allowedData.seller_name,
          dealership_id: dealership.id,
          status: 'available',
          views: 0,
          likes: 0,
          viewed_users: [],
          liked_users: []
        };

        const { data, error } = await supabase
          .from('cars')
          .insert(newListingData)
          .select()
          .single();

        if (error) throw error;

        Alert.alert(
          'Success',
          'New listing created successfully',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (error: any) {
      console.error('Error submitting listing:', error);
      Alert.alert(
        'Error',
        error?.message || 'Failed to submit listing. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  submitListing();
}, [formData, modalImages, initialData, dealership, router, isSubscriptionValid, validateFormData]);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#D55004" />
      </View>
    )
  }

  return (
    <SafeAreaView className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
      <View className="flex-row items-center justify-between px-6 py-4">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDarkMode ? '#fff' : '#000'}
          />
        </TouchableOpacity>
        <Text
          className={`text-xl font-bold ${
            isDarkMode ? 'text-white' : 'text-black'
          }`}
        >
          {initialData ? 'Edit Vehicle' : 'Add New Vehicle'}
        </Text>
        <TouchableOpacity
          onPress={handleSubmit}
          className="bg-red px-4 py-2 rounded-full"
        >
          <Text className="text-white font-medium">
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

    </SafeAreaView>
  )
}