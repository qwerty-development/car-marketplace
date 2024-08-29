import React, { useEffect, useState, useCallback } from 'react'
import {
	View,
	FlatList,
	Text,
	ActivityIndicator,
	StatusBar,
	TouchableOpacity
} from 'react-native'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/app/(home)/(user)/CarDetailModal'
import { useFavorites } from '@/utils/useFavorites'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'

const CustomHeader = ({ title, onBack }: any) => {
	const { isDarkMode } = useTheme()
	const iconColor = isDarkMode ? '#D55004' : '#FF8C00'

	return (
		<SafeAreaView
			edges={['top']}
			style={{ backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }}>
			<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					paddingBottom: 14,
					paddingHorizontal: 16
				}}>
				<TouchableOpacity onPress={onBack}>
					<Ionicons name='arrow-back' size={24} color={iconColor} />
				</TouchableOpacity>
				<Text
					style={{
						marginLeft: 16,
						fontSize: 18,
						fontWeight: 'bold',
						color: isDarkMode ? '#FFFFFF' : '#000000'
					}}>
					{title}
				</Text>
			</View>
		</SafeAreaView>
	)
}
export default function FavoritesPage() {
	const { isDarkMode } = useTheme()
	const { favorites, toggleFavorite, isFavorite } = useFavorites()
	const [favoriteCars, setFavoriteCars] = useState<any>([])
	const [selectedCar, setSelectedCar] = useState<any>(null)
	const [isModalVisible, setIsModalVisible] = useState<boolean>(false)
	const [isLoading, setIsLoading] = useState<boolean>(true)
	const bgColor = isDarkMode ? 'bg-night' : 'bg-white'
	const textColor = isDarkMode ? 'text-white' : 'text-light-text'

	const EmptyFavorites = () => (
		<View className='flex-1 justify-center items-center'>
			<Text className={`text-xl font-bold ${textColor} mb-2`}>
				No cars added as favorite
			</Text>
			<Text className='text-base text-gray-400'>
				Your favorite cars will appear here
			</Text>
		</View>
	)

	useEffect(() => {
		fetchFavoriteCars()
	}, [favorites])

	const fetchFavoriteCars = async () => {
		setIsLoading(true)
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
          dealerships (name,logo,phone,location,latitude,longitude)
        `
				)
				.in('id', favorites)

			if (error) {
				throw error
			}

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
		} finally {
			setIsLoading(false)
		}
	}

	const handleFavoritePress = useCallback(
		async (carId: number) => {
			const newLikesCount = await toggleFavorite(carId)
			setFavoriteCars((prevCars: any[]) =>
				prevCars
					.map((car: { id: number }) =>
						car.id === carId ? { ...car, likes: newLikesCount } : car
					)
					.filter((car: { id: number }) => isFavorite(car.id))
			)
		},
		[toggleFavorite, isFavorite]
	)

	const handleCarPress = useCallback((car: any) => {
		setSelectedCar(car)
		setIsModalVisible(true)
	}, [])

	const handleViewUpdate = useCallback(
		(carId: number, newViewCount: number) => {
			setFavoriteCars((prevCars: any[]) =>
				prevCars.map((car: { id: number }) =>
					car.id === carId ? { ...car, views: newViewCount } : car
				)
			)
		},
		[]
	)

	const renderCarItem = useCallback(
		({ item }: any) => (
			<CarCard
				car={item}
				onPress={() => handleCarPress(item)}
				onFavoritePress={() => handleFavoritePress(item.id)}
				isFavorite={true}
			/>
		),
		[handleCarPress, handleFavoritePress]
	)

	if (isLoading) {
		return (
			<View className={`flex-1 ${bgColor} justify-center items-center`}>
				<ActivityIndicator
					size='large'
					color={isDarkMode ? '#ffffff' : '#000000'}
				/>
			</View>
		)
	}

	return (
		<View className={`flex-1 ${bgColor}`}>
			<CustomHeader title='Favorites' onBack={() => router.back()} />
			{favoriteCars.length > 0 ? (
				<FlatList
					data={favoriteCars}
					renderItem={renderCarItem}
					keyExtractor={item => item.id.toString()}
					contentContainerStyle={{ paddingBottom: 20 }}
				/>
			) : (
				<EmptyFavorites />
			)}
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
		</View>
	)
}
