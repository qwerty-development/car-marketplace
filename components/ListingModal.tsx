import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	Modal,
	ScrollView,
	Image,
	ActivityIndicator
} from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { styled } from 'nativewind'
import { FontAwesome } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { supabase } from '@/utils/supabase'
import { Buffer } from 'buffer'
import DraggableFlatList from 'react-native-draggable-flatlist'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import axios from 'axios'
import SearchableDropdown from './SearchableDropdown'
import { Dropdown } from 'react-native-element-dropdown'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTextInput = styled(TextInput)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledImage = styled(Image)

const ListingModal = ({
	isVisible,
	onClose,
	onSubmit,
	initialData,
	dealership
}: any) => {
	const [formData, setFormData] = useState(initialData || {})
	const [modalImages, setModalImages] = useState(initialData?.images || [])
	const [isUploading, setIsUploading] = useState(false)
	const [makes, setMakes] = useState<any>([])
	const [models, setModels] = useState<any>([])
	const [uploadProgress, setUploadProgress] = useState<{
		[key: string]: number
	}>({})

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

	const fetchMakes = async () => {
		try {
			const { data, error } = await supabase
				.from('allcars')
				.select('make')
				.order('make')

			if (error) throw error

			const uniqueMakes = Array.from(new Set(data.map(item => item.make)))
			const makesData = uniqueMakes.map(make => ({
				id: make,
				name: make
			}))

			setMakes(makesData)
		} catch (error) {
			console.error('Error fetching makes:', error)
		}
	}

	const fetchModels = async (make: string) => {
		try {
			const { data, error } = await supabase
				.from('allcars')
				.select('model')
				.eq('make', make)
				.order('model')

			if (error) throw error

			const uniqueModels = Array.from(new Set(data.map(item => item.model)))
			const modelsData = uniqueModels.map(model => ({
				id: model,
				name: model
			}))

			setModels(modelsData)
		} catch (error) {
			console.error('Error fetching models:', error)
		}
	}

	const handleInputChange = (
		key: string,
		value: string | number | null,
		customValue?: string
	) => {
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
	}

	const pickImages = async () => {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
		if (status !== 'granted') {
			alert('Sorry, we need camera roll permissions to make this work!')
			return
		}

		let result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsMultipleSelection: true,
			quality: 1
		})

		if (!result.canceled && result.assets && result.assets.length > 0) {
			setIsUploading(true)
			try {
				await handleMultipleImageUpload(result.assets)
			} catch (error) {
				console.error('Error uploading images:', error)
				alert('Failed to upload images. Please try again.')
			} finally {
				setIsUploading(false)
				setUploadProgress({})
			}
		}
	}

	const handleMultipleImageUpload = async (
		assets: ImagePicker.ImagePickerAsset[]
	) => {
		if (!dealership) return

		const uploadPromises = assets.map(async (asset, index) => {
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

				setUploadProgress(prev => ({ ...prev, [asset.uri]: 100 }))

				return publicURLData.publicUrl
			} catch (error) {
				console.error('Error uploading image:', error)
				setUploadProgress(prev => ({ ...prev, [asset.uri]: -1 }))
				return null
			}
		})

		const uploadedUrls = await Promise.all(uploadPromises)
		const successfulUploads = uploadedUrls.filter(
			url => url !== null
		) as string[]

		setModalImages((prev: any) => [...successfulUploads, ...prev])
		setFormData((prev: { images: any }) => ({
			...prev,
			images: [...successfulUploads, ...(prev.images || [])]
		}))
	}

	const handleImageUpload = async (imageUri: string) => {
		if (!dealership) return

		try {
			const fileName = `${Date.now()}_${Math.random()
				.toString(36)
				.substring(7)}.jpg`
			const filePath = `${dealership.id}/${fileName}`

			const base64 = await FileSystem.readAsStringAsync(imageUri, {
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

			setModalImages((prev: any) => [publicURLData.publicUrl, ...prev])
			setFormData((prev: { images: any }) => ({
				...prev,
				images: [publicURLData.publicUrl, ...(prev.images || [])]
			}))
		} catch (error) {
			console.error('Detailed error in handleImageUpload:', error)
			throw error
		}
	}

	const handleRemoveImage = async (imageUrl: string) => {
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
		} catch (error: any) {
			console.error('Error removing image:', error)
			alert('Failed to remove image: ' + error.message)
		}
	}

	const renderDraggableItem = ({ item, drag, isActive }: any) => (
		<TouchableOpacity
			onLongPress={drag}
			disabled={isActive}
			style={{
				opacity: isActive ? 0.5 : 1,
				flexDirection: 'row',
				alignItems: 'center',
				marginBottom: 10
			}}>
			<StyledImage
				source={{ uri: item }}
				style={{ width: 80, height: 80, marginRight: 10 }}
			/>
			<FontAwesome name='bars' size={20} color='gray' />
			<StyledTouchableOpacity
				onPress={() => handleRemoveImage(item)}
				style={{ marginLeft: 10 }}>
				<FontAwesome name='trash' size={20} color='red' />
			</StyledTouchableOpacity>
		</TouchableOpacity>
	)

	const handleSubmit = () => {
		onSubmit({ ...formData, images: modalImages })
	}

	return (
		<Modal visible={isVisible} animationType='slide' transparent={true}>
			<GestureHandlerRootView style={{ flex: 1 }}>
				<StyledView className='flex-1 mt-24 justify-center items-cent0'>
					<StyledView className='bg-white p-6 rounded-lg'>
						<ScrollView>
							<StyledText className='text-2xl font-bold mb-4'>
								{initialData ? 'Edit Listing' : 'Create New Listing'}
							</StyledText>

							<SearchableDropdown
								items={makes}
								onItemSelect={item =>
									handleInputChange('make', item ? item.name : null)
								}
								placeholder='Select Make'
								selectedItem={
									formData.make
										? { id: formData.make, name: formData.make }
										: undefined
								}
							/>

							<SearchableDropdown
								items={models}
								onItemSelect={item =>
									handleInputChange('model', item ? item.name : null)
								}
								placeholder='Select Model'
								selectedItem={
									formData.model
										? { id: formData.model, name: formData.model }
										: undefined
								}
							/>
							<StyledTextInput
								className='border border-gray-300 rounded p-2 mb-4'
								placeholder='Year'
								value={formData.year ? formData.year.toString() : ''}
								onChangeText={(text: any) =>
									handleInputChange('year', parseInt(text) || '')
								}
								keyboardType='numeric'
							/>
							<StyledTextInput
								className='border border-gray-300 rounded p-2 mb-4'
								placeholder='Price'
								value={formData.price ? formData.price.toString() : ''}
								onChangeText={text =>
									handleInputChange('price', parseInt(text) || '')
								}
								keyboardType='numeric'
							/>
							<StyledTextInput
								className='border border-gray-300 rounded p-2 mb-4'
								placeholder='Description'
								value={formData.description || ''}
								onChangeText={text => handleInputChange('description', text)}
								multiline
							/>
							<Dropdown
								style={{
									height: 50,
									borderColor: 'gray',
									borderWidth: 0.5,
									borderRadius: 8,
									paddingHorizontal: 8,
									marginBottom: 16
								}}
								placeholderStyle={{ fontSize: 16 }}
								selectedTextStyle={{ fontSize: 16 }}
								inputSearchStyle={{ height: 40, fontSize: 16 }}
								data={[
									{ label: 'Sedan', value: 'Sedan' },
									{ label: 'SUV', value: 'SUV' },
									{ label: 'Hatchback', value: 'Hatchback' },
									{ label: 'Convertible', value: 'Convertible' },
									{ label: 'Coupe', value: 'Coupe' },
									{ label: 'Sports', value: 'Sports' },
									{ label: 'Others', value: 'Other' }
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
								style={{
									height: 50,
									borderColor: 'gray',
									borderWidth: 0.5,
									borderRadius: 8,
									paddingHorizontal: 8,
									marginBottom: 16
								}}
								placeholderStyle={{ fontSize: 16 }}
								selectedTextStyle={{ fontSize: 16 }}
								inputSearchStyle={{ height: 40, fontSize: 16 }}
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
								style={{
									height: 50,
									borderColor: 'gray',
									borderWidth: 0.5,
									borderRadius: 8,
									paddingHorizontal: 8,
									marginBottom: 16
								}}
								placeholderStyle={{ fontSize: 16 }}
								selectedTextStyle={{ fontSize: 16 }}
								inputSearchStyle={{ height: 40, fontSize: 16 }}
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

							<SearchableDropdown
								items={colors}
								onItemSelect={item =>
									handleInputChange('color', item ? item.name : null)
								}
								placeholder='Select Color'
								selectedItem={
									formData.color
										? colors.find(color => color.name === formData.color)
										: undefined
								}
							/>

							<Dropdown
								style={{
									height: 50,
									borderColor: 'gray',
									borderWidth: 0.5,
									borderRadius: 8,
									paddingHorizontal: 8,
									marginBottom: 16
								}}
								placeholderStyle={{ fontSize: 16 }}
								selectedTextStyle={{ fontSize: 16 }}
								inputSearchStyle={{ height: 40, fontSize: 16 }}
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
								onChange={item => handleInputChange('transmission', item.value)}
							/>

							<Dropdown
								style={{
									height: 50,
									borderColor: 'gray',
									borderWidth: 0.5,
									borderRadius: 8,
									paddingHorizontal: 8,
									marginBottom: 16
								}}
								placeholderStyle={{ fontSize: 16 }}
								selectedTextStyle={{ fontSize: 16 }}
								inputSearchStyle={{ height: 40, fontSize: 16 }}
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
								style={{
									height: 50,
									borderColor: 'gray',
									borderWidth: 0.5,
									borderRadius: 8,
									paddingHorizontal: 8,
									marginBottom: 16
								}}
								placeholderStyle={{ fontSize: 16 }}
								selectedTextStyle={{ fontSize: 16 }}
								inputSearchStyle={{ height: 40, fontSize: 16 }}
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
							<StyledTextInput
								className='border border-gray-300 rounded p-2 mb-4'
								placeholder='Mileage'
								value={formData.mileage ? formData.mileage.toString() : ''}
								onChangeText={text =>
									handleInputChange('mileage', parseInt(text) || '')
								}
								keyboardType='numeric'
							/>

							<StyledText className='font-bold mb-2 mt-4'>Images:</StyledText>
							{modalImages.length > 0 ? (
								<DraggableFlatList
									data={modalImages}
									renderItem={renderDraggableItem}
									keyExtractor={(item, index) => `draggable-item-${index}`}
									onDragEnd={({ data }) => setModalImages(data)}
									horizontal={false}
								/>
							) : (
								<StyledText className='text-gray-500 mb-2'>
									No images uploaded yet
								</StyledText>
							)}

							<StyledView className='flex-row justify-between mt-2'>
								<StyledTouchableOpacity
									className='bg-blue-500 py-2 px-4 rounded flex-1 mr-2 items-center'
									onPress={pickImages}
									disabled={isUploading}>
									{isUploading ? (
										<ActivityIndicator color='white' />
									) : (
										<StyledText className='text-white'>Add Images</StyledText>
									)}
								</StyledTouchableOpacity>
							</StyledView>

							{Object.keys(uploadProgress).length > 0 && (
								<StyledView className='mt-2'>
									{Object.entries(uploadProgress).map(([uri, progress]) => (
										<StyledView
											key={uri}
											className='flex-row items-center mb-1'>
											<StyledText className='mr-2'>{`Image ${uri.slice(
												-8
											)}: `}</StyledText>
											{progress === 100 ? (
												<FontAwesome name='check' size={16} color='green' />
											) : progress === -1 ? (
												<FontAwesome name='times' size={16} color='red' />
											) : (
												<ActivityIndicator size='small' />
											)}
										</StyledView>
									))}
								</StyledView>
							)}

							<StyledView className='flex-row justify-end mt-4 mb-10'>
								<StyledTouchableOpacity
									className='bg-gray-300 py-2 px-4 rounded mr-2'
									onPress={onClose}>
									<StyledText>Cancel</StyledText>
								</StyledTouchableOpacity>
								<StyledTouchableOpacity
									className='bg-red py-2 px-4 rounded'
									onPress={handleSubmit}>
									<StyledText className='text-white'>
										{initialData ? 'Update' : 'Create'}
									</StyledText>
								</StyledTouchableOpacity>
							</StyledView>
						</ScrollView>
					</StyledView>
				</StyledView>
			</GestureHandlerRootView>
		</Modal>
	)
}

export default ListingModal
