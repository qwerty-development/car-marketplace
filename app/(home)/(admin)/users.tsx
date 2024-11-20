import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
	StatusBar,
	Image,
	Animated,
	ScrollView
} from 'react-native'
import { useUser } from '@clerk/clerk-expo'
import {
	Ionicons,
	MaterialCommunityIcons,
	FontAwesome5
} from '@expo/vector-icons'
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
	imageUrl: string
	lastSignInAt: number
	createdAt: number
	banned: boolean
	locked: boolean
}

interface DealershipForm {
	location: string
	phone: string
	subscriptionEndDate: Date
	name: string // Added field
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity)

const CustomHeader = React.memo(
	({ title, userCount }: { title: string; userCount: number }) => {
		const { isDarkMode } = useTheme()

		return (
			<SafeAreaView
				edges={['top']}
				className={`border-b border-red ${
					isDarkMode ? 'bg-black' : 'bg-white'
				}`}>
				<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
				<View className='flex-row justify-between items-center px-4 py-3'>
					<Text className='text-2xl font-bold text-red'>{title}</Text>
					<BlurView intensity={50} className='px-3 py-1 rounded-full'>
						<Text className={isDarkMode ? 'text-white' : 'text-black'}>
							{userCount} Users
						</Text>
					</BlurView>
				</View>
			</SafeAreaView>
		)
	}
)

const UserStatusBadge = ({ status, isDarkMode }: any) => {
	const getStatusColor = () => {
		switch (status) {
			case 'active':
				return 'bg-green-500'
			case 'banned':
				return 'bg-rose-500'
			case 'locked':
				return 'bg-yellow-500'
			default:
				return 'bg-gray'
		}
	}

	return (
		<View className={`px-2 py-1 rounded-full ${getStatusColor()} opacity-80`}>
			<Text className='text-white text-xs font-medium capitalize'>
				{status}
			</Text>
		</View>
	)
}

const UserItem = React.memo(
	({ item, onPress, onRoleChange, isDarkMode }: any) => {
		const scaleAnim = useRef(new Animated.Value(1)).current
		const getUserStatus = () => {
			if (item.banned) return 'banned'
			if (item.locked) return 'locked'
			return 'active'
		}

		const handlePressIn = () => {
			Animated.spring(scaleAnim, {
				toValue: 0.95,
				useNativeDriver: true
			}).start()
		}

		const handlePressOut = () => {
			Animated.spring(scaleAnim, {
				toValue: 1,
				useNativeDriver: true
			}).start()
		}

		const canPromoteToDealer =
			!item.banned &&
			!item.locked &&
			item.publicMetadata.role !== 'dealer' &&
			item.publicMetadata.role !== 'admin'

		return (
			<AnimatedTouchable
				onPress={onPress}
				onPressIn={handlePressIn}
				onPressOut={handlePressOut}
				style={[{ transform: [{ scale: scaleAnim }] }]}
				className={`mb-4 rounded-xl overflow-hidden ${
					isDarkMode ? 'bg-gray/20' : 'bg-white'
				}`}>
				<LinearGradient
					colors={isDarkMode ? ['#1A1A1A', '#2D2D2D'] : ['#FFFFFF', '#F8F9FA']}
					className='p-4'>
					<View className='flex-row items-center'>
						<Image
							source={{
								uri: item.imageUrl || 'https://via.placeholder.com/50'
							}}
							className='w-12 h-12 rounded-full'
						/>
						<View className='flex-1 ml-3'>
							<Text
								className={`font-semibold text-lg ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								{item.firstName} {item.lastName}
							</Text>
							<Text
								className={`text-sm ${isDarkMode ? 'text-red' : 'text-gray'}`}>
								{item.emailAddresses[0].emailAddress}
							</Text>
						</View>
						<UserStatusBadge status={getUserStatus()} isDarkMode={isDarkMode} />
					</View>

					<View className='mt-4 flex-row justify-between items-center'>
						<View className='flex-row items-center space-x-4'>
							<View className='flex-row items-center'>
								<MaterialCommunityIcons
									name='shield-account'
									size={16}
									color={isDarkMode ? '#D1D5DB' : '#6B7280'}
								/>
								<Text
									className={`ml-1 ${isDarkMode ? 'text-red' : 'text-gray'}`}>
									{item.publicMetadata.role || 'user'}
								</Text>
							</View>
							<View className='flex-row items-center'>
								<Ionicons
									name='time-outline'
									size={16}
									color={isDarkMode ? '#D1D5DB' : '#6B7280'}
								/>
								<Text
									className={`ml-1 ${isDarkMode ? 'text-red' : 'text-gray'}`}>
									{new Date(item.lastSignInAt).toLocaleDateString()}
								</Text>
							</View>
						</View>

						{canPromoteToDealer && (
							<TouchableOpacity
								onPress={onRoleChange}
								className='bg-red px-4 py-2 rounded-lg flex-row items-center'>
								<FontAwesome5 name='user-tie' size={12} color='white' />
								<Text className='text-white text-sm font-medium ml-2'>
									Make Dealer
								</Text>
							</TouchableOpacity>
						)}
					</View>

					{(item.banned || item.locked) && (
						<View className='mt-3 bg-red/10 p-3 rounded-lg'>
							<Text className='text-red text-sm'>
								{item.banned ? 'Account is banned' : 'Account is locked'}
							</Text>
						</View>
					)}
				</LinearGradient>
			</AnimatedTouchable>
		)
	}
)
// Enhanced DealershipFormModal with better validation and UI
const DealershipFormModal = React.memo(
	({ visible, onClose, onSubmit, initialData, isDarkMode }: any) => {
		const [form, setForm] = useState<DealershipForm>({
			location: '',
			phone: '',
			name: '',

			subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
		})
		const [errors, setErrors] = useState<Record<string, string>>({})
		const [showDatePicker, setShowDatePicker] = useState(false)

		const validateForm = () => {
			const newErrors: Record<string, string> = {}
			if (!form.name.trim()) newErrors.companyName = 'Company name is required'
			if (!form.location.trim()) newErrors.location = 'Location is required'
			if (!form.phone.trim()) newErrors.phone = 'Phone is required'
			if (!/^\d{8,}$/.test(form.phone)) newErrors.phone = 'Invalid phone number'
			if (form.subscriptionEndDate < new Date())
				newErrors.subscriptionEndDate = 'Invalid subscription end date'
			setErrors(newErrors)
			return Object.keys(newErrors).length === 0
		}

		const handleSubmit = () => {
			if (validateForm()) {
				onSubmit(form)
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
			} else {
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
			}
		}

		const FloatingInput = ({
			label,
			value,
			onChangeText,
			error,
			keyboardType = 'default'
		}: any) => (
			<View className='mb-4'>
				<Text
					className={`text-sm mb-1 ${isDarkMode ? 'text-red' : 'text-gray'}`}>
					{label}
				</Text>
				<TextInput
					value={value}
					onChangeText={onChangeText}
					keyboardType={keyboardType}
					className={`p-3 rounded-lg border ${
						error ? 'border-red' : 'border-gray'
					} ${isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'}`}
					placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
				/>
				{error && <Text className='text-red text-sm mt-1'>{error}</Text>}
			</View>
		)

		return (
			<Modal visible={visible} animationType='slide' transparent>
				<BlurView
					intensity={isDarkMode ? 30 : 50}
					tint={isDarkMode ? 'dark' : 'light'}
					className='flex-1 justify-center items-center px-4'>
					<View
						className={`w-full max-w-md rounded-3xl p-6 ${
							isDarkMode ? 'bg-gray' : 'bg-white'
						}`}>
						<View className='flex-row justify-between items-center mb-6'>
							<Text
								className={`text-xl font-bold ${
									isDarkMode ? 'text-white' : 'text-gray'
								}`}>
								Dealership Information
							</Text>
							<TouchableOpacity onPress={onClose}>
								<Ionicons
									name='close-circle'
									size={24}
									color={isDarkMode ? '#D1D5DB' : '#6B7280'}
								/>
							</TouchableOpacity>
						</View>

						<FloatingInput
							label='Company Name'
							value={form.name}
							onChangeText={(text: string) =>
								setForm(prev => ({ ...prev, name: text }))
							}
							error={errors.name}
						/>

						<FloatingInput
							label='Location'
							value={form.location}
							onChangeText={(text: string) =>
								setForm(prev => ({ ...prev, location: text }))
							}
							error={errors.location}
						/>

						<FloatingInput
							label='Phone'
							value={form.phone}
							onChangeText={(text: string) =>
								setForm(prev => ({ ...prev, phone: text }))
							}
							error={errors.phone}
							keyboardType='phone-pad'
						/>

						<TouchableOpacity
							onPress={() => setShowDatePicker(true)}
							className={`p-3 rounded-lg border border-red mb-4 ${
								isDarkMode ? 'bg-gray' : 'bg-white'
							}`}>
							<Text className={isDarkMode ? 'text-white' : 'text-black'}>
								Subscription End Date:{' '}
								{form.subscriptionEndDate.toLocaleDateString()}
							</Text>
						</TouchableOpacity>

						{showDatePicker && (
							<DateTimePicker
								value={form.subscriptionEndDate}
								mode='date'
								display='default'
								minimumDate={new Date()}
								onChange={(event, selectedDate) => {
									setShowDatePicker(Platform.OS === 'ios')
									if (selectedDate) {
										setForm(prev => ({
											...prev,
											subscriptionEndDate: selectedDate
										}))
									}
								}}
								textColor={isDarkMode ? 'white' : 'black'}
							/>
						)}

						<View className='flex-row justify-end space-x-3 mt-6'>
							<TouchableOpacity
								onPress={onClose}
								className={`px-6 py-3 rounded-xl ${
									isDarkMode ? 'bg-gray' : 'bg-white'
								}`}>
								<Text className={isDarkMode ? 'text-white' : 'text-black'}>
									Cancel
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								onPress={handleSubmit}
								className='bg-red px-6 py-3 rounded-xl'>
								<Text className='text-white font-medium'>
									Create Dealership
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				</BlurView>
			</Modal>
		)
	}
)

// Enhanced SearchBar with better UX
const SearchBar = React.memo(
	({ value, onChangeText, onSubmit, onClear, isDarkMode }: any) => {
		const inputRef = useRef<TextInput>(null)
		const [isFocused, setIsFocused] = useState(false)

		return (
			<BlurView
				intensity={isDarkMode ? 30 : 50}
				tint={isDarkMode ? 'dark' : 'light'}
				className={`mx-4 my-2 rounded-2xl overflow-hidden ${
					isFocused ? 'border-2 border-red' : ''
				}`}>
				<View className='flex-row items-center p-2'>
					<Ionicons
						name='search'
						size={20}
						color={isDarkMode ? '#D1D5DB' : '#6B7280'}
						className='ml-2'
					/>
					<TextInput
						ref={inputRef}
						value={value}
						onChangeText={onChangeText}
						onSubmitEditing={onSubmit}
						placeholder='Search users by name or email...'
						placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
						onFocus={() => setIsFocused(true)}
						onBlur={() => setIsFocused(false)}
						className={`flex-1 px-3 py-2 ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}
						returnKeyType='search'
					/>
					{value ? (
						<TouchableOpacity
							onPress={() => {
								onClear()
								inputRef.current?.focus()
							}}
							className='p-2'>
							<Ionicons
								name='close-circle'
								size={20}
								color={isDarkMode ? '#D1D5DB' : '#6B7280'}
							/>
						</TouchableOpacity>
					) : null}
				</View>
			</BlurView>
		)
	}
)
export default function AdminUserManagement() {
	const { isDarkMode } = useTheme()
	const [users, setUsers] = useState<User[]>([])
	const [filteredUsers, setFilteredUsers] = useState<User[]>([])
	const [search, setSearch] = useState('')
	const [selectedUser, setSelectedUser] = useState<User | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [refreshing, setRefreshing] = useState(false)
	const [isDealershipFormVisible, setIsDealershipFormVisible] = useState(false)
	const [sortConfig, setSortConfig] = useState({
		field: 'createdAt',
		ascending: false
	})
	const [filterConfig, setFilterConfig] = useState({
		role: 'all',
		status: 'all'
	})

	// Enhanced error handling with retry mechanism
	const [error, setError] = useState<{
		message: string
		retryCount: number
	} | null>(null)
	const maxRetries = 3
	const retryTimeout = useRef<NodeJS.Timeout>()

	const fetchUsers = useCallback(
		async (retryCount = 0) => {
			try {
				setIsLoading(true)
				setError(null)

				const response = await fetch(
					`https://backend-car-marketplace.vercel.app/api/users`
				)

				if (!response.ok) {
					throw new Error(
						response.status === 500
							? 'Server is temporarily unavailable'
							: `Error: ${response.status}`
					)
				}

				const data = await response.json()
				setUsers(data.data || [])
				applyFiltersAndSort(data.data || [], filterConfig, sortConfig, search)
			} catch (error: any) {
				console.error('Error fetching users:', error)

				if (retryCount < maxRetries) {
					setError({
						message: `Retrying... (${retryCount + 1}/${maxRetries})`,
						retryCount
					})
					retryTimeout.current = setTimeout(() => {
						fetchUsers(retryCount + 1)
					}, 2000 * (retryCount + 1)) // Exponential backoff
				} else {
					setError({
						message: 'Failed to load users. Please try again.',
						retryCount
					})
				}
			} finally {
				setIsLoading(false)
				setRefreshing(false)
			}
		},
		[filterConfig, sortConfig, search]
	)

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (retryTimeout.current) {
				clearTimeout(retryTimeout.current)
			}
		}
	}, [])

	useEffect(() => {
		fetchUsers()
	}, [fetchUsers])

	// Enhanced filtering and sorting
	const applyFiltersAndSort = useCallback(
		(
			users: User[],
			filters: typeof filterConfig,
			sort: typeof sortConfig,
			searchTerm: string
		) => {
			let result = [...users]

			// Apply filters
			if (filters.role !== 'all') {
				result = result.filter(
					user => user.publicMetadata.role === filters.role
				)
			}

			if (filters.status !== 'all') {
				result = result.filter(user => {
					switch (filters.status) {
						case 'active':
							return !user.banned && !user.locked
						case 'banned':
							return user.banned
						case 'locked':
							return user.locked
						default:
							return true
					}
				})
			}

			// Apply search
			if (searchTerm) {
				const searchLower = searchTerm.toLowerCase()
				result = result.filter(
					user =>
						user.firstName?.toLowerCase().includes(searchLower) ||
						user.lastName?.toLowerCase().includes(searchLower) ||
						user.emailAddresses[0].emailAddress
							.toLowerCase()
							.includes(searchLower)
				)
			}

			// Apply sort
			result.sort((a, b) => {
				let compareResult = 0
				switch (sort.field) {
					case 'name':
						compareResult = `${a.firstName} ${a.lastName}`.localeCompare(
							`${b.firstName} ${b.lastName}`
						)
						break
					case 'email':
						compareResult = a.emailAddresses[0].emailAddress.localeCompare(
							b.emailAddresses[0].emailAddress
						)
						break
					case 'createdAt':
						compareResult = a.createdAt - b.createdAt
						break
					case 'lastActive':
						compareResult = (a.lastSignInAt || 0) - (b.lastSignInAt || 0)
						break
				}
				return sort.ascending ? compareResult : -compareResult
			})

			setFilteredUsers(result)
		},
		[]
	)

	// Enhanced role update with optimistic update and rollback
	const handleSetRole = useCallback(async (user: User) => {
		if (
			user.publicMetadata.role === 'admin' ||
			user.publicMetadata.role === 'dealer'
		) {
			Alert.alert(
				'Not Allowed',
				'Cannot modify admin or existing dealer roles.'
			)
			return
		}

		if (user.banned || user.locked) {
			Alert.alert(
				'Not Allowed',
				'Cannot modify roles for banned or locked accounts.'
			)
			return
		}

		setSelectedUser(user)
		setIsDealershipFormVisible(true)
	}, [])

	const handleDealershipSubmit = useCallback(
		async (formData: DealershipForm) => {
			if (!selectedUser) return

			// Optimistic update
			const previousUsers = [...users]
			setUsers(current =>
				current.map(u =>
					u.id === selectedUser.id
						? { ...u, publicMetadata: { ...u.publicMetadata, role: 'dealer' } }
						: u
				)
			)

			try {
				const response = await fetch(
					'https://backend-car-marketplace.vercel.app/api/setRole',
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							userId: selectedUser.id,
							role: 'dealer',
							...formData
						})
					}
				)

				if (!response.ok) {
					throw new Error('Failed to update role')
				}

				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
				Alert.alert('Success', 'User has been promoted to dealer successfully.')

				// Refresh data
				fetchUsers()
			} catch (error) {
				// Rollback on error
				setUsers(previousUsers)
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
				Alert.alert('Error', 'Failed to update user role. Please try again.')
			} finally {
				setIsDealershipFormVisible(false)
				setSelectedUser(null)
			}
		},
		[selectedUser, users, fetchUsers]
	)

	const renderSortButton = ({ label, field }: any) => (
		<TouchableOpacity
			onPress={() => {
				setSortConfig(current => ({
					field,
					ascending: current.field === field ? !current.ascending : true
				}))
			}}
			className={`flex-row items-center px-4 py-2 rounded-lg ${
				sortConfig.field === field
					? 'bg-red'
					: isDarkMode
					? 'bg-gray'
					: 'bg-white'
			}`}>
			<Text
				className={`${
					sortConfig.field === field
						? 'text-white'
						: isDarkMode
						? 'text-white'
						: 'text-black'
				}`}>
				{label}
			</Text>
			{sortConfig.field === field && (
				<Ionicons
					name={sortConfig.ascending ? 'chevron-up' : 'chevron-down'}
					size={16}
					color='white'
					style={{ marginLeft: 4 }}
				/>
			)}
		</TouchableOpacity>
	)

	const renderErrorState = () => (
		<View className='flex-1 justify-center items-center p-6'>
			<Ionicons
				name='alert-circle'
				size={48}
				color={isDarkMode ? '#D55004' : '#D55004'}
			/>
			<Text
				className={`text-lg mt-4 mb-6 text-center ${
					isDarkMode ? 'text-white' : 'text-gray'
				}`}>
				{error?.message}
			</Text>
			<TouchableOpacity
				onPress={() => fetchUsers()}
				className='bg-red px-6 py-3 rounded-xl'>
				<Text className='text-white font-medium'>Try Again</Text>
			</TouchableOpacity>
		</View>
	)

	const renderListHeader = useCallback(
		() => (
			<View className='px-4 py-2'>
				{/* Filter Pills */}
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					className='mb-4'>
					<View className='flex-row space-x-2'>
						{renderSortButton({ label: 'Name', field: 'name' })}
						{renderSortButton({ label: 'Date Joined', field: 'createdAt' })}
						{renderSortButton({ label: 'Last Active', field: 'lastActive' })}
					</View>
				</ScrollView>

				{/* Status Filters */}
				<View className='flex-row justify-between mb-4'>
					<TouchableOpacity
						onPress={() =>
							setFilterConfig(prev => ({
								...prev,
								status: prev.status === 'active' ? 'all' : 'active'
							}))
						}
						className={`flex-row items-center px-4 py-2 rounded-lg ${
							filterConfig.status === 'active'
								? 'bg-green-500/20'
								: isDarkMode
								? 'bg-gray'
								: 'bg-white'
						}`}>
						<Ionicons
							name='checkmark-circle'
							size={16}
							color={filterConfig.status === 'active' ? '#10B981' : '#6B7280'}
						/>
						<Text
							className={`ml-2 ${
								filterConfig.status === 'active'
									? 'text-green-500'
									: isDarkMode
									? 'text-white'
									: 'text-gray'
							}`}>
							Active
						</Text>
					</TouchableOpacity>

					<TouchableOpacity
						onPress={() =>
							setFilterConfig(prev => ({
								...prev,
								status: prev.status === 'banned' ? 'all' : 'banned'
							}))
						}
						className={`flex-row items-center px-4 py-2 rounded-lg ${
							filterConfig.status === 'banned'
								? 'bg-rose-500/20'
								: isDarkMode
								? 'bg-gray'
								: 'bg-white'
						}`}>
						<Ionicons
							name='ban'
							size={16}
							color={filterConfig.status === 'banned' ? '#EF4444' : '#6B7280'}
						/>
						<Text
							className={`ml-2 ${
								filterConfig.status === 'banned'
									? 'text-rose-500'
									: isDarkMode
									? 'text-white'
									: 'text-gray'
							}`}>
							Banned
						</Text>
					</TouchableOpacity>

					<TouchableOpacity
						onPress={() =>
							setFilterConfig(prev => ({
								...prev,
								status: prev.status === 'locked' ? 'all' : 'locked'
							}))
						}
						className={`flex-row items-center px-4 py-2 rounded-lg ${
							filterConfig.status === 'locked'
								? 'bg-yellow-500/20'
								: isDarkMode
								? 'bg-gray'
								: 'bg-white'
						}`}>
						<Ionicons
							name='lock-closed'
							size={16}
							color={filterConfig.status === 'locked' ? '#F59E0B' : '#6B7280'}
						/>
						<Text
							className={`ml-2 ${
								filterConfig.status === 'locked'
									? 'text-yellow-500'
									: isDarkMode
									? 'text-white'
									: 'text-gray'
							}`}>
							Locked
						</Text>
					</TouchableOpacity>
				</View>

				{/* Stats Summary */}
				<BlurView
					intensity={isDarkMode ? 30 : 50}
					tint={isDarkMode ? 'dark' : 'light'}
					className='p-4 rounded-xl mb-4'>
					<View className='flex-row justify-between'>
						<View className='items-center'>
							<Text className={isDarkMode ? 'text-white' : 'text-gray'}>
								Total Users
							</Text>
							<Text className='text-red text-lg font-bold'>{users.length}</Text>
						</View>
						<View className='items-center'>
							<Text className={isDarkMode ? 'text-white' : 'text-gray'}>
								Dealers
							</Text>
							<Text className='text-red text-lg font-bold'>
								{users.filter(u => u.publicMetadata.role === 'dealer').length}
							</Text>
						</View>
						<View className='items-center'>
							<Text className={isDarkMode ? 'text-white' : 'text-gray'}>
								Active Today
							</Text>
							<Text className='text-red text-lg font-bold'>
								{
									users.filter(u => {
										const lastActive = new Date(u.lastSignInAt)
										const today = new Date()
										return lastActive.toDateString() === today.toDateString()
									}).length
								}
							</Text>
						</View>
					</View>
				</BlurView>
			</View>
		),
		[isDarkMode, filterConfig, sortConfig, users]
	)

	return (
		<View className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
			<CustomHeader title='User Management' userCount={users.length} />

			<SearchBar
				value={search}
				onChangeText={setSearch}
				onSubmit={() =>
					applyFiltersAndSort(users, filterConfig, sortConfig, search)
				}
				onClear={() => {
					setSearch('')
					applyFiltersAndSort(users, filterConfig, sortConfig, '')
				}}
				isDarkMode={isDarkMode}
			/>

			{error ? (
				renderErrorState()
			) : (
				<FlatList
					data={filteredUsers}
					renderItem={({ item }) => (
						<UserItem
							item={item}
							onPress={() => setSelectedUser(item)}
							onRoleChange={() => handleSetRole(item)}
							isDarkMode={isDarkMode}
						/>
					)}
					keyExtractor={item => item.id}
					contentContainerStyle={{ padding: 16 }}
					ListHeaderComponent={renderListHeader}
					ListEmptyComponent={
						<View className='flex-1 justify-center items-center p-6'>
							<Text
								className={`text-lg ${
									isDarkMode ? 'text-white' : 'text-gray'
								}`}>
								{isLoading ? 'Loading users...' : 'No users found'}
							</Text>
						</View>
					}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={() => {
								setRefreshing(true)
								fetchUsers()
							}}
							colors={['#D55004']}
							tintColor={isDarkMode ? '#FFFFFF' : '#D55004'}
						/>
					}
					ListFooterComponent={
						isLoading ? (
							<ActivityIndicator
								color='#D55004'
								size='large'
								style={{ marginVertical: 20 }}
							/>
						) : null
					}
				/>
			)}

			<DealershipFormModal
				visible={isDealershipFormVisible}
				onClose={() => {
					setIsDealershipFormVisible(false)
					setSelectedUser(null)
				}}
				onSubmit={handleDealershipSubmit}
				isDarkMode={isDarkMode}
			/>
		</View>
	)
}
