import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	FlatList,
	ActivityIndicator,
	Alert,
	Image,
	RefreshControl,
	StatusBar,
	TextInput,
	StyleSheet
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { Ionicons, FontAwesome5 } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Dropdown } from 'react-native-element-dropdown'
import ListingModal from '@/components/ListingModal'
import { LinearGradient } from 'expo-linear-gradient'
import SortPicker from '@/components/SortPicker'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'

const ITEMS_PER_PAGE = 10

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

const ListingCard = React.memo(
	({ item, onEdit, onDelete, isDarkMode }: any) => {
		const handleEdit = useCallback(() => {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
			onEdit(item)
		}, [item, onEdit])

		const handleDelete = useCallback(() => {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
			onDelete(item.id)
		}, [item.id, onDelete])

		return (
			<View
				style={[styles.card, isDarkMode ? styles.darkCard : styles.lightCard]}>
				<Image source={{ uri: item.images[0] }} style={styles.cardImage} />
				<LinearGradient
					colors={['rgba(0,0,0,0.8)', 'transparent']}
					style={styles.cardGradient}>
					<Text style={styles.cardTitle}>
						{item.year} {item.make} {item.model}
					</Text>
					<Text style={styles.cardPrice}>${item.price.toLocaleString()}</Text>
				</LinearGradient>
				<BlurView
					intensity={80}
					tint={isDarkMode ? 'dark' : 'light'}
					style={styles.cardContent}>
					<View style={styles.cardStatusRow}>
						<View style={styles.cardStatusItem}>
							<FontAwesome5
								name='car'
								size={16}
								color={isDarkMode ? '#fff' : '#000'}
							/>
							<Text
								style={[
									styles.cardStatusText,
									isDarkMode ? styles.darkText : styles.lightText
								]}>
								{item.status}
							</Text>
						</View>
						<View style={styles.cardStatusItem}>
							<Ionicons
								name='eye'
								size={16}
								color={isDarkMode ? '#fff' : '#000'}
							/>
							<Text
								style={[
									styles.cardStatusText,
									isDarkMode ? styles.darkText : styles.lightText
								]}>
								{item.views}
							</Text>
							<Ionicons
								name='heart'
								size={16}
								color={isDarkMode ? '#fff' : '#000'}
								style={styles.cardLikeIcon}
							/>
							<Text
								style={[
									styles.cardStatusText,
									isDarkMode ? styles.darkText : styles.lightText
								]}>
								{item.likes}
							</Text>
						</View>
					</View>
					<Text
						style={[
							styles.cardDescription,
							isDarkMode ? styles.darkText : styles.lightText
						]}
						numberOfLines={2}>
						{item.description}
					</Text>
					<View style={styles.cardButtonRow}>
						<TouchableOpacity onPress={handleEdit} style={styles.editButton}>
							<FontAwesome5 name='edit' size={16} color='white' />
							<Text style={styles.buttonText}>Edit</Text>
						</TouchableOpacity>
						<TouchableOpacity
							onPress={handleDelete}
							style={styles.deleteButton}>
							<FontAwesome5 name='trash-alt' size={16} color='white' />
							<Text style={styles.buttonText}>Delete</Text>
						</TouchableOpacity>
					</View>
				</BlurView>
			</View>
		)
	}
)

export default function AdminBrowseScreen() {
	const { isDarkMode } = useTheme()
	const [listings, setListings] = useState<any>([])
	const [isLoading, setIsLoading] = useState<boolean>(true)
	const [sortBy, setSortBy] = useState<string>('listed_at')
	const [sortOrder, setSortOrder] = useState<string>('desc')
	const [filterStatus, setFilterStatus] = useState<string>('all')
	const [isListingModalVisible, setIsListingModalVisible] =
		useState<boolean>(false)
	const [selectedListing, setSelectedListing] = useState<any>(null)
	const [dealerships, setDealerships] = useState<any>([])
	const [selectedDealership, setSelectedDealership] = useState<any>(null)
	const [refreshing, setRefreshing] = useState<boolean>(false)
	const [currentPage, setCurrentPage] = useState<number>(1)
	const [totalPages, setTotalPages] = useState<number>(1)
	const [searchQuery, setSearchQuery] = useState<string>('')

	useEffect(() => {
		fetchDealerships()
	}, [])

	useEffect(() => {
		fetchListings()
	}, [
		sortBy,
		sortOrder,
		filterStatus,
		selectedDealership,
		currentPage,
		searchQuery
	])

	const fetchDealerships = async () => {
		try {
			const { data, error } = await supabase.from('dealerships').select('*')
			if (error) throw error
			setDealerships(data)
		} catch (error: any) {
			console.error('Error fetching dealerships:', error)
			Alert.alert('Error', `Failed to fetch dealerships: ${error.message}`)
		}
	}

	const fetchListings = async () => {
		setIsLoading(true)
		try {
			let query = supabase
				.from('cars')
				.select('*', { count: 'exact' })
				.order(sortBy, { ascending: sortOrder === 'asc' })

			if (selectedDealership) {
				query = query.eq('dealership_id', selectedDealership.id)
			}

			if (filterStatus !== 'all') {
				query = query.eq('status', filterStatus)
			}

			if (searchQuery) {
				query = query.or(
					`make.ilike.%${searchQuery}%,model.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,color.ilike.%${searchQuery}%`
				)
			}

			const { data, count, error } = await query.range(
				(currentPage - 1) * ITEMS_PER_PAGE,
				currentPage * ITEMS_PER_PAGE - 1
			)

			if (error) throw error

			setListings(data)
			setTotalPages(Math.ceil((count ?? 0) / ITEMS_PER_PAGE))
		} catch (error: any) {
			console.error('Error fetching listings:', error)
			Alert.alert('Error', `Failed to fetch listings: ${error.message}`)
		} finally {
			setIsLoading(false)
			setRefreshing(false)
		}
	}

	const handleDeleteListing = useCallback((id: string) => {
		Alert.alert(
			'Delete Listing',
			'Are you sure you want to delete this listing?',
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Delete',
					onPress: async () => {
						try {
							Haptics.notificationAsync(
								Haptics.NotificationFeedbackType.Success
							)
							const { error } = await supabase
								.from('cars')
								.delete()
								.eq('id', id)
							if (error) throw error
							fetchListings()
							Alert.alert('Success', 'Listing deleted successfully')
						} catch (error: any) {
							console.error('Error deleting listing:', error)
							Alert.alert('Error', `Failed to delete listing: ${error.message}`)
						}
					},
					style: 'destructive'
				}
			]
		)
	}, [])

	const handleEditListing = useCallback((listing: any) => {
		setSelectedListing(listing)
		setIsListingModalVisible(true)
	}, [])

	const handleSubmitListing = useCallback(
		async (formData: any) => {
			try {
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
				const { error } = await supabase
					.from('cars')
					.update(formData)
					.eq('id', selectedListing.id)
				if (error) throw error
				fetchListings()
				setIsListingModalVisible(false)
				setSelectedListing(null)
				Alert.alert('Success', 'Listing updated successfully')
			} catch (error: any) {
				console.error('Error updating listing:', error)
				Alert.alert('Error', `Failed to update listing: ${error.message}`)
			}
		},
		[selectedListing]
	)

	const onRefresh = useCallback(() => {
		setRefreshing(true)
		setCurrentPage(1)
		fetchListings()
	}, [])

	const handleSortChange = useCallback((value: string) => {
		const [newSortBy, newSortOrder] = value.split('_')
		setSortBy(newSortBy === 'date' ? 'listed_at' : newSortBy)
		setSortOrder(newSortOrder)
		setCurrentPage(1)
	}, [])

	const renderItem = useCallback(
		({ item }: { item: any }) => (
			<ListingCard
				item={item}
				onEdit={handleEditListing}
				onDelete={handleDeleteListing}
				isDarkMode={isDarkMode}
			/>
		),
		[isDarkMode, handleEditListing, handleDeleteListing]
	)

	const keyExtractor = useCallback((item: any) => item.id.toString(), [])

	const ListHeaderComponent = useMemo(
		() => (
			<View style={styles.headerComponentContainer}>
				<TextInput
					style={[
						styles.searchInput,
						isDarkMode ? styles.darkInput : styles.lightInput
					]}
					placeholder='Search listings...'
					placeholderTextColor={isDarkMode ? '#999' : '#666'}
					value={searchQuery}
					onChangeText={setSearchQuery}
					onSubmitEditing={fetchListings}
					className='mt-3'
				/>

				<View style={styles.dropdownContainer}>
					<Dropdown
						style={[
							styles.dropdown,
							isDarkMode ? styles.darkDropdown : styles.lightDropdown
						]}
						placeholderStyle={styles.placeholderStyle}
						selectedTextStyle={styles.selectedTextStyle}
						inputSearchStyle={styles.inputSearchStyle}
						data={[
							{ label: 'All Dealerships', value: null },
							...dealerships.map((d: { name: string; id: string }) => ({
								label: d.name,
								value: d.id
							}))
						]}
						search
						maxHeight={300}
						labelField='label'
						valueField='value'
						placeholder='Select Dealership'
						searchPlaceholder='Search...'
						value={selectedDealership?.id}
						onChange={item => {
							setSelectedDealership(
								dealerships.find((d: { id: string }) => d.id === item.value) ||
									null
							)
							setCurrentPage(1)
						}}
					/>
				</View>

				<View style={styles.filterSortContainer}>
					<Dropdown
						style={[
							styles.dropdown,
							styles.halfWidth,
							isDarkMode ? styles.darkDropdown : styles.lightDropdown
						]}
						placeholderStyle={styles.placeholderStyle}
						selectedTextStyle={styles.selectedTextStyle}
						inputSearchStyle={styles.inputSearchStyle}
						data={[
							{ label: 'All', value: 'all' },
							{ label: 'Available', value: 'available' },
							{ label: 'Pending', value: 'pending' },
							{ label: 'Sold', value: 'sold' }
						]}
						maxHeight={300}
						labelField='label'
						valueField='value'
						placeholder='Filter Status'
						value={filterStatus}
						onChange={item => {
							setFilterStatus(item.value)
							setCurrentPage(1)
						}}
					/>

					<View style={[styles.halfWidth, styles.sortPickerContainer]}>
						<SortPicker
							onValueChange={handleSortChange}
							initialValue={{ label: 'Newest', value: 'listed_at_desc' }}
						/>
					</View>
				</View>
			</View>
		),
		[
			isDarkMode,
			searchQuery,
			dealerships,
			selectedDealership,
			filterStatus,
			handleSortChange
		]
	)

	const ListEmptyComponent = useMemo(
		() => (
			<Text
				style={[
					styles.emptyListText,
					isDarkMode ? styles.darkText : styles.lightText
				]}>
				No listings found
			</Text>
		),
		[isDarkMode]
	)

	const ListFooterComponent = useMemo(
		() =>
			isLoading ? (
				<ActivityIndicator
					size='large'
					color='#D55004'
					style={styles.loadingIndicator}
				/>
			) : (
				<View style={styles.paginationContainer}>
					<TouchableOpacity
						onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
						disabled={currentPage === 1}
						style={[
							styles.paginationButton,
							currentPage === 1 ? styles.disabledButton : styles.enabledButton
						]}>
						<Text style={styles.paginationButtonText}>Previous</Text>
					</TouchableOpacity>
					<Text
						style={[
							styles.paginationText,
							isDarkMode ? styles.darkText : styles.lightText
						]}>
						Page {currentPage} of {totalPages}
					</Text>
					<TouchableOpacity
						onPress={() =>
							setCurrentPage(prev => Math.min(totalPages, prev + 1))
						}
						disabled={currentPage === totalPages}
						style={[
							styles.paginationButton,
							currentPage === totalPages
								? styles.disabledButton
								: styles.enabledButton
						]}>
						<Text style={styles.paginationButtonText}>Next</Text>
					</TouchableOpacity>
				</View>
			),
		[isLoading, currentPage, totalPages, isDarkMode]
	)

	return (
		<LinearGradient
			colors={isDarkMode ? ['#1A1A1A', '#2D2D2D'] : ['#F5F5F5', '#E0E0E0']}
			style={styles.container}
			className='mb-10'>
			<CustomHeader title='Manage Listings' />
			<FlatList
				data={listings}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				contentContainerStyle={styles.listContentContainer}
				ListHeaderComponent={ListHeaderComponent}
				ListEmptyComponent={ListEmptyComponent}
				ListFooterComponent={ListFooterComponent}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
				}
				initialNumToRender={5}
				maxToRenderPerBatch={10}
				updateCellsBatchingPeriod={50}
				windowSize={21}
				removeClippedSubviews={true}
			/>

			<ListingModal
				isVisible={isListingModalVisible}
				onClose={() => {
					setIsListingModalVisible(false)
					setSelectedListing(null)
				}}
				onSubmit={handleSubmitListing}
				initialData={selectedListing}
				dealership={selectedDealership}
			/>
		</LinearGradient>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1
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
		paddingBottom: 8
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: '600',
		color: '#D55004'
	},
	listContentContainer: {
		paddingHorizontal: 16
	},
	card: {
		borderRadius: 8,
		marginBottom: 16,
		overflow: 'hidden',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3
	},
	darkCard: {
		backgroundColor: '#333'
	},
	lightCard: {
		backgroundColor: '#fff'
	},
	cardImage: {
		width: '100%',
		height: 200,
		resizeMode: 'cover'
	},
	cardGradient: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		height: 64,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 16
	},
	cardTitle: {
		color: '#fff',
		fontSize: 16,
		fontWeight: 'bold'
	},
	cardPrice: {
		color: '#D55004',
		fontSize: 18,
		fontWeight: '600'
	},
	cardContent: {
		padding: 16
	},
	cardStatusRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 8
	},
	cardStatusItem: {
		flexDirection: 'row',
		alignItems: 'center'
	},
	cardStatusText: {
		marginLeft: 8,
		fontSize: 14
	},
	cardLikeIcon: {
		marginLeft: 16
	},
	cardDescription: {
		marginBottom: 8,
		fontSize: 14
	},
	cardButtonRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 8
	},
	editButton: {
		backgroundColor: '#4CAF50',
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 20
	},
	deleteButton: {
		backgroundColor: '#F44336',
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 20
	},
	buttonText: {
		color: '#fff',
		marginLeft: 8,
		fontSize: 14,
		fontWeight: '500'
	},
	darkText: {
		color: '#fff'
	},
	lightText: {
		color: '#000'
	},
	headerComponentContainer: {
		marginBottom: 16
	},
	searchInput: {
		height: 40,
		borderRadius: 20,
		paddingHorizontal: 16,
		marginBottom: 16
	},
	darkInput: {
		backgroundColor: '#333',
		color: '#fff'
	},
	lightInput: {
		backgroundColor: '#fff',
		color: '#000'
	},
	dropdownContainer: {
		marginBottom: 16
	},
	dropdown: {
		height: 50,
		borderColor: '#D55004',
		borderWidth: 1,
		borderRadius: 8,
		paddingHorizontal: 8
	},
	darkDropdown: {
		backgroundColor: '#333'
	},
	lightDropdown: {
		backgroundColor: '#fff'
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
		borderColor: '#D55004'
	},
	filterSortContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between'
	},
	halfWidth: {
		width: '48%'
	},
	sortPickerContainer: {
		justifyContent: 'center'
	},
	emptyListText: {
		textAlign: 'center',
		marginTop: 16,
		fontSize: 16
	},
	loadingIndicator: {
		marginVertical: 20
	},
	paginationContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginTop: 16,
		marginBottom: 16
	},
	paginationButton: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 20
	},
	disabledButton: {
		backgroundColor: '#ccc'
	},
	enabledButton: {
		backgroundColor: '#D55004'
	},
	paginationButtonText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '500'
	},
	paginationText: {
		fontSize: 14
	}
})
