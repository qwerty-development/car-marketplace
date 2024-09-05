import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
	View,
	Text,
	FlatList,
	Image,
	TouchableOpacity,
	TextInput,
	Alert,
	StyleSheet,
	ActivityIndicator,
	Modal
} from 'react-native'
import { FontAwesome } from '@expo/vector-icons'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import ListingModal from '@/components/ListingModal'
import { SafeAreaView } from 'react-native-safe-area-context'
import SortPicker from '@/components/SortPicker'
import { styled } from 'nativewind'
import { StatusBar } from 'react-native'
const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTextInput = styled(TextInput)
const StyledTouchableOpacity = styled(TouchableOpacity)
const ITEMS_PER_PAGE = 10

const CustomHeader = ({ title, onBack }: any) => {
	const { isDarkMode } = useTheme()

	return (
		<SafeAreaView
			edges={['top']}
			style={{
				backgroundColor: isDarkMode ? 'black' : 'white',
				borderBottomWidth: 0,
				borderBottomColor: '#D55004',
				borderTopWidth: 0,
				borderWidth: 0,

				borderColor: '#D55004'
			}}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'center', // Centers the content horizontally
					paddingHorizontal: 0,
					paddingBottom: 9
				}}>
				<Text
					style={{
						fontSize: 20,
						textAlign: 'center',
						color: '#D55004',
						fontWeight: '600'
					}}>
					{title}
				</Text>
			</View>
		</SafeAreaView>
	)
}

interface CarListing {
	id: number
	make: string
	model: string
	year: number
	price: number
	description: string
	images: string[]
	views: number
	likes: number
	dealership_id: number
	condition: 'New' | 'Used'
	color: string
	transmission: 'Manual' | 'Automatic'
	drivetrain: 'FWD' | 'RWD' | 'AWD' | '4WD' | '4x4'
	mileage: number
	status: 'available' | 'pending' | 'sold'
	type: 'Benzine' | 'Diesel' | 'Electric' | 'Hybrid'
	category:
		| 'Sedan'
		| 'SUV'
		| 'Hatchback'
		| 'Convertible'
		| 'Coupe'
		| 'Sports'
		| 'Other'
}

interface Dealership {
	id: number
	name: string
	user_id: string
}

export default function DealerListings() {
	const { isDarkMode } = useTheme()
	const { user } = useUser()
	const [dealership, setDealership] = useState<Dealership | null>(null)
	const [listings, setListings] = useState<CarListing[]>([])
	const [currentPage, setCurrentPage] = useState(1)
	const [totalPages, setTotalPages] = useState(1)
	const [isLoading, setIsLoading] = useState(false)
	const [sortBy, setSortBy] = useState('listed_at')
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
	const [filterStatus, setFilterStatus] = useState('all')
	const [searchQuery, setSearchQuery] = useState('')
	const [selectedListing, setSelectedListing] = useState<CarListing | null>(
		null
	)
	const [isListingModalVisible, setIsListingModalVisible] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [isSoldModalVisible, setIsSoldModalVisible] = useState(false)

	const handleMarkAsSold = useCallback(
		async (soldInfo: { price: string; date: string }) => {
			if (!selectedListing || !dealership) return

			try {
				const { error } = await supabase
					.from('cars')
					.update({
						status: 'sold',
						sold_price: parseInt(soldInfo.price),
						date_sold: soldInfo.date
					})
					.eq('id', selectedListing.id)
					.eq('dealership_id', dealership.id)

				if (error) throw error

				fetchListings()
				setIsSoldModalVisible(false)
				setSelectedListing(null)
				Alert.alert('Success', 'Listing marked as sold successfully')
			} catch (error) {
				console.error('Error marking as sold:', error)
				Alert.alert('Error', 'Failed to mark listing as sold')
			}
		},
		[selectedListing, dealership]
	)

	useEffect(() => {
		if (user) {
			fetchDealership()
		}
	}, [user])

	useEffect(() => {
		if (dealership) {
			fetchListings()
		}
	}, [dealership, currentPage, sortBy, sortOrder, filterStatus, searchQuery])

	const fetchDealership = async () => {
		if (!user) return

		const { data, error } = await supabase
			.from('dealerships')
			.select('*')
			.eq('user_id', user.id)
			.single()

		if (error) {
			console.error('Error fetching dealership:', error)
			setError('Failed to fetch dealership information')
		} else if (data) {
			setDealership(data)
		} else {
			setError('You do not have a dealership associated with your account')
		}
	}

	const fetchListings = useCallback(async () => {
		if (!dealership) return
		setIsLoading(true)

		let query = supabase
			.from('cars')
			.select('*', { count: 'exact' })
			.eq('dealership_id', dealership.id)
			.order(sortBy, { ascending: sortOrder === 'asc' })

		if (filterStatus !== 'all') {
			query = query.eq('status', filterStatus)
		}

		if (searchQuery) {
			query = query.or(
				`make.ilike.%${searchQuery}%,model.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
			)
		}

		const { data, count, error } = await query.range(
			(currentPage - 1) * ITEMS_PER_PAGE,
			currentPage * ITEMS_PER_PAGE - 1
		)

		if (error) {
			console.error('Error fetching listings:', error)
			setError('Failed to fetch car listings')
		} else {
			setListings(data || [])
			setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE))
		}
		setIsLoading(false)
	}, [dealership, currentPage, sortBy, sortOrder, filterStatus, searchQuery])

	const handleDeleteListing = async (id: number) => {
		if (!dealership) return

		Alert.alert(
			'Delete Listing',
			'Are you sure you want to delete this listing?',
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Delete',
					onPress: async () => {
						try {
							const { error } = await supabase
								.from('cars')
								.delete()
								.eq('id', id)
								.eq('dealership_id', dealership.id)

							if (error) throw error

							fetchListings()
							Alert.alert('Success', 'Listing deleted successfully')
						} catch (error) {
							console.error('Error in handleDeleteListing:', error)
							Alert.alert('Error', 'Failed to delete listing')
						}
					},
					style: 'destructive'
				}
			]
		)
	}

	const handleSubmitListing = async (formData: Partial<CarListing>) => {
		if (!dealership) return

		try {
			if (selectedListing) {
				const { error } = await supabase
					.from('cars')
					.update(formData)
					.eq('id', selectedListing.id)
					.eq('dealership_id', dealership.id)

				if (error) throw error

				Alert.alert('Success', 'Listing updated successfully')
			} else {
				const { error } = await supabase.from('cars').insert({
					...formData,
					dealership_id: dealership.id
				})

				if (error) throw error

				Alert.alert('Success', 'New listing created successfully')
			}

			fetchListings()
			setIsListingModalVisible(false)
			setSelectedListing(null)
		} catch (error) {
			console.error('Error submitting listing:', error)
			Alert.alert('Error', 'Failed to submit listing. Please try again.')
		}
	}

	const handleSortChange = (value: string) => {
		const [newSortBy, newSortOrder] = value.split('_')
		setSortBy(newSortBy)
		setSortOrder(newSortOrder as 'asc' | 'desc')
	}

	const handleSearch = () => {
		setCurrentPage(1)
		fetchListings()
	}

	const SoldModal = useCallback(() => {
		const [localSoldInfo, setLocalSoldInfo] = useState({ price: '', date: '' })

		const handleConfirm = () => {
			handleMarkAsSold(localSoldInfo)
		}

		return (
			<Modal
				visible={isSoldModalVisible}
				animationType='slide'
				transparent={true}>
				<StyledView className='flex-1 justify-center items-center  bg-opacity-50'>
					<StyledView className='bg-white p-6 rounded-lg w-5/6'>
						<StyledText className='text-2xl font-bold mb-4'>
							Mark as Sold
						</StyledText>
						<StyledTextInput
							className='border border-gray-300 rounded p-2 mb-4'
							placeholder='Sold Price'
							value={localSoldInfo.price}
							onChangeText={text =>
								setLocalSoldInfo(prev => ({ ...prev, price: text }))
							}
							keyboardType='numeric'
						/>
						<StyledTextInput
							className='border border-gray-300 rounded p-2 mb-4'
							placeholder='Date Sold (YYYY-MM-DD)'
							value={localSoldInfo.date}
							onChangeText={text =>
								setLocalSoldInfo(prev => ({ ...prev, date: text }))
							}
						/>
						<StyledView className='flex-row justify-end mt-4'>
							<StyledTouchableOpacity
								className='bg-gray-300 py-2 px-4 rounded mr-2'
								onPress={() => setIsSoldModalVisible(false)}>
								<StyledText>Cancel</StyledText>
							</StyledTouchableOpacity>
							<StyledTouchableOpacity
								className='bg-red py-2 px-4 rounded'
								onPress={handleConfirm}>
								<StyledText className='text-white'>Confirm</StyledText>
							</StyledTouchableOpacity>
						</StyledView>
					</StyledView>
				</StyledView>
			</Modal>
		)
	}, [isSoldModalVisible, handleMarkAsSold])

	const ListingCard = ({ item }: { item: CarListing }) => (
		<View
			className='border border-red'
			style={[styles.listingCard, isDarkMode && styles.darkListingCard]}>
			<Image
				source={{ uri: item.images?.[0] || 'default_image_url' }}
				style={styles.listingImage}
			/>
			<LinearGradient
				colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.6)']}
				style={styles.gradientOverlay}
			/>
			<View style={styles.statusBadge}>
				<Text style={styles.statusText}>{item.status}</Text>
			</View>
			<View style={styles.topStatsRow}>
				<View style={styles.stat}>
					<FontAwesome name='eye' size={16} color='#FFFFFF' />
					<Text style={styles.statText}>{item.views || 0}</Text>
				</View>
				<View style={styles.stat}>
					<FontAwesome name='heart' size={16} color='#FFFFFF' />
					<Text style={styles.statText}>{item.likes || 0}</Text>
				</View>
			</View>
			<View style={styles.cardContent}>
				<View style={styles.topRow}>
					<Text style={styles.listingTitle}>
						{`${item.year} ${item.make} ${item.model}`}
					</Text>
					<Text style={styles.listingPrice}>
						${item.price != null ? item.price.toLocaleString() : 'N/A'}
					</Text>
				</View>
				<View style={styles.infoRow}>
					<View style={styles.infoItem}>
						<FontAwesome name='car' size={16} color='#FFFFFF' />
						<Text style={styles.listingInfo}>{item.condition}</Text>
					</View>
					<View style={styles.infoItem}>
						<FontAwesome name='tachometer' size={16} color='#FFFFFF' />
						<Text style={styles.listingInfo}>
							{item.mileage != null
								? `${item.mileage.toLocaleString()} mi`
								: 'N/A'}
						</Text>
					</View>
					<View style={styles.infoItem}>
						<FontAwesome name='gears' size={16} color='#FFFFFF' />
						<Text style={styles.listingInfo}>{item.transmission}</Text>
					</View>
				</View>
			</View>
			<View style={styles.actionContainer}>
				<TouchableOpacity
					style={styles.actionButton}
					onPress={() => {
						setSelectedListing(item)
						setIsListingModalVisible(true)
					}}>
					<FontAwesome name='edit' size={18} color='#FFFFFF' />
					<Text style={styles.actionButtonText}>Edit</Text>
				</TouchableOpacity>
				{item.status !== 'sold' && (
					<TouchableOpacity
						style={styles.actionButton}
						onPress={() => {
							setSelectedListing(item)
							setIsSoldModalVisible(true)
						}}>
						<FontAwesome name='check-circle' size={18} color='#FFFFFF' />
						<Text style={styles.actionButtonText}>Sold</Text>
					</TouchableOpacity>
				)}
				<TouchableOpacity
					style={styles.actionButton}
					onPress={() => handleDeleteListing(item.id)}>
					<FontAwesome name='trash' size={18} color='#FFFFFF' />
					<Text style={styles.actionButtonText}>Delete</Text>
				</TouchableOpacity>
			</View>
		</View>
	)

	const renderListEmpty = useCallback(
		() => (
			<View style={styles.emptyContainer}>
				<Text style={[styles.emptyText, isDarkMode && styles.darkEmptyText]}>
					No listings available.
				</Text>
			</View>
		),
		[isDarkMode]
	)

	if (!dealership) {
		return (
			<View style={styles.loadingContainer}>
				<Text style={styles.loadingText}>
					Loading dealership information...
				</Text>
			</View>
		)
	}

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<CustomHeader title='My cars' />
			<LinearGradient
				colors={isDarkMode ? ['#000000', '#D55004'] : ['#FFFFFF', '#D55004']}
				style={{ flex: 1 }}
				start={{ x: 1, y: 0.3 }}
				end={{ x: 2, y: 1 }}>
				{error && <Text style={styles.errorText}>{error}</Text>}

				<View style={styles.searchContainer}>
					<View style={styles.searchInputContainer}>
						<View
							style={[styles.searchBar, isDarkMode && styles.darkSearchBar]}>
							<TouchableOpacity
								style={[styles.iconButton, isDarkMode && styles.iconButton]}
								onPress={handleSearch}>
								<FontAwesome
									name='search'
									size={20}
									color={isDarkMode ? 'white' : 'black'}
								/>
							</TouchableOpacity>
							<TextInput
								style={[
									styles.searchInput,
									isDarkMode && styles.darkSearchInput
								]}
								placeholder='Search listings...'
								placeholderTextColor={isDarkMode ? 'white' : 'gray'}
								value={searchQuery}
								onChangeText={setSearchQuery}
								onSubmitEditing={handleSearch}
							/>
							{searchQuery.length > 0 && (
								<TouchableOpacity
									style={styles.clearButton}
									onPress={() => {
										setSearchQuery('')
										fetchListings()
									}}>
									<FontAwesome
										name='times-circle'
										size={20}
										color={isDarkMode ? 'white' : 'black'}
									/>
								</TouchableOpacity>
							)}
						</View>
						<SortPicker
							onValueChange={handleSortChange}
							initialValue={{ label: 'Sort', value: null }}
						/>
						<TouchableOpacity
							style={styles.addButton}
							onPress={() => {
								setSelectedListing(null)
								setIsListingModalVisible(true)
							}}>
							<FontAwesome name='plus' size={20} color='white' />
						</TouchableOpacity>
					</View>
				</View>

				<FlatList
					data={listings}
					renderItem={({ item }) => <ListingCard item={item} />}
					keyExtractor={item => item.id.toString()}
					onEndReached={() => {
						if (currentPage < totalPages) {
							setCurrentPage(prev => prev + 1)
						}
					}}
					onEndReachedThreshold={0.1}
					ListEmptyComponent={renderListEmpty}
					ListFooterComponent={() =>
						isLoading ? (
							<ActivityIndicator
								size='large'
								color='#D55004'
								style={{ marginVertical: 20 }}
							/>
						) : null
					}
				/>

				<ListingModal
					isVisible={isListingModalVisible}
					onClose={() => {
						setIsListingModalVisible(false)
						setSelectedListing(null)
					}}
					onSubmit={handleSubmitListing}
					initialData={selectedListing}
					dealership={dealership}
				/>
				<SoldModal />
			</LinearGradient>
		</GestureHandlerRootView>
	)
}

// ... (previous code remains the same)

const styles = StyleSheet.create({
	safeArea: {
		flex: 1
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center'
	},
	loadingText: {
		fontSize: 18,
		color: '#666666'
	},
	errorText: {
		color: '#FF3B30',
		marginBottom: 16,
		fontSize: 16,
		padding: 10
	},
	searchContainer: {
		marginBottom: 16,
		margin: 10
	},
	searchInputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between'
	},
	searchBar: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderColor: '#ccc',
		borderRadius: 20,
		marginRight: 10,
		backgroundColor: 'white'
	},
	darkSearchBar: {
		borderColor: '#555',
		backgroundColor: '#333'
	},
	iconButton: {
		padding: 10
	},

	searchInput: {
		flex: 1,
		paddingVertical: 8,
		paddingHorizontal: 12,
		color: 'black'
	},
	darkSearchInput: {
		color: 'white'
	},
	clearButton: {
		padding: 10
	},
	addButton: {
		backgroundColor: '#D55004',
		width: 40,
		height: 40,
		borderRadius: 20,
		justifyContent: 'center',
		alignItems: 'center'
	},
	listingCard: {
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		marginHorizontal: 10,
		marginBottom: 16,
		overflow: 'hidden',
		elevation: 3,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4
	},
	darkListingCard: {
		backgroundColor: '#2D2D2D'
	},
	listingImage: {
		width: '100%',
		height: 200,
		resizeMode: 'cover'
	},
	gradientOverlay: {
		position: 'absolute',
		left: 0,
		right: 0,
		top: 0,
		bottom: 0
	},
	statusBadge: {
		position: 'absolute',
		top: 10,
		right: 10,
		backgroundColor: 'rgba(213, 80, 4, 0.8)',
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12
	},
	statusText: {
		color: '#FFFFFF',
		fontSize: 12,
		fontWeight: 'bold',
		textTransform: 'uppercase'
	},
	topStatsRow: {
		position: 'absolute',
		top: 10,
		left: 10,
		flexDirection: 'row',
		alignItems: 'center'
	},
	stat: {
		flexDirection: 'row',
		alignItems: 'center',
		marginRight: 16,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12
	},
	statText: {
		marginLeft: 4,
		color: '#FFFFFF',
		fontSize: 12
	},
	cardContent: {
		padding: 16
	},
	topRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 8
	},
	listingTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#FFFFFF',
		flex: 1
	},
	listingPrice: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#D55004'
	},
	infoRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 8
	},
	infoItem: {
		flexDirection: 'row',
		alignItems: 'center'
	},
	listingInfo: {
		fontSize: 14,
		color: '#FFFFFF',
		marginLeft: 6
	},
	actionContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		padding: 10,
		borderColor: '#D55004',
		borderTopWidth: 1,
		backgroundColor: 'rgba(0, 0, 0, 0)'
	},
	actionButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#D55004',
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 20,
		marginHorizontal: 4
	},
	actionButtonText: {
		color: '#FFFFFF',
		fontWeight: 'bold',
		marginLeft: 6,
		fontSize: 14
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20
	},
	emptyText: {
		fontSize: 16,
		textAlign: 'center',
		color: '#000'
	},
	darkEmptyText: {
		color: '#fff'
	}
})
