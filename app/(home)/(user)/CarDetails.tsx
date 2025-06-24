// app/(home)/(user)/CarDetails.tsx
import React, { useEffect, useState, useCallback, Suspense, useRef } from 'react'
import { View, ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, AppState } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useCarDetails } from '@/hooks/useCarDetails'
import { useFavorites } from '@/utils/useFavorites'
import { useTheme } from '@/utils/ThemeContext'
import ErrorBoundary from 'react-native-error-boundary'
import { Ionicons } from '@expo/vector-icons'

// **CRITICAL FIX 1: Enhanced error boundary with better error handling**
const EnhancedErrorBoundary = ({ children, onError }: any) => {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        console.error("Enhanced Error Boundary caught error:", error, errorInfo);
        // Report to crash analytics if available
        onError?.(error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
};

// **CRITICAL FIX 2: Improved lazy loading with fallback**
let CarDetailScreen: React.ComponentType<any> | null = null;

const loadCarDetailScreen = async () => {
  try {
    if (!CarDetailScreen) {
      const module = require('./CarDetailModal');
      CarDetailScreen = module.default;
    }
    return CarDetailScreen;
  } catch (error) {
    console.error('Failed to load CarDetailScreen:', error);
    // Return a fallback component
    return ({ car, onFavoritePress }: any) => (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={50} color="#D55004" />
        <Text style={styles.errorTitle}>Failed to load car details</Text>
        <Text style={styles.errorMessage}>Please try refreshing the page</Text>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={() => router.back()}
        >
          <Text style={styles.resetButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
};

// **CRITICAL FIX 3: Enhanced error fallback component**
const ErrorFallback = ({ error, resetError }: any) => (
  <View style={styles.errorContainer}>
    <Ionicons name="alert-circle-outline" size={50} color="#D55004" />
    <Text style={styles.errorTitle}>Something went wrong</Text>
    <Text style={styles.errorMessage}>
      {error?.message || "We're having trouble displaying this car"}
    </Text>
    <TouchableOpacity style={styles.resetButton} onPress={resetError}>
      <Text style={styles.resetButtonText}>Try Again</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.backButton}
      onPress={() => {
        try {
          router.back();
        } catch (navError) {
          console.error('Navigation error in fallback:', navError);
          router.replace('/(home)/(user)');
        }
      }}
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
  const [componentReady, setComponentReady] = useState(false)
  const { toggleFavorite } = useFavorites()
  const { prefetchCarDetails } = useCarDetails()
  const { isDarkMode } = useTheme()
  const carId = params.carId as string
  const isDealer = params.isDealerView === 'true'
  const [appState, setAppState] = useState(AppState.currentState)

  // **CRITICAL FIX 4: Enhanced refs with proper cleanup tracking**
  const isMountedRef = useRef(true)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dataLoadedRef = useRef(false)
  const componentLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const cleanupExecutedRef = useRef(false)

  // Performance monitoring
  const [loadTimes, setLoadTimes] = useState<{
    start: number;
    dataLoaded?: number;
    renderComplete?: number;
  }>({ start: Date.now() })

  // **CRITICAL FIX 5: Enhanced cleanup function**
  const executeCleanup = useCallback(() => {
    if (cleanupExecutedRef.current) return;
    cleanupExecutedRef.current = true;

    console.log('[CarDetails] Executing cleanup');
    
    isMountedRef.current = false;
    
    // Clear all timeouts
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    
    if (componentLoadTimeoutRef.current) {
      clearTimeout(componentLoadTimeoutRef.current);
      componentLoadTimeoutRef.current = null;
    }
  }, []);

  // **CRITICAL FIX 6: Improved app state handling**
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (isMountedRef.current) {
        setAppState(nextAppState);
      }
    });

    return () => {
      try {
        subscription.remove();
      } catch (error) {
        console.warn('Error removing AppState listener:', error);
      }
    };
  }, []);

  // **CRITICAL FIX 7: Enhanced component unmount cleanup**
  useEffect(() => {
    return () => {
      executeCleanup();
    };
  }, [executeCleanup]);

  // **CRITICAL FIX 8: Safe favorite handling with error boundaries**
  const handleFavoritePress = useCallback(
    async (carId: any) => {
      if (!carId || !isMountedRef.current) return;

      try {
        const newLikesCount = await toggleFavorite(carId);
        if (car && car.id === carId && isMountedRef.current) {
          setCar((prev: any) => ({ ...prev, likes: newLikesCount }));
        }
      } catch (error) {
        console.error('Error toggling favorite:', error);
        // Don't throw - just log the error
      }
    },
    [car, toggleFavorite]
  );

  // **CRITICAL FIX 9: Enhanced retry with proper state reset**
  const handleRetry = useCallback(() => {
    if (!isMountedRef.current) return;

    try {
      setLoadError(null);
      setIsLoading(true);
      setComponentReady(false);
      setLoadTimes({ start: Date.now() });
      dataLoadedRef.current = false;

      // Reset the timeout on retry
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      loadingTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && !dataLoadedRef.current) {
          setLoadError(new Error('Loading timeout - please try again'));
          setIsLoading(false);
        }
      }, 15000);

      loadCarDetails();
    } catch (error) {
      console.error('Error in handleRetry:', error);
      if (isMountedRef.current) {
        setLoadError(new Error('Failed to retry loading'));
        setIsLoading(false);
      }
    }
  }, [carId, params.prefetchedData]);

  // **CRITICAL FIX 10: Enhanced car details loading with better error handling**
  const loadCarDetails = useCallback(async () => {
    if (!isMountedRef.current) return;

    if (!carId && !params.prefetchedData) {
      setLoadError(new Error('No car ID or prefetched data provided'));
      setIsLoading(false);
      return;
    }

    try {
      // First attempt to use prefetched data with enhanced validation
      if (params.prefetchedData) {
        try {
          const prefetchedData = params.prefetchedData as string;
          
          // Enhanced validation
          if (typeof prefetchedData === 'string' && 
              prefetchedData.trim().startsWith('{') && 
              prefetchedData.trim().endsWith('}')) {
            
            const prefetchedCar = JSON.parse(prefetchedData);

            // Validate that parsed data is usable and has required fields
            if (prefetchedCar && 
                prefetchedCar.id && 
                typeof prefetchedCar.id !== 'undefined' &&
                prefetchedCar.make &&
                prefetchedCar.model) {
              
              if (!isMountedRef.current) return;
              
              setCar(prefetchedCar);
              setLoadTimes(prev => ({ ...prev, dataLoaded: Date.now() }));

              // Mark data as loaded and clear the timeout
              dataLoadedRef.current = true;
              if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
                loadingTimeoutRef.current = null;
              }

              setIsLoading(false);
              return;
            }
          }
        } catch (parseError) {
          console.error('Error parsing prefetched data:', parseError);
          // Continue to fallback fetch below
        }
      }

      // Fallback to fetching if no prefetched data or parsing failed
      if (!carId) {
        throw new Error('No valid car ID available');
      }

      const fetchedCar = await prefetchCarDetails(carId);
      if (!fetchedCar) {
        throw new Error('Car not found');
      }

      if (!isMountedRef.current) return;

      setCar(fetchedCar);
      setLoadTimes(prev => ({ ...prev, dataLoaded: Date.now() }));
      setLoadError(null);

      // Mark data as loaded and clear the timeout
      dataLoadedRef.current = true;
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

    } catch (error) {
      if (!isMountedRef.current) return;

      console.error('Error loading car details:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load car details';
      setLoadError(new Error(errorMessage));
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [carId, params.prefetchedData, prefetchCarDetails]);

  // **CRITICAL FIX 11: Enhanced component loading with timeout protection**
  useEffect(() => {
    const loadComponent = async () => {
      if (!isMountedRef.current) return;

      try {
        // Set a timeout for component loading
        componentLoadTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && !componentReady) {
            console.warn('Component loading timeout, setting ready anyway');
            setComponentReady(true);
          }
        }, 5000);

        await loadCarDetailScreen();
        
        if (isMountedRef.current) {
          setComponentReady(true);
          if (componentLoadTimeoutRef.current) {
            clearTimeout(componentLoadTimeoutRef.current);
            componentLoadTimeoutRef.current = null;
          }
        }
      } catch (error) {
        console.error('Error loading component:', error);
        if (isMountedRef.current) {
          setComponentReady(true); // Set ready anyway to show fallback
        }
      }
    };

    loadComponent();
  }, []);

  // **CRITICAL FIX 12: Enhanced initial loading effect**
  useEffect(() => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setLoadError(null);
    setLoadTimes({ start: Date.now() });
    dataLoadedRef.current = false;

    // Start the loading timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }

    loadingTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && !dataLoadedRef.current) {
        console.log('Loading timeout occurred');
        setLoadError(new Error('Loading timeout - please try again'));
        setIsLoading(false);
      }
    }, 15000);

    loadCarDetails();

    // Cleanup function: clear timeout if component unmounts or deps change
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [carId, params.prefetchedData]);

  // **CRITICAL FIX 13: Safe memory optimization**
  useEffect(() => {
    if (appState !== 'active' && car && isMountedRef.current) {
      try {
        // Safely clear unnecessary data when app is in background
        const optimizedCar = { ...car };
        if (optimizedCar.similarCars) optimizedCar.similarCars = [];
        if (optimizedCar.dealerCars) optimizedCar.dealerCars = [];
        setCar(optimizedCar);
      } catch (error) {
        console.warn('Error optimizing memory:', error);
      }
    }
  }, [appState, car]);

  // **CRITICAL FIX 14: Enhanced render with multiple safety checks**
  if (!componentReady) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }]}>
        <ActivityIndicator size="large" color="#D55004" />
        <Text style={{ marginTop: 16, color: isDarkMode ? '#CCCCCC' : '#666666' }}>
          Initializing...
        </Text>
      </View>
    );
  }

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
            onPress={() => {
              try {
                router.back();
              } catch (navError) {
                console.error('Navigation error:', navError);
                router.replace('/(home)/(user)');
              }
            }}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : car ? (
        <EnhancedErrorBoundary
          onError={(error: Error, errorInfo: any) => {
            console.error("CarDetailScreen error:", error, errorInfo);
            // Could report to crash analytics here
          }}
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
              {CarDetailScreen && (
                <CarDetailScreen
                  car={{
                    ...car,
                    fromDeepLink: params.fromDeepLink
                  }}
                  isDealer={isDealer}
                  onFavoritePress={handleFavoritePress}
                />
              )}
            </View>
          </Suspense>
        </EnhancedErrorBoundary>
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
            onPress={() => {
              try {
                router.back();
              } catch (navError) {
                console.error('Navigation error:', navError);
                router.replace('/(home)/(user)');
              }
            }}
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