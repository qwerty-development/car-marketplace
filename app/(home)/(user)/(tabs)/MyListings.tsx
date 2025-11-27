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
	StyleSheet
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { FontAwesome, Ionicons } from '@expo/vector-icons'
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
/* CREDIT_DISABLED: Boost system temporarily disabled
import { BoostListingModal } from '@/components/BoostListingModal'
*/

const ITEMS_PER_PAGE = 10

interface CarListing {
	id: number
	make: string
	model: string
	year: number
	price: number
	images: string[]
	views: number
	likes: number
	status: 'available' | 'pending' | 'sold'
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
}

export default function MyListings() {
	const { isDarkMode } = useTheme()
	const { user } = useAuth()
	const { isGuest, clearGuestMode } = useGuestUser()
	const { t } = useTranslation()
	const [initialLoading, setInitialLoading] = useState(true)
	const [listings, setListings] = useState<CarListing[]>([])
	const [currentPage, setCurrentPage] = useState(1)
	const [isLoading, setIsLoading] = useState(false)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [hasMoreListings, setHasMoreListings] = useState(true)
	const [totalListings, setTotalListings] = useState(0)
	/* CREDIT_DISABLED: Boost state disabled
	const [showBoostModal, setShowBoostModal] = useState(false)
	const [selectedCarForBoost, setSelectedCarForBoost] = useState<number | null>(null)
	*/
	const scrollRef = useRef(null)
	const router = useRouter()

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
				// Build query to fetch user's cars with user data
				let query = supabase
					.from('cars')
					.select('*, users!cars_user_id_fkey(name, id)', { count: 'exact' })
					.eq('user_id', user.id)
					.order('listed_at', { ascending: false })

				// Get count first
				const { count, error: countError } = await query
				if (countError) throw countError

				if (!count) {
					setListings([])
					setCurrentPage(1)
					setHasMoreListings(false)
					setTotalListings(0)
					setIsLoading(false)
					setInitialLoading(false)
					return
				}

				const totalItems = count
				const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)
				const safePageNumber = Math.min(page, totalPages)
				const startRange = (safePageNumber - 1) * ITEMS_PER_PAGE
				const endRange = Math.min(
					safePageNumber * ITEMS_PER_PAGE - 1,
					totalItems - 1
				)

				// Fetch data for current page
				const { data, error } = await query.range(startRange, endRange)
				if (error) throw error

				// Map the data to include seller info
				const mappedData = (data || []).map((item: any) => ({
					...item,
					seller_type: 'user' as const,
					seller_name: item.users?.name || 'Private Seller',
					seller_phone: item.seller_phone || null,
				}))

				const uniqueListings = Array.from(
					new Set(mappedData.map(car => car.id))
				).map(id => mappedData.find(car => car.id === id))

				setListings(prev =>
					refresh ? uniqueListings : [...prev, ...uniqueListings]
				)
				setTotalListings(totalItems)
				setCurrentPage(safePageNumber)
				setHasMoreListings(totalItems > safePageNumber * ITEMS_PER_PAGE)
			} catch (error) {
				console.error('Error fetching listings:', error)
				Alert.alert('Error', 'Failed to fetch listings')
			} finally {
				setIsLoading(false)
				setIsRefreshing(false)
				setInitialLoading(false)
			}
		},
		[user?.id]
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
						flexDirection: 'row',
						alignItems: 'center',
						paddingHorizontal: 16,
						paddingVertical: 16,
						backgroundColor: isDarkMode ? 'black' : 'white'
					}}>
					<Text
						style={{
							fontSize: 24,
							fontWeight: 'bold',
							color: isDarkMode ? 'white' : 'black'
						}}>
						My Listings
					</Text>
					{totalListings > 0 && (
						<View
							style={{
								marginLeft: 'auto',
								backgroundColor: '#D55004',
								paddingHorizontal: 12,
								paddingVertical: 4,
								borderRadius: 12
							}}>
							<Text style={{ color: 'white', fontWeight: 'bold' }}>
								{totalListings}
							</Text>
						</View>
					)}
				</View>

				{/* Add New Car Button */}
				<View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
					<TouchableOpacity
						onPress={() => {
							router.push({
								pathname: '/(home)/(dealer)/AddEditListing',
								params: { userId: user?.id }
							})
						}}
						style={{
							backgroundColor: '#D55004',
							padding: 16,
							borderRadius: 16,
							flexDirection: 'row',
							alignItems: 'center',
							justifyContent: 'center'
						}}>
						<Ionicons name='add-circle-outline' size={24} color='white' />
						<Text
							style={{
								color: 'white',
								fontSize: 16,
								fontWeight: 'bold',
								marginLeft: 8
							}}>
							Add New Car
						</Text>
					</TouchableOpacity>
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
						data={listings}
						renderItem={({ item }) => <ListingCard item={item} />}
						keyExtractor={item => item.id.toString()}
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
									name='car-sport-outline'
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
									No listings yet
								</Text>
								<Text
									style={{
										fontSize: 14,
										color: isDarkMode ? '#888' : '#666',
										textAlign: 'center',
										paddingHorizontal: 32
									}}>
									Tap the button above to list your first car for sale
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
							flexGrow: listings.length === 0 ? 1 : undefined
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
