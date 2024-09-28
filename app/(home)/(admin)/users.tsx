import React, { useState, useEffect, useCallback } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	FlatList,
	TextInput,
	Modal,
	ScrollView,
	Alert,
	ActivityIndicator,
	RefreshControl,
	Platform
} from 'react-native'
import { useUser } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '@/utils/ThemeContext'
import { LinearGradient } from 'expo-linear-gradient'
import DateTimePicker from '@react-native-community/datetimepicker'

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
	const { user } = useUser()

	const fetchUsers = useCallback(async () => {
		setIsLoading(true)
		try {
			const response = await fetch(
				`https://backend-car-marketplace.vercel.app/api/users?query=${search}`
			)
			const data = await response.json()
			setUsers(data.data)
		} catch (error) {
			console.error('Failed to fetch users:', error)
			Alert.alert('Error', 'Failed to fetch users. Please try again.')
		} finally {
			setIsLoading(false)
		}
	}, [search])

	useEffect(() => {
		fetchUsers()
	}, [fetchUsers])

	const onRefresh = useCallback(() => {
		setRefreshing(true)
		fetchUsers().then(() => setRefreshing(false))
	}, [fetchUsers])

	const handleSetRole = async (userId: string, role: string) => {
		if (role === 'dealer') {
			setIsModifyingDealer(false)
			setIsDealershipFormVisible(true)
		} else {
			await updateUserRole(userId, role)
		}
	}

	const updateUserRole = async (userId: string, role: string) => {
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
				Alert.alert('Success', 'User role updated successfully')
				fetchUsers()
				setSelectedUser(null)
				setIsDealershipFormVisible(false)
			} else {
				console.error('Failed to set role:', data.error)
				Alert.alert('Error', 'Failed to update user role. Please try again.')
			}
		} catch (error) {
			console.error('Failed to set role:', error)
			Alert.alert('Error', 'An unexpected error occurred. Please try again.')
		}
	}

	const handleModifyDealer = async () => {
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
				Alert.alert('Success', 'Dealership details updated successfully')
				fetchUsers()
				setSelectedUser(null)
				setIsDealershipFormVisible(false)
			} else {
				console.error('Failed to update dealership:', data.error)
				Alert.alert(
					'Error',
					'Failed to update dealership details. Please try again.'
				)
			}
		} catch (error) {
			console.error('Failed to update dealership:', error)
			Alert.alert('Error', 'An unexpected error occurred. Please try again.')
		}
	}

	const renderUserItem = ({ item }: { item: User }) => (
		<TouchableOpacity
			className={`p-4 mb-4 rounded-lg ${
				isDarkMode ? 'bg-gray' : 'bg-white'
			} shadow-md`}
			onPress={() => setSelectedUser(item)}>
			{item.firstName && (
				<Text
					className={`text-lg font-bold ${
						isDarkMode ? 'text-white' : 'text-night'
					}`}>
					{item.firstName} {item.lastName}
				</Text>
			)}
			<Text className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray'}`}>
				{item.emailAddresses[0].emailAddress}
			</Text>
			<View className='flex-row justify-between items-center mt-2'>
				<Text
					className={`text-sm italic ${isDarkMode ? 'text-red' : 'text-red'}`}>
					Role: {item.publicMetadata.role || 'User'}
				</Text>
				<TouchableOpacity
					className={`px-3 py-1 rounded-full ${
						item.publicMetadata.role === 'dealer'
							? 'bg-green-500'
							: 'bg-blue-500'
					}`}
					onPress={() =>
						handleSetRole(
							item.id,
							item.publicMetadata.role === 'dealer' ? 'user' : 'dealer'
						)
					}>
					<Text className='text-white text-xs'>
						{item.publicMetadata.role === 'dealer'
							? 'Revoke Dealer'
							: 'Make Dealer'}
					</Text>
				</TouchableOpacity>
			</View>
		</TouchableOpacity>
	)

	return (
		<SafeAreaView
			className={`flex-1 ${isDarkMode ? 'bg-night' : 'bg-light-background'}`}>
			<LinearGradient
				colors={isDarkMode ? ['#1A1A1A', '#2D2D2D'] : ['#F0F0F0', '#FFFFFF']}
				className='flex-1 px-4 py-6'>
				<Text
					className={`text-3xl font-bold mb-6 ${
						isDarkMode ? 'text-white' : 'text-night'
					}`}>
					User Management
				</Text>
				<View className='flex-row items-center mb-6'>
					<TextInput
						className={`flex-1 py-2 px-4 rounded-full mr-2 ${
							isDarkMode ? 'bg-gray text-white' : 'bg-white text-night'
						}`}
						placeholder='Search users...'
						placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
						value={search}
						onChangeText={setSearch}
						onSubmitEditing={fetchUsers}
					/>
					<TouchableOpacity
						className='bg-red p-3 rounded-full'
						onPress={fetchUsers}>
						<Ionicons name='search' size={24} color='white' />
					</TouchableOpacity>
				</View>
				{isLoading ? (
					<ActivityIndicator size='large' color='#D55004' />
				) : (
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
								className={`text-center ${
									isDarkMode ? 'text-white' : 'text-gray'
								}`}>
								No users found.
							</Text>
						}
					/>
				)}

				<Modal
					visible={isDealershipFormVisible}
					animationType='slide'
					transparent={true}>
					<View className='flex-1 justify-center items-center bg-black bg-opacity-50'>
						<View
							className={`w-11/12 p-6 rounded-2xl ${
								isDarkMode ? 'bg-gray' : 'bg-white'
							}`}>
							<Text
								className={`text-2xl font-bold mb-4 ${
									isDarkMode ? 'text-white' : 'text-night'
								}`}>
								{isModifyingDealer
									? 'Modify Dealership Details'
									: 'Dealership Information'}
							</Text>
							<TextInput
								className={`mb-4 p-3 rounded-lg ${
									isDarkMode ? 'bg-gray text-white' : 'bg-white text-night'
								}`}
								placeholder='Location'
								placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
								value={dealershipForm.location}
								onChangeText={text =>
									setDealershipForm(prev => ({ ...prev, location: text }))
								}
							/>
							<TextInput
								className={`mb-4 p-3 rounded-lg ${
									isDarkMode ? 'bg-gray text-white' : 'bg-white text-night'
								}`}
								placeholder='Phone'
								placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
								value={dealershipForm.phone}
								onChangeText={text =>
									setDealershipForm(prev => ({ ...prev, phone: text }))
								}
								keyboardType='phone-pad'
							/>
							<TouchableOpacity
								className={`mb-4 p-3 rounded-lg ${
									isDarkMode ? 'bg-gray' : 'bg-white'
								}`}
								onPress={() => setShowDatePicker(true)}>
								<Text className={isDarkMode ? 'text-white' : 'text-night'}>
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
								className='bg-red py-3 px-4 rounded-lg mt-4 mb-3'
								onPress={() => {
									if (selectedUser) {
										if (isModifyingDealer) {
											handleModifyDealer()
										} else {
											updateUserRole(selectedUser.id, 'dealer')
										}
									}
								}}>
								<Text className='text-white text-center font-semibold'>
									{isModifyingDealer ? 'Update Details' : 'Make Dealer'}
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								className={`py-3 px-4 rounded-lg ${
									isDarkMode ? 'bg-rose-500' : 'bg-rose-500'
								}`}
								onPress={() => setIsDealershipFormVisible(false)}>
								<Text
									className={`text-center font-semibold ${
										isDarkMode ? 'text-white' : 'text-night'
									}`}>
									Cancel
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				</Modal>
			</LinearGradient>
		</SafeAreaView>
	)
}
