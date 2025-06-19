// app/(home)/(user)/CarDetails.tsx
import React, { useEffect, useState, useCallback, Suspense } from 'react'
import { View, ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '@/utils/supabase'
import { useCarDetails } from '@/hooks/useCarDetails'
import { useFavorites } from '@/utils/useFavorites'
import { useTheme } from '@/utils/ThemeContext'
import CarDetailScreen from './CarDetailModal'
import ErrorBoundary from 'react-native-error-boundary'
import { Ionicons } from '@expo/vector-icons'

// Error fallback component for handling component failures gracefully
const ErrorFallback = ({ error, resetError }:any) => (
  <View style={styles.errorContainer}>
    <Ionicons name="alert-circle-outline" size={50} color="#D55004" />
    <Text style={styles.errorTitle}>Something went wrong</Text>
    <Text style={styles.errorMessage}>We're having trouble displaying this car</Text>
    <TouchableOpacity style={styles.resetButton} onPress={resetError}>
      <Text style={styles.resetButtonText}>Try Again</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.backButton}
      onPress={() => router.back()}
    >
      <Text style={styles.backButtonText}>Go Back</Text>
    </TouchableOpacity>
  </View>
);

export default function CarDetailsPage() {
  const params = useLocalSearchParams()
  const [car, setCar] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const { toggleFavorite } = useFavorites()
  const { prefetchCarDetails } = useCarDetails()
  const { isDarkMode } = useTheme()
  const carId = params.carId as string
  const isDealer = params.isDealerView === 'true'

  const handleFavoritePress = useCallback(
    async (carId: any) => {
      if (!carId) return;

      try {
        const newLikesCount = await toggleFavorite(carId)
        if (car && car.id === carId) {
          setCar((prev: any) => ({ ...prev, likes: newLikesCount }))
        }
      } catch (error) {
        console.error('Error toggling favorite:', error)
      }
    },
    [car, toggleFavorite]
  )

  // Handle retry when fetching fails
  const handleRetry = useCallback(() => {
    setLoadError(null)
    setIsLoading(true)
    loadCarDetails()
  }, [carId, params.prefetchedData]) // eslint-disable-line react-hooks/exhaustive-deps

  // Extract car details loading logic to a reusable function
  const loadCarDetails = useCallback(async () => {
    if (!carId && !params.prefetchedData) {
      setLoadError(new Error('No car ID or prefetched data provided'))
      setIsLoading(false)
      return
    }

    try {
      // First attempt to use prefetched data with validation
      if (params.prefetchedData) {
        try {
          const prefetchedData = params.prefetchedData as string
          // Basic validation before parsing
          if (typeof prefetchedData === 'string' && prefetchedData.trim().startsWith('{')) {
            const prefetchedCar = JSON.parse(prefetchedData)

            // Validate that parsed data is usable
            if (prefetchedCar && prefetchedCar.id) {
              setCar(prefetchedCar)
              setIsLoading(false)
              return
            }
          }
        } catch (parseError) {
          console.error('Error parsing prefetched data:', parseError)
          // Continue to fallback fetch below
        }
      }

      // Fallback to fetching if no prefetched data or parsing failed
      if (!carId) {
        throw new Error('No valid car ID available')
      }

      const fetchedCar = await prefetchCarDetails(carId)
      if (!fetchedCar) {
        throw new Error('Car not found')
      }

      setCar(fetchedCar)
      setLoadError(null)
    } catch (error) {
      console.error('Error loading car details:', error)
      setLoadError(error instanceof Error ? error : new Error('Failed to load car details'))
    } finally {
      setIsLoading(false)
    }
  }, [carId, params.prefetchedData, prefetchCarDetails])

  // Load car details on mount
  useEffect(() => {
    let isMounted = true

    const initializeCarDetails = async () => {
      if (!isMounted) return

      setIsLoading(true)
      setLoadError(null)

      try {
        await loadCarDetails()
      } catch (error) {
        if (isMounted) {
          console.error('Unhandled error in car details initialization:', error)
        }
      }
    }

    initializeCarDetails()

    // Add a timeout to prevent indefinite loading
    const loadingTimeout = setTimeout(() => {
      if (isMounted && isLoading) {
        setLoadError(new Error('Loading timeout - please try again'))
        setIsLoading(false)
      }
    }, 15000) // 15 second timeout

    return () => {
      isMounted = false
      clearTimeout(loadingTimeout)
    }
  }, [carId, params.prefetchedData]) // eslint-disable-line react-hooks/exhaustive-deps

  // Render error state with retry option


  return (
    <View
      style={[
        styles.mainContainer,
        { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }
      ]}
    >
      {isLoading ? (
        <View style={[
          styles.loadingContainer,
          { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }
        ]}>
          <ActivityIndicator size="large" color="#D55004" />
          <Text style={{
            marginTop: 16,
            color: isDarkMode ? '#CCCCCC' : '#666666'
          }}>
            Loading car details...
          </Text>
        </View>
      ) : car ? (
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onError={(error) => console.error("CarDetailScreen crashed:", error)}
        >
          <View style={[
            styles.screenContainer,
            { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }
          ]}>
            <CarDetailScreen
              car={car}
              isDealer={isDealer}
              onFavoritePress={handleFavoritePress}
            />
          </View>
        </ErrorBoundary>
      ) : (
        <View style={[
          styles.emptyContainer,
          { backgroundColor: isDarkMode ? '#121212' : '#F7F7F7' }
        ]}>
          <Ionicons name="car-outline" size={60} color={isDarkMode ? '#444444' : '#CCCCCC'} />
          <Text style={{
            marginTop: 16,
            color: isDarkMode ? '#CCCCCC' : '#666666',
            textAlign: 'center'
          }}>
            Car details not available
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      )}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
  },
  errorMessage: {
    marginTop: 10,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#D55004',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  backButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#EEEEEE',
    borderRadius: 8,
  },
  backButtonText: {
    fontWeight: 'bold',
  },
  resetButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#D55004',
    borderRadius: 8,
  },
  resetButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
})