import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
	View,
	Text,
	FlatList,
	Image,
	TouchableOpacity,
	Alert,
	ActivityIndicator,
	RefreshControl,
	StyleSheet,
	TextInput,
	Modal
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { FontAwesome, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { supabase } from '@/utils/supabase'

import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'

import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useScrollToTop, useFocusEffect } from '@react-navigation/native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/utils/AuthContext'

import { useGuestUser } from '@/utils/GuestUserContext'
import { formatMileage } from '@/utils/formatMileage';
import { BlurView } from 'expo-blur'
import AddListingModal from '@/components/AddListingModal'
import { LicensePlateTemplate } from '@/components/NumberPlateCard'
import { useWindowDimensions } from 'react-native'
/* CREDIT_DISABLED: Boost system temporarily disabled
import { BoostListingModal } from '@/components/BoostListingModal'
*/

const ITEMS_PER_PAGE = 10

type ListingType = 'vehicle' | 'plate'
type SortOption = 'newest' | 'price_low' | 'price_high'

interface CarListing {
	id: number
	make: string
	model: string
	year: number
	price: number
	images: string[]
	views: number
	likes: number
	status: 'available' | 'pending' | 'sold' | 'deleted'
	condition: 'New' | 'Used'
	mileage: number
	transmission: 'Manual' | 'Automatic'
	is_boosted?: boolean
	boost_priority?: number
	boost_end_date?: string
	user_id?: string
	dealership_id?: number
	seller_type?: 'user' | 'dealer'
	seller_name?: string
	seller_phone?: string
	listingType: 'vehicle'
}

interface PlateListing {
	id: number
	letter: string
	digits: string
	price: number
	picture: string | null
	status: 'available' | 'pending' | 'sold' | 'deleted'
	created_at: string
	user_id?: string
	dealership_id?: number
	listingType: 'plate'
}

export default function MyListings() {
	const { isDarkMode } = useTheme()
	const { user } = useAuth()
	const { isGuest, clearGuestMode } = useGuestUser()
	const { t } = useTranslation()
	const [initialLoading, setInitialLoading] = useState(true)
	const [allListings, setAllListings] = useState<(CarListing | PlateListing)[]>([])
	const [currentPage, setCurrentPage] = useState(1)
	const [isLoading, setIsLoading] = useState(false)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [hasMoreListings, setHasMoreListings] = useState(true)
	const [totalListings, setTotalListings] = useState(0)
	const [searchQuery, setSearchQuery] = useState('')
	const [sortOption, setSortOption] = useState<SortOption>('newest')
	const [filterType, setFilterType] = useState<'all' | 'vehicle' | 'plate'>('all')
	const [showAddModal, setShowAddModal] = useState(false)
	const [showFilterModal, setShowFilterModal] = useState(false)
	const [showSortModal, setShowSortModal] = useState(false)
	/* CREDIT_DISABLED: Boost state disabled
	const [showBoostModal, setShowBoostModal] = useState(false)
	const [selectedCarForBoost, setSelectedCarForBoost] = useState<number | null>(null)
	*/
	const scrollRef = useRef(null)
	const router = useRouter()
	const { width: windowWidth } = useWindowDimensions()
	const plateCardWidth = windowWidth - 72 // Account for padding (m-4 = 16px on each side + extra for card padding)

	useScrollToTop(scrollRef)

	// Handle Sign In for Guest Users
	const handleSignIn = async () => {
		await clearGuestMode()
		router.replace('/(auth)/sign-in')
	}

	const fetchListings = useCallback(
		async (page = 1, refresh = false) => {
			if (!user?.id) return

			// Only set loading true for pagination, not for initial load
			if (!refresh && page > 1) {
				setIsLoading(true)
			}

			// For initial load or refresh, set initialLoading
			if (refresh || page === 1) {
				setInitialLoading(true)
			}

			try {
				// Fetch both vehicles and plates together
				const [vehiclesData, platesData] = await Promise.all([
					// Fetch vehicles
					(async () => {
						let vQuery = supabase
							.from('cars')
							.select('*, users!cars_user_id_fkey(name, id, phone_number)')
							.eq('user_id', user.id)
							.neq('status', 'deleted')

						// Apply search filter
						if (searchQuery.trim()) {
							vQuery = vQuery.or(`make.ilike.%${searchQuery}%,model.ilike.%${searchQuery}%`)
						}

						// Apply sorting
						if (sortOption === 'newest') {
							vQuery = vQuery.order('listed_at', { ascending: false })
						} else if (sortOption === 'price_low') {
							vQuery = vQuery.order('price', { ascending: true })
						} else if (sortOption === 'price_high') {
							vQuery = vQuery.order('price', { ascending: false })
						}

						const { data, error } = await vQuery
						if (error) throw error

						// Map the data to include seller info and listing type
						return (data || []).map((item: any) => ({
							...item,
							seller_type: 'user' as const,
							seller_name: item.users?.name || 'Private Seller',
							seller_phone: item.seller_phone || null,
							listingType: 'vehicle' as const
						}))
					})(),
					// Fetch plates
					(async () => {
						let pQuery = supabase
							.from('number_plates')
							.select('*')
							.eq('user_id', user.id)
							.neq('status', 'deleted')

						// Apply search filter
						if (searchQuery.trim()) {
							pQuery = pQuery.or(`letter.ilike.%${searchQuery}%,digits.ilike.%${searchQuery}%`)
						}

						// Apply sorting
						if (sortOption === 'newest') {
							pQuery = pQuery.order('created_at', { ascending: false })
						} else if (sortOption === 'price_low') {
							pQuery = pQuery.order('price', { ascending: true })
						} else if (sortOption === 'price_high') {
							pQuery = pQuery.order('price', { ascending: false })
						}

						const { data, error } = await pQuery
						if (error) throw error

						// Add listing type marker
						return (data || []).map((item: any) => ({
							...item,
							listingType: 'plate' as const
						}))
					})()
				])

				// Combine and sort all listings
				let combined: any[] = [...vehiclesData, ...platesData]

				// Apply global sort
				if (sortOption === 'newest') {
					combined.sort((a, b) => {
						const dateA = new Date(a.listed_at || a.created_at).getTime()
						const dateB = new Date(b.listed_at || b.created_at).getTime()
						return dateB - dateA
					})
				} else if (sortOption === 'price_low') {
					combined.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
				} else if (sortOption === 'price_high') {
					combined.sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
				}

				setAllListings(combined)
				setTotalListings(combined.length)
				setHasMoreListings(false) // No pagination for now since we load all
			} catch (error) {
				console.error('Error fetching listings:', error)
				Alert.alert('Error', 'Failed to fetch listings')
			} finally {
				setIsLoading(false)
				setIsRefreshing(false)
				setInitialLoading(false)
			}
		},
		[user?.id, searchQuery, sortOption]
	)

	const handleRefresh = useCallback(() => {
		setIsRefreshing(true)
		setCurrentPage(1)
		fetchListings(1, true)
	}, [fetchListings])

	useFocusEffect(
		React.useCallback(() => {
			handleRefresh()
			return () => {}
		}, [handleRefresh])
	)

	const handleLoadMore = useCallback(() => {
		if (!isLoading && hasMoreListings && !isRefreshing) {
			const nextPage = currentPage + 1
			fetchListings(nextPage, false)
		}
	}, [currentPage, isLoading, hasMoreListings, isRefreshing, fetchListings])

	/* CREDIT_DISABLED: Boost handler disabled
	const handleBoostPress = useCallback((carId: number) => {
		setSelectedCarForBoost(carId);
		setShowBoostModal(true);
	}, []);
	*/

	useEffect(() => {
		if (user?.id) {
			fetchListings(1, true)
		}
	}, [user?.id])

	// Debounced search effect
	useEffect(() => {
		if (!user?.id) return
		
		const timer = setTimeout(() => {
			setCurrentPage(1)
			fetchListings(1, true)
		}, 500)

		return () => clearTimeout(timer)
	}, [searchQuery])

	// Re-fetch when sort option changes
	useEffect(() => {
		if (!user?.id) return
		setCurrentPage(1)
		fetchListings(1, true)
	}, [sortOption])

	const SpecItem = ({ title, icon, value, isDarkMode }: any) => (
		<View className='flex-1 items-center justify-center'>
			<Text
				className={`text-xs mb-3 ${
					isDarkMode ? 'text-[#e6e6e6]' : 'text-textgray'
				}`}
				style={{ textAlign: 'center' }}>
				{title}
			</Text>
			<Ionicons
				name={icon}
				size={30}
				color={isDarkMode ? '#FFFFFF' : '#000000'}
				style={{ marginVertical: 3 }}
			/>
			<Text
				className={`text-sm font-bold mt-3 ${
					isDarkMode ? 'text-white' : 'text-black'
				}`}
				style={{ textAlign: 'center' }}>
				{value}
			</Text>
		</View>
	)

	const getStatusConfig = (status: string) => {
		switch (status.toLowerCase()) {
			case 'available':
				return { color: '#22C55E', dotColor: '#4ADE80' }
			case 'pending':
				return { color: '#EAB308', dotColor: '#FDE047' }
			case 'sold':
				return { color: '#EF4444', dotColor: '#FCA5A5' }
			default:
				return { color: '#6B7280', dotColor: '#9CA3AF' }
		}
	}

	// Filter and search listings
	const displayListings = useMemo(() => {
		let filtered = [...allListings]
		
		// Filter by type
		if (filterType !== 'all') {
			filtered = filtered.filter(item => item.listingType === filterType)
		}
		
		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase().trim()
			filtered = filtered.filter(item => {
				if (item.listingType === 'vehicle') {
					const vehicle = item as CarListing
					return (
						vehicle.make?.toLowerCase().includes(query) ||
						vehicle.model?.toLowerCase().includes(query) ||
						`${vehicle.year}`.includes(query)
					)
				} else {
					const plate = item as PlateListing
					return (
						plate.letter?.toLowerCase().includes(query) ||
						plate.digits?.includes(query)
					)
				}
			})
		}
		
		return filtered
	}, [allListings, filterType, searchQuery])

	const PlateListingCard = useMemo(
		() =>
			React.memo(({ item }: { item: PlateListing }) => {
				const statusConfig = getStatusConfig(item.status)

				const handleCardPress = () => {
					router.push({
						pathname: '/(home)/(user)/NumberPlatesManager',
						params: {
							plateId: item.id
						}
					})
				}

				return (
					<TouchableOpacity activeOpacity={0.9} onPress={handleCardPress}>
						<Animated.View
							entering={FadeInDown}
							className={`m-4 mb-4 ${
								isDarkMode ? 'bg-[#242424]' : 'bg-[#e1e1e1]'
							} rounded-3xl overflow-hidden shadow-xl`}>
							
							{/* License Plate Template */}
							<View
								style={{
									paddingVertical: 24,
									paddingHorizontal: 20,
									backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
									justifyContent: 'center',
									alignItems: 'center',
								}}
							>
								{/* Status Badge */}
								<View style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}>
									<View
										style={{ backgroundColor: statusConfig.color }}
										className='rounded-full px-3 py-1.5 flex-row items-center'>
										<View
											style={{ backgroundColor: statusConfig.dotColor }}
											className='w-2 h-2 rounded-full mr-2'
										/>
										<Text className='text-white text-xs font-bold uppercase tracking-wider'>
											{item.status}
										</Text>
									</View>
								</View>

								<LicensePlateTemplate
									letter={item.letter}
									digits={item.digits}
									width={plateCardWidth}
								/>
							</View>

							{/* Info Section */}
							<View className='px-4 py-3'>
								<View className='flex-row items-center justify-between'>
									{/* Plate Number */}
									<Text
										className={`text-xl font-bold ${
											isDarkMode ? 'text-white' : 'text-black'
										}`}
										style={{ letterSpacing: 2 }}
									>
										{item.letter} {item.digits}
									</Text>
									
									{/* Price */}
									<Text
										style={{ 
											fontSize: 20,
											fontWeight: '800',
											color: '#D55004',
										}}
									>
										${parseFloat(item.price.toString()).toLocaleString()}
									</Text>
								</View>
							</View>

							{/* Footer */}
							<View 
								className={`px-5 py-4 ${isDarkMode ? 'bg-[#2b2b2b]' : 'bg-[#d1d1d1]'} rounded-t-3xl`}
								style={{ marginTop: 4 }}
							>
								<View className='flex-row items-center'>
									<MaterialCommunityIcons
										name='card-text-outline'
										size={20}
										color={isDarkMode ? '#FFFFFF' : '#000000'}
									/>
									<Text
										className={`ml-2 text-sm ${
											isDarkMode ? 'text-white/60' : 'text-gray-600'
										}`}>
										License Plate • Added{' '}
										{new Date(item.created_at).toLocaleDateString()}
									</Text>
								</View>
							</View>
						</Animated.View>
					</TouchableOpacity>
				)
			}),
		[isDarkMode, router, plateCardWidth]
	)

	const ListingCard = useMemo(
		() =>
			React.memo(({ item }: { item: CarListing }) => {
				const statusConfig = getStatusConfig(item.status)

				const handleCardPress = () => {
					router.push({
						pathname: '/(home)/(dealer)/AddEditListing',
						params: {
							userId: user?.id,
							listingId: item.id,
							isUserListing: 'true' // Flag to indicate this is a user listing
						}
					})
				}

				return (
					<TouchableOpacity activeOpacity={0.9} onPress={handleCardPress}>
						<Animated.View
							entering={FadeInDown}
							className={`m-4 mb-4 ${
								isDarkMode ? 'bg-textgray' : 'bg-[#e1e1e1]'
							} rounded-3xl overflow-hidden shadow-xl`}>
							<View className='relative'>
								<Image
									source={{ uri: item.images[0] }}
									className='w-full aspect-[24/24]'
									resizeMode='cover'
								/>

								<View className='absolute top-4 w-full px-4 flex-row justify-between items-center'>
									<View className='flex-row items-center'>
										<View
											style={{ backgroundColor: statusConfig.color }}
											className='rounded-full px-3 py-1.5 mr-2 flex-row items-center'>
											<View
												style={{ backgroundColor: statusConfig.dotColor }}
												className='w-2 h-2 rounded-full mr-2 animate-pulse'
											/>
											<Text className='text-white text-xs font-bold uppercase tracking-wider'>
												{item.status}
											</Text>
										</View>

										{/* User Listing Badge */}
										<View className='bg-blue-500/90 backdrop-blur-lg rounded-full px-3 py-1.5 mr-2 flex-row items-center'>
											<Ionicons name='person' size={12} color='#FFFFFF' />
											<Text className='text-white text-xs font-bold ml-1.5'>
												Private
											</Text>
										</View>

										<View className='flex-row space-x-2'>
											<View className='flex-row items-center bg-black/60 backdrop-blur-lg rounded-full px-3 py-1.5'>
												<FontAwesome name='eye' size={12} color='#FFFFFF' />
												<Text className='text-white text-xs font-medium ml-1.5'>
													{item.views || 0}
												</Text>
											</View>

											<View className='flex-row items-center bg-black/60 backdrop-blur-lg rounded-full px-3 py-1.5'>
												<FontAwesome name='heart' size={12} color='#FFFFFF' />
												<Text className='text-white text-xs font-medium ml-1.5'>
													{item.likes || 0}
												</Text>
											</View>
										</View>
									</View>
								</View>

								<View className='absolute bottom-0 w-full p-5'>
									<View className='flex-row justify-between items-end'>
										<View className='flex-1'>
											<Text className='text-white text-2xl font-bold tracking-tight mb-1'>
												{item.make} {item.model}
											</Text>
											<Text className='text-white text-3xl font-extrabold'>
												${item.price.toLocaleString()}
											</Text>
										</View>
									</View>
								</View>
							</View>

							<View className='px-5 py-4'>
								<View className='flex-row justify-between'>
									<SpecItem
										title='Year'
										icon='calendar-outline'
										value={item.year}
										isDarkMode={isDarkMode}
									/>
									<SpecItem
										title='KM'
										icon='speedometer-outline'
										value={formatMileage(item.mileage)}
										isDarkMode={isDarkMode}
									/>
									<SpecItem
										title='Trans'
										icon='cog-outline'
										value={
											item.transmission === 'Automatic'
												? 'Auto'
												: item.transmission === 'Manual'
												? 'Man'
												: item.transmission
										}
										isDarkMode={isDarkMode}
									/>
									<SpecItem
										title='Condition'
										icon='car-sport-outline'
										value={item.condition}
										isDarkMode={isDarkMode}
									/>
							</View>
						</View>

						{/* CREDIT_DISABLED: Boost Button Section - Only for available listings
						{item.status === 'available' && (
							<View className='px-5 pb-4'>
								{item.is_boosted && item.boost_end_date && new Date(item.boost_end_date) > new Date() ? (
									<View className={`flex-row items-center justify-between p-3 rounded-xl ${isDarkMode ? 'bg-orange-900/20 border border-orange-500/30' : 'bg-orange-50 border border-orange-200'}`}>
										<View className='flex-row items-center flex-1'>
											<Ionicons name="rocket" size={20} color="#D55004" />
											<View className='ml-2 flex-1'>
												<Text className={`font-semibold ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
													Boosted{item.boost_priority ? ` - Priority ${item.boost_priority}` : ''}
												</Text>
												<Text className={`text-xs ${isDarkMode ? 'text-orange-300/70' : 'text-orange-500'}`}>
													Until {new Date(item.boost_end_date).toLocaleDateString()}
												</Text>
											</View>
										</View>
										<TouchableOpacity
											onPress={(e) => {
												e.stopPropagation();
												handleBoostPress(item.id);
											}}
											className='bg-orange-500 px-3 py-2 rounded-lg'
										>
											<Text className='text-white font-semibold text-xs'>Extend</Text>
										</TouchableOpacity>
									</View>
								) : (
									<TouchableOpacity
										onPress={(e) => {
											e.stopPropagation();
											handleBoostPress(item.id);
										}}
										className='bg-orange-500 p-3 rounded-xl flex-row items-center justify-center'
									>
										<Ionicons name="rocket-outline" size={20} color="white" />
										<Text className='text-white font-bold ml-2'>Boost Listing</Text>
									</TouchableOpacity>
								)}
							</View>
						)}
						*/}
					</Animated.View>
				</TouchableOpacity>
			)
		}),
		[isDarkMode, router, user?.id]
	)

	return (
		<LinearGradient
			colors={isDarkMode ? ['#000000', '#1A1A1A'] : ['#FFFFFF', '#F5F5F5']}
			style={{ flex: 1 }}>
			<SafeAreaView edges={['top']} style={{ flex: 1 }}>
				{/* Header */}
				<View
					style={{
 						paddingHorizontal: 24,
						paddingTop: 16,
						paddingBottom: 12,
						backgroundColor: isDarkMode ? 'black' : 'white',
						flexDirection: 'row',
						alignItems: 'center',
						justifyContent: 'space-between'
					}}>
					<Text
						style={{
							fontSize: 24,
							fontWeight: 'bold',
							color: isDarkMode ? 'white' : 'black'
						}}>
						My Listings
					</Text>
					<TouchableOpacity
						onPress={() => setShowAddModal(true)}
						style={{
							backgroundColor: '#D55004',
							paddingVertical: 8,
							paddingHorizontal: 16,
							borderRadius: 20,
							flexDirection: 'row',
							alignItems: 'center'
						}}>
						<Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>
							Add new +
						</Text>
					</TouchableOpacity>
				</View>

				{/* Search Bar with Filter and Sort Icons */}
				<View style={{ paddingHorizontal: 24, paddingBottom: 8 }}>
					<View style={{ flexDirection: 'row', gap: 8 }}>
						<View
							style={{
								flex: 1,
								flexDirection: 'row',
								alignItems: 'center',
								backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
								borderRadius: 12,
								paddingHorizontal: 12
							}}>
							<Ionicons
								name='search'
								size={20}
								color={isDarkMode ? '#666' : '#999'}
							/>
							<TextInput
								value={searchQuery}
								onChangeText={setSearchQuery}
								placeholder='Search'
								placeholderTextColor={isDarkMode ? '#666' : '#999'}
								style={{
									flex: 1,
									paddingVertical: 12,
									paddingHorizontal: 8,
									color: isDarkMode ? 'white' : 'black'
								}}
							/>
							{searchQuery.length > 0 && (
								<TouchableOpacity onPress={() => setSearchQuery('')}>
									<Ionicons
										name='close-circle'
										size={20}
										color={isDarkMode ? '#666' : '#999'}
									/>
								</TouchableOpacity>
							)}
						</View>

						<TouchableOpacity
							onPress={() => setShowFilterModal(true)}
							style={{
								backgroundColor: filterType !== 'all' ? '#D55004' : isDarkMode ? '#1a1a1a' : '#f5f5f5',
								width: 44,
								height: 44,
								borderRadius: 22,
								justifyContent: 'center',
								alignItems: 'center'
							}}>
							<Ionicons
								name='options'
								size={20}
								color={filterType !== 'all' ? 'white' : isDarkMode ? 'white' : 'black'}
							/>
						</TouchableOpacity>

						<TouchableOpacity
							onPress={() => setShowSortModal(true)}
							style={{
								backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
								width: 44,
								height: 44,
								borderRadius: 22,
								justifyContent: 'center',
								alignItems: 'center'
							}}>
							<Ionicons
								name='swap-vertical'
								size={20}
								color={isDarkMode ? 'white' : 'black'}
							/>
						</TouchableOpacity>
					</View>
				</View>

				{/* Listings */}
				{initialLoading && (
					<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
						<ActivityIndicator size='large' color='#D55004' />
					</View>
				)}

				{!initialLoading && (
					<FlatList
						ref={scrollRef}
						data={displayListings}
						renderItem={({ item }) => {
							// Detect if it's a vehicle or plate by checking listingType property
							if (item.listingType === 'plate') {
								return <PlateListingCard item={item} />
							} else {
								return <ListingCard item={item} />
							}
						}}
						keyExtractor={item => `${item.listingType}-${item.id}`}
						showsVerticalScrollIndicator={false}
						onEndReached={handleLoadMore}
						onEndReachedThreshold={0.3}
						refreshControl={
							<RefreshControl
								refreshing={isRefreshing}
								onRefresh={handleRefresh}
								colors={['#D55004']}
								tintColor={isDarkMode ? '#FFFFFF' : '#000000'}
							/>
						}
						ListEmptyComponent={
							<View
								style={{
									flex: 1,
									justifyContent: 'center',
									alignItems: 'center',
									paddingVertical: 80
								}}>
								<Ionicons
									name='albums-outline'
									size={64}
									color={isDarkMode ? '#666' : '#ccc'}
									style={{ marginBottom: 16 }}
								/>
								<Text
									style={{
										fontSize: 18,
										color: isDarkMode ? 'white' : 'black',
										marginBottom: 8
									}}>
									{searchQuery ? 'No results found' : 'No listings yet'}
								</Text>
								<Text
									style={{
										fontSize: 14,
										color: isDarkMode ? '#888' : '#666',
										textAlign: 'center',
										paddingHorizontal: 32
									}}>
									{searchQuery
										? 'Try adjusting your search'
										: 'Tap the "Add new +" button to create your first listing'}
								</Text>
							</View>
						}
						ListFooterComponent={() =>
							isLoading && !isRefreshing ? (
								<ActivityIndicator
									size='large'
									color='#D55004'
									style={{ padding: 20 }}
								/>
							) : null
						}
						removeClippedSubviews={true}
						maxToRenderPerBatch={5}
						windowSize={10}
						updateCellsBatchingPeriod={100}
						initialNumToRender={5}
						contentContainerStyle={{
							paddingBottom: 100,
							flexGrow: displayListings.length === 0 ? 1 : undefined
						}}
					/>
				)}
			</SafeAreaView>

			{/* Guest User Overlay */}
			{isGuest && (
				<View style={guestStyles.overlay} pointerEvents='auto'>
					<BlurView
						intensity={80}
						tint={isDarkMode ? 'dark' : 'light'}
						style={StyleSheet.absoluteFill}
					/>
					<View style={guestStyles.container}>
						<Ionicons
							name='lock-closed-outline'
							size={56}
							color='#ffffff'
							style={guestStyles.icon}
						/>
						<Text style={guestStyles.title}>You're Browsing as Guest</Text>
						<Text style={guestStyles.subtitle}>
							Please sign in to view and manage your car listings
						</Text>
						<TouchableOpacity
							style={guestStyles.signInButton}
							onPress={handleSignIn}>
							<Text style={guestStyles.signInButtonText}>Sign In</Text>
						</TouchableOpacity>
					</View>
				</View>
			)}

			{/* Add Listing Modal */}
			<AddListingModal
				visible={showAddModal}
				onClose={() => setShowAddModal(false)}
				userId={user?.id}
			/>

			{/* Sort Modal */}
			<Modal
				visible={showSortModal}
				transparent
				animationType='fade'
				onRequestClose={() => setShowSortModal(false)}>
				<BlurView
					intensity={80}
					tint={isDarkMode ? 'dark' : 'light'}
					style={StyleSheet.absoluteFill}>
					<TouchableOpacity
						style={{
							flex: 1,
							justifyContent: 'center',
							alignItems: 'center',
							padding: 20
						}}
						activeOpacity={1}
						onPress={() => setShowSortModal(false)}>
						<TouchableOpacity
							activeOpacity={1}
							style={{
								backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
								borderRadius: 16,
								padding: 20,
								width: '100%',
								maxWidth: 400
							}}>
							<Text
								style={{
									fontSize: 18,
									fontWeight: 'bold',
									marginBottom: 16,
									color: isDarkMode ? 'white' : 'black'
								}}>
								Sort By
							</Text>

							<TouchableOpacity
								onPress={() => {
									setSortOption('newest')
									setShowSortModal(false)
								}}
								style={{
									padding: 16,
									borderRadius: 12,
									backgroundColor:
										sortOption === 'newest'
											? isDarkMode
												? '#2a2a2a'
												: '#f0f0f0'
											: 'transparent',
									marginBottom: 8
								}}>
								<Text
									style={{
										fontSize: 16,
										color: isDarkMode ? 'white' : 'black',
										fontWeight: sortOption === 'newest' ? 'bold' : 'normal'
									}}>
									Newest First
								</Text>
							</TouchableOpacity>

							<TouchableOpacity
								onPress={() => {
									setSortOption('price_low')
									setShowSortModal(false)
								}}
								style={{
									padding: 16,
									borderRadius: 12,
									backgroundColor:
										sortOption === 'price_low'
											? isDarkMode
												? '#2a2a2a'
												: '#f0f0f0'
											: 'transparent',
									marginBottom: 8
								}}>
								<Text
									style={{
										fontSize: 16,
										color: isDarkMode ? 'white' : 'black',
										fontWeight: sortOption === 'price_low' ? 'bold' : 'normal'
									}}>
									Price: Low to High
								</Text>
							</TouchableOpacity>

							<TouchableOpacity
								onPress={() => {
									setSortOption('price_high')
									setShowSortModal(false)
								}}
								style={{
									padding: 16,
									borderRadius: 12,
									backgroundColor:
										sortOption === 'price_high'
											? isDarkMode
												? '#2a2a2a'
												: '#f0f0f0'
											: 'transparent'
								}}>
								<Text
									style={{
										fontSize: 16,
										color: isDarkMode ? 'white' : 'black',
										fontWeight: sortOption === 'price_high' ? 'bold' : 'normal'
									}}>
									Price: High to Low
								</Text>
							</TouchableOpacity>
						</TouchableOpacity>
					</TouchableOpacity>
				</BlurView>
			</Modal>

			{/* Filter Modal */}
			<Modal
				visible={showFilterModal}
				transparent
				animationType='fade'
				onRequestClose={() => setShowFilterModal(false)}>
				<BlurView
					intensity={80}
					tint={isDarkMode ? 'dark' : 'light'}
					style={StyleSheet.absoluteFill}>
					<TouchableOpacity
						style={{
							flex: 1,
							justifyContent: 'center',
							alignItems: 'center',
							padding: 20
						}}
						activeOpacity={1}
						onPress={() => setShowFilterModal(false)}>
						<TouchableOpacity
							activeOpacity={1}
							style={{
								backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
								borderRadius: 16,
								padding: 20,
								width: '100%',
								maxWidth: 400
							}}>
							<Text
								style={{
									fontSize: 18,
									fontWeight: 'bold',
									marginBottom: 16,
									color: isDarkMode ? 'white' : 'black'
								}}>
								Filter By Type
							</Text>

							<TouchableOpacity
								onPress={() => {
									setFilterType('all')
									setShowFilterModal(false)
								}}
								style={{
									padding: 16,
									borderRadius: 12,
									backgroundColor:
										filterType === 'all'
											? isDarkMode
												? '#2a2a2a'
												: '#f0f0f0'
											: 'transparent',
									marginBottom: 8,
									flexDirection: 'row',
									alignItems: 'center'
								}}>
								<Ionicons 
									name='albums-outline' 
									size={20} 
									color={isDarkMode ? 'white' : 'black'} 
									style={{ marginRight: 12 }}
								/>
								<Text
									style={{
										fontSize: 16,
										color: isDarkMode ? 'white' : 'black',
										fontWeight: filterType === 'all' ? 'bold' : 'normal'
									}}>
									All Listings
								</Text>
							</TouchableOpacity>

							<TouchableOpacity
								onPress={() => {
									setFilterType('vehicle')
									setShowFilterModal(false)
								}}
								style={{
									padding: 16,
									borderRadius: 12,
									backgroundColor:
										filterType === 'vehicle'
											? isDarkMode
												? '#2a2a2a'
												: '#f0f0f0'
											: 'transparent',
									marginBottom: 8,
									flexDirection: 'row',
									alignItems: 'center'
								}}>
								<Ionicons 
									name='car-sport' 
									size={20} 
									color={isDarkMode ? 'white' : 'black'} 
									style={{ marginRight: 12 }}
								/>
								<Text
									style={{
										fontSize: 16,
										color: isDarkMode ? 'white' : 'black',
										fontWeight: filterType === 'vehicle' ? 'bold' : 'normal'
									}}>
									Vehicles Only
								</Text>
							</TouchableOpacity>

							<TouchableOpacity
								onPress={() => {
									setFilterType('plate')
									setShowFilterModal(false)
								}}
								style={{
									padding: 16,
									borderRadius: 12,
									backgroundColor:
										filterType === 'plate'
											? isDarkMode
												? '#2a2a2a'
												: '#f0f0f0'
											: 'transparent',
									flexDirection: 'row',
									alignItems: 'center'
								}}>
								<MaterialCommunityIcons 
									name='card-text-outline' 
									size={20} 
									color={isDarkMode ? 'white' : 'black'} 
									style={{ marginRight: 12 }}
								/>
								<Text
									style={{
										fontSize: 16,
										color: isDarkMode ? 'white' : 'black',
										fontWeight: filterType === 'plate' ? 'bold' : 'normal'
									}}>
									License Plates Only
								</Text>
							</TouchableOpacity>
						</TouchableOpacity>
					</TouchableOpacity>
				</BlurView>
			</Modal>

			{/* CREDIT_DISABLED: Boost Listing Modal
			{selectedCarForBoost && (
				<BoostListingModal
					visible={showBoostModal}
					onClose={() => {
						setShowBoostModal(false);
						setSelectedCarForBoost(null);
					}}
					carId={selectedCarForBoost}
					isDarkMode={isDarkMode}
					onSuccess={() => {
						setShowBoostModal(false);
						setSelectedCarForBoost(null);
						// Refresh listings to show updated boost status
						fetchListings(1, true);
					}}
				/>
			)}
			*/}
		</LinearGradient>
	)
}

const guestStyles = StyleSheet.create({
	overlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		alignItems: 'center',
		zIndex: 1000
	},
	container: {
		width: '80%',
		padding: 24,
		borderRadius: 16,
		backgroundColor: '#D55004',
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.4,
		shadowRadius: 10,
		elevation: 10
	},
	icon: {
		marginBottom: 12
	},
	title: {
		fontSize: 24,
		fontWeight: 'bold',
		color: '#ffffff',
		marginBottom: 12,
		textAlign: 'center'
	},
	subtitle: {
		fontSize: 16,
		color: '#ffffff',
		marginBottom: 20,
		textAlign: 'center'
	},
	signInButton: {
		backgroundColor: '#ffffff',
		paddingVertical: 14,
		paddingHorizontal: 24,
		borderRadius: 12
	},
	signInButtonText: {
		fontSize: 16,
		fontWeight: '700',
		color: '#D55004'
	}
})
