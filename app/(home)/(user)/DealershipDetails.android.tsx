import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Animated,
  Platform,
  Alert,
  TextInput,
  StatusBar,
  Pressable,
  ActivityIndicator,
  AppState
} from 'react-native'
import { router, useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/app/(home)/(user)/CarDetailModal'
import CarDetailModalIOS from './CarDetailModal.ios'
import { useFavorites } from '@/utils/useFavorites'
import { FontAwesome, Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'
import * as Linking from 'expo-linking'
import DealershipAutoClips from '@/components/DealershipAutoClips'
import SortPicker from '@/components/SortPicker'
import ErrorBoundary from 'react-native-error-boundary'

const ITEMS_PER_PAGE = 10

interface FilterState {
  searchQuery: string
  sortOption: string
  priceRange?: [number, number]
  yearRange?: [number, number]
}

// Safe Image component with error handling
const SafeImage = ({ source, style, fallbackColor = '#333' }:any) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <View style={[style, { overflow: 'hidden', backgroundColor: fallbackColor }]}>
      {!hasError ? (
        <Image
          source={source}
          style={[style, { opacity: isLoaded ? 1 : 0.5 }]}
          onError={() => setHasError(true)}
          onLoad={() => setIsLoaded(true)}
          defaultSource={require('@/assets/placeholder.jpg')}
        />
      ) : (
        <View style={[style, { justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="image-outline" size={style.height ? style.height/3 : 40} color="#999" />
        </View>
      )}
    </View>
  );
};

// Error fallback component
const ErrorFallback = ({ error, resetError }:any) => (
  <View style={{
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f8f8'
  }}>
    <Ionicons name="alert-circle-outline" size={50} color="#D55004" />
    <Text style={{
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 20,
      color: '#333'
    }}>
      Something went wrong
    </Text>
    <Text style={{
      marginTop: 10,
      textAlign: 'center',
      color: '#666'
    }}>
      We're having trouble displaying this content
    </Text>
    <TouchableOpacity
      style={{
        marginTop: 20,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#D55004',
        borderRadius: 8
      }}
      onPress={resetError}
    >
      <Text style={{ color: 'white', fontWeight: 'bold' }}>Try Again</Text>
    </TouchableOpacity>
  </View>
);

const CustomHeader = React.memo(
  ({ title, onBack }: { title: string; onBack?: () => void }) => {
    const { isDarkMode } = useTheme();

    return (
      <SafeAreaView style={{
        backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
      }}>
        <StatusBar
          barStyle={isDarkMode ? "light-content" : "dark-content"}
          backgroundColor={isDarkMode ? '#000000' : '#FFFFFF'}
          translucent={true}
        />
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingBottom: 8
        }}>
          {onBack && (
            <TouchableOpacity
              onPress={onBack}
              style={{ padding: 8 }}
            >
              <Ionicons
                name="chevron-back"
                size={28}
                color={isDarkMode ? "#FFFFFF" : "#000000"}
              />
            </TouchableOpacity>
          )}
          <Text style={{
            fontSize: 24,
            fontWeight: 'bold',
            marginLeft: 8,
            color: isDarkMode ? "#FFFFFF" : "#000000"
          }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title || 'Dealership Details'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }
);

interface Dealership {
  id: number
  name: string
  logo: string
  phone: string
  location: string
  longitude: number
  latitude: number
}

interface Car {
  id: number
  make: string
  model: string
  year: number
  price: number
  images: string[]
  description: string
  condition: 'New' | 'Used'
  mileage: number
  color: string
  transmission: 'Manual' | 'Automatic'
  drivetrain: 'FWD' | 'RWD' | 'AWD' | '4WD' | '4x4'
  listed_at: string
  likes: number
  views: number
}

const DealershipMapView = React.memo(({ dealership, isDarkMode }) => {
  // Component state
  const [mapError, setMapError] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isMapVisible, setIsMapVisible] = useState(false);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const [useStaticMap, setUseStaticMap] = useState(false);
  
  // Refs for lifecycle and memory management
  const isMounted = useRef(true);
  const mapRef = useRef(null);
  const timeoutRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // Lifecycle management
  useEffect(() => {
    // Delay map initialization to prevent UI thread blocking
    const visibilityTimeout = setTimeout(() => {
      if (isMounted.current) {
        setIsMapVisible(true);
      }
    }, 800);

    // AppState listener for memory management
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
        // App is going to background, release map resources
        if (mapRef.current && isMounted.current) {
          setMapLoaded(false);
          setIsMapVisible(false);
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      isMounted.current = false;
      clearTimeout(visibilityTimeout);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      subscription.remove();
    };
  }, []);

  // Progressive loading with timeouts and retries
  useEffect(() => {
    if (mapError || mapLoaded || !isMapVisible || useStaticMap) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    timeoutRef.current = setTimeout(() => {
      if (isMounted.current && !mapLoaded) {
        console.log(`Map load attempt ${loadAttempts + 1} timed out`);
        
        if (loadAttempts < 2) {
          // Retry with incremental backoff
          setLoadAttempts(prev => prev + 1);
        } else {
          // After multiple failures, switch to static fallback on Android
          console.log('Multiple map load failures, using fallback');
          setMapError(true);
          setUseStaticMap(Platform.OS === 'android');
        }
      }
    }, 6000 + (loadAttempts * 2000)); // Increasing timeout with backoff

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [mapLoaded, isMapVisible, loadAttempts, mapError, useStaticMap]);

  // Event handlers with safety checks
  const handleMapError = useCallback(() => {
    if (isMounted.current) {
      console.error('Map error event triggered');
      setMapError(true);
    }
  }, []);

  const handleMapReady = useCallback(() => {
    if (isMounted.current) {
      console.log('Map ready event received');
      setMapLoaded(true);
      
      // Clear timeout when map successfully loads
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, []);

  // Validate coordinates before rendering
  const hasValidCoordinates = useMemo(() => {
    try {
      if (!dealership?.latitude || !dealership?.longitude) return false;
      const lat = parseFloat(dealership.latitude);
      const lng = parseFloat(dealership.longitude);
      return !isNaN(lat) && !isNaN(lng) && 
             lat !== 0 && lng !== 0 &&
             Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    } catch (error) {
      console.error('Error validating coordinates:', error);
      return false;
    }
  }, [dealership]);

  // Safe coordinate parsing
  const getCoordinates = useCallback(() => {
    if (!hasValidCoordinates) return { lat: 0, lng: 0 };
    
    try {
      const lat = parseFloat(dealership.latitude);
      const lng = parseFloat(dealership.longitude);
      return { lat, lng };
    } catch {
      return { lat: 0, lng: 0 };
    }
  }, [dealership, hasValidCoordinates]);

  const { lat, lng } = getCoordinates();

  // Maps handling with fallbacks
  const handleOpenMaps = useCallback(() => {
    try {
      if (!hasValidCoordinates) {
        Alert.alert("Error", "Invalid location coordinates");
        return;
      }

      // Platform-specific map opening
      if (Platform.OS === 'android') {
        // Direct intent for Google Maps
        const url = `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(dealership.name || 'Dealership')})`;
        
        Linking.openURL(url).catch(() => {
          // Web fallback if intent fails
          const webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
          Linking.openURL(webUrl).catch(err => {
            console.error('Error opening maps:', err);
            Alert.alert("Error", "Could not open maps application");
          });
        });
      } else {
        // iOS options
        Alert.alert('Open Maps', 'Choose your preferred maps application', [
          {
            text: 'Apple Maps',
            onPress: () => {
              const appleMapsUrl = `maps:0,0?q=${lat},${lng}`;
              Linking.openURL(appleMapsUrl);
            }
          },
          {
            text: 'Google Maps',
            onPress: () => {
              const googleMapsUrl = `comgooglemaps://?q=${lat},${lng}&zoom=14`;
              Linking.openURL(googleMapsUrl).catch(() => {
                // Fallback if Google Maps not installed
                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
              });
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]);
      }
    } catch (error) {
      console.error("Error opening maps:", error);
      Alert.alert("Error", "Unable to open maps at this time");
    }
  }, [lat, lng, hasValidCoordinates, dealership?.name]);

  // Error states and fallbacks
  if (!hasValidCoordinates || mapError) {
    // Static map fallback for Android
    if (useStaticMap && hasValidCoordinates) {
      return (
        <View style={{
          height: 256,
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: isDarkMode ? '#333' : '#f0f0f0'
        }}>
          <Image 
            source={{ 
              uri: `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=14&size=600x400&markers=color:red%7C${lat},${lng}&key=AIzaSyDvW1iMajBuW0mqJHIyNFtDm8A7VkgkAdg` 
            }}
            style={{ width: '100%', height: '100%' }}
            onError={() => {
              if (isMounted.current) {
                setUseStaticMap(false);
                setMapError(true);
              }
            }}
          />
          <TouchableOpacity
            onPress={handleOpenMaps}
            style={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              backgroundColor: '#D55004',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 9999,
              flexDirection: 'row',
              alignItems: 'center',
              elevation: 3
            }}
          >
            <Ionicons name='navigate' size={16} color='white' />
            <Text style={{ color: 'white', marginLeft: 8 }}>Take Me There</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Standard error fallback
    return (
      <View style={{
        height: 256,
        borderRadius: 16,
        backgroundColor: isDarkMode ? '#333' : '#f0f0f0',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Ionicons
          name='map-outline'
          size={48}
          color={isDarkMode ? '#666' : '#999'}
        />
        <Text style={{
          color: isDarkMode ? '#999' : '#666',
          marginTop: 16,
          textAlign: 'center',
          paddingHorizontal: 16,
        }}>
          {mapError ? 'Unable to load map' : 'Location not available'}
        </Text>
        {mapError && loadAttempts > 0 && hasValidCoordinates && (
          <TouchableOpacity
            onPress={() => {
              if (isMounted.current) {
                setMapError(false);
                setIsMapVisible(true);
                setLoadAttempts(prev => prev + 1);
              }
            }}
            style={{
              marginTop: 12,
              padding: 8,
              backgroundColor: '#D55004',
              borderRadius: 8
            }}>
            <Text style={{ color: 'white' }}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Region configuration with safety checks
  const region = {
    latitude: lat,
    longitude: lng,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01
  };

  // Main render with optimizations
  return (
    <View style={{
      height: 256,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: isDarkMode ? '#333' : '#f0f0f0',
    }}>
      {!isMapVisible ? (
        // Loading state
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#D55004" />
          <Text style={{ marginTop: 12, color: isDarkMode ? '#fff' : '#000' }}>
            Preparing map...
          </Text>
        </View>
      ) : (
        <ErrorBoundary FallbackComponent={({ error, resetError }) => (
          <View style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: isDarkMode ? '#333' : '#f0f0f0',
          }}>
            <Ionicons name="warning-outline" size={48} color={isDarkMode ? '#666' : '#999'} />
            <Text style={{
              color: isDarkMode ? '#999' : '#666',
              marginTop: 16,
              textAlign: 'center',
              paddingHorizontal: 16,
            }}>
              Map display error
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (isMounted.current) {
                  resetError();
                  setMapError(false);
                  setLoadAttempts(prev => prev + 1);
                }
              }}
              style={{
                marginTop: 12,
                padding: 8,
                backgroundColor: '#D55004',
                borderRadius: 8
              }}>
              <Text style={{ color: 'white' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={region}
            onMapReady={handleMapReady}
            onError={handleMapError}
            // Performance optimizations
            liteMode={Platform.OS === 'android'}
            minZoomLevel={12}
            maxZoomLevel={16}
            rotateEnabled={false}
            pitchEnabled={false}
            zoomTapEnabled={false}
            moveOnMarkerPress={false}
            scrollEnabled={false}
            showsBuildings={false}
            showsTraffic={false}
            showsIndoors={false}
            showsCompass={false}
            toolbarEnabled={false}
            loadingEnabled={true}
            loadingIndicatorColor="#D55004"
            loadingBackgroundColor={isDarkMode ? "#333" : "#f0f0f0"}
            mapPadding={{ top: 0, right: 0, bottom: 0, left: 0 }}
            cacheEnabled={Platform.OS === 'ios'}
          >
            {mapLoaded && (
              <Marker
                coordinate={{
                  latitude: lat,
                  longitude: lng
                }}
                title={dealership.name || "Dealership"}
                description={dealership.location || ""}
              >
                <View style={{
                  backgroundColor: '#fff',
                  borderRadius: 20,
                  padding: 4,
                  borderWidth: 2,
                  borderColor: '#fff'
                }}>
                  {dealership.logo ? (
                    <Image
                      source={{ uri: dealership.logo }}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16
                      }}
                      defaultSource={require('@/assets/placeholder.jpg')}
                    />
                  ) : (
                    <Ionicons name="business" size={20} color="#D55004" />
                  )}
                </View>
              </Marker>
            )}
          </MapView>

          {mapLoaded && (
            <TouchableOpacity
              onPress={handleOpenMaps}
              style={{
                position: 'absolute',
                bottom: 16,
                right: 16,
                backgroundColor: '#D55004',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 24,
                flexDirection: 'row',
                alignItems: 'center',
                elevation: 3
              }}
            >
              <Ionicons name='navigate' size={16} color='white' />
              <Text style={{ color: 'white', marginLeft: 8 }}>Take Me There</Text>
            </TouchableOpacity>
          )}
        </ErrorBoundary>
      )}
    </View>
  );
});

const DealershipDetails = () => {
  const { isDarkMode } = useTheme();
  const { dealershipId } = useLocalSearchParams<{ dealershipId: string }>();
  const [dealership, setDealership] = useState<Dealership | null>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [isDealershipLoading, setIsDealershipLoading] = useState(true);
  const [isCarsLoading, setIsCarsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { toggleFavorite, isFavorite } = useFavorites();
  const scrollY = new Animated.Value(0);
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    sortOption: ''
  });
  const [filteredCars, setFilteredCars] = useState<Car[]>([]);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [dealershipError, setDealershipError] = useState(false);
  const [carsError, setCarsError] = useState(false);
  const [mapSectionVisible, setMapSectionVisible] = useState(false);
  const [autoclipSectionVisible, setAutoclipSectionVisible] = useState(false);

  // Debounce the search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(filters.searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [filters.searchQuery]);

  // Theme for gradient background
  const bgGradient: [string, string] = isDarkMode
    ? ['#000000', '#1c1c1c']
    : ['#FFFFFF', '#F0F0F0'];

  // Staggered loading of heavy components
  useEffect(() => {
    // Delay loading of map component to prevent blocking UI thread
    const mapTimer = setTimeout(() => {
      setMapSectionVisible(true);
    }, 1000);

    // Delay loading of autoclips to further improve initial loading
    const autoclipTimer = setTimeout(() => {
      setAutoclipSectionVisible(true);
    }, 2000);

    return () => {
      clearTimeout(mapTimer);
      clearTimeout(autoclipTimer);
    };
  }, []);

  // Fetch dealership details with robust error handling
  const fetchDealershipDetails = useCallback(async () => {
    if (!dealershipId) {
      setDealershipError(true);
      setIsDealershipLoading(false);
      return;
    }

    setIsDealershipLoading(true);
    try {
      const { data, error } = await supabase
        .from('dealerships')
        .select('*')
        .eq('id', dealershipId)
        .single();

      if (error) throw error;

      if (!data) {
        console.error('No dealership found with ID:', dealershipId);
        setDealershipError(true);
      } else {
        setDealership(data);
      }
    } catch (error) {
      console.error('Error fetching dealership details:', error);
      setDealershipError(true);
    } finally {
      setIsDealershipLoading(false);
    }
  }, [dealershipId]);

  // Initial load
  useEffect(() => {
    fetchDealershipDetails();
  }, [fetchDealershipDetails]);

  // Fetch cars with enhanced error handling
  const fetchDealershipCars = useCallback(
    async (page = 1, refresh = false, preserveSort = false) => {
      if (!dealershipId) {
        setCarsError(true);
        setIsCarsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const currentSort = preserveSort ? filters.sortOption : '';
      if (refresh) {
        setIsRefreshing(true);
      } else if (!refresh && page === 1) {
        setIsCarsLoading(true);
      }

      try {
        let query = supabase
          .from('cars')
          .select(
            `*, dealerships (name,logo,phone,location,latitude,longitude)`,
            { count: 'exact' }
          )
          .eq('status', 'available')
          .eq('dealership_id', dealershipId);

        // Apply sorting based on filter options
        switch (filters.sortOption) {
          case 'price_asc':
            query = query.order('price', { ascending: true });
            break;
          case 'price_desc':
            query = query.order('price', { ascending: false });
            break;
          case 'year_asc':
            query = query.order('year', { ascending: true });
            break;
          case 'year_desc':
            query = query.order('year', { ascending: false });
            break;
          case 'mileage_asc':
            query = query.order('mileage', { ascending: true });
            break;
          case 'mileage_desc':
            query = query.order('mileage', { ascending: false });
            break;
          default:
            query = query.order('listed_at', { ascending: false });
        }

        // First get the total count
        const { count, error: countError } = await query;

        if (countError) throw countError;

        const totalItems = count || 0;
        const calculatedTotalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        const safePageNumber = Math.min(page, calculatedTotalPages || 1);
        const startRange = (safePageNumber - 1) * ITEMS_PER_PAGE;
        const endRange = Math.min(
          safePageNumber * ITEMS_PER_PAGE - 1,
          Math.max(totalItems - 1, 0)
        );

        // Now fetch the actual data for this page
        const { data, error } = await query.range(startRange, endRange);

        if (error) throw error;

        // Process the data safely with null checks
        const processedCars =
          data?.map(item => ({
            ...item,
            dealership_name: item.dealerships?.name,
            dealership_logo: item.dealerships?.logo,
            dealership_phone: item.dealerships?.phone,
            dealership_location: item.dealerships?.location,
            dealership_latitude: item.dealerships?.latitude,
            dealership_longitude: item.dealerships?.longitude
          })) || [];

        // Update state based on whether this is a fresh load or pagination
        if (safePageNumber === 1 || refresh) {
          setCars(processedCars);
        } else {
          setCars(prevCars => [...prevCars, ...processedCars]);
        }

        setTotalPages(calculatedTotalPages || 1);
        setCurrentPage(safePageNumber);
        setCarsError(false);
      } catch (error) {
        console.error('Error fetching dealership cars:', error);
        setCarsError(true);
      } finally {
        setIsCarsLoading(false);
        setIsRefreshing(false);
      }
    },
    [dealershipId, filters.sortOption]
  );

  // Filter and sort cars client-side
  useEffect(() => {
    try {
      let result = [...cars];

      // Apply search filter if there's a search term
      if (debouncedSearchTerm) {
        const searchTerms = debouncedSearchTerm.toLowerCase().split(' ');
        result = result.filter(car => {
          // Skip invalid cars
          if (!car) return false;

          const searchableFields = [
            car.make,
            car.model,
            car.year?.toString(),
            car.condition,
            car.transmission,
            car.color
          ].filter(Boolean); // Filter out undefined fields

          return searchTerms.every(term =>
            searchableFields.some(field =>
              field && field.toLowerCase().includes(term)
            )
          );
        });
      }

      // Apply local sorting if needed
      if (filters.sortOption && result.length > 0) {
        result.sort((a, b) => {
          try {
            switch (filters.sortOption) {
              case 'price_asc':
                return (a.price || 0) - (b.price || 0);
              case 'price_desc':
                return (b.price || 0) - (a.price || 0);
              case 'year_asc':
                return (a.year || 0) - (b.year || 0);
              case 'year_desc':
                return (b.year || 0) - (a.year || 0);
              case 'mileage_asc':
                return (a.mileage || 0) - (b.mileage || 0);
              case 'mileage_desc':
                return (b.mileage || 0) - (a.mileage || 0);
              default:
                if (a.listed_at && b.listed_at) {
                  return new Date(b.listed_at).getTime() - new Date(a.listed_at).getTime();
                }
                return 0;
            }
          } catch (error) {
            console.error('Error sorting cars:', error);
            return 0;
          }
        });
      }

      setFilteredCars(result);
    } catch (error) {
      console.error('Error filtering/sorting cars:', error);
      // In case of error, just use the original unfiltered list
      setFilteredCars(cars);
    }
  }, [cars, debouncedSearchTerm, filters.sortOption]);

  // Initial cars load
  useEffect(() => {
    // Load car data with slight delay to ensure UI is responsive first
    const timer = setTimeout(() => {
      fetchDealershipCars(1, true);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  // Handle car selection for modal
  const handleCarPress = useCallback((car: Car) => {
    if (!car) return;
    setSelectedCar(car);
    setIsModalVisible(true);
  }, []);

  // Handle favorite toggle
  const handleFavoritePress = useCallback(
    async (carId: number) => {
      try {
        if (!carId) return;
        const newLikesCount = await toggleFavorite(carId);
        setCars(prevCars =>
          prevCars.map(car =>
            car.id === carId ? { ...car, likes: newLikesCount } : car
          )
        );
      } catch (error) {
        console.error('Error toggling favorite:', error);
      }
    },
    [toggleFavorite]
  );

  // Update view count
  const handleViewUpdate = useCallback(
    (carId: number, newViewCount: number) => {
      if (!carId) return;
      setCars(prevCars =>
        prevCars.map(car =>
          car.id === carId ? { ...car, views: newViewCount } : car
        )
      );
    },
    []
  );

  // Load more cars for pagination
  const handleLoadMore = useCallback(() => {
    if (currentPage < totalPages && !isCarsLoading && !carsError) {
      console.log(`Loading more cars, page ${currentPage + 1} of ${totalPages}`);
      fetchDealershipCars(currentPage + 1, false, true);
    }
  }, [currentPage, totalPages, isCarsLoading, carsError, fetchDealershipCars]);

  // Memoize modal component to prevent unnecessary re-renders
  const renderModal = useMemo(() => {
    if (!selectedCar) return null;

    const ModalComponent =
      Platform.OS === 'ios' ? CarDetailModalIOS : CarDetailModal;

    return (
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <ModalComponent
          isVisible={isModalVisible}
          car={selectedCar}
          onClose={() => {
            setIsModalVisible(false);
            // Use a short delay before clearing the selected car to prevent flicker
            setTimeout(() => setSelectedCar(null), 300);
          }}
          onFavoritePress={() =>
            selectedCar && handleFavoritePress(selectedCar.id)
          }
          isFavorite={!!selectedCar && isFavorite(selectedCar.id)}
          onViewUpdate={handleViewUpdate}
          setSelectedCar={setSelectedCar}
          setIsModalVisible={setIsModalVisible}
        />
      </ErrorBoundary>
    );
  }, [
    isModalVisible,
    selectedCar,
    handleFavoritePress,
    isFavorite,
    handleViewUpdate
  ]);

  // Render car card items for the list
  const renderCarItem = useCallback(
    ({ item }: { item: Car }) => {
      // Skip rendering if item is invalid
      if (!item || !item.id) return null;

      return (
        <ErrorBoundary FallbackComponent={() => (
          <View style={{
            height: 200,
            margin: 10,
            backgroundColor: isDarkMode ? '#1c1c1c' : '#f0f0f0',
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Ionicons name="car" size={40} color="#999" />
            <Text style={{ marginTop: 10, color: isDarkMode ? '#999' : '#666' }}>
              Failed to load car
            </Text>
          </View>
        )}>
          <CarCard
            car={item}
            onPress={() => handleCarPress(item)}
            onFavoritePress={() => handleFavoritePress(item.id)}
            isFavorite={isFavorite(item.id)}
          />
        </ErrorBoundary>
      );
    },
    [handleCarPress, handleFavoritePress, isFavorite, isDarkMode]
  );

  // Handle call button press
  const handleCall = useCallback(() => {
    if (!dealership?.phone) {
      Alert.alert('Error', 'Phone number not available');
      return;
    }

    try {
      Linking.openURL(`tel:${dealership.phone}`);
    } catch (error) {
      console.error('Error making call:', error);
      Alert.alert('Error', 'Could not initiate call');
    }
  }, [dealership]);

  // Handle WhatsApp button press
  const handleWhatsApp = useCallback(() => {
    if (!dealership?.phone) {
      Alert.alert('Error', 'Phone number not available');
      return;
    }

    try {
      const whatsappUrl = `https://wa.me/+961${dealership.phone}`;
      Linking.openURL(whatsappUrl).catch(() => {
        Alert.alert('Error', 'Could not open WhatsApp. Please make sure the app is installed.');
      });
    } catch (error) {
      console.error('Error opening WhatsApp:', error);
      Alert.alert('Error', 'Could not open WhatsApp');
    }
  }, [dealership]);

  // Render list header content with dealership info and search
  const renderHeader = useCallback(() => {
    if (isDealershipLoading) {
      return (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#D55004" />
          <Text style={{ marginTop: 16, color: isDarkMode ? 'white' : 'black' }}>
            Loading dealership details...
          </Text>
        </View>
      );
    }

    if (dealershipError || !dealership) {
      return (
        <View style={{
          padding: 20,
          alignItems: 'center',
          backgroundColor: isDarkMode ? '#1A1A1A' : '#F7F7F7',
          margin: 16,
          borderRadius: 12,
        }}>
          <Ionicons name="alert-circle-outline" size={48} color="#D55004" />
          <Text style={{
            marginTop: 16,
            color: isDarkMode ? 'white' : 'black',
            fontWeight: 'bold',
            fontSize: 16
          }}>
            Error Loading Dealership
          </Text>
          <Text style={{
            marginTop: 8,
            color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
            textAlign: 'center'
          }}>
            We couldn't load the dealership details. Please try again later.
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 16,
              backgroundColor: '#D55004',
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 8
            }}
            onPress={fetchDealershipDetails}
          >
            <Text style={{ color: 'white', fontWeight: 'bold' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <>
        <View style={{ marginBottom: 24 }}>
          {/* Dealership Info Card */}
          <View style={{
            paddingHorizontal: 16,
            paddingBottom: 24,
            marginTop: 16,
          }}>
            <View style={{
              backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF',
              borderRadius: 24,
              padding: 20,
              elevation: 4
            }}>
              {/* Logo and Info Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {/* Dealership Logo */}
                <View style={{ position: 'relative' }}>
                  <View style={{
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    borderRadius: 16,
                    padding: 4
                  }}>
                    <SafeImage
                      source={{ uri: dealership.logo }}
                      style={{
                        width: 96,
                        height: 96,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#D55004',
                      }}
                      fallbackColor={isDarkMode ? '#333' : '#e0e0e0'}
                    />
                  </View>
                </View>

                {/* Dealership Information */}
                <View style={{ marginLeft: 16, flex: 1 }}>
                  <Text style={{
                    fontSize: 22,
                    fontWeight: 'bold',
                    color: isDarkMode ? '#FFFFFF' : '#000000'
                  }}
                    numberOfLines={2}
                  >
                    {dealership?.name || 'Unknown Dealership'}
                  </Text>

                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 4,
                    backgroundColor: 'rgba(128,128,128,0.1)',
                    borderRadius: 16,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    alignSelf: 'flex-start'
                  }}>
                    <Ionicons
                      name='location-outline'
                      size={14}
                      color='#D55004'
                    />
                    <Text style={{
                      marginLeft: 4,
                      fontSize: 14,
                      color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'
                    }} numberOfLines={1}>
                      {dealership.location || 'Location not available'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Stats Row */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-around',
                marginTop: 16,
                marginBottom: 8,
                paddingHorizontal: 8
              }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{
                    fontSize: 12,
                    color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)'
                  }}>
                    Available Cars
                  </Text>
                  <Text style={{
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: isDarkMode ? '#FFFFFF' : '#000000'
                  }}>
                    {filteredCars.length}
                  </Text>
                </View>

                <View style={{
                  height: '100%',
                  width: 1,
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'
                }}/>

                <View style={{ alignItems: 'center' }}>
                  <Text style={{
                    fontSize: 12,
                    color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)'
                  }}>
                    Since
                  </Text>
                  <Text style={{
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: isDarkMode ? '#FFFFFF' : '#000000'
                  }}>
                    {dealership.created_at ? new Date(dealership.created_at).getFullYear() : 'N/A'}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: 16
              }}>
                <TouchableOpacity
                  onPress={handleCall}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    paddingVertical: 12,
                    borderRadius: 12,
                    marginRight: 8
                  }}>
                  <View style={{
                    backgroundColor: 'rgba(213,80,4,0.1)',
                    borderRadius: 999,
                    padding: 4
                  }}>
                    <Ionicons name='call-outline' size={18} color='#D55004' />
                  </View>
                  <Text style={{
                    marginLeft: 4,
                    fontWeight: '500',
                    color: isDarkMode ? '#FFFFFF' : '#000000'
                  }}>
                    Call
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleWhatsApp}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#25D366',
                    paddingVertical: 12,
                    borderRadius: 12,
                    marginLeft: 8,
                    elevation: 2
                  }}>
                  <Ionicons name='logo-whatsapp' size={18} color='white' />
                  <Text style={{
                    marginLeft: 4,
                    color: 'white',
                    fontWeight: '500'
                  }}>
                    WhatsApp
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Map View - Conditionally rendered */}
          {mapSectionVisible && (
            <View style={{ paddingHorizontal: 16, marginBottom: 32 }}>
              <DealershipMapView
                dealership={dealership}
                isDarkMode={isDarkMode}
              />
            </View>
          )}

          {/* AutoClips Section - Conditionally rendered */}
          {autoclipSectionVisible && (
            <ErrorBoundary FallbackComponent={() => (
              <View style={{
                padding: 16,
                backgroundColor: isDarkMode ? '#1A1A1A' : '#F7F7F7',
                margin: 16,
                borderRadius: 12,
                alignItems: 'center'
              }}>
                <Ionicons name="videocam-off" size={40} color="#999" />
                <Text style={{
                  marginTop: 8,
                  color: isDarkMode ? '#999' : '#666',
                  textAlign: 'center'
                }}>
                  Could not load autoclips
                </Text>
              </View>
            )}>
              <DealershipAutoClips dealershipId={dealershipId} />
            </ErrorBoundary>
          )}
        </View>

        {/* Search and Sort Section */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
            columnGap: 8,
          }}>
            <View style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: isDarkMode ? '#555' : '#ccc',
              borderRadius: 999,
              paddingHorizontal: 16,
            }}>
              <FontAwesome
                name="search"
                size={20}
                color={isDarkMode ? "white" : "black"}
              />
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                  color: isDarkMode ? 'white' : 'black',
                }}
                placeholder='Search cars...'
                placeholderTextColor={isDarkMode ? '#999999' : '#666666'}
                textAlignVertical="center"
                value={filters.searchQuery}
                onChangeText={text =>
                  setFilters(prev => ({ ...prev, searchQuery: text }))
                }
              />
              {filters.searchQuery ? (
                <TouchableOpacity
                  style={{ padding: 8 }}
                  onPress={() =>
                    setFilters(prev => ({ ...prev, searchQuery: '' }))
                  }>
                  <Ionicons
                    name='close-circle'
                    size={20}
                    color={isDarkMode ? '#FFFFFF' : '#666666'}
                  />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={{ width: 48, height: 48, justifyContent: 'center', alignItems: 'center' }}>
              <SortPicker
                onValueChange={(value: any) => {
                  setFilters(prev => ({ ...prev, sortOption: value }));
                }}
                initialValue={filters.sortOption}
              />
            </View>
          </View>
        </View>

        {/* Available Cars Header */}
        <View style={{
          paddingHorizontal: 24,
          marginBottom: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Text style={{
            fontSize: 20,
            fontWeight: 'bold',
            color: isDarkMode ? '#FFFFFF' : '#000000'
          }}>
            Available Cars
          </Text>
          <Text style={{
            color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'
          }}>
            {filteredCars.length} vehicles
          </Text>
        </View>

        {/* Show loading or error states for cars section */}
        {isCarsLoading && currentPage === 1 && (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#D55004" />
            <Text style={{ marginTop: 16, color: isDarkMode ? 'white' : 'black' }}>
              Loading available cars...
            </Text>
          </View>
        )}

        {carsError && filteredCars.length === 0 && (
          <View style={{
            padding: 20,
            alignItems: 'center',
            margin: 16,
            backgroundColor: isDarkMode ? '#1A1A1A' : '#F7F7F7',
            borderRadius: 12
          }}>
            <Ionicons name="warning-outline" size={48} color="#D55004" />
            <Text style={{
              marginTop: 16,
              color: isDarkMode ? 'white' : 'black',
              fontWeight: 'bold',
              fontSize: 16
            }}>
              Couldn't Load Cars
            </Text>
            <Text style={{
              marginTop: 8,
              color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
              textAlign: 'center'
            }}>
              There was a problem loading the cars for this dealership.
            </Text>
            <TouchableOpacity
              style={{
                marginTop: 16,
                backgroundColor: '#D55004',
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 8
              }}
              onPress={() => fetchDealershipCars(1, true)}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isCarsLoading && !carsError && filteredCars.length === 0 && (
          <View style={{
            padding: 20,
            alignItems: 'center',
            margin: 16,
            backgroundColor: isDarkMode ? '#1A1A1A' : '#F7F7F7',
            borderRadius: 12
          }}>
            <Ionicons name="car-outline" size={48} color="#999" />
            <Text style={{
              marginTop: 16,
              color: isDarkMode ? 'white' : 'black',
              fontWeight: 'bold',
              fontSize: 16
            }}>
              No Cars Available
            </Text>
            <Text style={{
              marginTop: 8,
              color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
              textAlign: 'center'
            }}>
              This dealership doesn't have any cars available at the moment, or none match your search criteria.
            </Text>
          </View>
        )}
      </>
    );
  }, [
    dealership,
    isDarkMode,
    filters,
    filteredCars.length,
    fetchDealershipCars,
    isDealershipLoading,
    dealershipError,
    isCarsLoading,
    carsError,
    mapSectionVisible,
    autoclipSectionVisible,
    handleCall,
    handleWhatsApp,
    dealershipId
  ]);

  // Main render with error boundary
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <LinearGradient colors={bgGradient} style={{ flex: 1 }}>
        {/* Header */}
        <CustomHeader
          title={dealership?.name || 'Dealership Details'}
          onBack={() => router.back()}
        />

        {/* Car List */}
        <Animated.FlatList
          data={filteredCars}
          renderItem={renderCarItem}
          keyExtractor={item => `${item.id}-${item.make}-${item.model}`}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingBottom: 20 }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          windowSize={5} // Optimize memory usage
          maxToRenderPerBatch={5}
          initialNumToRender={5}
          removeClippedSubviews={true}
          ListFooterComponent={
            isCarsLoading && currentPage > 1 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#D55004" />
                <Text style={{ marginTop: 8, color: isDarkMode ? 'white' : 'black' }}>
                  Loading more...
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            !isCarsLoading && !carsError ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: isDarkMode ? 'white' : 'black' }}>
                  No cars available
                </Text>
              </View>
            ) : null
          }
        />

        {/* Car Detail Modal */}
        {renderModal}
      </LinearGradient>
    </ErrorBoundary>
  );
};

export default DealershipDetails;