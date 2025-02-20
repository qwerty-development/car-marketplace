// app/(home)/(user)/CarDetails.tsx
import React, { useEffect, useState, useCallback, Suspense } from 'react'
import { View, ActivityIndicator, Platform,StyleSheet } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { supabase } from '@/utils/supabase'
import { useCarDetails } from '@/hooks/useCarDetails'
import { useFavorites } from '@/utils/useFavorites'
import { useTheme } from '@/utils/ThemeContext'
import CarDetailScreen from './CarDetailModalIOS';


export default function CarDetailsPage() {
	const params = useLocalSearchParams()
	const [car, setCar] = useState<any>(null)
	const { toggleFavorite } = useFavorites()
	const { prefetchCarDetails } = useCarDetails()
    const { isDarkMode } = useTheme()

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

		async function initializeCarDetails() {
			// Try to use prefetched data first
			if (params.prefetchedData) {
				try {
					const prefetchedCar = JSON.parse(params.prefetchedData as string)
					if (isMounted) {
						setCar(prefetchedCar)
						return
					}
				} catch (error) {
					console.error('Error parsing prefetched data:', error)
				}
			}

			// Fallback to fetching if no prefetched data
			if (!params.carId) return

			try {
				const fetchedCar = await prefetchCarDetails(params.carId as string)
				if (isMounted && fetchedCar) {
					setCar(fetchedCar)
				}
			} catch (error) {
				console.error('Error fetching car details:', error)
			}
		}

		initializeCarDetails()

		return () => {
			isMounted = false
		}
	}, [params.carId, params.prefetchedData, prefetchCarDetails])

	   return (
    <View
      style={[
        styles.mainContainer,
        { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }
      ]}
    >
      <Suspense
        fallback={
          <View style={[
            styles.loadingContainer,
            { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }
          ]}>
            <ActivityIndicator size='large' color='#D55004' />
          </View>
        }
      >
        {car && (
          <View style={[
            styles.screenContainer,
            { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }
          ]}>
            <CarDetailScreen
              car={car}
              isDealer={params.isDealerView === 'true'}
              onFavoritePress={handleFavoritePress}
            />
          </View>
        )}
      </Suspense>
    </View>
  )
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    ...Platform.select({
      android: {
        elevation: 0,
      },
    }),
  },
  screenContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})