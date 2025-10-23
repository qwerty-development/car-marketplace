import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef
} from 'react'
import {
  View,
  FlatList,
  Text,
  RefreshControl,
  ListRenderItem,
  StatusBar,
  Platform,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Animated,
  StyleProp,
  ViewStyle
} from 'react-native'
import { router, useRouter } from 'expo-router'
import { supabase } from '@/utils/supabase'
import CarCard from '@/components/CarCard'
import CarDetailModal from '@/app/(home)/(user)/CarDetailModal'
import CarDetailModalIOS from './CarDetailModal.ios'
import { useFavorites } from '@/utils/useFavorites'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FontAwesome, Ionicons } from '@expo/vector-icons'
import SortPicker from '@/components/SortPicker'
import { useScrollToTop } from '@react-navigation/native'
import SkeletonCarCard from '@/components/SkeletonCarCard'
import { BlurView } from 'expo-blur'
import { useGuestUser } from '@/utils/GuestUserContext'
import CompareButton from '@/components/CompareButton'
import { useTranslation } from 'react-i18next'

// -----------------------
// Custom Header Component
// -----------------------
const CustomHeader = React.memo(({
  title,
  onComparePress,
  canCompare,
  isDarkMode,
  onBackPress
}: {
  title: string;
  onComparePress: () => void;
  canCompare: boolean;
  isDarkMode: boolean;
  onBackPress: () => void;
}) => {
  return (
    <SafeAreaView style={{ backgroundColor: isDarkMode ? 'black' : 'white' }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 24,
          marginBottom: Platform.OS === 'ios' ? -20 : 8,
          backgroundColor: 'transparent' // Ensure no background color conflicts
        }}
      >
        <TouchableOpacity onPress={onBackPress} style={{ marginRight: 16 }}>
          <Ionicons
            name='arrow-back'
            size={24}
            color={isDarkMode ? '#FFFFFF' : '#000000'}
          />
        </TouchableOpacity>
        <Text
          style={[
            { fontSize: 24, fontWeight: 'bold', flex: 1 },
            { color: isDarkMode ? 'white' : 'black' }
          ]}
        >
          {title}
        </Text>

        <CompareButton
          onPress={onComparePress}
          enabled={canCompare}
          isDarkMode={isDarkMode}
          inHeader={true}
        />
      </View>
    </SafeAreaView>
  )
});

interface Car {
  id: number
  make: string
  model: string
  year: number
  price: number
  mileage: number
  likes: number
  views: number
  listed_at: string
  status: string
  sold_at?: string
  dealerships: {
    name: string
    logo: string
    phone: string
    location: string
    latitude: number
    longitude: number
  }
}

export default function Favorite() {
  const { t } = useTranslation()
  const { isDarkMode } = useTheme()
  const { favorites, toggleFavorite, isFavorite } = useFavorites()
  const { isGuest, clearGuestMode } = useGuestUser()
  const router = useRouter()
  const [favoriteCars, setFavoriteCars] = useState<Car[]>([])
  const [filteredCars, setFilteredCars] = useState<Car[]>([])
  const [sortedCars, setSortedCars] = useState<Car[]>([])
  const [selectedCar, setSelectedCar] = useState<Car | null>(null)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(true) // For initial load
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState('')
  // Track whether we've fetched at least once to avoid re-skeletonizing on refresh
  const [hasFetched, setHasFetched] = useState(false)
  // New state for tracking if comparison is possible
  const [canCompare, setCanCompare] = useState(false)

  const scrollRef = useRef(null)
  useScrollToTop(scrollRef)

  const fadeAnim = useRef(new Animated.Value(0)).current

  // Handle back navigation
  const handleBack = () => {
    router.back()
  }

  // -----------------------
  // Fetch Favorite Cars
  // -----------------------
  const fetchFavoriteCars = useCallback(async () => {
    setError(null)
    const firstLoad = !hasFetched
    if (firstLoad) {
      setIsLoading(true)
    }
    if (favorites.length === 0) {
      setFavoriteCars([])
      setFilteredCars([])
      setSortedCars([])
      setCanCompare(false) // Ensure comparison is disabled when no favorites
      if (firstLoad) setIsLoading(false)
      setHasFetched(true)
      return
    }
    try {
      // Fetch ALL favorited cars regardless of status to show sold ones with banner
      const { data, error } = await supabase
        .from('cars')
        .select(
          `*, dealerships (name, logo, phone, location, latitude, longitude)`
        )
        .in('id', favorites)
      if (error) throw error

      const carsData =
        data?.map(item => ({
          ...item,
          dealership_name: item.dealerships.name,
          dealership_logo: item.dealerships.logo,
          dealership_phone: item.dealerships.phone,
          dealership_location: item.dealerships.location,
          dealership_latitude: item.dealerships.latitude,
          dealership_longitude: item.dealerships.longitude
        })) || []

      // Filter out cars that have been sold for more than 15 days
      const fifteenDaysAgo = new Date()
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)
      
      const validCars = carsData.filter(car => {
        if (car.status === 'available') return true
        
        // For sold cars, check if sold_at is within 15 days
        if (car.sold_at) {
          const soldDate = new Date(car.sold_at)
          return soldDate > fifteenDaysAgo
        }
        
        // If no sold_at but status is not available, assume recently sold
        return true
      })

      // Sort: available cars first, then sold cars
      const sortedValidCars = validCars.sort((a, b) => {
        if (a.status === 'available' && b.status !== 'available') return -1
        if (a.status !== 'available' && b.status === 'available') return 1
        return 0
      })

      setFavoriteCars(sortedValidCars)
      setFilteredCars(sortedValidCars)

      // Update canCompare state - need at least 2 AVAILABLE cars to compare
      const availableCars = sortedValidCars.filter(car => car.status === 'available')
      setCanCompare(availableCars.length >= 2)

      // Auto-remove favorites that are sold for more than 15 days
      const expiredFavorites = favorites.filter(favId => {
        const car = carsData.find(c => c.id === favId)
        if (!car) return true // Remove if car no longer exists
        
        if (car.status !== 'available' && car.sold_at) {
          const soldDate = new Date(car.sold_at)
          return soldDate <= fifteenDaysAgo
        }
        return false
      })

      // Remove expired favorites from user's favorites list
      if (expiredFavorites.length > 0) {
        console.log('Auto-removing expired sold favorites:', expiredFavorites)
        // This will trigger a re-fetch, so we don't need to update local state
        expiredFavorites.forEach(async (carId) => {
          await toggleFavorite(carId)
        })
      }

    } catch (error) {
      console.error('Error fetching favorite cars:', error)
      setError(t('favorites.failed_fetch_favorites'))
      setCanCompare(false)
    } finally {
      if (firstLoad) setIsLoading(false)
      setHasFetched(true)
    }
  }, [favorites, hasFetched, toggleFavorite])

  useEffect(() => {
    fetchFavoriteCars()
  }, [fetchFavoriteCars])

  // -----------------------
  // Filter by Search Query
  // -----------------------
  useEffect(() => {
    let filtered = favoriteCars
    if (searchQuery) {
      const cleanQuery = searchQuery.trim().toLowerCase()
      filtered = filtered.filter(
        car =>
          car.make.toLowerCase().includes(cleanQuery) ||
          car.model.toLowerCase().includes(cleanQuery) ||
          car.dealerships.name.toLowerCase().includes(cleanQuery)
      )
    }
    setFilteredCars(filtered)
  }, [searchQuery, favoriteCars])

  // -----------------------
  // Apply Sorting
  // -----------------------
  useEffect(() => {
    let sorted = [...filteredCars]
    if (sortOption) {
      switch (sortOption) {
        case 'price_asc':
          sorted.sort((a, b) => a.price - b.price)
          break
        case 'price_desc':
          sorted.sort((a, b) => b.price - a.price)
          break
        case 'year_asc':
          sorted.sort((a, b) => a.year - b.year)
          break
        case 'year_desc':
          sorted.sort((a, b) => b.year - a.year)
          break
        case 'mileage_asc':
          sorted.sort((a, b) => a.mileage - b.mileage)
          break
        case 'mileage_desc':
          sorted.sort((a, b) => b.mileage - a.mileage)
          break
        case 'date_listed_desc':
          sorted.sort(
            (a, b) =>
              new Date(b.listed_at).getTime() -
              new Date(a.listed_at).getTime()
          )
          break
        default:
          break
      }
    }
    setSortedCars(sorted)
  }, [sortOption, filteredCars])

  // -----------------------
  // Refresh Handler
  // -----------------------
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchFavoriteCars()
    setRefreshing(false)
  }, [fetchFavoriteCars])

  // -----------------------
  // Handlers for Favorites & Modal
  // -----------------------
  const handleFavoritePress = useCallback(
    async (carId: number) => {
      const newLikesCount = await toggleFavorite(carId)
      setFavoriteCars(prevCars =>
        prevCars
          .map(car =>
            car.id === carId ? { ...car, likes: newLikesCount } : car
          )
          .filter(car => isFavorite(car.id))
      )
      setFilteredCars(prevCars =>
        prevCars
          .map(car =>
            car.id === carId ? { ...car, likes: newLikesCount } : car
          )
          .filter(car => isFavorite(car.id))
      )
    },
    [toggleFavorite, isFavorite]
  )

  const handleCarPress = useCallback((car: Car) => {
    setSelectedCar(car)
    setIsModalVisible(true)
  }, [])

  const handleViewUpdate = useCallback(
    (carId: number, newViewCount: number) => {
      setFavoriteCars(prevCars =>
        prevCars.map(car =>
          car.id === carId ? { ...car, views: newViewCount } : car
        )
      )
      setFilteredCars(prevCars =>
        prevCars.map(car =>
          car.id === carId ? { ...car, views: newViewCount } : car
        )
      )
    },
    []
  )

  // -----------------------
  // Compare Navigation Handler
  // -----------------------
 const handleComparePress = useCallback(() => {
    router.push('/CarComparison')
  }, [router])


  // -----------------------
  // Modal Rendering (Platform‑specific)
  // -----------------------
  const renderModal = useMemo(() => {
    const ModalComponent =
      Platform.OS === 'ios' ? CarDetailModalIOS : CarDetailModal
    return (
      <ModalComponent
        isVisible={isModalVisible}
        car={selectedCar}
        onClose={() => setIsModalVisible(false)}
        onFavoritePress={() =>
          selectedCar && handleFavoritePress(selectedCar.id)
        }
        isFavorite={true}
        onViewUpdate={handleViewUpdate}
        setSelectedCar={setSelectedCar}
        setIsModalVisible={setIsModalVisible}
      />
    )
  }, [isModalVisible, selectedCar, handleFavoritePress, handleViewUpdate])

  // -----------------------
  // List Rendering
  // -----------------------
  const renderCarItem: ListRenderItem<Car> = useCallback(
    ({ item }) => (
      <CarCard
        car={item}
        onPress={() => handleCarPress(item)}
        onFavoritePress={() => handleFavoritePress(item.id)}
        isFavorite={true}
        showSoldBanner={item.status !== 'available'}
        disableActions={item.status !== 'available'}
      />
    ),
    [handleCarPress, handleFavoritePress]
  )

  const keyExtractor = useCallback(
    (item: Car) => `${item.id}-${item.make}-${item.model}`,
    []
  )

  const EmptyFavorites = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {searchQuery
            ? t('search.no_results')
            : favorites.length > 0
            ? t('favorites.all_favorite_cars_sold')
            : t('favorites.no_cars_added_favorite')}
        </Text>
        {!searchQuery && (
          <Text style={styles.emptySubText}>
            {favorites.length > 0
              ? t('favorites.sold_favorites_removed')
              : t('favorites.favorite_cars_will_appear')}
          </Text>
        )}
      </View>
    ),
    [searchQuery, favorites.length, t]
  )

  const ErrorMessage = useMemo(
    () => (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorSubText}>
          {t('favorites.pull_down_refresh')}
        </Text>
      </View>
    ),
    [error, t]
  )

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isLoading ? 0 : 1,
      duration: 300,
      useNativeDriver: true
    }).start()
  }, [isLoading])

  const renderContent = () => {
    if (isLoading && favoriteCars.length === 0) {
      // Render skeletons only on the very first load
      return Array(3)
        .fill(null)
        .map((_, index) => <SkeletonCarCard key={`skeleton-${index}`} />)
    }
    if (error) {
      return ErrorMessage
    }
    return (
      <Animated.View style={{ opacity: fadeAnim }}>
        <FlatList
          className="mb-32"
          ref={scrollRef}
          data={sortedCars}
          renderItem={renderCarItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: Platform.OS === 'android' ? 150 : 150
          }}
          ListEmptyComponent={EmptyFavorites}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={isDarkMode ? '#ffffff' : '#000000'}
              colors={['#D55004']}
            />
          }
        />
      </Animated.View>
    )
  }

  // -----------------------
  // Handle Sign In for Guest Users
  // -----------------------
  const handleSignIn = async () => {
    await clearGuestMode()
    router.replace('/(auth)/sign-in')
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }}>
      <CustomHeader
        title={t('navbar.favorites')}
        onComparePress={handleComparePress}
        canCompare={canCompare}
        isDarkMode={isDarkMode}
        onBackPress={handleBack}
      />
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={[
              {
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderRadius: 999,
                paddingVertical: 4,
                paddingHorizontal: 8
              },
              { borderColor: isDarkMode ? '#555' : '#ccc' }
            ]}
          >
            <FontAwesome
              name="search"
              size={20}
              color={isDarkMode ? 'white' : 'black'}
              style={{ marginLeft: 12 }}
            />
            <TextInput
              style={[
                { flex: 1, padding: 12, color: isDarkMode ? 'white' : 'black' }
              ]}
              placeholder={t('search.search_placeholder')}
              placeholderTextColor={isDarkMode ? 'lightgray' : 'gray'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              textAlignVertical="center"
            />
          </View>
          <SortPicker
            onValueChange={(value: string) => {
              setSortOption(value)
            }}
            initialValue={sortOption}
            style={{ padding: 12, borderRadius: 999 }}
          />

        </View>
      </View>

      {renderContent()}
      {renderModal}



      {isGuest && (
        <View style={guestStyles.overlay} pointerEvents="auto">
          <BlurView
            intensity={80}
            tint={isDarkMode ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View style={guestStyles.container}>
            <Ionicons
              name="lock-closed-outline"
              size={56}
              color="#ffffff"
              style={guestStyles.icon}
            />
            <Text style={guestStyles.title}>{t('favorites.browsing_as_guest')}</Text>
            <Text style={guestStyles.subtitle}>
              {t('favorites.sign_in_access_feature')}
            </Text>
            <TouchableOpacity style={guestStyles.signInButton} onPress={handleSignIn}>
              <Text style={guestStyles.signInButtonText}>{t('favorites.sign_in')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

// Common guest styles – can be placed in a separate file for reuse
const guestStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // semi-transparent overlay
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    width: '80%',
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#D55004', // unified orange background
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  icon: {
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  signInButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D55004',
  },
});

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8
  },
  emptySubText: {
    fontSize: 16,
    color: '#666666'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8
  },
  errorSubText: {
    fontSize: 16,
    color: '#FF0000'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  container: {
    flex: 1
  },
  darkContainer: {
    backgroundColor: '#000000'
  },
  searchContainer: {
    padding: 10
  },
  scrollTopButton: {
    position: 'absolute',
    right: 20,
    bottom: 70,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  iconButton: {
    borderRadius: 20,
    backgroundColor: '#000000'
  },
  darkIconButton: {
    backgroundColor: '#ffffff'
  },
  sortPickerContainer: {
    marginLeft: 10
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20
  },
  darkSearchBar: {
    borderColor: '#555'
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    color: 'black'
  },
  darkSearchInput: {
    color: 'white'
  },
  clearButton: {
    padding: 10
  },
  darkEmptyText: {
    color: '#fff'
  },
  resetButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#D55004',
    borderRadius: 5
  },
  resetButtonText: {
    color: 'white',
    fontWeight: 'bold'
  },
  favoriteButton: {
    padding: 12,
    borderRadius: 20,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
})