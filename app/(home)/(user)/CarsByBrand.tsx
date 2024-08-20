import React, { useState, useEffect } from 'react'
import {
  View,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native'
import { useRouter, useLocalSearchParams, Stack } from 'expo-router'
import CarCard from '@/components/CarCard'
import { supabase } from '@/utils/supabase'
import { useFavorites } from '@/utils/useFavorites'
import { Ionicons } from '@expo/vector-icons'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const TAB_BAR_HEIGHT = 50 // Adjust this based on your actual tab bar height
const CAR_CARD_HEIGHT = SCREEN_HEIGHT - TAB_BAR_HEIGHT

export default function CarsByBrand() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { brand } = params
  const [cars, setCars] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { isFavorite, toggleFavorite } = useFavorites()

  useEffect(() => {
    if (brand) {
      fetchCarsByBrand(brand as string)
    }
  }, [brand])

  const fetchCarsByBrand = async (brand: string) => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('cars')
      .select(`
        *,
        dealerships (name,logo,phone,location)
      `)
      .eq('make', brand)

    if (error) {
      console.error('Error fetching cars by brand:', error)
    } else {
      const carsData = data?.map(item => ({
        ...item,
        dealership_name: item.dealerships.name,
        dealership_logo: item.dealerships.logo,
        dealership_phone: item.dealerships.phone,
        dealership_location: item.dealerships.location
      })) || []
      setCars(carsData)
    }
    setIsLoading(false)
  }

  const handleFavoritePress = async (carId: number) => {
    const newLikesCount = await toggleFavorite(carId)
    setCars(prevCars =>
      prevCars.map(car =>
        car.id === carId ? { ...car, likes: newLikesCount } : car
      )
    )
  }

  const renderCarItem = ({ item }: { item: any }) => (
    <CarCard
      car={item}
      onPress={() => {}} // Add navigation to car detail page if needed
      onFavoritePress={() => handleFavoritePress(item.id)}
      isFavorite={isFavorite(item.id)}
      cardHeight={CAR_CARD_HEIGHT}
    />
  )

  return (
    <View className='flex-1 bg-black'>
      <Stack.Screen
        options={{
          presentation: 'modal',
          headerLeft: () => (
            <TouchableOpacity className='ml-3' onPress={() => router.back()}>
              <Ionicons name='arrow-back'  size={30} color='white' />
            </TouchableOpacity>
          ),
          title: brand ? `${brand} Cars` : 'Cars by Brand',
        }}
      />
      {isLoading ? (
        <ActivityIndicator size="large" color="#D55004" className="flex-1 justify-center items-center" />
      ) : (
        <FlatList
          data={cars}
          renderItem={renderCarItem}
          keyExtractor={item => item.id.toString()}
          showsVerticalScrollIndicator={false}
          snapToAlignment='start'
          decelerationRate='fast'
          snapToInterval={CAR_CARD_HEIGHT}
        />
      )}
    </View>
  )
}