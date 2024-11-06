import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	FlatList,
	TextInput,
	Modal,
	Alert,
	ActivityIndicator,
	RefreshControl,
	Platform,
	StyleSheet,
	StatusBar,
	Vibration
} from 'react-native'
import { useUser } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '@/utils/ThemeContext'
import { LinearGradient } from 'expo-linear-gradient'
import DateTimePicker from '@react-native-community/datetimepicker'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'

interface User {
	id: string
	firstName: string
	lastName: string
	emailAddresses: { emailAddress: string }[]
	publicMetadata: { role?: string }
}

interface DealershipForm {
	location: string
	phone: string
	subscriptionEndDate: Date
}

const CustomHeader = React.memo(({ title }: { title: string }) => {
	const { isDarkMode } = useTheme()
	return (
		<SafeAreaView
			edges={['top']}
			style={[
				styles.header,
				isDarkMode ? styles.darkHeader : styles.lightHeader
			]}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View style={styles.headerContent}>
				<Text style={styles.headerTitle}>{title}</Text>
			</View>
		</SafeAreaView>
	)
})

const UserItem = React.memo(
	({
		item,
		onPress,
		onRoleChange
	}: {
		item: User
		onPress: () => void
		onRoleChange: () => void
	}) => {
		const { isDarkMode } = useTheme()
		return (
			<TouchableOpacity
				style={[
					styles.userItem,
					isDarkMode ? styles.darkUserItem : styles.lightUserItem
				]}
				onPress={onPress}>
				{item.firstName && (
					<Text
						style={[
							styles.userName,
							isDarkMode ? styles.darkText : styles.lightText
						]}>
						{item.firstName} {item.lastName}
					</Text>
				)}
				<Text
					style={[
						styles.userEmail,
						isDarkMode ? styles.darkSubText : styles.lightSubText
					]}>
					{item.emailAddresses[0].emailAddress}
				</Text>
				<View style={styles.userRoleContainer}>
					<Text
						style={[
							styles.userRole,
							{ color: isDarkMode ? '#FF6B6B' : '#D55004' }
						]}>
						Role: {item.publicMetadata.role || 'user'}
					</Text>
					<TouchableOpacity
						style={[
							styles.roleButton,
							{
								backgroundColor:
									item.publicMetadata.role === 'dealer' ? '#4CAF50' : '#2196F3'
							}
						]}
						onPress={onRoleChange}>
						<Text style={styles.roleButtonText}>
							{item.publicMetadata.role === 'dealer'
								? 'Revoke Dealer'
								: 'Make Dealer'}
						</Text>
					</TouchableOpacity>
				</View>
			</TouchableOpacity>
		)
	}
)

export default function AdminUserManagement() {
	const { isDarkMode } = useTheme()
	const [users, setUsers] = useState<User[]>([])
	const [search, setSearch] = useState('')
	const [selectedUser, setSelectedUser] = useState<User | null>(null)
	const [dealershipForm, setDealershipForm] = useState<DealershipForm>({
		location: '',
		phone: '',
		subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
	})
	const [isDealershipFormVisible, setIsDealershipFormVisible] = useState(false)
	const [isModifyingDealer, setIsModifyingDealer] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [refreshing, setRefreshing] = useState(false)
	const [showDatePicker, setShowDatePicker] = useState(false)

	const [debouncedSearch, setDebouncedSearch] = useState(search)

	const fetchUsers = useCallback(async () => {
		setIsLoading(true)
		try {
			const response = await fetch(
				`https://backend-car-marketplace.vercel.app/api/users?query=${debouncedSearch}`
			)

			// Handle no results case without throwing error
			if (response.status === 404) {
				setUsers([])
				return
			}

			// Handle server errors more gracefully
			if (!response.ok) {
				throw new Error(
					response.status === 500
						? 'Server is temporarily unavailable'
						: `Error: ${response.status}`
				)
			}

			const data = await response.json()
			setUsers(data.data || [])
		} catch (error: any) {
			console.warn('Search warning:', error)
			// Don't show alert for expected cases
			if (error.message !== 'Server is temporarily unavailable') {
				Alert.alert(
					'Notice',
					'Search results may be incomplete. Please try again later.',
					[{ text: 'OK' }]
				)
			}
			// Keep existing results on error
		} finally {
			setIsLoading(false)
		}
	}, [debouncedSearch])

	useEffect(() => {
		fetchUsers()
	}, [fetchUsers])

	const onRefresh = useCallback(() => {
		setRefreshing(true)
		fetchUsers().then(() => setRefreshing(false))
	}, [fetchUsers])

	const handleSetRole = useCallback(async (userId: string, role: string) => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
		if (role === 'dealer') {
			setIsModifyingDealer(false)
			setIsDealershipFormVisible(true)
		} else {
			await updateUserRole(userId, role)
		}
	}, [])

	const updateUserRole = useCallback(
		async (userId: string, role: string) => {
			try {
				const body: any = { userId, role }
				if (role === 'dealer') {
					body.location = dealershipForm.location
					body.phone = dealershipForm.phone
					body.subscriptionEndDate =
						dealershipForm.subscriptionEndDate.toISOString()
				} else {
					body.subscriptionEndDate = new Date().toISOString()
				}

				const response = await fetch(
					`https://backend-car-marketplace.vercel.app/api/setRole`,
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(body)
					}
				)
				const data = await response.json()
				if (response.ok) {
					Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
					Alert.alert('Success', 'User role updated successfully')
					fetchUsers()
					setSelectedUser(null)
					setIsDealershipFormVisible(false)
				} else {
					console.error('Failed to set role:', data.error)
					Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
					Alert.alert('Error', `Failed to update user role: ${data.error}`)
				}
			} catch (error) {
				console.error('Failed to set role:', error)
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
				Alert.alert('Error', 'An unexpected error occurred. Please try again.')
			}
		},
		[dealershipForm, fetchUsers]
	)

	const handleModifyDealer = useCallback(async () => {
		if (!selectedUser) return

		try {
			const body: any = {
				userId: selectedUser.id,
				role: 'dealer',
				location: dealershipForm.location,
				phone: dealershipForm.phone,
				subscriptionEndDate: dealershipForm.subscriptionEndDate.toISOString()
			}

			const response = await fetch(
				`https://backend-car-marketplace.vercel.app/api/setRole`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				}
			)
			const data = await response.json()
			if (response.ok) {
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
				Alert.alert('Success', 'Dealership details updated successfully')
				fetchUsers()
				setSelectedUser(null)
				setIsDealershipFormVisible(false)
			} else {
				console.error('Failed to update dealership:', data.error)
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
				Alert.alert(
					'Error',
					`Failed to update dealership details: ${data.error}`
				)
			}
		} catch (error) {
			console.error('Failed to update dealership:', error)
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
			Alert.alert('Error', 'An unexpected error occurred. Please try again.')
		}
	}, [selectedUser, dealershipForm, fetchUsers])

	const renderUserItem = useCallback(
		({ item }: { item: User }) => (
			<UserItem
				item={item}
				onPress={() => setSelectedUser(item)}
				onRoleChange={() =>
					handleSetRole(
						item.id,
						item.publicMetadata.role === 'dealer' ? 'user' : 'dealer'
					)
				}
			/>
		),
		[handleSetRole]
	)

	const memoizedUserList = useMemo(
		() => (
			<FlatList
				data={users}
				renderItem={renderUserItem}
				keyExtractor={item => item.id}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						colors={['#D55004']}
					/>
				}
				ListEmptyComponent={
					<Text
						style={[
							styles.emptyListText,
							isDarkMode ? styles.darkText : styles.lightText
						]}>
						No users found.
					</Text>
				}
				initialNumToRender={10}
				maxToRenderPerBatch={5}
				updateCellsBatchingPeriod={50}
				windowSize={5}
				className='mb-14'
			/>
		),
		[users, renderUserItem, refreshing, onRefresh, isDarkMode]
	)

	const SearchBar = useMemo(
		() => (
			<View className='flex-row items-center space-x-2 px-4 my-2'>
				<View className='flex-1 relative'>
					<TextInput
						className={`rounded-xl py-3 px-4 ${
							isDarkMode
								? 'bg-gray text-white border-gray-700'
								: 'bg-white text-gray border-gray-200'
						} border`}
						placeholder='Search users...'
						placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
						value={search}
						onChangeText={setSearch}
						returnKeyType='search'
						onSubmitEditing={() => {
							setDebouncedSearch(search)
							fetchUsers()
						}}
					/>
					{search !== '' && (
						<TouchableOpacity
							className='absolute right-12 top-3.5'
							onPress={() => {
								setSearch('')
								setDebouncedSearch('')
								fetchUsers()
							}}>
							<Ionicons
								name='close-circle'
								size={20}
								color={isDarkMode ? '#9CA3AF' : '#6B7280'}
							/>
						</TouchableOpacity>
					)}
				</View>
				<TouchableOpacity
					className={`p-3 rounded-xl ${isDarkMode ? 'bg-red' : 'bg-red'}`}
					onPress={() => {
						setDebouncedSearch(search)
						fetchUsers()
						Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
					}}>
					<Ionicons name='search' size={22} color='white' />
				</TouchableOpacity>
			</View>
		),
		[search, isDarkMode, fetchUsers]
	)

	return (
		<View className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
			<CustomHeader title='User Management' />
			<LinearGradient
				colors={isDarkMode ? ['#000000', '#2D2D2D'] : ['#F0F0F0', '#FFFFFF']}
				className='flex-1'>
				{SearchBar}
				{isLoading ? (
					<ActivityIndicator
						size='large'
						color='#D55004'
						style={styles.loadingIndicator}
					/>
				) : (
					memoizedUserList
				)}

				<Modal
					visible={isDealershipFormVisible}
					animationType='slide'
					transparent={true}>
					<BlurView
						style={styles.modalContainer}
						intensity={100}
						tint={isDarkMode ? 'dark' : 'light'}>
						<View
							style={[
								styles.modalContent,
								isDarkMode ? styles.darkModalContent : styles.lightModalContent
							]}>
							<Text
								style={[
									styles.modalTitle,
									isDarkMode ? styles.darkText : styles.lightText
								]}>
								{isModifyingDealer
									? 'Modify Dealership Details'
									: 'Dealership Information'}
							</Text>
							<TextInput
								style={[
									styles.modalInput,
									isDarkMode ? styles.darkInput : styles.lightInput
								]}
								placeholder='Location'
								placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
								value={dealershipForm.location}
								onChangeText={text =>
									setDealershipForm(prev => ({ ...prev, location: text }))
								}
							/>
							<TextInput
								style={[
									styles.modalInput,
									isDarkMode ? styles.darkInput : styles.lightInput
								]}
								placeholder='Phone'
								placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
								value={dealershipForm.phone}
								onChangeText={text =>
									setDealershipForm(prev => ({ ...prev, phone: text }))
								}
								keyboardType='phone-pad'
							/>
							<TouchableOpacity
								style={[
									styles.datePickerButton,
									isDarkMode ? styles.darkInput : styles.lightInput
								]}
								onPress={() => setShowDatePicker(true)}>
								<Text style={isDarkMode ? styles.darkText : styles.lightText}>
									Subscription End Date:{' '}
									{dealershipForm.subscriptionEndDate.toDateString()}
								</Text>
							</TouchableOpacity>
							{showDatePicker && (
								<DateTimePicker
									value={dealershipForm.subscriptionEndDate}
									mode='date'
									display='default'
									onChange={(event, selectedDate) => {
										setShowDatePicker(Platform.OS === 'ios')
										if (selectedDate) {
											setDealershipForm(prev => ({
												...prev,
												subscriptionEndDate: selectedDate
											}))
										}
									}}
									textColor={isDarkMode ? 'white' : 'black'}
								/>
							)}
							<TouchableOpacity
								style={styles.submitButton}
								onPress={() => {
									if (selectedUser) {
										if (isModifyingDealer) {
											handleModifyDealer()
										} else {
											updateUserRole(selectedUser.id, 'dealer')
										}
									}
								}}>
								<Text style={styles.submitButtonText}>
									{isModifyingDealer ? 'Update Details' : 'Make Dealer'}
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[
									styles.cancelButton,
									isDarkMode
										? styles.darkCancelButton
										: styles.lightCancelButton
								]}
								onPress={() => setIsDealershipFormVisible(false)}>
								<Text
									style={[
										styles.cancelButtonText,
										isDarkMode ? styles.darkText : styles.lightText
									]}>
									Cancel
								</Text>
							</TouchableOpacity>
						</View>
					</BlurView>
				</Modal>
			</LinearGradient>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1
	},
	darkContainer: {
		backgroundColor: '#121212'
	},
	lightContainer: {
		backgroundColor: '#F7FAFC'
	},
	header: {
		borderBottomWidth: 1,
		borderBottomColor: '#D55004'
	},
	darkHeader: {
		backgroundColor: '#000'
	},
	lightHeader: {
		backgroundColor: '#fff'
	},
	headerContent: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 12
	},
	headerTitle: {
		fontSize: 22,
		fontWeight: '600',
		color: '#D55004'
	},
	gradientContainer: {
		flex: 1,
		paddingHorizontal: 16,
		paddingTop: 16,
		marginBottom: 16
	},
	searchContainer: {
		flexDirection: 'row',
		marginBottom: 16
	},
	searchInput: {
		flex: 1,
		height: 48,
		borderRadius: 24,
		paddingHorizontal: 16,
		fontSize: 16
	},
	darkInput: {
		backgroundColor: '#333',
		color: '#fff'
	},
	lightInput: {
		backgroundColor: '#fff',
		color: '#000',
		borderWidth: 1,
		borderColor: '#E2E8F0'
	},
	searchButton: {
		width: 48,
		height: 48,
		borderRadius: 24,
		backgroundColor: '#D55004',
		justifyContent: 'center',
		alignItems: 'center',
		marginLeft: 8
	},
	loadingIndicator: {
		marginTop: 20
	},
	userItem: {
		padding: 16,
		marginBottom: 12,
		borderRadius: 8
	},
	darkUserItem: {
		backgroundColor: '#333'
	},
	lightUserItem: {
		backgroundColor: '#fff',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2
	},
	userName: {
		fontSize: 18,
		fontWeight: '600',
		marginBottom: 4
	},
	userEmail: {
		fontSize: 14,
		marginBottom: 8
	},
	darkText: {
		color: '#fff'
	},
	lightText: {
		color: '#000'
	},
	darkSubText: {
		color: '#A0AEC0'
	},
	lightSubText: {
		color: '#718096'
	},
	userRoleContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center'
	},
	userRole: {
		fontSize: 14,
		fontStyle: 'italic'
	},
	roleButton: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 16
	},
	roleButtonText: {
		color: '#fff',
		fontSize: 12,
		fontWeight: '500'
	},
	emptyListText: {
		textAlign: 'center',
		marginTop: 20,
		fontSize: 16
	},
	modalContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center'
	},
	modalContent: {
		width: '90%',
		padding: 20,
		borderRadius: 12
	},
	darkModalContent: {
		backgroundColor: '#333'
	},
	lightModalContent: {
		backgroundColor: '#fff'
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: '600',
		marginBottom: 16,
		textAlign: 'center'
	},
	modalInput: {
		height: 48,
		borderRadius: 8,
		paddingHorizontal: 12,
		fontSize: 16,
		marginBottom: 12
	},
	datePickerButton: {
		height: 48,
		borderRadius: 8,
		paddingHorizontal: 12,
		justifyContent: 'center',
		marginBottom: 12
	},
	submitButton: {
		backgroundColor: '#D55004',
		paddingVertical: 12,
		borderRadius: 8,
		marginTop: 8,
		marginBottom: 12
	},
	submitButtonText: {
		color: '#fff',
		textAlign: 'center',
		fontWeight: '600',
		fontSize: 16
	},
	cancelButton: {
		paddingVertical: 12,
		borderRadius: 8
	},
	darkCancelButton: {
		backgroundColor: '#4A5568'
	},
	lightCancelButton: {
		backgroundColor: '#E2E8F0'
	},
	cancelButtonText: {
		textAlign: 'center',
		fontWeight: '600',
		fontSize: 16
	}
})
