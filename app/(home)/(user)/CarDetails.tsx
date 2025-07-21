// app/(home)/(user)/CarDetails.tsx
import React, { useEffect, useState, useCallback, Suspense, useRef } from 'react'
import { View, ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, AppState } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useCarDetails } from '@/hooks/useCarDetails'
import { useFavorites } from '@/utils/useFavorites'
import { useTheme } from '@/utils/ThemeContext'
import ErrorBoundary from 'react-native-error-boundary'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

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
      onPress={() => router.replace("/(home)/(user)")}
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
  const fromDeepLink = params.fromDeepLink === 'true'
  const [appState, setAppState] = useState(AppState.currentState)

  // Refs to track mounting state and loading timeout
  const isMountedRef = useRef(true)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dataLoadedRef = useRef(false)
  const backNavigationAttemptedRef = useRef(false)

  // Performance monitoring
  const [loadTimes, setLoadTimes] = useState<{
    start: number;
    dataLoaded?: number;
    renderComplete?: number;
  }>({ start: Date.now() })

  // ENHANCED: Back button handler with deep link support and global state coordination
  const handleBackPress = useCallback(() => {
    // Prevent multiple navigation attempts
    if (backNavigationAttemptedRef.current) {
      console.log('[CarDetails] Back navigation already attempted, ignoring');
      return;
    }
    
    backNavigationAttemptedRef.current = true;

    try {
      console.log('[CarDetails] Handling back press, fromDeepLink:', fromDeepLink);
      
      // ENHANCEMENT: Clear any deep link processing state
      if (global.deepLinkProcessing) {
        console.log('[CarDetails] Clearing global deep link processing state');
        global.deepLinkProcessing = false;
      }

      if (fromDeepLink === 'true') {
        console.log('[CarDetails] From deep link, navigating to home');
        // If came from deep link, go to home instead of back
        router.replace("/(home)/(user)");
      } else {
        // Try normal back navigation first
        console.log('[CarDetails] Attempting normal back navigation');
        
        try {
          if (router.canGoBack()) {
            router.back();
            
            // Safety timeout - if we're still here after navigation, force redirect
            setTimeout(() => {
              if (isMountedRef.current) {
                console.log('[CarDetails] Back navigation timeout, forcing home redirect');
                router.replace("/(home)/(user)");
              }
            }, 1000);
          } else {
            // Fallback to home if can't go back
            console.log('[CarDetails] Cannot go back, navigating to home');
            router.replace("/(home)/(user)");
          }
        } catch (navigationError) {
          console.error('[CarDetails] Normal navigation failed:', navigationError);
          // Immediate fallback to home
          router.replace("/(home)/(user)");
        }
      }
    } catch (error) {
      // If any error occurs during navigation, safely redirect to home
      console.error("[CarDetails] Navigation error:", error);
      
      // Emergency fallback with delay
      setTimeout(() => {
        try {
          router.replace("/(home)/(user)");
        } catch (emergencyError) {
          console.error('[CarDetails] Emergency navigation failed:', emergencyError);
          // Last resort - reload the app
          if (Platform.OS === 'web') {
            window.location.reload();
          }
        }
      }, 100);
    }
    
    // Reset the flag after a delay to allow retry if needed
    setTimeout(() => {
      backNavigationAttemptedRef.current = false;
    }, 2000);
  }, [fromDeepLink, router]);

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
      backNavigationAttemptedRef.current = false
      
      // Clear the timeout if component unmounts
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
      
      // ENHANCEMENT: Clear deep link processing state on unmount
      if (global.deepLinkProcessing && fromDeepLink) {
        console.log('[CarDetails] Clearing deep link processing state on unmount');
        global.deepLinkProcessing = false;
      }
    }
  }, [fromDeepLink])

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
    setLoadTimes({ start: Date.now() })
    dataLoadedRef.current = false

    // Reset the timeout on retry
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
    }

    loadingTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && !dataLoadedRef.current) {
        setLoadError(new Error('Loading timeout - please try again'))
        setIsLoading(false)
      }
    }, 15000)

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
              setLoadTimes(prev => ({ ...prev, dataLoaded: Date.now() }))

              // Mark data as loaded and clear the timeout
              dataLoadedRef.current = true
              if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current)
                loadingTimeoutRef.current = null
              }

              setIsLoading(false)
              
              // ENHANCEMENT: Clear deep link processing state after successful load
              if (global.deepLinkProcessing && fromDeepLink) {
                setTimeout(() => {
                  global.deepLinkProcessing = false;
                }, 500);
              }
              
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

      if (!isMountedRef.current) return; // Ensure component is still mounted

      setCar(fetchedCar)
      setLoadTimes(prev => ({ ...prev, dataLoaded: Date.now() }))
      setLoadError(null)

      // Mark data as loaded and clear the timeout
      dataLoadedRef.current = true
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }

      // ENHANCEMENT: Clear deep link processing state after successful load
      if (global.deepLinkProcessing && fromDeepLink) {
        setTimeout(() => {
          global.deepLinkProcessing = false;
        }, 500);
      }

    } catch (error) {
      if (!isMountedRef.current) return; // Ensure component is still mounted

      console.error('Error loading car details:', error)
      setLoadError(error instanceof Error ? error : new Error('Failed to load car details'))
      
      // ENHANCEMENT: Clear deep link processing state on error
      if (global.deepLinkProcessing && fromDeepLink) {
        global.deepLinkProcessing = false;
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [carId, params.prefetchedData, prefetchCarDetails, fromDeepLink])

  // Load car details on mount with proper cleanup and timeout handling
  useEffect(() => {
    setIsLoading(true)
    setLoadError(null)
    setLoadTimes({ start: Date.now() })
    dataLoadedRef.current = false

    // Start the loading timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
    }

    loadingTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && !dataLoadedRef.current) {
        console.log('Loading timeout occurred')
        setLoadError(new Error('Loading timeout - please try again'))
        setIsLoading(false)
        
        // ENHANCEMENT: Clear deep link processing state on timeout
        if (global.deepLinkProcessing && fromDeepLink) {
          global.deepLinkProcessing = false;
        }
      }
    }, 15000) // 15 second timeout

    loadCarDetails()

    // Cleanup function: clear timeout if component unmounts or deps change
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
    }
  }, [carId, params.prefetchedData]) // eslint-disable-line react-hooks/exhaustive-deps

  // Optimize memory usage when app goes to background
  useEffect(() => {
    if (appState !== 'active' && car) {
      // Clear unnecessary data when app is in background
      if (car.similarCars) car.similarCars = [];
      if (car.dealerCars) car.dealerCars = [];
    }
  }, [appState, car]);

  // ENHANCEMENT: Handle browser back button (for web)
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handlePopState = (event: PopStateEvent) => {
        event.preventDefault();
        handleBackPress();
      };

      window.addEventListener('popstate', handlePopState);
      
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [handleBackPress]);

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
          {fromDeepLink && (
            <Text style={{
              marginTop: 8,
              fontSize: 12,
              color: isDarkMode ? '#999999' : '#888888',
              textAlign: 'center'
            }}>
              Opening from link...
            </Text>
          )}
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
            Error Loading Car
          </Text>
          <Text style={{
            marginTop: 10,
            textAlign: 'center',
            marginBottom: 20,
            color: isDarkMode ? '#CCCCCC' : '#666666'
          }}>
            {loadError.message || 'Something went wrong'}
          </Text>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleRetry}
          >
            <Text style={styles.resetButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackPress}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
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
            onPress={handleBackPress}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ENHANCED: Floating back button with better deep link handling */}
      <TouchableOpacity
        onPress={handleBackPress}
        style={styles.floatingBackButton}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        activeOpacity={0.6}
      >
        <Ionicons
          name={fromDeepLink ? "home" : "arrow-back"}
          size={28}
          color="#FFFFFF"
          style={styles.floatingIcon}
        />
      </TouchableOpacity>
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
  // SOLUTION: Minimal Floating Icon - No Container
  floatingBackButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 16,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    // No background, no borders - pure minimal design
  },
  floatingIcon: {
    // Multi-layer shadow system for maximum visibility
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 12,
    // Additional text shadow for Android
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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