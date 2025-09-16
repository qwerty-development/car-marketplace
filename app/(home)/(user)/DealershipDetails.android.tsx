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
  ActivityIndicator,
  AppState,
  Pressable,
  Keyboard,
  InteractionManager,
  PixelRatio,
  Dimensions
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
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
import { useTranslation } from 'react-i18next'
import { I18nManager } from 'react-native'

// **ANDROID OPTIMIZATION CONSTANTS**
const ITEMS_PER_PAGE = 10
const SEARCH_DEBOUNCE_MS = 400
const MIN_SEARCH_LENGTH = 2
const MAP_LOAD_DELAY = 1200
const AUTOCLIPS_LOAD_DELAY = 2000
const COMPONENT_MOUNT_DELAY = 300
const ANDROID_PERFORMANCE_MODE = Platform.OS === 'android'

// **DEVICE PERFORMANCE DETECTION**
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const PIXEL_DENSITY = PixelRatio.get()
const IS_LOW_END_DEVICE = PIXEL_DENSITY < 2 || SCREEN_WIDTH < 400

// **TYPE DEFINITIONS**
interface FilterState {
  searchQuery: string
  sortOption: string
  priceRange?: [number, number]
  yearRange?: [number, number]
}

interface Dealership {
  id: number
  name: string
  logo: string
  phone: string
  location: string
  longitude: number
  latitude: number
  created_at?: string
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
  dealership_name?: string
  dealership_logo?: string
  dealership_phone?: string
  dealership_location?: string
}

interface LoadingState {
  dealership: boolean
  cars: boolean
  search: boolean
  refresh: boolean
}

interface ComponentVisibilityState {
  map: boolean
  autoClips: boolean
  initialized: boolean
}

// **OPTIMIZED SAFE IMAGE COMPONENT - ANDROID SPECIFIC**
const SafeImage = React.memo(({ source, style, fallbackColor = '#333', testID }: any) => {
  const [hasError, setHasError] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const isMounted = useRef(true)

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  const handleError = useCallback(() => {
    if (isMounted.current) {
      setHasError(true)
      setIsLoaded(false)
    }
  }, [])

  const handleLoad = useCallback(() => {
    if (isMounted.current) {
      setIsLoaded(true)
    }
  }, [])

  if (hasError) {
    return (
      <View style={[style, {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: fallbackColor
      }]}>
        <Ionicons
          name="image-outline"
          size={Math.min(style.width || 40, style.height || 40) / 2}
          color="#999"
        />
      </View>
    )
  }

  return (
    <View style={[style, { overflow: 'hidden', backgroundColor: fallbackColor }]}>
      <Image
        source={source}
        style={[style, { opacity: isLoaded ? 1 : 0.7 }]}
        onError={handleError}
        onLoad={handleLoad}
        testID={testID}
        // Android-specific optimizations
        resizeMode="cover"
        fadeDuration={ANDROID_PERFORMANCE_MODE ? 100 : 300}
      />
      {!isLoaded && !hasError && (
        <View style={[style, {
          position: 'absolute',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'transparent'
        }]}>
          <ActivityIndicator size="small" color="#D55004" />
        </View>
      )}
    </View>
  )
})

// **ADVANCED SEARCH COMPONENT - ANDROID OPTIMIZED**
const AdvancedSearchBar = React.memo(({
  onSearch,
  onClear,
  isSearching,
  isDarkMode
}: {
  onSearch: (query: string) => void
  onClear: () => void
  isSearching: boolean
  isDarkMode: boolean
}) => {
  const [localQuery, setLocalQuery] = useState('')
  const [isInputFocused, setIsInputFocused] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  const inputRef = useRef<TextInput>(null)

  // **DEBOUNCED AUTO-SEARCH**
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (localQuery.trim().length >= MIN_SEARCH_LENGTH) {
        onSearch(localQuery.trim())
      } else if (localQuery.trim().length === 0) {
        onClear()
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [localQuery, onSearch, onClear])

  const handleManualSearch = useCallback(() => {
    Keyboard.dismiss()
    if (localQuery.trim().length >= MIN_SEARCH_LENGTH) {
      onSearch(localQuery.trim())
    } else if (localQuery.trim().length === 0) {
      onClear()
    } else {
      Alert.alert('Search', `Please enter at least ${MIN_SEARCH_LENGTH} characters`)
    }
  }, [localQuery, onSearch, onClear])

  const handleClear = useCallback(() => {
    setLocalQuery('')
    onClear()
    inputRef.current?.focus()
  }, [onClear])

  const handleFocus = useCallback(() => {
    setIsInputFocused(true)
  }, [])

  const handleBlur = useCallback(() => {
    setIsInputFocused(false)
  }, [])

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      paddingHorizontal: 4
    }}>
      {/* **SEARCH INPUT CONTAINER** */}
      <View style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: isInputFocused ? 2 : 1,
        borderColor: isInputFocused ? '#D55004' : (isDarkMode ? '#555' : '#ccc'),
        borderRadius: 999,
        paddingHorizontal: 16,
        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
        elevation: isInputFocused ? 2 : 0
      }}>
        <FontAwesome
          name="search"
          size={18}
          color={isInputFocused ? '#D55004' : (isDarkMode ? "white" : "black")}
        />

        <TextInput
          ref={inputRef}
          style={{
            flex: 1,
            paddingVertical: 14,
            paddingHorizontal: 12,
            color: isDarkMode ? 'white' : 'black',
            fontSize: 16
          }}
          placeholder={`Search cars... (min ${MIN_SEARCH_LENGTH} chars)`}
          placeholderTextColor={isDarkMode ? '#999999' : '#666666'}
          value={localQuery}
          onChangeText={setLocalQuery}
          onSubmitEditing={handleManualSearch}
          onFocus={handleFocus}
          onBlur={handleBlur}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          editable={!isSearching}
          textAlignVertical="center"
          // Android-specific optimizations
          underlineColorAndroid="transparent"
          selectTextOnFocus={true}
          blurOnSubmit={true}
        />

        {/* **SEARCH ACTIONS** */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {isSearching && (
            <ActivityIndicator
              size="small"
              color="#D55004"
              style={{ marginRight: 8 }}
            />
          )}

          {localQuery.length > 0 && (
            <TouchableOpacity
              onPress={handleClear}
              disabled={isSearching}
              style={{
                padding: 4,
                marginRight: 4
              }}
            >
              <Ionicons
                name='close-circle'
                size={20}
                color={isDarkMode ? '#FFFFFF' : '#666666'}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* **MANUAL SEARCH BUTTON** */}
      <TouchableOpacity
        onPress={handleManualSearch}
        disabled={isSearching || localQuery.trim().length < MIN_SEARCH_LENGTH}
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: (isSearching || localQuery.trim().length < MIN_SEARCH_LENGTH)
            ? (isDarkMode ? '#333' : '#e0e0e0')
            : '#D55004',
          marginLeft: 8,
          elevation: isSearching ? 0 : 2
        }}
      >
        {isSearching ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Ionicons
            name="search"
            size={20}
            color="white"
          />
        )}
      </TouchableOpacity>
    </View>
  )
})

// **PERFORMANCE-OPTIMIZED MAP COMPONENT - ANDROID SPECIFIC**
const AndroidOptimizedMapView = React.memo(({ dealership, isDarkMode }: any) => {
  const [mapState, setMapState] = useState({
    error: false,
    loaded: false,
    visible: false,
    attempts: 0,
    useStaticFallback: false
  })

  const isMounted = useRef(true)
  const mapRef = useRef<MapView>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()
  const appStateRef = useRef(AppState.currentState)

  // **COORDINATES VALIDATION**
  const coordinates = useMemo(() => {
    try {
      if (!dealership?.latitude || !dealership?.longitude) return null

      const lat = parseFloat(dealership.latitude)
      const lng = parseFloat(dealership.longitude)

      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null

      return { lat, lng }
    } catch {
      return null
    }
  }, [dealership])

  // **LIFECYCLE MANAGEMENT**
  useEffect(() => {
    // **DELAYED MAP INITIALIZATION FOR ANDROID PERFORMANCE**
    const initTimeout = setTimeout(() => {
      if (isMounted.current && coordinates) {
        setMapState(prev => ({ ...prev, visible: true }))
      }
    }, IS_LOW_END_DEVICE ? MAP_LOAD_DELAY * 1.5 : MAP_LOAD_DELAY)

    // **APP STATE MONITORING FOR MEMORY MANAGEMENT**
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
        // **RELEASE MAP RESOURCES ON BACKGROUND**
        if (isMounted.current) {
          setMapState(prev => ({ ...prev, loaded: false }))
        }
      }
      appStateRef.current = nextAppState
    })

    return () => {
      isMounted.current = false
      clearTimeout(initTimeout)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      subscription.remove()
    }
  }, [coordinates])

  // **MAP LOADING TIMEOUT WITH PROGRESSIVE FALLBACK**
  useEffect(() => {
    if (!mapState.visible || mapState.loaded || mapState.error) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      return
    }

    timeoutRef.current = setTimeout(() => {
      if (isMounted.current && !mapState.loaded) {
        if (mapState.attempts < 2) {
          setMapState(prev => ({ ...prev, attempts: prev.attempts + 1 }))
        } else {
          setMapState(prev => ({
            ...prev,
            error: true,
            useStaticFallback: ANDROID_PERFORMANCE_MODE
          }))
        }
      }
    }, 8000 + (mapState.attempts * 3000))

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [mapState.visible, mapState.loaded, mapState.error, mapState.attempts])

  // **EVENT HANDLERS**
  const handleMapReady = useCallback(() => {
    if (isMounted.current) {
      setMapState(prev => ({ ...prev, loaded: true }))
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleMapError = useCallback(() => {
    if (isMounted.current) {
      setMapState(prev => ({ ...prev, error: true }))
    }
  }, [])

  const handleOpenMaps = useCallback(() => {
    if (!coordinates) {
      Alert.alert("Error", "Invalid location coordinates")
      return
    }

    try {
      const { lat, lng } = coordinates
      const dealerName = encodeURIComponent(dealership?.name || 'Dealership')

      if (Platform.OS === 'android') {
        const geoUrl = `geo:${lat},${lng}?q=${lat},${lng}(${dealerName})`
        Linking.openURL(geoUrl).catch(() => {
          const webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
          Linking.openURL(webUrl).catch(() => {
            Alert.alert("Error", "Could not open maps application")
          })
        })
      } else {
        // iOS handling...
        const appleMapsUrl = `maps:0,0?q=${lat},${lng}`
        Linking.openURL(appleMapsUrl)
      }
    } catch (error) {
      Alert.alert("Error", "Unable to open maps")
    }
  }, [coordinates, dealership?.name])

  const handleRetry = useCallback(() => {
    if (isMounted.current) {
      setMapState({
        error: false,
        loaded: false,
        visible: true,
        attempts: 0,
        useStaticFallback: false
      })
    }
  }, [])

  // **RENDER STATIC MAP FALLBACK**
  if (mapState.useStaticFallback && coordinates && ANDROID_PERFORMANCE_MODE) {
    const { lat, lng } = coordinates
    const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=14&size=600x400&markers=color:red%7C${lat},${lng}&key=AIzaSyCDuRjdx7YfYc0Y46fcEisE6YbY0zVY7jk`

    return (
      <View style={{
        height: 240,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: isDarkMode ? '#333' : '#f0f0f0'
      }}>
        <Image
          source={{ uri: staticMapUrl }}
          style={{ width: '100%', height: '100%' }}
          onError={() => {
            if (isMounted.current) {
              setMapState(prev => ({ ...prev, useStaticFallback: false, error: true }))
            }
          }}
        />
        <TouchableOpacity
          onPress={handleOpenMaps}
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            backgroundColor: '#D55004',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            elevation: 3
          }}
        >
          <Ionicons name='navigate' size={16} color='white' />
          <Text style={{ color: 'white', marginLeft: 6 }}>Navigate</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // **RENDER ERROR STATE**
  if (!coordinates || mapState.error) {
    return (
      <View style={{
        height: 240,
        borderRadius: 16,
        backgroundColor: isDarkMode ? '#333' : '#f0f0f0',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}>
        <Ionicons
          name='map-outline'
          size={48}
          color={isDarkMode ? '#666' : '#999'}
        />
        <Text style={{
          color: isDarkMode ? '#999' : '#666',
          marginTop: 12,
          textAlign: 'center',
          fontSize: 16
        }}>
          {mapState.error ? 'Map loading failed' : 'Location not available'}
        </Text>
        {mapState.error && coordinates && (
          <TouchableOpacity
            onPress={handleRetry}
            style={{
              marginTop: 12,
              paddingHorizontal: 16,
              paddingVertical: 8,
              backgroundColor: '#D55004',
              borderRadius: 8
            }}
          >
            <Text style={{ color: 'white', fontWeight: '500' }}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  // **RENDER LOADING STATE**
  if (!mapState.visible) {
    return (
      <View style={{
        height: 240,
        borderRadius: 16,
        backgroundColor: isDarkMode ? '#333' : '#f0f0f0',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <ActivityIndicator size="large" color="#D55004" />
        <Text style={{
          marginTop: 12,
          color: isDarkMode ? '#fff' : '#000',
          fontSize: 16
        }}>
          Preparing map...
        </Text>
      </View>
    )
  }

  // **RENDER INTERACTIVE MAP**
  const { lat, lng } = coordinates
  const region = {
    latitude: lat,
    longitude: lng,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01
  }

  return (
    <View style={{
      height: 240,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: isDarkMode ? '#333' : '#f0f0f0'
    }}>
      <ErrorBoundary
        FallbackComponent={() => (
          <View style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Ionicons name="warning-outline" size={48} color="#D55004" />
            <Text style={{ marginTop: 12, color: isDarkMode ? '#999' : '#666' }}>
              Map error occurred
            </Text>
            <TouchableOpacity onPress={handleRetry} style={{
              marginTop: 8,
              padding: 8,
              backgroundColor: '#D55004',
              borderRadius: 8
            }}>
              <Text style={{ color: 'white' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      >
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={region}
          onMapReady={handleMapReady}
          onError={handleMapError}
          // **ANDROID PERFORMANCE OPTIMIZATIONS**
          liteMode={IS_LOW_END_DEVICE}
          minZoomLevel={10}
          maxZoomLevel={18}
          rotateEnabled={false}
          pitchEnabled={false}
          scrollEnabled={true}
          zoomEnabled={true}
          zoomTapEnabled={false}
          moveOnMarkerPress={false}
          showsBuildings={false}
          showsTraffic={false}
          showsIndoors={false}
          showsCompass={false}
          toolbarEnabled={false}
          loadingEnabled={true}
          loadingIndicatorColor="#D55004"
          loadingBackgroundColor={isDarkMode ? "#333" : "#f0f0f0"}
          cacheEnabled={true}
        >
          {mapState.loaded && (
            <Marker
              coordinate={{ latitude: lat, longitude: lng }}
              title={dealership?.name || "Dealership"}
              description={dealership?.location || ""}
            >
              <View style={{
                backgroundColor: '#fff',
                borderRadius: 20,
                padding: 3,
                borderWidth: 2,
                borderColor: '#D55004',
                elevation: 3
              }}>
                {dealership?.logo ? (
                  <SafeImage
                    source={{ uri: dealership.logo }}
                    style={{ width: 32, height: 32, borderRadius: 16 }}
                    fallbackColor="#f0f0f0"
                  />
                ) : (
                  <Ionicons name="business" size={20} color="#D55004" />
                )}
              </View>
            </Marker>
          )}
        </MapView>

        {mapState.loaded && (
          <TouchableOpacity
            onPress={handleOpenMaps}
            style={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              backgroundColor: '#D55004',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              flexDirection: 'row',
              alignItems: 'center',
              elevation: 3
            }}
          >
            <Ionicons name='navigate' size={16} color='white' />
            <Text style={{ color: 'white', marginLeft: 6 }}>Navigate</Text>
          </TouchableOpacity>
        )}
      </ErrorBoundary>
    </View>
  )
})

// **ERROR FALLBACK COMPONENT**
const ErrorFallback = ({ error, resetError }: any) => (
  <View style={{
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f8f8'
  }}>
    <Ionicons name="alert-circle-outline" size={60} color="#D55004" />
    <Text style={{
      fontSize: 20,
      fontWeight: 'bold',
      marginTop: 16,
      color: '#333',
      textAlign: 'center'
    }}>
      Something went wrong
    </Text>
    <Text style={{
      marginTop: 8,
      textAlign: 'center',
      color: '#666',
      fontSize: 16
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
      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Try Again</Text>
    </TouchableOpacity>
  </View>
)

// **CUSTOM HEADER COMPONENT**
const CustomHeader = React.memo(({ title, onBack }: { title: string; onBack?: () => void }) => {
  const { isDarkMode } = useTheme()

  return (
    <SafeAreaView style={{
      backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
    }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingBottom: 8
      }}>
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            style={{
              padding: 8,
              marginRight: 4
            }}
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
          color: isDarkMode ? "#FFFFFF" : "#000000",
          flex: 1
        }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title || 'Dealership Details'}
        </Text>
      </View>
    </SafeAreaView>
  )
})

// **MAIN COMPONENT**
const DealershipDetails = () => {
  const { isDarkMode } = useTheme()
  const { dealershipId } = useLocalSearchParams<{ dealershipId: string }>()
  const router = useRouter()
  const { t } = useTranslation()
  const isRTL = I18nManager.isRTL

  // **STATE MANAGEMENT**
  const [dealership, setDealership] = useState<Dealership | null>(null)
  const [allCars, setAllCars] = useState<Car[]>([])
  const [filteredCars, setFilteredCars] = useState<Car[]>([])
  const [loadingState, setLoadingState] = useState<LoadingState>({
    dealership: true,
    cars: true,
    search: false,
    refresh: false
  })
  const [componentVisibility, setComponentVisibility] = useState<ComponentVisibilityState>({
    map: false,
    autoClips: false,
    initialized: false
  })
  const [selectedCar, setSelectedCar] = useState<Car | null>(null)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [activeSearchQuery, setActiveSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState('')
  const [errorStates, setErrorStates] = useState({
    dealership: false,
    cars: false
  })

  const { toggleFavorite, isFavorite } = useFavorites()
  const scrollY = new Animated.Value(0)

  // **MEMOIZED VALUES**
  const bgGradient: [string, string] = useMemo(() =>
    isDarkMode ? ['#000000', '#1c1c1c'] : ['#FFFFFF', '#F0F0F0']
  , [isDarkMode])

  // **PROGRESSIVE COMPONENT LOADING**
  useEffect(() => {
    const initSequence = async () => {
      await new Promise(resolve => setTimeout(resolve, COMPONENT_MOUNT_DELAY))

      if (!componentVisibility.initialized) {
        setComponentVisibility(prev => ({ ...prev, initialized: true }))

        // **STAGGERED LOADING FOR ANDROID PERFORMANCE**
        InteractionManager.runAfterInteractions(() => {
          setTimeout(() => {
            setComponentVisibility(prev => ({ ...prev, map: true }))
          }, MAP_LOAD_DELAY)

          setTimeout(() => {
            setComponentVisibility(prev => ({ ...prev, autoClips: true }))
          }, AUTOCLIPS_LOAD_DELAY)
        })
      }
    }

    initSequence()
  }, [componentVisibility.initialized])

  // **DEALERSHIP DATA FETCHING**
  const fetchDealershipDetails = useCallback(async () => {
    if (!dealershipId) {
      setErrorStates(prev => ({ ...prev, dealership: true }))
      setLoadingState(prev => ({ ...prev, dealership: false }))
      return
    }

    setLoadingState(prev => ({ ...prev, dealership: true }))
    try {
      const { data, error } = await supabase
        .from('dealerships')
        .select('*')
        .eq('id', dealershipId)
        .single()

      if (error) throw error

      if (!data) {
        setErrorStates(prev => ({ ...prev, dealership: true }))
      } else {
        setDealership(data)
        setErrorStates(prev => ({ ...prev, dealership: false }))
      }
    } catch (error) {
      console.error('Error fetching dealership details:', error)
      setErrorStates(prev => ({ ...prev, dealership: true }))
    } finally {
      setLoadingState(prev => ({ ...prev, dealership: false }))
    }
  }, [dealershipId])

  // **CARS DATA FETCHING WITH ANDROID OPTIMIZATIONS**
  const fetchAllCars = useCallback(async (refresh = false) => {
    if (!dealershipId) {
      setErrorStates(prev => ({ ...prev, cars: true }))
      setLoadingState(prev => ({ ...prev, cars: false, refresh: false }))
      return
    }

    setLoadingState(prev => ({
      ...prev,
      cars: !refresh,
      refresh: refresh
    }))

    try {
      let query = supabase
        .from('cars')
        .select(
          `*, dealerships (name,logo,phone,location,latitude,longitude)`,
          { count: 'exact' }
        )
        .eq('status', 'available')
        .eq('dealership_id', dealershipId)

      // **SERVER-SIDE SORTING**
      switch (sortOption) {
        case 'price_asc':
          query = query.order('price', { ascending: true })
          break
        case 'price_desc':
          query = query.order('price', { ascending: false })
          break
        case 'year_asc':
          query = query.order('year', { ascending: true })
          break
        case 'year_desc':
          query = query.order('year', { ascending: false })
          break
        case 'mileage_asc':
          query = query.order('mileage', { ascending: true })
          break
        case 'mileage_desc':
          query = query.order('mileage', { ascending: false })
          break
        default:
          query = query.order('listed_at', { ascending: false })
      }

      const { data, error, count } = await query

      if (error) throw error

      const processedCars: Car[] = data?.map(item => ({
        ...item,
        dealership_name: item.dealerships?.name,
        dealership_logo: item.dealerships?.logo,
        dealership_phone: item.dealerships?.phone,
        dealership_location: item.dealerships?.location,
      })) || []

      setAllCars(processedCars)
      setErrorStates(prev => ({ ...prev, cars: false }))

    } catch (error) {
      console.error('Error fetching cars:', error)
      setErrorStates(prev => ({ ...prev, cars: true }))
    } finally {
      setLoadingState(prev => ({
        ...prev,
        cars: false,
        refresh: false
      }))
    }
  }, [dealershipId, sortOption])

  // **CLIENT-SIDE SEARCH IMPLEMENTATION**
  const performSearch = useCallback((searchQuery: string) => {
    setLoadingState(prev => ({ ...prev, search: true }))
    setActiveSearchQuery(searchQuery)

    // **ANDROID PERFORMANCE: DEFER SEARCH PROCESSING**
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        try {
          let result = [...allCars]

          if (searchQuery.trim()) {
            const searchTerms = searchQuery.toLowerCase().split(' ')
            result = result.filter(car => {
              if (!car) return false

              const searchableFields = [
                car.make,
                car.model,
                car.year?.toString(),
                car.condition,
                car.transmission,
                car.color
              ].filter(Boolean)

              return searchTerms.every(term =>
                searchableFields.some(field =>
                  field && field.toLowerCase().includes(term)
                )
              )
            })
          }

          setFilteredCars(result)
        } catch (error) {
          console.error('Search error:', error)
          setFilteredCars(allCars)
        } finally {
          setLoadingState(prev => ({ ...prev, search: false }))
        }
      }, ANDROID_PERFORMANCE_MODE ? 150 : 50)
    })
  }, [allCars])

  const clearSearch = useCallback(() => {
    setActiveSearchQuery('')
    setFilteredCars(allCars)
  }, [allCars])

  // **INITIALIZATION EFFECTS**
  useEffect(() => {
    fetchDealershipDetails()
  }, [fetchDealershipDetails])

  useEffect(() => {
    fetchAllCars()
  }, [fetchAllCars])

  useEffect(() => {
    if (activeSearchQuery) {
      performSearch(activeSearchQuery)
    } else {
      setFilteredCars(allCars)
    }
  }, [allCars, activeSearchQuery, performSearch])

  // **EVENT HANDLERS**
  const handleCarPress = useCallback((car: Car) => {
    if (!car) return
    setSelectedCar(car)
    setIsModalVisible(true)
  }, [])

  const handleFavoritePress = useCallback(async (carId: number) => {
    try {
      if (!carId) return
      const newLikesCount = await toggleFavorite(carId)
      setAllCars(prevCars =>
        prevCars.map(car =>
          car.id === carId ? { ...car, likes: newLikesCount } : car
        )
      )
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  }, [toggleFavorite])

  const handleRefresh = useCallback(() => {
    Promise.all([
      fetchDealershipDetails(),
      fetchAllCars(true)
    ])
  }, [fetchDealershipDetails, fetchAllCars])

  const handleCall = useCallback(() => {
    if (!dealership?.phone) {
      Alert.alert('Error', 'Phone number not available')
      return
    }

    try {
      Linking.openURL(`tel:${dealership.phone}`)
    } catch (error) {
      Alert.alert('Error', 'Could not initiate call')
    }
  }, [dealership])

  const handleWhatsApp = useCallback(() => {
    if (!dealership?.phone) {
      Alert.alert('Error', 'Phone number not available')
      return
    }

    try {
      const whatsappUrl = `https://wa.me/+961${dealership.phone}`
      Linking.openURL(whatsappUrl).catch(() => {
        Alert.alert('Error', 'Could not open WhatsApp. Please make sure the app is installed.')
      })
    } catch (error) {
      Alert.alert('Error', 'Could not open WhatsApp')
    }
  }, [dealership])

  // **RENDER FUNCTIONS**
  const renderCarItem = useCallback(({ item }: { item: Car }) => {
    if (!item || !item.id) return null

    return (
      <ErrorBoundary
        FallbackComponent={() => (
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
        )}
      >
        <CarCard
          car={item}
          onPress={() => handleCarPress(item)}
          onFavoritePress={() => handleFavoritePress(item.id)}
          isFavorite={isFavorite(item.id)}
        />
      </ErrorBoundary>
    )
  }, [handleCarPress, handleFavoritePress, isFavorite, isDarkMode])

  const renderModal = useMemo(() => {
    if (!selectedCar) return null

    const ModalComponent = Platform.OS === 'ios' ? CarDetailModalIOS : CarDetailModal

    return (
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <ModalComponent
          isVisible={isModalVisible}
          car={selectedCar}
          onClose={() => {
            setIsModalVisible(false)
            setTimeout(() => setSelectedCar(null), 300)
          }}
          onFavoritePress={() => selectedCar && handleFavoritePress(selectedCar.id)}
          isFavorite={!!selectedCar && isFavorite(selectedCar.id)}
          setSelectedCar={setSelectedCar}
          setIsModalVisible={setIsModalVisible}
        />
      </ErrorBoundary>
    )
  }, [isModalVisible, selectedCar, handleFavoritePress, isFavorite])

  const renderHeader = useMemo(() => {
    // **LOADING STATE**
    if (loadingState.dealership) {
      return (
        <View style={{ padding: 24, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#D55004" />
          <Text style={{
            marginTop: 16,
            color: isDarkMode ? 'white' : 'black',
            fontSize: 16
          }}>
            Loading dealership details...
          </Text>
        </View>
      )
    }

    // **ERROR STATE**
    if (errorStates.dealership || !dealership) {
      return (
        <View style={{
          padding: 24,
          alignItems: 'center',
          backgroundColor: isDarkMode ? '#1A1A1A' : '#F7F7F7',
          margin: 16,
          borderRadius: 16,
        }}>
          <Ionicons name="alert-circle-outline" size={64} color="#D55004" />
          <Text style={{
            marginTop: 16,
            color: isDarkMode ? 'white' : 'black',
            fontWeight: 'bold',
            fontSize: 18
          }}>
            Error Loading Dealership
          </Text>
          <Text style={{
            marginTop: 8,
            color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
            textAlign: 'center',
            fontSize: 16
          }}>
            We couldn't load the dealership details. Please try again.
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 16,
              backgroundColor: '#D55004',
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8
            }}
            onPress={fetchDealershipDetails}
          >
            <Text style={{ color: 'white', fontWeight: 'bold' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )
    }

    return (
      <>
        {/* **DEALERSHIP INFO SECTION** */}
        <View style={{ marginBottom: 24 }}>
          <View style={{
            paddingHorizontal: 16,
            paddingBottom: 24,
            marginTop: 16,
          }}>
            <View style={{
              backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF',
              borderRadius: 24,
              padding: 24,
              elevation: 4,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4
            }}>
              {/* **LOGO AND INFO ROW** */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ position: 'relative' }}>
                  <View style={{
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    borderRadius: 20,
                    padding: 6
                  }}>
                    <SafeImage
                      source={{ uri: dealership.logo }}
                      style={{
                        width: 100,
                        height: 100,
                        borderRadius: 16,
                        borderWidth: 2,
                        borderColor: '#D55004',
                      }}
                      fallbackColor={isDarkMode ? '#333' : '#e0e0e0'}
                      testID="dealership-logo"
                    />
                  </View>
                </View>

                <View style={{ marginLeft: 20, flex: 1 }}>
                  <Text style={{
                    fontSize: 24,
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
                    marginTop: 8,
                    backgroundColor: 'rgba(213,80,4,0.1)',
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    alignSelf: 'flex-start'
                  }}>
                    <Ionicons
                      name='location-outline'
                      size={16}
                      color='#D55004'
                    />
                    <Text style={{
                      marginLeft: 6,
                      fontSize: 14,
                      color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
                      fontWeight: '500'
                    }} numberOfLines={1}>
                      {dealership.location || 'Location not available'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* **STATISTICS ROW** */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-around',
                marginTop: 20,
                marginBottom: 12,
                paddingHorizontal: 12
              }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{
                    fontSize: 12,
                    color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                    fontWeight: '500'
                  }}>
                    Available Cars
                  </Text>
                  <Text style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: isDarkMode ? '#FFFFFF' : '#000000',
                    marginTop: 4
                  }}>
                    {filteredCars.length}
                  </Text>
                </View>

                <View style={{
                  height: '100%',
                  width: 1,
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'
                }} />

                <View style={{ alignItems: 'center' }}>
                  <Text style={{
                    fontSize: 12,
                    color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                    fontWeight: '500'
                  }}>
                    Since
                  </Text>
                  <Text style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: isDarkMode ? '#FFFFFF' : '#000000',
                    marginTop: 4
                  }}>
                    {dealership.created_at ? new Date(dealership.created_at).getFullYear() : 'N/A'}
                  </Text>
                </View>
              </View>

              {/* **ACTION BUTTONS** */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: 20
              }}>
                <TouchableOpacity
                  onPress={handleCall}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    paddingVertical: 14,
                    borderRadius: 12,
                    marginRight: 10,
                    borderWidth: 1,
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
                  }}
                >
                  <View style={{
                    backgroundColor: 'rgba(213,80,4,0.15)',
                    borderRadius: 999,
                    padding: 6
                  }}>
                    <Ionicons name='call-outline' size={20} color='#D55004' />
                  </View>
                  <Text style={{
                    marginLeft: 8,
                    fontWeight: '600',
                    color: isDarkMode ? '#FFFFFF' : '#000000',
                    fontSize: 16
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
                    paddingVertical: 14,
                    borderRadius: 12,
                    marginLeft: 10,
                    elevation: 3,
                    shadowColor: '#25D366',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4
                  }}
                >
                  <Ionicons name='logo-whatsapp' size={20} color='white' />
                  <Text style={{
                    marginLeft: 8,
                    color: 'white',
                    fontWeight: '600',
                    fontSize: 16
                  }}>
                    WhatsApp
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* **MAP SECTION - CONDITIONALLY RENDERED** */}
          {componentVisibility.map && (
            <View style={{ paddingHorizontal: 16, marginBottom: 32 }}>
              <AndroidOptimizedMapView
                dealership={dealership}
                isDarkMode={isDarkMode}
              />
            </View>
          )}

          {/* **AUTOCLIPS SECTION - CONDITIONALLY RENDERED** */}
          {componentVisibility.autoClips && (
            <ErrorBoundary
              FallbackComponent={() => (
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
                    {t('autoclips.could_not_load_autoclips')}
                  </Text>
                </View>
              )}
            >
              <DealershipAutoClips dealershipId={dealershipId} />
            </ErrorBoundary>
          )}
        </View>

        {/* **SEARCH AND SORT SECTION** */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <AdvancedSearchBar
            onSearch={performSearch}
            onClear={clearSearch}
            isSearching={loadingState.search}
            isDarkMode={isDarkMode}
          />

          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: isDarkMode ? 'white' : 'black'
            }}>
              Sort Options
            </Text>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <SortPicker
                onValueChange={(value: string) => setSortOption(value)}
                initialValue={sortOption}
              />
            </View>
          </View>
        </View>

        {/* **RESULTS HEADER** */}
        <View style={{
          paddingHorizontal: 24,
          marginBottom: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Text style={{
            fontSize: 22,
            fontWeight: 'bold',
            color: isDarkMode ? '#FFFFFF' : '#000000'
          }}>
            {activeSearchQuery ? 'Search Results' : 'Available Cars'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {loadingState.search && (
              <ActivityIndicator
                size="small"
                color="#D55004"
                style={{ marginRight: 8 }}
              />
            )}
            <Text style={{
              color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
              fontSize: 16
            }}>
              {filteredCars.length} vehicles
            </Text>
          </View>
        </View>

        {/* **ACTIVE SEARCH INDICATOR** */}
        {activeSearchQuery && (
          <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderRadius: 12,
              backgroundColor: isDarkMode ? 'rgba(213, 80, 4, 0.1)' : 'rgba(213, 80, 4, 0.05)',
              borderWidth: 1,
              borderColor: 'rgba(213, 80, 4, 0.2)'
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="search" size={18} color="#D55004" />
                <Text style={{
                  marginLeft: 8,
                  color: isDarkMode ? 'white' : 'black',
                  fontWeight: '500',
                  fontSize: 16
                }}
                  numberOfLines={1}
                >
                  Searching for: "{activeSearchQuery}"
                </Text>
              </View>
              <TouchableOpacity onPress={clearSearch} style={{ marginLeft: 12 }}>
                <Ionicons name="close-circle" size={24} color="#D55004" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* **CARS LOADING/ERROR STATES** */}
        {loadingState.cars && (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#D55004" />
            <Text style={{
              marginTop: 16,
              color: isDarkMode ? 'white' : 'black',
              fontSize: 16
            }}>
              Loading available cars...
            </Text>
          </View>
        )}

        {errorStates.cars && filteredCars.length === 0 && (
          <View style={{
            padding: 24,
            alignItems: 'center',
            margin: 16,
            backgroundColor: isDarkMode ? '#1A1A1A' : '#F7F7F7',
            borderRadius: 16
          }}>
            <Ionicons name="warning-outline" size={64} color="#D55004" />
            <Text style={{
              marginTop: 16,
              color: isDarkMode ? 'white' : 'black',
              fontWeight: 'bold',
              fontSize: 18
            }}>
              Couldn't Load Cars
            </Text>
            <Text style={{
              marginTop: 8,
              color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
              textAlign: 'center',
              fontSize: 16
            }}>
              There was a problem loading the cars for this dealership.
            </Text>
            <TouchableOpacity
              style={{
                marginTop: 16,
                backgroundColor: '#D55004',
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 8
              }}
              onPress={() => fetchAllCars(true)}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </>
    )
  }, [
    dealership,
    isDarkMode,
    filteredCars.length,
    activeSearchQuery,
    loadingState,
    errorStates,
    componentVisibility,
    performSearch,
    clearSearch,
    handleCall,
    handleWhatsApp,
    sortOption,
    fetchDealershipDetails,
    fetchAllCars,
    dealershipId
  ])

  // **MAIN RENDER WITH COMPREHENSIVE ERROR HANDLING**
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <LinearGradient colors={bgGradient} style={{ flex: 1 }}>
        <CustomHeader
          title={dealership?.name || 'Dealership Details'}
          onBack={() => router.back()}
        />

        <Animated.FlatList
          data={filteredCars}
          renderItem={renderCarItem}
          keyExtractor={(item) => `car-${item.id}-${item.make}`}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingBottom: 24 }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          refreshing={loadingState.refresh}
          onRefresh={handleRefresh}
          showsVerticalScrollIndicator={false}
          // **ANDROID PERFORMANCE OPTIMIZATIONS**
          windowSize={ANDROID_PERFORMANCE_MODE ? 3 : 10}
          maxToRenderPerBatch={ANDROID_PERFORMANCE_MODE ? 3 : 10}
          initialNumToRender={ANDROID_PERFORMANCE_MODE ? 3 : 10}
          removeClippedSubviews={true}
          getItemLayout={null}
          ListEmptyComponent={
            !loadingState.cars && !errorStates.cars ? (
              <View style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 48
              }}>
                <Ionicons
                  name="car-outline"
                  size={80}
                  color={isDarkMode ? '#666' : '#999'}
                />
                <Text style={{
                  marginTop: 16,
                  fontSize: 18,
                  fontWeight: '600',
                  color: isDarkMode ? 'white' : 'black'
                }}>
                  {activeSearchQuery ? 'No cars match your search' : 'No cars available'}
                </Text>
                <Text style={{
                  marginTop: 8,
                  fontSize: 16,
                  color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                  textAlign: 'center'
                }}>
                  {activeSearchQuery ? 'Try different search terms' : 'This dealership has no cars listed'}
                </Text>
                {activeSearchQuery && (
                  <TouchableOpacity
                    onPress={clearSearch}
                    style={{
                      marginTop: 16,
                      backgroundColor: '#D55004',
                      paddingHorizontal: 24,
                      paddingVertical: 12,
                      borderRadius: 8
                    }}
                  >
                    <Text style={{
                      color: 'white',
                      fontWeight: '600',
                      fontSize: 16
                    }}>
                      Clear Search
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null
          }
        />

        {renderModal}
      </LinearGradient>
    </ErrorBoundary>
  )
}

export default DealershipDetails