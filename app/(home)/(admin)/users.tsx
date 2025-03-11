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
import { supabase } from '@/utils/supabase'

// Updated User interface for Supabase
interface User {
	id: string
	email: string
	user_metadata: {
		name?: string;
		role?: string;
		full_name?: string;
	}
	created_at: string;
	last_sign_in_at: string;
	banned_until: string | null;
	locked: boolean; // Add this if you're tracking locked status
}

// Updated interface for processed users to match component expectations
interface ProcessedUser {
	id: string
	firstName: string
	lastName: string
	email: string
	user_metadata: {
		role?: string;
	}
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
	name: string
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
			item.user_metadata.role !== 'dealer' &&
			item.user_metadata.role !== 'admin'

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
								{item.email}
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
									{item.user_metadata.role || 'user'}
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
			if (!form.name.trim()) newErrors.name = 'Company name is required'
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

		const FloatingInput = useCallback(
			({
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
			),
			[isDarkMode]
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
	const [users, setUsers] = useState<ProcessedUser[]>([])
	const [filteredUsers, setFilteredUsers] = useState<ProcessedUser[]>([])
	const [search, setSearch] = useState('')
	const [selectedUser, setSelectedUser] = useState<ProcessedUser | null>(null)
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

	// Process Supabase users to match our component's expected format
	const processSupabaseUsers = (data: User[]) => {
		return data.map(user => {
			// Extract first and last name from metadata or email
			let firstName = '';
			let lastName = '';

			if (user.user_metadata?.name) {
				const nameParts = user.user_metadata.name.split(' ');
				firstName = nameParts[0] || '';
				lastName = nameParts.slice(1).join(' ') || '';
			} else if (user.user_metadata?.full_name) {
				const nameParts = user.user_metadata.full_name.split(' ');
				firstName = nameParts[0] || '';
				lastName = nameParts.slice(1).join(' ') || '';
			} else {
				// Use email as fallback for the name
				firstName = user.email.split('@')[0] || '';
				lastName = '';
			}

			// Check if user is banned based on banned_until field
			const isBanned = user.banned_until !== null &&
				new Date(user.banned_until) > new Date();

			return {
				id: user.id,
				firstName,
				lastName,
				email: user.email,
				user_metadata: {
					role: user.user_metadata?.role || 'user'
				},
				imageUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName + ' ' + lastName)}&background=random`,
				lastSignInAt: user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0,
				createdAt: Date.parse(user.created_at),
				banned: isBanned,
				locked: user.locked || false // Adjust based on how you track locked users
			};
		});
	};

	const fetchUsers = useCallback(
		async (retryCount = 0) => {
			try {
				setIsLoading(true)
				setError(null)

				// Fetch users from Supabase
				const { data, error } = await supabase.auth.admin.listUsers();

				if (error) {
					throw error;
				}

				if (data && data.users) {
					const processedUsers = processSupabaseUsers(data.users as User[]);
					setUsers(processedUsers);
					applyFiltersAndSort(processedUsers, filterConfig, sortConfig, search);
				} else {
					setUsers([]);
					setFilteredUsers([]);
				}
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
			users: ProcessedUser[],
			filters: typeof filterConfig,
			sort: typeof sortConfig,
			searchTerm: string
		) => {
			let result = [...users]

			// Apply filters
			if (filters.role !== 'all') {
				result = result.filter(
					user => user.user_metadata.role === filters.role
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
						user.email?.toLowerCase().includes(searchLower)
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
						compareResult = a.email.localeCompare(b.email)
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

	// Update this to work with Supabase role updating
	const handleSetRole = useCallback(async (user: ProcessedUser) => {
		if (
			user.user_metadata.role === 'admin' ||
			user.user_metadata.role === 'dealer'
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
						? {
								...u,
								user_metadata: {
									...u.user_metadata,
									role: 'dealer'
								}
							}
						: u
				)
			)

			try {
				// 1. Update user role in auth.users metadata
				const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
					selectedUser.id,
					{
						user_metadata: {
							role: 'dealer',
							// Preserve existing metadata fields
							...(selectedUser.user_metadata || {})
						}
					}
				);

				if (authUpdateError) throw authUpdateError;

				// 2. Update user role in public.users table
				const { error: dbUpdateError } = await supabase
					.from('users')
					.update({ role: 'dealer' })
					.eq('id', selectedUser.id);

				if (dbUpdateError) throw dbUpdateError;

				// 3. Create dealership entry
				const { error: dealershipError } = await supabase
					.from('dealerships')
					.insert({
						name: formData.name,
						location: formData.location,
						phone: formData.phone,
						subscription_end_date: formData.subscriptionEndDate.toISOString().split('T')[0],
						user_id: selectedUser.id
					});

				if (dealershipError) throw dealershipError;

				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
				Alert.alert('Success', 'User has been promoted to dealer successfully.')

				// Refresh data
				fetchUsers()
			} catch (error: any) {
				// Rollback on error
				console.error('Error updating role:', error);
				setUsers(previousUsers)
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
				Alert.alert('Error', 'Failed to update user role: ' + error.message)
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
								?'bg-gray'
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
								{users.filter(u => u.user_metadata.role === 'dealer').length}
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

	// Helper function to update user roles directly
	const updateUserRole = async (userId: string, newRole: string) => {
		try {
			// 1. Update user metadata in Supabase Auth
			const { error: authError } = await supabase.auth.admin.updateUserById(
				userId,
				{
					user_metadata: {
						role: newRole
					}
				}
			);

			if (authError) throw authError;

			// 2. Update role in database users table for consistency
			const { error: dbError } = await supabase
				.from('users')
				.update({ role: newRole })
				.eq('id', userId);

			if (dbError) throw dbError;

			// 3. Refresh the users list
			fetchUsers();

			return { success: true, error: null };
		} catch (error: any) {
			console.error('Error updating user role:', error);
			return { success: false, error: error.message };
		}
	};

	// Function to ban or unban a user
	const toggleUserBan = async (userId: string, shouldBan: boolean) => {
		try {
			// Set banned_until to null (unban) or far future date (ban)
			const bannedUntil = shouldBan
				? new Date(2099, 11, 31).toISOString() // Ban until end of century
				: null; // No ban (unban)

			// Update user in Supabase Auth
			const { error } = await supabase.auth.admin.updateUserById(
				userId,
				{
					ban_duration: bannedUntil ? 'forever' : null
				}
			);

			if (error) throw error;

			// Refresh the user list
			fetchUsers();

			return { success: true, error: null };
		} catch (error: any) {
			console.error(`Error ${shouldBan ? 'banning' : 'unbanning'} user:`, error);
			return { success: false, error: error.message };
		}
	};

	// Function to handle user actions (role change, ban/unban, etc.)
	const handleUserAction = (user: ProcessedUser, action: string) => {
		switch (action) {
			case 'make-dealer':
				handleSetRole(user);
				break;

			case 'make-admin':
				Alert.alert(
					'Confirm Action',
					`Are you sure you want to make ${user.firstName} ${user.lastName} an admin?`,
					[
						{ text: 'Cancel', style: 'cancel' },
						{
							text: 'Confirm',
							onPress: async () => {
								const result = await updateUserRole(user.id, 'admin');
								if (result.success) {
									Alert.alert('Success', 'User is now an admin.');
								} else {
									Alert.alert('Error', `Failed to update role: ${result.error}`);
								}
							}
						}
					]
				);
				break;

			case 'make-user':
				Alert.alert(
					'Confirm Action',
					`Are you sure you want to change ${user.firstName} ${user.lastName} back to a regular user?`,
					[
						{ text: 'Cancel', style: 'cancel' },
						{
							text: 'Confirm',
							onPress: async () => {
								const result = await updateUserRole(user.id, 'user');
								if (result.success) {
									Alert.alert('Success', 'Role changed to regular user.');
								} else {
									Alert.alert('Error', `Failed to update role: ${result.error}`);
								}
							}
						}
					]
				);
				break;

			case 'ban-user':
				Alert.alert(
					'Confirm Action',
					`Are you sure you want to ban ${user.firstName} ${user.lastName}? This will prevent them from logging in.`,
					[
						{ text: 'Cancel', style: 'cancel' },
						{
							text: 'Ban User',
							style: 'destructive',
							onPress: async () => {
								const result = await toggleUserBan(user.id, true);
								if (result.success) {
									Alert.alert('Success', 'User has been banned.');
								} else {
									Alert.alert('Error', `Failed to ban user: ${result.error}`);
								}
							}
						}
					]
				);
				break;

			case 'unban-user':
				Alert.alert(
					'Confirm Action',
					`Are you sure you want to unban ${user.firstName} ${user.lastName}?`,
					[
						{ text: 'Cancel', style: 'cancel' },
						{
							text: 'Unban User',
							onPress: async () => {
								const result = await toggleUserBan(user.id, false);
								if (result.success) {
									Alert.alert('Success', 'User has been unbanned.');
								} else {
									Alert.alert('Error', `Failed to unban user: ${result.error}`);
								}
							}
						}
					]
				);
				break;
		}
	};

	const handleUserPress = (user: ProcessedUser) => {
		// Show action sheet for this user
		const options = [];
		const actions:any = [];

		// Add appropriate options based on user's current status
		if (user.user_metadata.role !== 'dealer' && user.user_metadata.role !== 'admin') {
			options.push('Make Dealer');
			actions.push('make-dealer');

			options.push('Make Admin');
			actions.push('make-admin');
		}

		if (user.user_metadata.role === 'dealer' || user.user_metadata.role === 'admin') {
			options.push('Demote to Regular User');
			actions.push('make-user');
		}

		if (!user.banned) {
			options.push('Ban User');
			actions.push('ban-user');
		} else {
			options.push('Unban User');
			actions.push('unban-user');
		}

		// Always add cancel option
		options.push('Cancel');

		// Show alert with options
		Alert.alert(
			`${user.firstName} ${user.lastName}`,
			`Role: ${user.user_metadata.role || 'user'}\nEmail: ${user.email}`,
			options.map((option:any, index:any) => {
				if (option === 'Cancel') {
					return { text: option, style: 'cancel' };
				}

				if (option === 'Ban User') {
					return {
						text: option,
						style: 'destructive',
						onPress: () => handleUserAction(user, actions[index])
					};
				}

				return {
					text: option,
					onPress: () => handleUserAction(user, actions[index])
				};
			})
		);
	};

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
							onPress={() => handleUserPress(item)}
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