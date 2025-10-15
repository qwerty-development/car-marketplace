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
}

export default function MyListings() {
	const { isDarkMode } = useTheme()
	const { user } = useAuth()
	const { t } = useTranslation()
	const [initialLoading, setInitialLoading] = useState(true)
	const [listings, setListings] = useState<CarListing[]>([])
	const [currentPage, setCurrentPage] = useState(1)
	const [isLoading, setIsLoading] = useState(false)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [hasMoreListings, setHasMoreListings] = useState(true)
	const [totalListings, setTotalListings] = useState(0)
	const scrollRef = useRef(null)
	const router = useRouter()

	useScrollToTop(scrollRef)

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
				// Build query to fetch user's cars
				let query = supabase
					.from('cars')
					.select('*', { count: 'exact' })
					.eq('user_id', user.id)
					.order('listed_at', { ascending: false })

				// Get count first
				const { count, error: countError } = await query
				if (countError) throw countError

				if (!count) {
					setListings([])
					setCurrentPage(1)
					setHasMoreListings(false)
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

				const uniqueListings = Array.from(
					new Set((data || []).map(car => car.id))
				).map(id => (data || []).find(car => car.id === id))

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
							listingId: item.id
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
										value={`${(item.mileage / 1000).toFixed(1)}k`}
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
					<TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
						<Ionicons
							name='arrow-back'
							size={24}
							color={isDarkMode ? '#FFFFFF' : '#000000'}
						/>
					</TouchableOpacity>
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
		</LinearGradient>
	)
}
