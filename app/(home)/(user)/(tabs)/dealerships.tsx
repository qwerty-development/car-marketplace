import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef
} from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  StatusBar,
  Modal,
  StyleSheet,
  Animated,
  Easing,
  TouchableWithoutFeedback,
  Dimensions,
  Platform
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { FontAwesome, Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RefreshControl } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useScrollToTop } from '@react-navigation/native'
import * as Location from 'expo-location'
import { BlurView } from 'expo-blur'

interface Dealership {
  id: number
  name: string
  logo: string
  total_cars?: number
  location?: string
  latitude: number
  longitude: number
  distance?: number
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

const SORT_OPTIONS = {
  AZ: 'a-z',
  ZA: 'z-a',
  RANDOM: 'random',
  NEAREST: 'nearest'
} as const

type SortOption = (typeof SORT_OPTIONS)[keyof typeof SORT_OPTIONS]

// -------------------
// Skeleton Component
// -------------------
const DealershipSkeleton = React.memo(() => (
  <View
    style={[
      skeletonStyles.card,
      {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5
      }
    ]}>
    <LinearGradient colors={['#f0f0f0', '#e0e0e0']} style={skeletonStyles.gradient}>
      <View style={skeletonStyles.row}>
        <View style={skeletonStyles.skeletonCircle} />
        <View style={skeletonStyles.skeletonContent}>
          <View style={skeletonStyles.skeletonLineShort} />
          <View style={skeletonStyles.skeletonLineMedium} />
          <View style={skeletonStyles.skeletonLineLong} />
        </View>
      </View>
    </LinearGradient>
  </View>
))

const skeletonStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden'
  },
  gradient: {
    padding: 16
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  skeletonCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ccc'
  },
  skeletonContent: {
    flex: 1,
    marginLeft: 16
  },
  skeletonLineShort: {
    width: '75%',
    height: 20,
    backgroundColor: '#ccc',
    borderRadius: 8
  },
  skeletonLineMedium: {
    width: '50%',
    height: 16,
    backgroundColor: '#ccc',
    borderRadius: 8,
    marginTop: 8
  },
  skeletonLineLong: {
    width: '60%',
    height: 16,
    backgroundColor: '#ccc',
    borderRadius: 8,
    marginTop: 8
  }
})

// -------------------
// Sort Modal Component
// -------------------
const SortModal = ({
  visible,
  onClose,
  onSelect,
  currentSort,
  isDarkMode
}: any) => {
  const animation = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.timing(animation, {
        toValue: 1,
        duration: 300,
        easing: Easing.bezier(0.33, 1, 0.68, 1),
        useNativeDriver: true
      }).start()
    } else {
      Animated.timing(animation, {
        toValue: 0,
        duration: 200,
        easing: Easing.bezier(0.33, 1, 0.68, 1),
        useNativeDriver: true
      }).start()
    }
  }, [visible, animation])

  const modalTranslateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, 0]
  })

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <BlurView
            intensity={isDarkMode ? 50 : 80}
            tint={isDarkMode ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        </TouchableWithoutFeedback>
        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [{ translateY: modalTranslateY }],
              backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF'
            }
          ]}>
          <View style={styles.modalHeader}>
            <View style={styles.dragIndicator} />
            <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
              Sort Dealerships
            </Text>
          </View>
          {Object.entries(SORT_OPTIONS).map(([key, value]) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.option,
                currentSort === value && styles.selectedOption,
                isDarkMode && styles.optionDark
              ]}
              onPress={() => {
                onSelect(value)
                onClose()
              }}>
              <Text
                style={[
                  styles.optionText,
                  currentSort === value && styles.selectedOptionText,
                  isDarkMode && styles.optionTextDark
                ]}>
                {key}
              </Text>
              {currentSort === value && <View style={styles.checkmark} />}
            </TouchableOpacity>
          ))}
        </Animated.View>
      </View>
    </Modal>
  )
}

// -------------------
// Custom Header Component
// -------------------
const CustomHeader = React.memo(({ title }: { title: string }) => {
  const { isDarkMode } = useTheme()
  const headerTitleMargin = Platform.OS === 'ios' ? '-mb-5' : 'mb-2'
  return (
    <SafeAreaView style={{ backgroundColor: isDarkMode ? 'black' : 'white' }}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={{ flexDirection: 'row', marginLeft: 24, marginBottom: Platform.OS === 'ios' ? -20 : 8 }}>
        <Text
          style={[
            { fontSize: 24, fontWeight: 'bold' },
            { color: isDarkMode ? 'white' : 'black' }
          ]}>
          {title}
        </Text>
      </View>
    </SafeAreaView>
  )
})

// -------------------
// Dealership Card Component
// -------------------
const DealershipCard = React.memo(({ item, onPress, isDarkMode, index }: any) => {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-50)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true
      })
    ]).start()
  }, [fadeAnim, translateY, index])

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY }]
      }}>
      <TouchableOpacity
        style={[
          cardStyles.container,
          { backgroundColor: isDarkMode ? '#222222' : '#FFFFFF' }
        ]}
        onPress={() => onPress(item)}>
        <LinearGradient
          colors={isDarkMode ? ['#000000', '#1A1A1A'] : ['#FFFFFF', '#E0E0E0']}
          style={cardStyles.gradient}>
          <View style={cardStyles.row}>
            <Image
              source={{ uri: item.logo }}
              style={cardStyles.logo}
            />
            <View style={cardStyles.content}>
              <Text style={[cardStyles.name, { color: isDarkMode ? 'white' : 'black' }]}>
                {item.name}
              </Text>
              {item.location && (
                <View style={cardStyles.infoRow}>
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={isDarkMode ? '#CCC' : '#666'}
                  />
                  <Text style={[cardStyles.infoText, { color: isDarkMode ? 'white' : '#444' }]}>
                    {item.location}{' '}
                    {item.distance && `• ${item.distance.toFixed(1)} km away`}
                  </Text>
                </View>
              )}
              {item.total_cars !== undefined && (
                <View style={cardStyles.infoRow}>
                  <Ionicons
                    name="car-outline"
                    size={14}
                    color={isDarkMode ? '#CCC' : '#666'}
                  />
                  <Text style={[cardStyles.infoText, { color: isDarkMode ? 'white' : '#444' }]}>
                    {item.total_cars} vehicles available
                  </Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  )
})

const cardStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5
  },
  gradient: {
    padding: 16
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ccc'
  },
  content: {
    flex: 1,
    marginLeft: 16
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4
  },
  infoText: {
    fontSize: 14,
    marginLeft: 4
  }
})

// -------------------
// Main Dealership List Page
// -------------------
export default function DealershipListPage() {
  const { isDarkMode } = useTheme()
  const [dealerships, setDealerships] = useState<Dealership[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortOption>(SORT_OPTIONS.RANDOM)
  const [showSortModal, setShowSortModal] = useState(false)
  // New state to differentiate initial load vs. later refreshes
  const [hasFetched, setHasFetched] = useState(false)
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null)
  const router = useRouter()
  const scrollRef = useRef(null)
  useScrollToTop(scrollRef)

  // -------------------
  // Location & Distance Helpers
  // -------------------
  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Unable to access location')
        return
      }
      const location = await Location.getCurrentPositionAsync({})
      setUserLocation(location)
    } catch (error) {
      console.error('Error getting location:', error)
    }
  }

  useEffect(() => {
    getUserLocation()
  }, [])

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const R = 6371 // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // -------------------
  // Fetch Dealerships
  // -------------------
  const fetchDealerships = useCallback(async () => {
    // Show skeleton only if we haven't fetched before.
    if (!hasFetched) setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('dealerships')
        .select('*, cars(count)')
      if (error) throw error
      let formattedData =
        data?.map((dealer: any) => ({
          ...dealer,
          total_cars: dealer.cars?.[0]?.count || 0,
          distance: userLocation
            ? calculateDistance(
                userLocation.coords.latitude,
                userLocation.coords.longitude,
                dealer.latitude,
                dealer.longitude
              )
            : undefined
        })) || []
      setDealerships(formattedData)
    } catch (error) {
      console.error('Error fetching dealerships:', error)
      Alert.alert('Error', 'Failed to fetch dealerships')
    } finally {
      if (!hasFetched) setIsLoading(false)
      setHasFetched(true)
    }
  }, [userLocation, hasFetched])

  useEffect(() => {
    fetchDealerships()
  }, [fetchDealerships])

  // -------------------
  // Sorting & Filtering
  // -------------------
  const sortedAndFilteredDealerships = useMemo(() => {
    const filtered = dealerships.filter(dealer =>
      dealer.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    switch (sortBy) {
      case SORT_OPTIONS.AZ:
        return filtered.sort((a, b) => a.name.localeCompare(b.name))
      case SORT_OPTIONS.ZA:
        return filtered.sort((a, b) => b.name.localeCompare(a.name))
      case SORT_OPTIONS.RANDOM:
        return filtered.sort(() => Math.random() - 0.5)
      case SORT_OPTIONS.NEAREST:
        return filtered.sort((a, b) => (a.distance || 0) - (b.distance || 0))
      default:
        return filtered
    }
  }, [dealerships, searchQuery, sortBy])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchDealerships()
    setRefreshing(false)
  }, [fetchDealerships])

  const handleDealershipPress = useCallback(
    (dealership: Dealership) => {
      router.push({
        pathname: '/(home)/(user)/DealershipDetails',
        params: { dealershipId: dealership.id }
      })
    },
    [router]
  )

  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="business-outline"
          size={50}
          color={isDarkMode ? '#FFFFFF' : '#000000'}
        />
        <Text style={[styles.emptyText, { color: isDarkMode ? 'white' : 'black' }]}>
          No dealerships found
        </Text>
        <Text style={[styles.emptySubText, { color: isDarkMode ? '#CCC' : '#555' }]}>
          Try adjusting your search
        </Text>
      </View>
    ),
    [isDarkMode]
  )

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? 'black' : 'white' }}>
      <CustomHeader title="Dealerships" />
      <View style={styles.searchContainer}>
     <View style={styles.searchRow}>
  <FontAwesome
    name="search"
    size={20}
    color={isDarkMode ? 'white' : 'black'}
    style={{ marginLeft: 12, marginRight: 8 }}
  />
  <TextInput
    style={[
      styles.searchInput,
      { color: isDarkMode ? 'white' : 'black' }
    ]}
    placeholder="Search Dealerships..."
    placeholderTextColor={isDarkMode ? 'lightgray' : 'gray'}
    value={searchQuery}
    onChangeText={setSearchQuery}
    textAlignVertical="center"
  />
  <TouchableOpacity
    onPress={() => setShowSortModal(true)}
    style={[
      styles.sortButton,
      { backgroundColor: isDarkMode ? 'black' : 'white', marginLeft: 8 } // Added marginLeft for spacing
    ]}>
    <FontAwesome
      name="sort"
      size={20}
      color={isDarkMode ? 'white' : 'black'}
    />
  </TouchableOpacity>
</View>

      </View>

      {isLoading ? (
        <FlatList
          data={[1, 2, 3, 4, 5]} // 5 skeleton items
          renderItem={() => <DealershipSkeleton />}
          keyExtractor={(item) => `skeleton-${item}`}
          contentContainerStyle={styles.flatListContent}
        />
      ) : (
        <FlatList
          ref={scrollRef}
          data={sortedAndFilteredDealerships}
          renderItem={({ item, index }) => (
            <DealershipCard
              item={item}
              onPress={handleDealershipPress}
              isDarkMode={isDarkMode}
              index={index}
            />
          )}
          keyExtractor={(item) => `${item.id}`}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#D55004']}
              tintColor={isDarkMode ? '#FFFFFF' : '#000000'}
            />
          }
          contentContainerStyle={styles.flatListContent}
        />
      )}

      <SortModal
        visible={showSortModal}
        onClose={() => setShowSortModal(false)}
        onSelect={setSortBy}
        currentSort={sortBy}
        isDarkMode={isDarkMode}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent'
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333'
  },
  modalTitleDark: {
    color: '#FFFFFF'
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8
  },
  optionDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)'
  },
  optionText: {
    fontSize: 16,
    color: '#333333',
    flex: 1
  },
  optionTextDark: {
    color: '#FFFFFF'
  },
  selectedOption: {
    backgroundColor: 'rgba(213, 80, 4, 0.1)'
  },
  selectedOptionText: {
    color: '#D55004',
    fontWeight: '600'
  },
  checkmark: {
    width: 10,
    height: 10,
    backgroundColor: '#D55004',
    borderRadius: 50,
    marginLeft: 8
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8
  },
  searchInput: {
    flex: 1,
    padding: 8
  },
  sortButton: {
    padding: 12,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center'
  },
  flatListContent: {
    paddingVertical: 8,
    flexGrow: 1,
    paddingBottom: Platform.OS === 'android' ? 70 : 64
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20
  },
  emptyText: {
    fontSize: 18,
    marginTop: 12,
    textAlign: 'center'
  },
  emptySubText: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center'
  }
})
