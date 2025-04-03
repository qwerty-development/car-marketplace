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
  ActivityIndicator
} from 'react-native'
import { router, useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/app/(home)/(dealer)/CarDetailModal'
import CarDetailModalIOS from './CarDetailModal.ios'
import { useFavorites } from '@/utils/useFavorites'
import { FontAwesome, Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView, { Marker } from 'react-native-maps'
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

// Enhanced DealershipMapView with more robust error handling
const DealershipMapView = ({ dealership, isDarkMode }: any) => {
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [isMapVisible, setIsMapVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const mapTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Set a timeout to show map after a delay to ensure UI is responsive
    const timeout = setTimeout(() => {
      setIsMapVisible(true);
    }, 500);

    // Set a timeout to handle cases where map doesn't load properly
    mapTimeout.current = setTimeout(() => {
      if (!isLoaded) {
        setMapError(true);
        console.log('Map loading timed out');
      }
    }, 7000);

    return () => {
      clearTimeout(timeout);
      if (mapTimeout.current) clearTimeout(mapTimeout.current);
    };
  }, []);

  // Safe validation of coordinates
  const hasValidCoordinates = useMemo(() => {
    try {
      if (!dealership?.latitude || !dealership?.longitude) return false;
      const lat = parseFloat(dealership.latitude);
      const lng = parseFloat(dealership.longitude);
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    } catch (error) {
      console.error('Error validating coordinates:', error);
      return false;
    }
  }, [dealership]);

  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
    setIsLoaded(true);
    if (mapTimeout.current) {
      clearTimeout(mapTimeout.current);
      mapTimeout.current = null;
    }
  }, []);

  const handleMapError = useCallback(() => {
    setMapError(true);
    console.error('Map failed to load');
  }, []);

  // If coordinates are invalid or map has error, show placeholder
  if (!hasValidCoordinates || mapError) {
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
      </View>
    );
  }

  // Parse coordinates safely
  let lat = 0, lng = 0;
  try {
    lat = parseFloat(dealership.latitude);
    lng = parseFloat(dealership.longitude);
  } catch (error) {
    console.error('Error parsing coordinates:', error);
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
          Invalid location coordinates
        </Text>
      </View>
    );
  }

  const region = {
    latitude: lat,
    longitude: lng,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01
  };

  // Handle map opening for directions
  const handleOpenMaps = useCallback(() => {
    try {
      const googleMapsUrl = `geo:${lat},${lng}?q=${lat},${lng}`;
      Linking.openURL(googleMapsUrl).catch(() => {
        // Fallback to web URL if native maps doesn't work
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
      });
    } catch (error) {
      console.error('Error opening maps:', error);
      Alert.alert('Error', 'Could not open maps application');
    }
  }, [lat, lng]);

  return (
    <View style={{
      height: 256,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: isDarkMode ? '#333' : '#f0f0f0',
    }}>
      {!isMapVisible ? (
        // Show loading state
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#D55004" />
          <Text style={{ marginTop: 12, color: isDarkMode ? '#fff' : '#000' }}>
            Loading map...
          </Text>
        </View>
      ) : (
        <ErrorBoundary FallbackComponent={({ error }) => (
          <View style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: isDarkMode ? '#333' : '#f0f0f0',
          }}>
            <Ionicons name="warning" size={48} color={isDarkMode ? '#666' : '#999'} />
            <Text style={{
              color: isDarkMode ? '#999' : '#666',
              marginTop: 16,
              textAlign: 'center',
              paddingHorizontal: 16,
            }}>
              Error loading map
            </Text>
          </View>
        )}>
          <MapView
            provider="google"
            style={{ flex: 1 }}
            initialRegion={region}
            onMapReady={handleMapReady}
            onError={handleMapError}
            liteMode={true} // Use lite mode on Android for better performance
          >
            {isMapReady && (
              <Marker
                coordinate={{
                  latitude: lat,
                  longitude: lng
                }}
              >
                <View style={{
                  backgroundColor: '#fff',
                  borderRadius: 20,
                  padding: 4,
                  borderWidth: 2,
                  borderColor: '#fff'
                }}>
                  {dealership.logo ? (
                    <SafeImage
                      source={{ uri: dealership.logo }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20
                      }}
                      fallbackColor="#D55004"
                    />
                  ) : (
                    <Ionicons name="business" size={24} color="#D55004" />
                  )}
                </View>
              </Marker>
            )}
          </MapView>

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
        </ErrorBoundary>
      )}
    </View>
  );
};

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
            isDealer={true}
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