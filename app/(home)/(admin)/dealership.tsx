import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
	Image,
	RefreshControl
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
import { PieChart } from 'react-native-chart-kit'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

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
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
	}, [])

	const closeModal = useCallback(() => {
		setIsModalVisible(false)
		setSelectedDealership(null)
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
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

const InfoRow = React.memo(
	({ icon, text, color }: { icon: string; text: string; color?: string }) => {
		const { isDarkMode } = useTheme()
		return (
			<View className='flex-row items-center h-6'>
				<Ionicons
					name={`${icon}-outline` as any}
					size={16}
					color={color || (isDarkMode ? '#D55004' : '#D55004')}
				/>
				<Text
					className={`ml-2 ${isDarkMode ? 'text-white' : 'text-gray'} flex-1`}
					style={color ? { color } : {}}
					numberOfLines={1}
					ellipsizeMode='tail'>
					{text}
				</Text>
			</View>
		)
	}
)

export default function DealershipManagement() {
	const { isDarkMode } = useTheme()
	const [dealerships, setDealerships] = useState<Dealership[]>([])
	const [allDealerships, setAllDealerships] = useState<Dealership[]>([])
	const [expiredDealerships, setExpiredDealerships] = useState<Dealership[]>([])
	const [nearExpiringDealerships, setNearExpiringDealerships] = useState<
		Dealership[]
	>([])
	const [searchQuery, setSearchQuery] = useState('')
	const [currentPage, setCurrentPage] = useState(1)
	const [totalPages, setTotalPages] = useState(1)
	const [sortBy, setSortBy] = useState('name')
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
	const [isLoading, setIsLoading] = useState(true)
	const [showDatePicker, setShowDatePicker] = useState(false)
	const [selectedDealerships, setSelectedDealerships] = useState<number[]>([])
	const [bulkAction, setBulkAction] = useState<string | null>(null)
	const [extendMonths, setExtendMonths] = useState(1)
	const [refreshing, setRefreshing] = useState(false)
	const [subscriptionStats, setSubscriptionStats] = useState({
		active: 0,
		expiring: 0,
		expired: 0
	})

	const { selectedDealership, isModalVisible, openModal, closeModal } =
		useDealershipState()

	const fetchAllDealerships = useCallback(async () => {
		try {
			const { data, error } = await supabase
				.from('dealerships')
				.select('*,cars(count)')

			if (error) throw error

			const dealershipsWithCarCount =
				data?.map(d => ({
					...d,
					cars_listed: d.cars[0].count
				})) || []

			setAllDealerships(dealershipsWithCarCount)

			// Calculate subscription stats
			const now = new Date()
			const thirtyDaysFromNow = new Date(
				now.getTime() + 30 * 24 * 60 * 60 * 1000
			)
			const stats = dealershipsWithCarCount.reduce(
				(acc, d) => {
					const endDate = new Date(d.subscription_end_date)
					if (endDate < now) acc.expired++
					else if (endDate <= thirtyDaysFromNow) acc.expiring++
					else acc.active++
					return acc
				},
				{ active: 0, expiring: 0, expired: 0 }
			)
			setSubscriptionStats(stats)

			// Set expired and near-expiring dealerships
			setExpiredDealerships(
				dealershipsWithCarCount.filter(
					d => new Date(d.subscription_end_date) < now
				)
			)
			setNearExpiringDealerships(
				dealershipsWithCarCount.filter(d => {
					const endDate = new Date(d.subscription_end_date)
					return endDate >= now && endDate <= thirtyDaysFromNow
				})
			)
		} catch (error) {
			console.error('Error fetching all dealerships:', error)
			Alert.alert('Error', 'Failed to fetch all dealerships data.')
		}
	}, [])

	useEffect(() => {
		fetchAllDealerships()
	}, [fetchAllDealerships])

	const fetchDealerships = useCallback(async () => {
		setIsLoading(true)
		try {
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

			if (error) throw error

			const dealershipsWithCarCount =
				data?.map(d => ({
					...d,
					cars_listed: d.cars[0].count
				})) || []

			setDealerships(dealershipsWithCarCount)
			setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE))
		} catch (error) {
			console.error('Error fetching dealerships:', error)
			Alert.alert(
				'Error',
				'Failed to fetch dealerships. Please check your network connection and try again.'
			)
		} finally {
			setIsLoading(false)
			setRefreshing(false)
		}
	}, [currentPage, sortBy, sortOrder, searchQuery])

	useEffect(() => {
		fetchDealerships()
	}, [fetchDealerships])

	const handleSearch = useCallback(() => {
		setCurrentPage(1)
		fetchDealerships()
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
	}, [fetchDealerships])

	const handleSort = useCallback((column: string) => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
		setSortBy(column)
		setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
	}, [])

	const handleUpdateDealership = useCallback(
		async (modalDealership: any) => {
			if (!modalDealership) return

			try {
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

				if (error) throw error

				await fetchDealerships()
				await fetchAllDealerships()
				closeModal()
				Alert.alert('Success', 'Dealership updated successfully!')
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
			} catch (error) {
				console.error('Error updating dealership:', error)
				Alert.alert('Error', 'Failed to update dealership. Please try again.')
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
			}
		},
		[fetchDealerships, fetchAllDealerships, closeModal]
	)

	const handleBulkAction = useCallback(async () => {
		if (!bulkAction || selectedDealerships.length === 0) return

		setIsLoading(true)
		try {
			const currentDate = new Date()
			const updatePromises = selectedDealerships.map(async id => {
				const dealership = allDealerships.find(d => d.id === id)
				if (!dealership) return

				let updateData: any = {}
				if (bulkAction === 'extend') {
					const subscriptionEndDate = new Date(dealership.subscription_end_date)
					const newEndDate = new Date(
						Math.max(currentDate.getTime(), subscriptionEndDate.getTime())
					)
					newEndDate.setMonth(newEndDate.getMonth() + extendMonths)
					updateData.subscription_end_date = newEndDate
						.toISOString()
						.split('T')[0]
				} else if (bulkAction === 'end') {
					updateData.subscription_end_date = currentDate
						.toISOString()
						.split('T')[0]
				}

				const { error } = await supabase
					.from('dealerships')
					.update(updateData)
					.eq('id', id)
				if (error) throw error
			})

			await Promise.all(updatePromises)

			fetchDealerships()
			fetchAllDealerships()
			setSelectedDealerships([])
			setBulkAction(null)
			Alert.alert(
				'Success',
				`Subscription ${
					bulkAction === 'extend' ? 'extended' : 'ended'
				} for selected dealerships!`
			)
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
		} catch (error) {
			console.error('Error performing bulk action:', error)
			Alert.alert('Error', 'Failed to perform bulk action. Please try again.')
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
		} finally {
			setIsLoading(false)
		}
	}, [
		bulkAction,
		selectedDealerships,
		allDealerships,
		extendMonths,
		fetchDealerships,
		fetchAllDealerships
	])

	const getSubscriptionStatus = useCallback((endDate: string) => {
		const now = new Date()
		const subscriptionEnd = new Date(endDate)
		const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

		if (subscriptionEnd < now) {
			return { status: 'Expired', color: '#FF0000' }
		} else if (subscriptionEnd <= thirtyDaysFromNow) {
			return { status: 'Expiring Soon', color: '#FFA500' }
		} else {
			return { status: 'Active', color: '#008000' }
		}
	}, [])

	const renderDealershipItem = useCallback(
		({ item }: { item: any }) => {
			const { status, color } = getSubscriptionStatus(
				item.subscription_end_date
			)

			return (
				<Animated.View
					entering={FadeInDown}
					exiting={FadeOutUp}
					className='mb-2'>
					<TouchableOpacity
						className={`${
							isDarkMode ? 'bg-night border-white' : 'bg-white border-gray'
						} rounded-lg p-4 mb-4 border shadow-2xl shadow-red`}
						onPress={() => openModal(item)}>
						<View className='flex-row justify-between items-center mb-2'>
							<View className='flex-row items-center'>
								<TouchableOpacity
									onPress={() => {
										const newSelected = selectedDealerships.includes(item.id)
											? selectedDealerships.filter(id => id !== item.id)
											: [...selectedDealerships, item.id]
										setSelectedDealerships(newSelected)
										Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
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
										isDarkMode ? 'text-red' : 'text-red'
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
								color={color}
							/>
							<InfoRow
								icon='information-circle'
								text={`Status: ${status}`}
								color={color}
							/>
						</View>
					</TouchableOpacity>
				</Animated.View>
			)
		},
		[isDarkMode, selectedDealerships, openModal, getSubscriptionStatus]
	)

	const DealershipModal = useMemo(() => {
		return ({ isVisible, dealership, onClose }: any) => {
			const [modalDealership, setModalDealership] = useState(dealership)
			const [modalDate, setModalDate] = useState(
				new Date(dealership?.subscription_end_date || new Date())
			)

			useEffect(() => {
				setModalDealership(dealership)
				setModalDate(new Date(dealership?.subscription_end_date || new Date()))
			}, [dealership])

			const pickImage = async () => {
				try {
					const result = await ImagePicker.launchImageLibraryAsync({
						mediaTypes: ImagePicker.MediaTypeOptions.Images,
						allowsEditing: true,
						aspect: [1, 1],
						quality: 1
					})

					if (!result.canceled && result.assets[0].uri) {
						setModalDealership((prev: any) => ({
							...prev,
							logo: result.assets[0].uri
						}))
						Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
					}
				} catch (error) {
					console.error('Error picking image:', error)
					Alert.alert('Error', 'Failed to pick image. Please try again.')
				}
			}

			const handleSubmit = () => {
				handleUpdateDealership({
					...modalDealership,
					subscription_end_date: modalDate.toISOString().split('T')[0]
				})
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
	}, [isDarkMode, handleUpdateDealership, showDatePicker])
	const SortButton = useCallback(
		({ title, column }: { title: string; column: string }) => {
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
		},
		[sortBy, sortOrder, isDarkMode, handleSort]
	)

	const PaginationButton = useCallback(
		({
			title,
			onPress,
			disabled
		}: {
			title: string
			onPress: () => void
			disabled: boolean
		}) => {
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
		},
		[isDarkMode]
	)

	const onRefresh = useCallback(() => {
		setRefreshing(true)
		fetchDealerships()
		fetchAllDealerships()
	}, [fetchDealerships, fetchAllDealerships])

	const SubscriptionChart = useMemo(() => {
		const data = [
			{
				name: 'Active',
				population: subscriptionStats.active,
				color: '#008000',
				legendFontColor: '#7F7F7F',
				legendFontSize: 12
			},
			{
				name: 'Expiring',
				population: subscriptionStats.expiring,
				color: '#FFA500',
				legendFontColor: '#7F7F7F',
				legendFontSize: 12
			},
			{
				name: 'Expired',
				population: subscriptionStats.expired,
				color: '#FF0000',
				legendFontColor: '#7F7F7F',
				legendFontSize: 12
			}
		]
		return (
			<View className='mb-4'>
				<Text
					className={`text-lg font-bold mb-2 ${
						isDarkMode ? 'text-white' : 'text-night'
					}`}>
					Subscription Overview
				</Text>
				<PieChart
					data={data}
					width={SCREEN_WIDTH - 32}
					height={200}
					chartConfig={{
						color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
						labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`
					}}
					accessor='population'
					backgroundColor='transparent'
					paddingLeft='15'
					absolute
				/>
			</View>
		)
	}, [subscriptionStats, isDarkMode])

	const ExpiredDealershipsList = useMemo(
		() => (
			<View className='mb-4'>
				<Text
					className={`text-lg font-bold mb-2  ${
						isDarkMode ? 'text-white' : 'text-night'
					}`}>
					Expired Subscriptions
				</Text>
				<FlatList
					data={expiredDealerships}
					renderItem={renderDealershipItem}
					keyExtractor={item => `expired-${item.id}`}
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={{ paddingLeft: 0 }}
					ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
				/>
			</View>
		),
		[expiredDealerships, isDarkMode, renderDealershipItem]
	)

	const NearExpiringDealershipsList = useMemo(
		() => (
			<View className='mb-4'>
				<Text
					className={`text-lg font-bold mb-2  ${
						isDarkMode ? 'text-white' : 'text-night'
					}`}>
					Expiring Soon
				</Text>
				<FlatList
					data={nearExpiringDealerships}
					renderItem={renderDealershipItem}
					keyExtractor={item => `expiring-${item.id}`}
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={{ paddingLeft: 0 }}
					ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
				/>
			</View>
		),
		[nearExpiringDealerships, isDarkMode, renderDealershipItem]
	)

	return (
		<View
			className={`flex-1 ${
				isDarkMode ? 'bg-night' : 'bg-light-background'
			} mb-10`}>
			<CustomHeader title='Dealership Management' />
			<FlatList
				data={dealerships}
				renderItem={renderDealershipItem}
				keyExtractor={item => item.id.toString()}
				contentContainerStyle={{ paddingHorizontal: 16 }}
				ListHeaderComponent={
					<>
						{SubscriptionChart}
						{ExpiredDealershipsList}
						{NearExpiringDealershipsList}
						<View className='flex-row mb-4'>
							<TextInput
								className={`flex-1 ${
									isDarkMode
										? 'bg-gray text-white'
										: 'bg-light-secondary text-night'
								} rounded-l-full p-3 mt-3`}
								placeholder='Search dealerships...'
								placeholderTextColor={isDarkMode ? '#FFF' : '#D55004'}
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
									placeholderStyle={{
										color: isDarkMode ? '#D55004' : '#D55004'
									}}
									selectedTextStyle={{
										color: isDarkMode ? '#FFFFFF' : '#0D0D0D'
									}}
								/>
								{bulkAction === 'extend' && (
									<View className='flex-row items-center mb-2'>
										<TextInput
											className={`${
												isDarkMode
													? 'bg-gray text-white'
													: 'bg-white text-night'
											} rounded-lg p-2 flex-1 mr-2`}
											placeholder='Months'
											keyboardType='numeric'
											value={extendMonths.toString()}
											onChangeText={text =>
												setExtendMonths(parseInt(text) || 0)
											}
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
					</>
				}
				ListFooterComponent={
					<View className='flex-row justify-between items-center p-4 border-t border-gray'>
						<PaginationButton
							title='Previous'
							onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
							disabled={currentPage === 1}
						/>
						<Text className={`${isDarkMode ? 'text-white' : 'text-night'}`}>
							{`Page ${currentPage} of ${totalPages}`}
						</Text>
						<PaginationButton
							title='Next'
							onPress={() =>
								setCurrentPage(prev => Math.min(totalPages, prev + 1))
							}
							disabled={currentPage === totalPages}
						/>
					</View>
				}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
				}
				initialNumToRender={5}
				maxToRenderPerBatch={10}
				updateCellsBatchingPeriod={50}
				windowSize={5}
			/>
			<LoadingOverlay isVisible={isLoading} />
			<DealershipModal
				isVisible={isModalVisible}
				dealership={selectedDealership}
				onClose={closeModal}
			/>
		</View>
	)
}

const LoadingOverlay = ({ isVisible }: { isVisible: boolean }) => {
	if (!isVisible) return null

	return (
		<View
			className='absolute inset-0 bg-black bg-opacity-50 justify-center items-center z-50'
			style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
			<BlurView
				intensity={80}
				tint='dark'
				style={{ borderRadius: 20, padding: 20 }}>
				<ActivityIndicator size='large' color='#D55004' />
				<Text className='text-white mt-2'>Loading...</Text>
			</BlurView>
		</View>
	)
}
