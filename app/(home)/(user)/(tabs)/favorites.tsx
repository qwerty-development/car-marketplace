import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
	View,
	FlatList,
	Text,
	ActivityIndicator,
	RefreshControl,
	ListRenderItem,
	StatusBar
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/app/(home)/(user)/CarDetailModal'
import { useFavorites } from '@/utils/useFavorites'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
const CustomHeader = ({ title, onBack }: any) => {
	const { isDarkMode } = useTheme()

	return (
		<View
			style={{
				backgroundColor: isDarkMode ? 'black' : 'white',
				borderBottomWidth: 0,
				paddingTop: 10,
				paddingBottom:10,
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
		</View>
	)
}

interface Car {
	id: number
	make: string
	model: string
	likes: number
	views: number
	dealerships: {
		name: string
		logo: string
		phone: string
		location: string
		latitude: number
		longitude: number
	}
}

export default function FavoritesPage() {
	const { isDarkMode } = useTheme()
	const { favorites, toggleFavorite, isFavorite } = useFavorites()
	const [favoriteCars, setFavoriteCars] = useState<Car[]>([])
	const [selectedCar, setSelectedCar] = useState<Car | null>(null)
	const [isModalVisible, setIsModalVisible] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const bgColor = isDarkMode ? 'bg-night' : 'bg-white'
	const textColor = isDarkMode ? 'text-white' : 'text-light-text'

	const fetchFavoriteCars = useCallback(async () => {
		setError(null)
		if (favorites.length === 0) {
			setFavoriteCars([])
			setIsLoading(false)
			return
		}

		try {
			const { data, error } = await supabase
				.from('cars')
				.select(
					`
          *,
          dealerships (name, logo, phone, location, latitude, longitude)
        `
				)
				.in('id', favorites)

			if (error) throw error

			const carsData =
				data?.map(item => ({
					...item,
					dealership_name: item.dealerships.name,
					dealership_logo: item.dealerships.logo,
					dealership_phone: item.dealerships.phone,
					dealership_location: item.dealerships.location,
					dealership_latitude: item.dealerships.latitude,
					dealership_longitude: item.dealerships.longitude
				})) || []

			setFavoriteCars(carsData)
		} catch (error) {
			console.error('Error fetching favorite cars:', error)
			setError('Failed to fetch favorite cars. Please try again.')
		} finally {
			setIsLoading(false)
		}
	}, [favorites])

	useEffect(() => {
		fetchFavoriteCars()
	}, [fetchFavoriteCars])

	const onRefresh = useCallback(async () => {
		setRefreshing(true)
		await fetchFavoriteCars()
		setRefreshing(false)
	}, [fetchFavoriteCars])

	const handleFavoritePress = useCallback(
		async (carId: number) => {
			const newLikesCount = await toggleFavorite(carId)
			setFavoriteCars(prevCars =>
				prevCars
					.map(car =>
						car.id === carId ? { ...car, likes: newLikesCount } : car
					)
					.filter(car => isFavorite(car.id))
			)
		},
		[toggleFavorite, isFavorite]
	)

	const handleCarPress = useCallback((car: Car) => {
		setSelectedCar(car)
		setIsModalVisible(true)
	}, [])

	const handleViewUpdate = useCallback(
		(carId: number, newViewCount: number) => {
			setFavoriteCars(prevCars =>
				prevCars.map(car =>
					car.id === carId ? { ...car, views: newViewCount } : car
				)
			)
		},
		[]
	)

	const renderCarItem: ListRenderItem<Car> = useCallback(
		({ item }) => (
			<CarCard
				car={item}
				onPress={() => handleCarPress(item)}
				onFavoritePress={() => handleFavoritePress(item.id)}
				isFavorite={true}
			/>
		),
		[handleCarPress, handleFavoritePress]
	)

	const keyExtractor = useCallback(
		(item: Car) => `${item.id}-${item.make}-${item.model}`,
		[]
	)

	const EmptyFavorites = useMemo(
		() => (
			<View className='flex-1 justify-center items-center'>
				<Text className={`text-xl font-bold ${textColor} mb-2`}>
					No cars added as favorite
				</Text>
				<Text className='text-base text-gray-400'>
					Your favorite cars will appear here
				</Text>
			</View>
		),
		[textColor]
	)

	const ErrorMessage = useMemo(
		() => (
			<View className='flex-1 justify-center items-center'>
				<Text className={`text-xl font-bold ${textColor} mb-2`}>{error}</Text>
				<Text className='text-base text-gray-400'>
					Pull down to refresh and try again
				</Text>
			</View>
		),
		[error, textColor]
	)

	const renderContent = () => {
		if (isLoading) {
			return (
				<View className='flex-1 justify-center items-center'>
					<ActivityIndicator
						size='large'
						color={isDarkMode ? '#ffffff' : '#000000'}
					/>
				</View>
			)
		}

		if (error) {
			return ErrorMessage
		}

		return (
			<FlatList
				data={favoriteCars}
				renderItem={renderCarItem}
				keyExtractor={keyExtractor}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 50 }}
				ListEmptyComponent={EmptyFavorites}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						tintColor={isDarkMode ? '#ffffff' : '#000000'}
						colors={['#D55004']}
					/>
				}
			/>
		)
	}

	return (
		<SafeAreaView className={`flex-1 ${bgColor}`}>
			<CustomHeader title='Favorites' onBack={() => router.back()} />
			{renderContent()}
			<CarDetailModal
				isVisible={isModalVisible}
				car={selectedCar}
				onClose={() => setIsModalVisible(false)}
				onFavoritePress={() =>
					selectedCar && handleFavoritePress(selectedCar.id)
				}
				isFavorite={true}
				onViewUpdate={handleViewUpdate}
				setSelectedCar={setSelectedCar}
				setIsModalVisible={setIsModalVisible}
			/>
		</SafeAreaView>
	)
}
