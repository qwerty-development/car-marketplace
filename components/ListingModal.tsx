import React, { useState, useEffect, useCallback } from 'react'
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	Modal,
	ScrollView,
	Image,
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	Alert
} from 'react-native'
import { FontAwesome, Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { supabase } from '@/utils/supabase'
import { Buffer } from 'buffer'
import DraggableFlatList from 'react-native-draggable-flatlist'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useTheme } from '@/utils/ThemeContext'
import { Dropdown } from 'react-native-element-dropdown'

const ListingModal = ({
	isVisible,
	onClose,
	onSubmit,
	initialData,
	dealership
}: any) => {
	const { isDarkMode } = useTheme()
	const [formData, setFormData] = useState<any>(initialData || {})
	const [modalImages, setModalImages] = useState<any>(initialData?.images || [])
	const [isUploading, setIsUploading] = useState<any>(false)
	const [makes, setMakes] = useState<any>([])
	const [models, setModels] = useState<any>([])
	const [uploadProgress, setUploadProgress] = useState<any>({})

	const colors = [
		{ id: 1, name: 'Red' },
		{ id: 2, name: 'Blue' },
		{ id: 3, name: 'Green' },
		{ id: 4, name: 'Yellow' },
		{ id: 5, name: 'Black' },
		{ id: 6, name: 'White' },
		{ id: 7, name: 'Silver' },
		{ id: 8, name: 'Orange' },
		{ id: 9, name: 'Purple' },
		{ id: 10, name: 'Brown' },
		{ id: 11, name: 'Pink' },
		{ id: 12, name: 'Gold' },
		{ id: 13, name: 'Grey' },
		{ id: 14, name: 'Beige' },
		{ id: 15, name: 'Burgundy' },
		{ id: 16, name: 'Turquoise' },
		{ id: 17, name: 'Maroon' },
		{ id: 18, name: 'Teal' },
		{ id: 19, name: 'Navy Blue' },
		{ id: 20, name: 'Charcoal' },
		{ id: 21, name: 'Ivory' },
		{ id: 22, name: 'Lavender' },
		{ id: 23, name: 'Magenta' },
		{ id: 24, name: 'Champagne' },
		{ id: 25, name: 'Bronze' },
		{ id: 26, name: 'Cyan' },
		{ id: 27, name: 'Copper' },
		{ id: 28, name: 'Coral' },
		{ id: 29, name: 'Mint Green' },
		{ id: 30, name: 'Peach' },
		{ id: 31, name: 'Sand' },
		{ id: 32, name: 'Sky Blue' },
		{ id: 33, name: 'Violet' },
		{ id: 34, name: 'Lime Green' },
		{ id: 35, name: 'Saffron' },
		{ id: 36, name: 'Indigo' },
		{ id: 37, name: 'Olive' },
		{ id: 38, name: 'Mustard' },
		{ id: 39, name: 'Sea Green' },
		{ id: 40, name: 'Graphite' },
		{ id: 41, name: 'Electric Blue' },
		{ id: 42, name: 'Matte Black' },
		{ id: 43, name: 'Pearl White' },
		{ id: 44, name: 'Aqua' },
		{ id: 45, name: 'Crimson' },
		{ id: 46, name: 'Rose Gold' },
		{ id: 47, name: 'Titanium' },
		{ id: 48, name: 'Gunmetal' },
		{ id: 49, name: 'Lemon Yellow' },
		{ id: 50, name: 'Rust' },
		{ id: 51, name: 'Tan' },
		{ id: 52, name: 'Slate' },
		{ id: 53, name: 'Khaki' },
		{ id: 54, name: 'Fuchsia' },
		{ id: 55, name: 'Mint' },
		{ id: 56, name: 'Lilac' },
		{ id: 57, name: 'Plum' },
		{ id: 58, name: 'Cerulean' },
		{ id: 59, name: 'Tangerine' }
	]

	useEffect(() => {
		if (isVisible) {
			setFormData(initialData || {})
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
		onSubmit({ ...formData, images: modalImages })
	}, [formData, modalImages, onSubmit])

	return (
		<Modal visible={isVisible} animationType='slide' transparent={true}>
			<KeyboardAvoidingView
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				className='flex-1'>
				<GestureHandlerRootView className='flex-1'>
					<View
						className={`flex-1 justify-end ${
							isDarkMode ? 'bg-black/50' : 'bg-gray/50'
						}`}>
						<View
							className={`bg-${
								isDarkMode ? 'night' : 'white'
							} rounded-t-3xl p-6 h-5/6`}>
							<ScrollView showsVerticalScrollIndicator={false}>
								<Text
									className={`text-2xl font-bold mb-6 ${
										isDarkMode ? 'text-white' : 'text-night'
									}`}>
									{initialData ? 'Edit Listing' : 'Create New Listing'}
								</Text>

								<Dropdown
									style={styles.dropdown}
									placeholderStyle={styles.placeholderStyle}
									selectedTextStyle={styles.selectedTextStyle}
									inputSearchStyle={styles.inputSearchStyle}
									data={makes}
									search
									maxHeight={300}
									labelField='name'
									valueField='id'
									placeholder='Select Make'
									searchPlaceholder='Search...'
									value={formData.make}
									onChange={item => handleInputChange('make', item.id)}
								/>

								<Dropdown
									style={styles.dropdown}
									placeholderStyle={styles.placeholderStyle}
									selectedTextStyle={styles.selectedTextStyle}
									inputSearchStyle={styles.inputSearchStyle}
									data={models}
									search
									maxHeight={300}
									labelField='name'
									valueField='id'
									placeholder='Select Model'
									searchPlaceholder='Search...'
									value={formData.model}
									onChange={item => handleInputChange('model', item.id)}
								/>

								<TextInput
									className={`border ${
										isDarkMode
											? 'border-red bg-gray text-white'
											: 'border-red bg-white text-night'
									} rounded-lg p-4 mb-4`}
									placeholder='Year'
									placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
									value={formData.year ? formData.year.toString() : ''}
									onChangeText={text =>
										handleInputChange('year', parseInt(text) || '')
									}
									keyboardType='numeric'
								/>

								<TextInput
									className={`border ${
										isDarkMode
											? 'border-red bg-gray text-white'
											: 'border-red bg-white text-night'
									} rounded-lg p-4 mb-4`}
									placeholder='Price'
									placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
									value={formData.price ? formData.price.toString() : ''}
									onChangeText={text =>
										handleInputChange('price', parseInt(text) || '')
									}
									keyboardType='numeric'
								/>

								<TextInput
									className={`border ${
										isDarkMode
											? 'border-red bg-gray text-white'
											: 'border-red bg-white text-night'
									} rounded-lg p-4 mb-4`}
									placeholder='Description'
									placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
									value={formData.description || ''}
									onChangeText={text => handleInputChange('description', text)}
									multiline
									numberOfLines={4}
								/>

								<Dropdown
									style={styles.dropdown}
									placeholderStyle={styles.placeholderStyle}
									selectedTextStyle={styles.selectedTextStyle}
									inputSearchStyle={styles.inputSearchStyle}
									data={[
										{ label: 'Sedan', value: 'Sedan' },
										{ label: 'SUV', value: 'SUV' },
										{ label: 'Hatchback', value: 'Hatchback' },
										{ label: 'Convertible', value: 'Convertible' },
										{ label: 'Coupe', value: 'Coupe' },
										{ label: 'Sports', value: 'Sports' },
										{ label: 'Other', value: 'Other' }
									]}
									maxHeight={300}
									labelField='label'
									valueField='value'
									placeholder='Select Category'
									searchPlaceholder='Search...'
									value={formData.category}
									onChange={item => handleInputChange('category', item.value)}
								/>

								<Dropdown
									style={styles.dropdown}
									placeholderStyle={styles.placeholderStyle}
									selectedTextStyle={styles.selectedTextStyle}
									inputSearchStyle={styles.inputSearchStyle}
									data={[
										{ label: 'Available', value: 'available' },
										{ label: 'Pending', value: 'pending' },
										{ label: 'Sold', value: 'sold' }
									]}
									maxHeight={300}
									labelField='label'
									valueField='value'
									placeholder='Select Status'
									searchPlaceholder='Search...'
									value={formData.status}
									onChange={item => handleInputChange('status', item.value)}
								/>

								<Dropdown
									style={styles.dropdown}
									placeholderStyle={styles.placeholderStyle}
									selectedTextStyle={styles.selectedTextStyle}
									inputSearchStyle={styles.inputSearchStyle}
									data={[
										{ label: 'New', value: 'New' },
										{ label: 'Used', value: 'Used' }
									]}
									maxHeight={300}
									labelField='label'
									valueField='value'
									placeholder='Select Condition'
									searchPlaceholder='Search...'
									value={formData.condition}
									onChange={item => handleInputChange('condition', item.value)}
								/>

								<Dropdown
									style={styles.dropdown}
									placeholderStyle={styles.placeholderStyle}
									selectedTextStyle={styles.selectedTextStyle}
									inputSearchStyle={styles.inputSearchStyle}
									data={colors}
									search
									maxHeight={300}
									labelField='name'
									valueField='name'
									placeholder='Select Color'
									searchPlaceholder='Search...'
									value={formData.color}
									onChange={item => handleInputChange('color', item.name)}
									renderItem={item => (
										<View style={styles.dropdownItem}>
											<View
												style={[
													styles.colorSwatch,
													{ backgroundColor: item.name.toLowerCase() }
												]}
											/>
											<Text
												style={
													isDarkMode
														? styles.dropdownItemTextDark
														: styles.dropdownItemText
												}>
												{item.name}
											</Text>
										</View>
									)}
								/>

								<Dropdown
									style={styles.dropdown}
									placeholderStyle={styles.placeholderStyle}
									selectedTextStyle={styles.selectedTextStyle}
									inputSearchStyle={styles.inputSearchStyle}
									data={[
										{ label: 'Automatic', value: 'Automatic' },
										{ label: 'Manual', value: 'Manual' }
									]}
									maxHeight={300}
									labelField='label'
									valueField='value'
									placeholder='Select Transmission'
									searchPlaceholder='Search...'
									value={formData.transmission}
									onChange={item =>
										handleInputChange('transmission', item.value)
									}
								/>

								<Dropdown
									style={styles.dropdown}
									placeholderStyle={styles.placeholderStyle}
									selectedTextStyle={styles.selectedTextStyle}
									inputSearchStyle={styles.inputSearchStyle}
									data={[
										{ label: 'FWD', value: 'FWD' },
										{ label: 'RWD', value: 'RWD' },
										{ label: 'AWD', value: 'AWD' },
										{ label: '4WD', value: '4WD' },
										{ label: '4x4', value: '4x4' }
									]}
									maxHeight={300}
									labelField='label'
									valueField='value'
									placeholder='Select Drivetrain'
									searchPlaceholder='Search...'
									value={formData.drivetrain}
									onChange={item => handleInputChange('drivetrain', item.value)}
								/>

								<Dropdown
									style={styles.dropdown}
									placeholderStyle={styles.placeholderStyle}
									selectedTextStyle={styles.selectedTextStyle}
									inputSearchStyle={styles.inputSearchStyle}
									data={[
										{ label: 'Benzine', value: 'Benzine' },
										{ label: 'Diesel', value: 'Diesel' },
										{ label: 'Electric', value: 'Electric' },
										{ label: 'Hybrid', value: 'Hybrid' }
									]}
									maxHeight={300}
									labelField='label'
									valueField='value'
									placeholder='Select Type'
									searchPlaceholder='Search...'
									value={formData.type}
									onChange={item => handleInputChange('type', item.value)}
								/>

								<TextInput
									className={`border ${
										isDarkMode
											? 'border-red bg-gray text-white'
											: 'border-red bg-white text-night'
									} rounded-lg p-4 mb-4`}
									placeholder='Mileage'
									placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
									value={formData.mileage ? formData.mileage.toString() : ''}
									onChangeText={text =>
										handleInputChange('mileage', parseInt(text) || '')
									}
									keyboardType='numeric'
								/>

								<Text
									className={`font-bold mb-2 mt-4 ${
										isDarkMode ? 'text-white' : 'text-night'
									}`}>
									Images:
								</Text>
								{modalImages.length > 0 ? (
									<View>
										<Text
											className={`mb-2 ${
												isDarkMode ? 'text-gray' : 'text-night'
											}`}>
											Hold and drag images to reorder
										</Text>
										<DraggableFlatList
											data={modalImages}
											renderItem={renderDraggableItem}
											keyExtractor={(item, index) => `draggable-item-${index}`}
											onDragEnd={({ data }) => setModalImages(data)}
										/>
									</View>
								) : (
									<Text
										className={`text-gray mb-2 ${
											isDarkMode ? 'text-white' : 'text-gray'
										}`}>
										No images uploaded yet
									</Text>
								)}

								<TouchableOpacity
									className={`flex-row justify-center items-center bg-red py-3 rounded-lg mt-4 ${
										isUploading ? 'opacity-50' : ''
									}`}
									onPress={pickImages}
									disabled={isUploading}>
									{isUploading ? (
										<ActivityIndicator color='white' />
									) : (
										<>
											<Ionicons name='camera-outline' size={24} color='white' />
											<Text className='text-white font-semibold ml-2'>
												Add Images
											</Text>
										</>
									)}
								</TouchableOpacity>

								{Object.keys(uploadProgress).length > 0 && (
									<View className='mt-4'>
										{Object.entries(uploadProgress).map(([uri, progress]) => (
											<View key={uri} className='flex-row items-center mb-2'>
												<Text
													className={`mr-2 ${
														isDarkMode ? 'text-white' : 'text-night'
													}`}>
													{`Image ${uri.slice(-8)}: `}
												</Text>
												{progress === 100 ? (
													<Ionicons
														name='checkmark-circle'
														size={20}
														color='green'
													/>
												) : progress === -1 ? (
													<Ionicons
														name='close-circle'
														size={20}
														color='#D55004'
													/>
												) : (
													<ActivityIndicator
														size='small'
														color={isDarkMode ? 'white' : 'black'}
													/>
												)}
											</View>
										))}
									</View>
								)}

								<View className='flex-row justify-end  py-8'>
									<TouchableOpacity
										className='bg-gray py-3 px-6 rounded-lg mr-4'
										onPress={onClose}>
										<Text className='text-night font-semibold'>Cancel</Text>
									</TouchableOpacity>
									<TouchableOpacity
										className='bg-red py-3 px-6 rounded-lg'
										onPress={handleSubmit}>
										<Text className='text-white font-semibold'>
											{initialData ? 'Update' : 'Create'}
										</Text>
									</TouchableOpacity>
								</View>
							</ScrollView>
						</View>
					</View>
				</GestureHandlerRootView>
			</KeyboardAvoidingView>
		</Modal>
	)
}

const styles = {
	dropdown: {
		height: 50,
		borderColor: 'gray',
		borderWidth: 0.5,
		borderRadius: 8,
		paddingHorizontal: 8,
		marginBottom: 16
	},
	placeholderStyle: {
		fontSize: 16,
		color: '#9CA3AF'
	},
	selectedTextStyle: {
		fontSize: 16,
		color: '#D55004'
	},
	inputSearchStyle: {
		height: 40,
		fontSize: 16,
		borderColor: 'gray'
	},
	dropdownItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 8,
		paddingHorizontal: 16
	},
	colorSwatch: {
		width: 20,
		height: 20,
		borderRadius: 4,
		marginRight: 8,
		borderWidth: 1,
		borderColor: '#E5E7EB'
	},
	dropdownItemText: {
		fontSize: 16,
		color: '#D55004'
	},
	dropdownItemTextDark: {
		fontSize: 16,
		color: '#D55004'
	}
}

export default ListingModal
