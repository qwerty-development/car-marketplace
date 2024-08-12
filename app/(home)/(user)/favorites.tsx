// app/(home)/favorites.tsx
import React, { useEffect, useState } from 'react'
import { View, FlatList, StyleSheet } from 'react-native'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/components/CarDetailModal'
import { useFavorites } from '@/utils/useFavorites'

export default function FavoritesPage() {
	const { favorites, removeFavorite, isFavorite } = useFavorites()
	const [favoriteCars, setFavoriteCars] = useState<any>([])
	const [selectedCar, setSelectedCar] = useState<any>(null)
	const [isModalVisible, setIsModalVisible] = useState<any>(false)

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
			.select('*, dealerships(name)')
			.in('id', favorites)

		if (error) {
			console.error('Error fetching favorite cars:', error)
		} else {
			setFavoriteCars(data || [])
		}
	}

	const handleFavoritePress = async (carId: number) => {
		await removeFavorite(carId)
	}

	const handleCarPress = (car: any) => {
		setSelectedCar(car)
		setIsModalVisible(true)
	}

	const renderCarItem = ({ item }: any) => (
		<CarCard
			car={item}
			onPress={() => handleCarPress(item)}
			onFavoritePress={() => handleFavoritePress(item.id)}
			isFavorite={true}
		/>
	)

	return (
		<View style={styles.container}>
			<FlatList
				data={favoriteCars}
				renderItem={renderCarItem}
				keyExtractor={item => item.id.toString()}
			/>
			<CarDetailModal
				isVisible={isModalVisible}
				car={selectedCar}
				onClose={() => setIsModalVisible(false)}
				onFavoritePress={() =>
					selectedCar && handleFavoritePress(selectedCar.id)
				}
				isFavorite={true}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 20,
		backgroundColor: '#f5f5f5'
	}
})
