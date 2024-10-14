import React, { useState, useEffect, useCallback } from 'react'
import {
	View,
	Text,
	FlatList,
	TextInput,
	TouchableOpacity,
	Modal,
	ScrollView,
	StatusBar,
	Alert,
	ActivityIndicator,
	Dimensions,
	Image
} from 'react-native'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { supabase } from '@/utils/supabase'
import { useTheme } from '@/utils/ThemeContext'
import DateTimePicker from '@react-native-community/datetimepicker'
import * as Haptics from 'expo-haptics'
import { BlurView } from 'expo-blur'
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated'
import { Dropdown } from 'react-native-element-dropdown'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

interface Dealership {
	id: number
	name: string
	location: string
	phone: string
	subscription_end_date: string
	cars_listed: number
	total_sales: number
	longitude: number
	latitude: number
	logo: string
	user_id: string
}

const useDealershipState = () => {
	const [selectedDealership, setSelectedDealership] = useState(null)
	const [isModalVisible, setIsModalVisible] = useState(false)

	const openModal = useCallback((dealership: React.SetStateAction<null>) => {
		setSelectedDealership(dealership)
		setIsModalVisible(true)
	}, [])

	const closeModal = useCallback(() => {
		setIsModalVisible(false)
		setSelectedDealership(null)
	}, [])

	return { selectedDealership, isModalVisible, openModal, closeModal }
}

const ITEMS_PER_PAGE = 10

const CustomHeader = React.memo(({ title }: { title: string }) => {
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
})

export default function DealershipManagement() {
	const { isDarkMode } = useTheme()
	const [dealerships, setDealerships] = useState<Dealership[]>([])
	const [searchQuery, setSearchQuery] = useState('')
	const [currentPage, setCurrentPage] = useState(1)
	const [totalPages, setTotalPages] = useState(1)
	const [sortBy, setSortBy] = useState('name')
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
	const [isLoading, setIsLoading] = useState(true)
	const [showDatePicker, setShowDatePicker] = useState(false)
	const [selectedDealerships, setSelectedDealerships] = useState<number[]>([])
	const [bulkAction, setBulkAction] = useState<string | null>(null)
	const [extendMonths, setExtendMonths] = useState(1) // State to hold number of months to extend

	const { selectedDealership, isModalVisible, openModal, closeModal } =
		useDealershipState()

	useEffect(() => {
		fetchDealerships()
	}, [currentPage, sortBy, sortOrder])

	const fetchDealerships = async () => {
		setIsLoading(true)
		let query = supabase
			.from('dealerships')
			.select('*,cars(count)', { count: 'exact' })
			.range(
				(currentPage - 1) * ITEMS_PER_PAGE,
				currentPage * ITEMS_PER_PAGE - 1
			)
			.order(sortBy, { ascending: sortOrder === 'asc' })

		if (searchQuery) {
			query = query.or(
				`name.ilike.%${searchQuery}%,location.ilike.%${searchQuery}%`
			)
		}

		const { data, count, error } = await query

		if (error) {
			console.error('Error fetching dealerships:', error)
			Alert.alert('Error', 'Failed to fetch dealerships. Please try again.')
		} else {
			const dealershipsWithCarCount =
				data?.map(d => ({
					...d,
					cars_listed: d.cars[0].count
				})) || []
			setDealerships(dealershipsWithCarCount)
			setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE))
		}
		setIsLoading(false)
	}

	const handleSearch = () => {
		setCurrentPage(1)
		fetchDealerships()
	}

	const handleSort = (column: string) => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
		if (sortBy === column) {
			setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
		} else {
			setSortBy(column)
			setSortOrder('asc')
		}
	}

	const handleUpdateDealership = async (modalDealership: any) => {
		if (!modalDealership) return

		const { error } = await supabase
			.from('dealerships')
			.update({
				name: modalDealership.name,
				location: modalDealership.location,
				phone: modalDealership.phone,
				subscription_end_date: modalDealership.subscription_end_date,
				longitude: modalDealership.longitude,
				latitude: modalDealership.latitude,
				logo: modalDealership.logo
			})
			.eq('id', modalDealership.id)

		if (error) {
			console.error('Error updating dealership:', error)
			Alert.alert('Error', 'Failed to update dealership. Please try again.')
		} else {
			fetchDealerships()
			closeModal()
			Alert.alert('Success', 'Dealership updated successfully!')
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
		}
	}

	const handleBulkAction = async () => {
		if (!bulkAction || selectedDealerships.length === 0) return

		setIsLoading(true)
		let updateData = {}
		let successMessage = ''

		try {
			switch (bulkAction) {
				case 'extend':
					const currentDate = new Date()
					for (const id of selectedDealerships) {
						const dealership = dealerships.find(d => d.id === id)
						if (dealership) {
							const subscriptionEndDate = new Date(
								dealership.subscription_end_date
							)
							subscriptionEndDate.setMonth(
								subscriptionEndDate.getMonth() + extendMonths
							)
							updateData = {
								subscription_end_date: subscriptionEndDate
									.toISOString()
									.split('T')[0]
							}
							await supabase.from('dealerships').update(updateData).eq('id', id)
						}
					}
					successMessage = 'Subscription extended for selected dealerships!'
					break
				case 'end':
					updateData = {
						subscription_end_date: new Date().toISOString().split('T')[0]
					}
					await supabase
						.from('dealerships')
						.update(updateData)
						.in('id', selectedDealerships)
					successMessage = 'Subscription ended for selected dealerships!'
					break
			}

			fetchDealerships()
			setSelectedDealerships([])
			setBulkAction(null)
			Alert.alert('Success', successMessage)
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
		} catch (error) {
			console.error('Error performing bulk action:', error)
			Alert.alert('Error', 'Failed to perform bulk action. Please try again.')
		} finally {
			setIsLoading(false)
		}
	}

	const renderDealershipItem = useCallback(
		({ item }: any) => (
			<Animated.View entering={FadeInDown} exiting={FadeOutUp}>
				<TouchableOpacity
					className={`${
						isDarkMode ? 'bg-night' : 'bg-white'
					} rounded-lg shadow-md p-4 mb-4`}
					onPress={() => {
						openModal(item)
						Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
					}}>
					<View className='flex-row justify-between items-center mb-2'>
						<View className='flex-row items-center'>
							<TouchableOpacity
								onPress={() => {
									const newSelected = selectedDealerships.includes(item.id)
										? selectedDealerships.filter(id => id !== item.id)
										: [...selectedDealerships, item.id]
									setSelectedDealerships(newSelected)
								}}>
								<Ionicons
									name={
										selectedDealerships.includes(item.id)
											? 'checkbox'
											: 'square-outline'
									}
									size={24}
									color={isDarkMode ? '#D55004' : '#D55004'}
								/>
							</TouchableOpacity>
							<Text
								className={`text-xl font-bold ${
									isDarkMode ? 'text-white' : 'text-night'
								} ml-2`}>
								{item.name}
							</Text>
						</View>
						<View className='bg-red rounded-full px-2 py-1'>
							<Text className='text-white font-semibold text-xs'>
								{item.cars_listed} cars
							</Text>
						</View>
					</View>
					<View className='space-y-1'>
						<InfoRow icon='location' text={item.location} />
						<InfoRow icon='call' text={item.phone} />
						<InfoRow
							icon='calendar'
							text={`Ends: ${item.subscription_end_date}`}
						/>
					</View>
				</TouchableOpacity>
			</Animated.View>
		),
		[isDarkMode, selectedDealerships]
	)

	const InfoRow = ({ icon, text }: { icon: string; text: string }) => (
		<View className='flex-row items-center'>
			<Ionicons
				name={`${icon}-outline` as any}
				size={16}
				color={isDarkMode ? '#D55004' : '#D55004'}
			/>
			<Text className={`ml-2 ${isDarkMode ? 'text-gray' : 'text-gray'}`}>
				{text}
			</Text>
		</View>
	)

	const DealershipModal = ({ isVisible, dealership, onClose }: any) => {
		const [modalDealership, setModalDealership] = useState(dealership)

		const pickImage = async () => {
			let result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ImagePicker.MediaTypeOptions.Images,
				allowsEditing: true,
				aspect: [1, 1],
				quality: 1
			})

			if (!result.canceled && result.assets[0].uri) {
				setModalDealership((prev: any) =>
					prev ? { ...prev, logo: result.assets[0].uri } : null
				)
			}
		}

		const handleSubmit = () => {
			handleUpdateDealership(modalDealership)
		}
		return (
			<Modal visible={isVisible} animationType='slide' transparent>
				<BlurView
					intensity={80}
					tint={isDarkMode ? 'dark' : 'light'}
					style={{ flex: 1 }}>
					<View className='flex-1 justify-end'>
						<View
							className={`${
								isDarkMode ? 'bg-night' : 'bg-white'
							} rounded-t-3xl p-6 h-4/5`}>
							<ScrollView showsVerticalScrollIndicator={false}>
								<Text
									className={`text-2xl font-bold ${
										isDarkMode ? 'text-white' : 'text-night'
									} mb-2 text-center`}>
									Edit Dealership
								</Text>

								<TouchableOpacity
									onPress={pickImage}
									className='items-center mb-4'>
									<Image
										source={{
											uri:
												modalDealership?.logo ||
												'https://via.placeholder.com/150'
										}}
										className='w-32 h-32 rounded-full'
									/>
									<Text className='text-red mt-2'>Change Logo</Text>
								</TouchableOpacity>

								<TextInput
									className={`${
										isDarkMode
											? 'bg-gray text-white'
											: 'bg-light-secondary text-night'
									} rounded-lg p-3 mb-4`}
									value={modalDealership?.name}
									onChangeText={text =>
										setModalDealership((prev: any) => ({
											...prev!,
											name: text
										}))
									}
									placeholder='Dealership Name'
									placeholderTextColor={isDarkMode ? '#D55004' : '#D55004'}
								/>
								<TextInput
									className={`${
										isDarkMode
											? 'bg-gray text-white'
											: 'bg-light-secondary text-night'
									} rounded-lg p-3 mb-4`}
									value={modalDealership?.location}
									onChangeText={text =>
										setModalDealership((prev: any) => ({
											...prev!,
											location: text
										}))
									}
									placeholder='Location'
									placeholderTextColor={isDarkMode ? '#D55004' : '#D55004'}
								/>
								<TextInput
									className={`${
										isDarkMode
											? 'bg-gray text-white'
											: 'bg-light-secondary text-night'
									} rounded-lg p-3 mb-4`}
									value={modalDealership?.phone?.toString()}
									onChangeText={text =>
										setModalDealership((prev: any) => ({
											...prev!,
											phone: text
										}))
									}
									placeholder='Phone'
									keyboardType='phone-pad'
									placeholderTextColor={isDarkMode ? '#D55004' : '#D55004'}
								/>
								<TextInput
									className={`${
										isDarkMode
											? 'bg-gray text-white'
											: 'bg-light-secondary text-night'
									} rounded-lg p-3 mb-4`}
									value={modalDealership?.longitude?.toString()}
									onChangeText={text =>
										setModalDealership((prev: any) => ({
											...prev!,
											longitude: parseFloat(text) || 0
										}))
									}
									placeholder='Longitude'
									keyboardType='numeric'
									placeholderTextColor={isDarkMode ? '#D55004' : '#D55004'}
								/>
								<TextInput
									className={`${
										isDarkMode
											? 'bg-gray text-white'
											: 'bg-light-secondary text-night'
									} rounded-lg p-3 mb-4`}
									value={modalDealership?.latitude?.toString()}
									onChangeText={text =>
										setModalDealership((prev: any) => ({
											...prev!,
											latitude: parseFloat(text) || 0
										}))
									}
									placeholder='Latitude'
									keyboardType='numeric'
									placeholderTextColor={isDarkMode ? '#D55004' : '#D55004'}
								/>
								<TouchableOpacity
									className={`${
										isDarkMode ? 'bg-gray' : 'bg-light-secondary'
									} rounded-lg p-3 mb-4`}
									onPress={() => setShowDatePicker(true)}>
									<Text className={isDarkMode ? 'text-white' : 'text-night'}>
										Subscription End Date:{' '}
										{modalDealership?.subscription_end_date || 'Select Date'}
									</Text>
								</TouchableOpacity>
								{showDatePicker && (
									<DateTimePicker
										value={
											new Date(
												modalDealership?.subscription_end_date || Date.now()
											)
										}
										mode='date'
										display='default'
										onChange={(event, selectedDate) => {
											setShowDatePicker(false)
											if (selectedDate) {
												setModalDealership((prev: any) => ({
													...prev!,
													subscription_end_date: selectedDate
														.toISOString()
														.split('T')[0]
												}))
											}
										}}
									/>
								)}
								<TouchableOpacity
									className='bg-red rounded-lg p-4 items-center mb-2'
									onPress={handleSubmit}>
									<Text className='text-white font-bold text-lg'>
										Update Dealership
									</Text>
								</TouchableOpacity>
								<TouchableOpacity
									className={`${
										isDarkMode ? 'bg-gray' : 'bg-light-secondary'
									} rounded-lg p-4 items-center`}
									onPress={onClose}>
									<Text
										className={`font-bold text-lg ${
											isDarkMode ? 'text-white' : 'text-night'
										}`}>
										Cancel
									</Text>
								</TouchableOpacity>
							</ScrollView>
						</View>
					</View>
				</BlurView>
			</Modal>
		)
	}

	return (
		<View
			className={`flex-1 ${isDarkMode ? 'bg-night' : 'bg-light-background'}`}>
			<CustomHeader title='Dealership Page' showBackButton={false} />
			<ScrollView>
				<View className='px-4 mb-4'>
					<View className='flex-row mb-4'>
						<TextInput
							className={`flex-1 ${
								isDarkMode ? 'bg-gray text-white' : 'bg-white text-night'
							} rounded-l-full p-3 mt-3`}
							placeholder='Search dealerships...'
							placeholderTextColor={isDarkMode ? '#D55004' : '#D55004'}
							value={searchQuery}
							onChangeText={setSearchQuery}
							onSubmitEditing={handleSearch}
						/>
						<TouchableOpacity
							className='bg-red rounded-r-full p-3 justify-center items-center mt-3'
							onPress={handleSearch}>
							<Ionicons name='search' size={24} color='white' />
						</TouchableOpacity>
					</View>

					<View className='flex-row justify-around mb-4'>
						<SortButton title='Name' column='name' />
						<SortButton title='Location' column='location' />
						<SortButton title='Subscription' column='subscription_end_date' />
					</View>

					{selectedDealerships.length > 0 && (
						<View className='mb-4'>
							<Dropdown
								data={[
									{ label: 'Extend Subscription', value: 'extend' },
									{ label: 'End Subscription', value: 'end' }
								]}
								labelField='label'
								valueField='value'
								placeholder='Select bulk action'
								value={bulkAction}
								onChange={item => setBulkAction(item.value)}
								style={{
									backgroundColor: isDarkMode ? '#4C4C4C' : '#F5F5F5',
									borderRadius: 8,
									padding: 10,
									marginBottom: 10
								}}
								placeholderStyle={{ color: isDarkMode ? '#D55004' : '#D55004' }}
								selectedTextStyle={{
									color: isDarkMode ? '#FFFFFF' : '#0D0D0D'
								}}
							/>
							{bulkAction === 'extend' && (
								<View className='flex-row items-center mb-2'>
									<TextInput
										className={`${
											isDarkMode ? 'bg-gray text-white' : 'bg-white text-night'
										} rounded-lg p-2 flex-1 mr-2`}
										placeholder='Months'
										keyboardType='numeric'
										value={extendMonths.toString()}
										onChangeText={text => setExtendMonths(parseInt(text) || 0)}
									/>
									<TouchableOpacity
										className='bg-red rounded-lg p-2 px-4'
										onPress={handleBulkAction}
										disabled={!bulkAction}>
										<Text className='text-white font-bold'>Apply</Text>
									</TouchableOpacity>
								</View>
							)}
							{bulkAction === 'end' && (
								<TouchableOpacity
									className='bg-red rounded-lg p-2 px-4 self-end'
									onPress={handleBulkAction}>
									<Text className='text-white font-bold'>Apply</Text>
								</TouchableOpacity>
							)}
						</View>
					)}
				</View>

				{isLoading ? (
					<ActivityIndicator
						size='large'
						color='#D55004'
						style={{ marginTop: 20 }}
					/>
				) : (
					<FlatList
						data={dealerships}
						renderItem={renderDealershipItem}
						keyExtractor={item => item.id.toString()}
						contentContainerStyle={{ paddingHorizontal: 16 }}
					/>
				)}

				<View className='flex-row justify-between items-center p-4 border-t border-gray'>
					<PaginationButton
						title='Previous'
						onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
						disabled={currentPage === 1}
					/>
					<Text
						className={`${
							isDarkMode ? 'text-white' : 'text-night'
						}`}>{`Page ${currentPage} of ${totalPages}`}</Text>
					<PaginationButton
						title='Next'
						onPress={() =>
							setCurrentPage(prev => Math.min(totalPages, prev + 1))
						}
						disabled={currentPage === totalPages}
					/>
				</View>
			</ScrollView>
			<DealershipModal
				isVisible={isModalVisible}
				dealership={selectedDealership}
				onClose={closeModal}
			/>
		</View>
	)
	function SortButton({ title, column }: { title: string; column: string }) {
		return (
			<TouchableOpacity onPress={() => handleSort(column)}>
				<Text
					className={`px-3 py-2 rounded-full ${
						sortBy === column
							? 'bg-red text-white'
							: isDarkMode
							? 'bg-gray text-white'
							: 'bg-light-secondary text-night'
					}`}>
					{title} {sortBy === column && (sortOrder === 'asc' ? '↑' : '↓')}
				</Text>
			</TouchableOpacity>
		)
	}

	function PaginationButton({
		title,
		onPress,
		disabled
	}: {
		title: string
		onPress: () => void
		disabled: boolean
	}) {
		return (
			<TouchableOpacity onPress={onPress} disabled={disabled}>
				<Text
					className={`font-bold ${
						disabled ? 'text-gray' : isDarkMode ? 'text-red' : 'text-red'
					}`}>
					{title}
				</Text>
			</TouchableOpacity>
		)
	}
}
