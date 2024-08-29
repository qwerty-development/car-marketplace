import React, { useState, useCallback } from 'react'
import { View, FlatList, Text, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import { useFavorites } from '@/utils/useFavorites'
import { useTheme } from '@/utils/ThemeContext'

export default function FavoritesPage() {
	const { isDarkMode } = useTheme()
	const router = useRouter()
	const { favorites, toggleFavorite, isFavorite } = useFavorites()
	const [favoriteCars, setFavoriteCars] = useState<any>([])
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

	const fetchFavoriteCars = useCallback(async () => {
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
	}, [favorites])

	useFocusEffect(
		useCallback(() => {
			fetchFavoriteCars()
		}, [fetchFavoriteCars])
	)

	const handleFavoritePress = useCallback(
		async (carId: number) => {
			await toggleFavorite(carId)
			fetchFavoriteCars()
		},
		[toggleFavorite, fetchFavoriteCars]
	)

	const handleCarPress = useCallback(
		(car: any) => {
			router.push({
				pathname: '/CarDetailModal',
				params: {
					car: JSON.stringify(car),
					isFavorite: 'true'
				}
			})
		},
		[router]
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
		</View>
	)
}
