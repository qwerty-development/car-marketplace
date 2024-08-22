import React, { useEffect, useState, useCallback } from 'react'
import { View, FlatList, Text } from 'react-native'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/components/CarDetailModal'
import { useFavorites } from '@/utils/useFavorites'

const EmptyFavorites = () => (
	<View className='flex-1 justify-center items-center'>
		<Text className='text-xl font-bold text-white mb-2'>
			No cars added as favorite
		</Text>
		<Text className='text-base text-gray-400'>
			Your favorite cars will appear here
		</Text>
	</View>
)

export default function FavoritesPage() {
	const { favorites, toggleFavorite, isFavorite } = useFavorites()
	const [favoriteCars, setFavoriteCars] = useState<any>([])
	const [selectedCar, setSelectedCar] = useState<any>(null)
	const [isModalVisible, setIsModalVisible] = useState<boolean>(false)

	useEffect(() => {
		fetchFavoriteCars()
	}, [favorites])

	const fetchFavoriteCars = async () => {
		if (favorites.length === 0) {
			setFavoriteCars([])
			return
		}

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
			console.error('Error fetching favorite cars:', error)
		} else {
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

	return (
		<View className='flex-1 bg-black'>
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
