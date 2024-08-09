import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	FlatList,
	TextInput,
	Modal,
	ScrollView,
	Alert
} from 'react-native'
import { useUser } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'

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

export default function AdminScreen() {
	const [users, setUsers] = useState<User[]>([])
	const [search, setSearch] = useState('')
	const [isUserManagementVisible, setIsUserManagementVisible] = useState(false)
	const [selectedUser, setSelectedUser] = useState<User | null>(null)
	const [dealershipForm, setDealershipForm] = useState<DealershipForm>({
		location: '',
		phone: '',
		subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
	})
	const [isDealershipFormVisible, setIsDealershipFormVisible] = useState(false)
	const [isDatePickerVisible, setIsDatePickerVisible] = useState(false)
	const [isModifyingDealer, setIsModifyingDealer] = useState(false)
	const { user } = useUser()

	useEffect(() => {
		if (isUserManagementVisible) {
			fetchUsers()
		}
	}, [isUserManagementVisible])

	const fetchUsers = async () => {
		try {
			const response = await fetch(
				`https://backend-car-marketplace.vercel.app/api/users?query=${search}`
			)
			const data = await response.json()
			setUsers(data.data)
		} catch (error) {
			console.error('Failed to fetch users:', error)
			Alert.alert('Error', 'Failed to fetch users. Please try again.')
		}
	}

	const handleSearch = () => {
		fetchUsers()
	}

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
				role: 'dealer'
			}

			if (dealershipForm.location) body.location = dealershipForm.location
			if (dealershipForm.phone) body.phone = dealershipForm.phone
			if (dealershipForm.subscriptionEndDate) {
				body.subscriptionEndDate =
					dealershipForm.subscriptionEndDate.toISOString()
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

	const renderDatePicker = () => {
		const dates = Array.from({ length: 365 }, (_, i) => {
			const date = new Date()
			date.setDate(date.getDate() + i)
			return date
		})

		return (
			<Modal
				visible={isDatePickerVisible}
				transparent={true}
				animationType='slide'>
				<View style={styles.datePickerContainer}>
					<ScrollView style={styles.datePickerScrollView}>
						{dates.map((date, index) => (
							<TouchableOpacity
								key={index}
								style={styles.dateItem}
								onPress={() => {
									setDealershipForm(prev => ({
										...prev,
										subscriptionEndDate: date
									}))
									setIsDatePickerVisible(false)
								}}>
								<Text>{date.toISOString().split('T')[0]}</Text>
							</TouchableOpacity>
						))}
					</ScrollView>
				</View>
			</Modal>
		)
	}

	const renderDealershipForm = () => (
		<Modal
			visible={isDealershipFormVisible}
			animationType='slide'
			transparent={true}>
			<View style={styles.formModalContainer}>
				<ScrollView contentContainerStyle={styles.formScrollView}>
					<Text style={styles.formTitle}>
						{isModifyingDealer
							? 'Modify Dealership Details'
							: 'Dealership Information'}
					</Text>
					<TextInput
						style={styles.input}
						placeholder='Location'
						value={dealershipForm.location}
						onChangeText={text =>
							setDealershipForm(prev => ({ ...prev, location: text }))
						}
					/>
					<TextInput
						style={styles.input}
						placeholder='Phone'
						value={dealershipForm.phone}
						onChangeText={text =>
							setDealershipForm(prev => ({ ...prev, phone: text }))
						}
						keyboardType='phone-pad'
					/>
					<Text style={styles.label}>Subscription End Date:</Text>
					<TouchableOpacity
						style={styles.datePickerButton}
						onPress={() => setIsDatePickerVisible(true)}>
						<Text>
							{dealershipForm.subscriptionEndDate.toISOString().split('T')[0]}
						</Text>
					</TouchableOpacity>
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
						style={styles.cancelButton}
						onPress={() => setIsDealershipFormVisible(false)}>
						<Text style={styles.cancelButtonText}>Cancel</Text>
					</TouchableOpacity>
				</ScrollView>
			</View>
		</Modal>
	)

	const renderUserItem = ({ item }: { item: User }) => (
		<TouchableOpacity
			style={styles.userItem}
			onPress={() => setSelectedUser(item)}>
			<Text style={styles.userName}>
				{item.firstName} {item.lastName}
			</Text>
			<Text style={styles.userEmail}>
				{item.emailAddresses[0].emailAddress}
			</Text>
			<Text style={styles.userRole}>{item.publicMetadata.role || 'User'}</Text>
		</TouchableOpacity>
	)

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Admin Dashboard</Text>
			<TouchableOpacity
				style={styles.button}
				onPress={() => setIsUserManagementVisible(true)}>
				<Text style={styles.buttonText}>Manage Users</Text>
			</TouchableOpacity>
			<TouchableOpacity style={styles.button}>
				<Text style={styles.buttonText}>Manage Listings</Text>
			</TouchableOpacity>
			<TouchableOpacity style={styles.button}>
				<Text style={styles.buttonText}>View Analytics</Text>
			</TouchableOpacity>

			<Modal visible={isUserManagementVisible} animationType='slide'>
				<View style={styles.modalContainer}>
					<TouchableOpacity
						style={styles.closeButton}
						onPress={() => setIsUserManagementVisible(false)}>
						<Ionicons name='close' size={24} color='black' />
					</TouchableOpacity>
					<Text style={styles.modalTitle}>User Management</Text>
					<View style={styles.searchContainer}>
						<TextInput
							style={styles.searchInput}
							placeholder='Search users...'
							value={search}
							onChangeText={setSearch}
							onSubmitEditing={handleSearch}
						/>
						<TouchableOpacity
							style={styles.searchButton}
							onPress={handleSearch}>
							<Text style={styles.searchButtonText}>Search</Text>
						</TouchableOpacity>
					</View>
					<FlatList
						data={users}
						renderItem={renderUserItem}
						keyExtractor={item => item.id}
					/>
				</View>
			</Modal>

			<Modal visible={!!selectedUser} animationType='slide' transparent={true}>
				<View style={styles.userDetailModal}>
					<View style={styles.userDetailContent}>
						<Text style={styles.userDetailName}>
							{selectedUser?.firstName} {selectedUser?.lastName}
						</Text>
						<Text style={styles.userDetailEmail}>
							{selectedUser?.emailAddresses[0].emailAddress}
						</Text>
						<Text style={styles.userDetailRole}>
							Current Role: {selectedUser?.publicMetadata.role || 'User'}
						</Text>
						{selectedUser?.publicMetadata.role !== 'dealer' ? (
							<TouchableOpacity
								style={styles.roleButton}
								onPress={() =>
									selectedUser && handleSetRole(selectedUser.id, 'dealer')
								}>
								<Text style={styles.roleButtonText}>Make Dealer</Text>
							</TouchableOpacity>
						) : (
							<>
								<TouchableOpacity
									style={styles.roleButton}
									onPress={() =>
										selectedUser && handleSetRole(selectedUser.id, 'user')
									}>
									<Text style={styles.roleButtonText}>Turn into User</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={styles.roleButton}
									onPress={() => {
										setIsModifyingDealer(true)
										setIsDealershipFormVisible(true)
									}}>
									<Text style={styles.roleButtonText}>Modify Details</Text>
								</TouchableOpacity>
							</>
						)}
						<TouchableOpacity
							style={styles.closeDetailButton}
							onPress={() => setSelectedUser(null)}>
							<Text style={styles.closeDetailButtonText}>Close</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>

			{renderDealershipForm()}
			{renderDatePicker()}
		</View>
	)
}

// ... (styles remain the same)
const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 20,
		backgroundColor: '#f5f5f5'
	},
	title: {
		fontSize: 24,
		fontWeight: 'bold',
		marginBottom: 20
	},
	button: {
		backgroundColor: '#007AFF',
		padding: 15,
		borderRadius: 5,
		marginBottom: 10
	},
	buttonText: {
		color: 'white',
		textAlign: 'center',
		fontWeight: 'bold'
	},
	modalContainer: {
		flex: 1,
		padding: 20,
		backgroundColor: 'white'
	},
	closeButton: {
		alignSelf: 'flex-end',
		padding: 10
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		marginBottom: 20
	},
	searchContainer: {
		flexDirection: 'row',
		marginBottom: 20
	},
	searchInput: {
		flex: 1,
		height: 40,
		borderColor: 'gray',
		borderWidth: 1,
		paddingHorizontal: 10,
		borderRadius: 5,
		marginRight: 10
	},
	searchButton: {
		backgroundColor: '#007AFF',
		padding: 10,
		borderRadius: 5,
		justifyContent: 'center'
	},
	searchButtonText: {
		color: 'white',
		fontWeight: 'bold'
	},
	userItem: {
		padding: 15,
		borderBottomWidth: 1,
		borderBottomColor: '#ccc'
	},
	userName: {
		fontSize: 16,
		fontWeight: 'bold'
	},
	userEmail: {
		fontSize: 14,
		color: 'gray'
	},
	userRole: {
		fontSize: 14,
		fontStyle: 'italic'
	},
	userDetailModal: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.5)'
	},
	userDetailContent: {
		backgroundColor: 'white',
		padding: 20,
		borderRadius: 10,
		width: '80%'
	},
	userDetailName: {
		fontSize: 18,
		fontWeight: 'bold',
		marginBottom: 10
	},
	userDetailEmail: {
		fontSize: 16,
		marginBottom: 10
	},
	userDetailRole: {
		fontSize: 16,
		marginBottom: 20
	},
	roleButton: {
		backgroundColor: '#007AFF',
		padding: 10,
		borderRadius: 5,
		marginBottom: 10
	},
	roleButtonText: {
		color: 'white',
		textAlign: 'center',
		fontWeight: 'bold'
	},
	closeDetailButton: {
		backgroundColor: '#ccc',
		padding: 10,
		borderRadius: 5
	},
	closeDetailButtonText: {
		color: 'black',
		textAlign: 'center',
		fontWeight: 'bold'
	},
	formModalContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.5)'
	},
	formScrollView: {
		backgroundColor: 'white',
		padding: 20,
		borderRadius: 10,
		width: '80%',
		maxHeight: '80%'
	},
	formTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		marginBottom: 20
	},
	input: {
		height: 40,
		borderColor: 'gray',
		borderWidth: 1,
		marginBottom: 10,
		paddingHorizontal: 10,
		borderRadius: 5
	},
	label: {
		fontSize: 16,
		marginBottom: 5
	},
	submitButton: {
		backgroundColor: '#4CAF50',
		padding: 10,
		borderRadius: 5,
		marginTop: 20
	},
	submitButtonText: {
		color: 'white',
		textAlign: 'center',
		fontWeight: 'bold'
	},
	cancelButton: {
		backgroundColor: '#f44336',
		padding: 10,
		borderRadius: 5,
		marginTop: 10
	},
	cancelButtonText: {
		color: 'white',
		textAlign: 'center',
		fontWeight: 'bold'
	},
	pickerContainer: {
		borderWidth: 1,
		borderColor: 'gray',
		borderRadius: 5,
		marginBottom: 10
	},
	picker: {
		height: 50,
		width: '100%'
	},
	datePickerButton: {
		borderWidth: 1,
		borderColor: 'gray',
		borderRadius: 5,
		padding: 10,
		marginBottom: 10
	},
	datePickerContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.5)'
	},
	datePickerScrollView: {
		backgroundColor: 'white',
		borderRadius: 10,
		padding: 10,
		maxHeight: '80%',
		width: '80%'
	},
	dateItem: {
		padding: 10,
		borderBottomWidth: 1,
		borderBottomColor: '#ccc'
	}
})
