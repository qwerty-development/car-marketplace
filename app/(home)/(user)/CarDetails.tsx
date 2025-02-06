// app/(home)/(user)/CarDetails.tsx
import React, { useEffect, useState, useCallback, Suspense } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { supabase } from '@/utils/supabase'
import { useCarDetails } from '@/hooks/useCarDetails'
import { useFavorites } from '@/utils/useFavorites'

// Lazy load the CarDetailScreen component
const CarDetailScreen = React.lazy(() => import('./CarDetailModalIOS'))

export default function CarDetailsPage() {
	const params = useLocalSearchParams()
	const [car, setCar] = useState<any>(null)
	const { toggleFavorite } = useFavorites()
	const { prefetchCarDetails } = useCarDetails()

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
		<View style={{ flex: 1, backgroundColor: 'transparent' }}>
			<Suspense
				fallback={
					<View
						style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
						<ActivityIndicator size='large' color='#D55004' />
					</View>
				}>
				{car && (
					<CarDetailScreen
						car={car}
						isDealer={params.isDealerView === 'true'}
						onFavoritePress={handleFavoritePress}
					/>
				)}
			</Suspense>
		</View>
	)
}
