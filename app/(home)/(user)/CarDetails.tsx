import React, { useEffect, useState, useCallback } from 'react'
import { View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { supabase } from '@/utils/supabase'
import CarDetailScreen from './CarDetailModalIOS'
import { useFavorites } from '@/utils/useFavorites'

export default function CarDetailsPage() {
  const params = useLocalSearchParams()
  const [car, setCar] = useState<any>(null)
  const { toggleFavorite } = useFavorites()

  const handleFavoritePress = useCallback(
    async (carId: any) => {
      const newLikesCount = await toggleFavorite(carId)
      if (car && car.id === carId) {
        setCar((prev: any) => ({ ...prev, likes: newLikesCount }))
      }
    },
    [car, toggleFavorite]
  )

  useEffect(() => {
    let isMounted = true

    async function fetchCarDetails() {
      if (!params.carId) return

      try {
        const { data, error } = await supabase
          .from('cars')
          .select(
            '*, dealerships (name,logo,phone,location,latitude,longitude)'
          )
          .eq('id', params.carId)
          .single()

        if (error) throw error

        if (data && isMounted) {
          const carWithDealershipInfo = {
            ...data,
            dealership_name: data.dealerships.name,
            dealership_logo: data.dealerships.logo,
            dealership_phone: data.dealerships.phone,
            dealership_location: data.dealerships.location,
            dealership_latitude: data.dealerships.latitude,
            dealership_longitude: data.dealerships.longitude
          }
          setCar(carWithDealershipInfo)
        }
      } catch (error) {
        console.error('Error fetching car details:', error)
      }
    }

    fetchCarDetails()

    return () => {
      isMounted = false
    }
  }, [params.carId])

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <CarDetailScreen
        car={car}
        isDealer={params.isDealerView === 'true'}
        onFavoritePress={handleFavoritePress}
      />
    </View>
  )
}