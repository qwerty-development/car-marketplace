import React, { useEffect, useState, useCallback, Suspense, useRef } from 'react'
import { View, ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, AppState, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useCarDetails } from '@/hooks/useCarDetails'
import { useFavorites } from '@/utils/useFavorites'
import { useTheme } from '@/utils/ThemeContext'
import ErrorBoundary from 'react-native-error-boundary'
import { Ionicons } from '@expo/vector-icons'

// Lazy load the detail screen component to improve initial load time
const CarDetailScreen = React.lazy(() => import('./CarDetailModal'))

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
  const isFromDeepLink = params.fromDeepLink === 'true'
  const [appState, setAppState] = useState(AppState.currentState)

  // Refs to track mounting state and loading timeout
  const isMountedRef = useRef(true)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dataLoadedRef = useRef(false)

  // Performance monitoring
  const [loadTimes, setLoadTimes] = useState<{
    start: number;
    dataLoaded?: number;
    renderComplete?: number;
  }>({ start: Date.now() })

  // Handle app state changes to optimize resource usage
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      setAppState(nextAppState)
    })

    return () => {
      subscription.remove()
    }
  }, [])

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
    }
  }, [])

  // Add validation for deep link scenarios
  useEffect(() => {
    if (isFromDeepLink && !carId && !params.prefetchedData) {
      console.error('Deep link received without carId or prefetchedData')
      setLoadError(new Error('Invalid deep link: Car ID not provided'))
      setIsLoading(false)
    }
  }, [isFromDeepLink, carId, params.prefetchedData])

  // Track deep link usage
  useEffect(() => {
    if (isFromDeepLink && carId) {
      logDeepLinkAccess(carId, 'car_details').catch(console.error);
    }
  }, [isFromDeepLink, carId]);

  // Analytics helper function (implement based on your analytics system)
  const logDeepLinkAccess = async (itemId: string, itemType: string) => {
    try {
      // TODO: Implement your analytics tracking here
      console.log(`Deep link accessed: ${itemType} with ID ${itemId}`);
      // Example: await supabase.from('analytics').insert({...})
    } catch (error) {
      console.error('Failed to log deep link access:', error);
    }
  };

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

  // Handle invalid deep link navigation
  const handleInvalidDeepLink = useCallback(() => {
    if (isFromDeepLink) {
      Alert.alert(
        'Car Not Found',
        'The car you\'re looking for is no longer available.',
        [
          {
            text: 'Browse Cars',
            onPress: () => router.replace('/(home)/(user)'),
          }
        ],
        { cancelable: false }
      );
    }
  }, [isFromDeepLink]);

  // Handle retry when fetching fails
  const handleRetry = useCallback(() => {
    setLoadError(null)
    setIsLoading(true)
    setLoadTimes({ start: Date.now() })
    dataLoadedRef.current = false

    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
    }

    const timeoutDuration = isFromDeepLink ? 10000 : 15000;
    
    loadingTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && !dataLoadedRef.current) {
        setLoadError(new Error(
          isFromDeepLink 
            ? 'Unable to load the requested car. Please try again or browse our catalog.' 
            : 'Loading timeout - please try again'
        ))
        setIsLoading(false)
      }
    }, timeoutDuration)

    loadCarDetails()
  }, [carId, params.prefetchedData, isFromDeepLink]) // eslint-disable-line react-hooks/exhaustive-deps

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
          if (typeof prefetchedData === 'string' && prefetchedData.trim().startsWith('{')) {
            const prefetchedCar = JSON.parse(prefetchedData)

            if (prefetchedCar && prefetchedCar.id) {
              setCar(prefetchedCar)
              setLoadTimes(prev => ({ ...prev, dataLoaded: Date.now() }))

              dataLoadedRef.current = true
              if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current)
                loadingTimeoutRef.current = null
              }

              setIsLoading(false)
              return
            }
          }
        } catch (parseError) {
          console.error('Error parsing prefetched data:', parseError)
        }
      }

      // Fallback to fetching if no prefetched data or parsing failed
      if (!carId) {
        throw new Error('No valid car ID available')
      }

      const fetchedCar = await prefetchCarDetails(carId)
      if (!fetchedCar) {
        if (isFromDeepLink) {
          handleInvalidDeepLink();
          return;
        }
        throw new Error('Car not found')
      }

      if (!isMountedRef.current) return;

      setCar(fetchedCar)
      setLoadTimes(prev => ({ ...prev, dataLoaded: Date.now() }))
      setLoadError(null)

      dataLoadedRef.current = true
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }

    } catch (error) {
      if (!isMountedRef.current) return;

      console.error('Error loading car details:', error)
      setLoadError(error instanceof Error ? error : new Error('Failed to load car details'))
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [carId, params.prefetchedData, prefetchCarDetails, isFromDeepLink, handleInvalidDeepLink])

  // Load car details on mount with proper cleanup and timeout handling
  useEffect(() => {
    setIsLoading(true)
    setLoadError(null)
    setLoadTimes({ start: Date.now() })
    dataLoadedRef.current = false

    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
    }

    // Shorter timeout for deep links to provide faster feedback
    const timeoutDuration = isFromDeepLink ? 10000 : 15000;
    
    loadingTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && !dataLoadedRef.current) {
        console.log('Loading timeout occurred')
        setLoadError(new Error(
          isFromDeepLink 
            ? 'Unable to load the requested car. Please try again or browse our catalog.' 
            : 'Loading timeout - please try again'
        ))
        setIsLoading(false)
      }
    }, timeoutDuration)

    loadCarDetails()

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
    }
  }, [carId, params.prefetchedData, isFromDeepLink]) // eslint-disable-line react-hooks/exhaustive-deps

  // Optimize memory usage when app goes to background
  useEffect(() => {
    if (appState !== 'active' && car) {
      if (car.similarCars) car.similarCars = [];
      if (car.dealerCars) car.dealerCars = [];
    }
  }, [appState, car]);

  // Render with proper loading states and error handling
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
      ) : loadError ? (
        <View style={[
          styles.errorContainer,
          { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }
        ]}>
          <Ionicons name="alert-circle-outline" size={50} color="#D55004" />
          <Text style={{
            fontSize: 18,
            fontWeight: 'bold',
            marginTop: 20,
            color: isDarkMode ? '#FFFFFF' : '#000000'
          }}>
            {isFromDeepLink ? 'Unable to Load Car' : 'Error Loading Car'}
          </Text>
          <Text style={{
            marginTop: 10,
            textAlign: 'center',
            marginBottom: 20,
            color: isDarkMode ? '#CCCCCC' : '#666666'
          }}>
            {isFromDeepLink 
              ? 'The car you requested is no longer available or the link is invalid.' 
              : (loadError.message || 'Something went wrong')}
          </Text>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleRetry}
          >
            <Text style={styles.resetButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (isFromDeepLink) {
                router.replace('/(home)/(user)');
              } else {
                router.back();
              }
            }}
          >
            <Text style={styles.backButtonText}>
              {isFromDeepLink ? 'Go to Home' : 'Go Back'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : car ? (
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onError={(error) => console.error("CarDetailScreen crashed:", error)}
        >
          <Suspense fallback={
            <View style={[styles.loadingContainer, { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }]}>
              <ActivityIndicator size="large" color="#D55004" />
              <Text style={{ marginTop: 16, color: isDarkMode ? '#CCCCCC' : '#666666' }}>
                Preparing car details...
              </Text>
            </View>
          }>
            <View style={[
              styles.screenContainer,
              { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }
            ]}>
              <CarDetailScreen
                car={{
                  ...car,
                  fromDeepLink: params.fromDeepLink
                }}
                isDealer={isDealer}
                onFavoritePress={handleFavoritePress}
              />
            </View>
          </Suspense>
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