import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
	View,
	FlatList,
	Text,
	ActivityIndicator,
	RefreshControl,
	ListRenderItem,
	StatusBar,
	Platform,
	TouchableOpacity
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/app/(home)/(user)/CarDetailModal'
import CarDetailModalIOS from '../CarDetailModalIOS'
import { useFavorites } from '@/utils/useFavorites'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
const CustomHeader = React.memo(({ title }: { title: string }) => {
	const { isDarkMode } = useTheme()

	return (
		<SafeAreaView
			className={`bg-${isDarkMode ? 'black' : 'white'} border-b border-red`}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View className='flex-row items-center justify-center pt-3'>
				<Text className='text-xl font-semibold text-red'>{title}</Text>
			</View>
		</SafeAreaView>
	)
})

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
					`*, dealerships (name, logo, phone, location, latitude, longitude)`
				)
        .eq('status','available')
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

	const renderModal = useMemo(() => {
		const ModalComponent =
			Platform.OS === 'ios' ? CarDetailModalIOS : CarDetailModal
		return (
			<ModalComponent
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
		)
	}, [isModalVisible, selectedCar, handleFavoritePress, handleViewUpdate])

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
				<Text
					className={`text-xl font-bold ${
						isDarkMode ? 'text-white' : 'text-black'
					} mb-2`}>
					No cars added as favorite
				</Text>
				<Text className='text-base text-gray'>
					Your favorite cars will appear here
				</Text>
			</View>
		),
		[isDarkMode]
	)

	const ErrorMessage = useMemo(
		() => (
			<View className='flex-1 justify-center items-center'>
				<Text
					className={`text-xl font-bold ${
						isDarkMode ? 'text-white' : 'text-black'
					} mb-2`}>
					{error}
				</Text>
				<Text className='text-base text-red'>
					Pull down to refresh and try again
				</Text>
			</View>
		),
		[error, isDarkMode]
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
		<View className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
			<CustomHeader title='Favorites' />
			{renderContent()}
			{renderModal}
		</View>
	)
}
