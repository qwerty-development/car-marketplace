import React, { useEffect, useState } from 'react'
import { View, FlatList, StyleSheet, Text } from 'react-native'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/components/CarDetailModal'
import { useFavorites } from '@/utils/useFavorites'

const EmptyFavorites = () => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyText}>No cars added as favorite</Text>
    <Text style={styles.emptySubText}>Your favorite cars will appear here</Text>
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
      .select('*, dealerships(name)')
      .in('id', favorites)

    if (error) {
      console.error('Error fetching favorite cars:', error)
    } else {
      setFavoriteCars(data || [])
    }
  }

  const handleFavoritePress = async (carId: number) => {
    const newLikesCount = await toggleFavorite(carId)
    setFavoriteCars((prevCars: any[]) =>
      prevCars
        .map((car: { id: number }) =>
          car.id === carId ? { ...car, likes: newLikesCount } : car
        )
        .filter((car: { id: number }) => isFavorite(car.id))
    )
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
      {favoriteCars.length > 0 ? (
        <FlatList
          data={favoriteCars}
          renderItem={renderCarItem}
          keyExtractor={item => item.id.toString()}
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
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
  },
  emptySubText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8
  }
})