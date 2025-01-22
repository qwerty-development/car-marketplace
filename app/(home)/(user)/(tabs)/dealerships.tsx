import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  StatusBar,
  Platform,
  Modal,
  Pressable
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { FontAwesome, Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RefreshControl } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import ShimmerPlaceholder from 'react-native-shimmer-placeholder'
import * as Location from 'expo-location'

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

const SORT_OPTIONS = {
	AZ: 'a-z',
	ZA: 'z-a',
	RANDOM: 'random',
	NEAREST: 'nearest'
  } as const
  
  type SortOption = typeof SORT_OPTIONS[keyof typeof SORT_OPTIONS]

  const SortModal = ({ visible, onClose, onSelect, currentSort, isDarkMode }:any) => (
	<Modal
	  visible={visible}
	  transparent={true}
	  animationType="slide"
	  onRequestClose={onClose}
	>
	  <Pressable 
		className="flex-1 justify-end bg-black/50"
		onPress={onClose}
	  >
		<View className={`rounded-t-3xl ${isDarkMode ? 'bg-black' : 'bg-white'} p-6`}>
		  <View className="items-center mb-6">
			<View className="w-16 h-1 bg-gray-300 rounded-full" />
		  </View>
		  <Text className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-textgray'}`}>
			Sort Dealerships
		  </Text>
		  {Object.entries(SORT_OPTIONS).map(([key, value]) => (
			<TouchableOpacity
			  key={value}
			  className={`py-4 px-4 rounded-xl mb-2 ${
				currentSort === value 
				  ? 'bg-red' 
				  : isDarkMode ? 'bg-textgray' : 'bg-gray-100'
			  }`}
			  onPress={() => {
				onSelect(value)
				onClose()
			  }}
			>
			  <Text className={`
				${currentSort === value ? 'text-white' : isDarkMode ? 'text-gray-200' : 'text-gray-800'}
				text-lg
			  `}>
				{key === 'AZ' ? 'A to Z' :
				 key === 'ZA' ? 'Z to A' :
				 key === 'RANDOM' ? 'Random' : 'Nearest to Me'}
			  </Text>
			</TouchableOpacity>
		  ))}
		</View>
	  </Pressable>
	</Modal>
  )

const CustomHeader = React.memo(({ title }: { title: string }) => {
    const { isDarkMode } = useTheme()
  
    return (
      <SafeAreaView
        className={`bg-${isDarkMode ? 'black' : 'white'} `}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View className='flex-row ml-6'>
          <Text className='text-2xl -mb-5 font-bold text-black dark:text-white'>{title}</Text>
        </View>
      </SafeAreaView>
    )
  })

const DealershipCard = React.memo(({ item, onPress, isDarkMode }: any) => (
  <TouchableOpacity 
    className={`mx-4 mb-4 rounded-2xl overflow-hidden ${isDarkMode ? 'bg-gray' : 'bg-white'}`}
    style={{ 
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5 
    }}
    onPress={() => onPress(item)}
  >
    <LinearGradient
      colors={isDarkMode ? ['#1A1A1A', '#1A1A1A'] : ['#e6e6e6', '#e6e6e6']}
      className="p-4"
    >
      <View className="flex-row items-center">
        <Image 
          source={{ uri: item.logo }} 
          className="w-16 h-16 rounded-full bg-gray-200"
        />
        <View className="flex-1 ml-4">
          <Text className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
            {item.name}
          </Text>
          {item.location && (
            <View className="flex-row items-center mt-1">
              <Ionicons 
                name="location-outline" 
                size={14} 
                color={isDarkMode ? '#CCC' : '#666'} 
              />
              <Text className={`ml-1 text-sm ${isDarkMode ? 'text-white' : 'text-textgray'}`}>
                {item.location} {item.distance && `• ${item.distance.toFixed(1)} km away`}
              </Text>
            </View>
          )}
          {item.total_cars !== undefined && (
            <View className="flex-row items-center mt-1">
              <Ionicons 
                name="car-outline" 
                size={14} 
                color={isDarkMode ? '#CCC' : '#666'} 
              />
              <Text className={`ml-1 text-sm ${isDarkMode ? 'text-white' : 'text-textgray'}`}>
                {item.total_cars} vehicles available
              </Text>
            </View>
          )}
        </View>
      </View>
    </LinearGradient>
  </TouchableOpacity>
))

export default function DealershipListPage() {
	const { isDarkMode } = useTheme()
	const [dealerships, setDealerships] = useState<Dealership[]>([])
	const [searchQuery, setSearchQuery] = useState('')
	const [refreshing, setRefreshing] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	const [sortBy, setSortBy] = useState<SortOption>(SORT_OPTIONS.RANDOM)
	const [showSortModal, setShowSortModal] = useState(false)
	const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null)
	const router = useRouter()
  
	// Get user location
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
  
	// Calculate distance between two coordinates
	const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
	  const R = 6371 // Earth's radius in km
	  const dLat = (lat2 - lat1) * Math.PI / 180
	  const dLon = (lon2 - lon1) * Math.PI / 180
	  const a = 
		Math.sin(dLat/2) * Math.sin(dLat/2) +
		Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
		Math.sin(dLon/2) * Math.sin(dLon/2)
	  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
	  return R * c
	}
  
	const fetchDealerships = useCallback(async () => {
	  setIsLoading(true)
	  try {
		const { data, error } = await supabase
		  .from('dealerships')
		  .select('*, cars(count)')
  
		if (error) throw error
  
		let formattedData = data?.map(dealer => ({
		  ...dealer,
		  total_cars: dealer.cars?.[0]?.count || 0,
		  distance: userLocation ? calculateDistance(
			userLocation.coords.latitude,
			userLocation.coords.longitude,
			dealer.latitude,
			dealer.longitude
		  ) : undefined
		})) || []
  
		setDealerships(formattedData)
	  } catch (error) {
		console.error('Error fetching dealerships:', error)
		Alert.alert('Error', 'Failed to fetch dealerships')
	  } finally {
		setIsLoading(false)
	  }
	}, [userLocation])
  
	useEffect(() => {
	  fetchDealerships()
	}, [fetchDealerships])
  
	const sortedAndFilteredDealerships = useMemo(() => {
	  let filtered = dealerships.filter(dealership =>
		dealership.name.toLowerCase().includes(searchQuery.toLowerCase())
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

  const filteredDealerships = useMemo(() => {
    return dealerships.filter(dealership =>
      dealership.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [dealerships, searchQuery])

  const handleDealershipPress = useCallback(
    (dealership: Dealership) => {
      router.push({
        pathname: '/(home)/(user)/DealershipDetails',
        params: { dealershipId: dealership.id }
      })
    },
    [router]
  )

  const renderEmpty = useCallback(() => (
    <View className='flex-1 justify-center items-center py-20'>
      <Ionicons
        name='business-outline'
        size={50}
        color={isDarkMode ? '#FFFFFF' : '#000000'}
      />
      <Text className={`${isDarkMode ? 'text-white' : 'text-black'} text-lg mt-4 text-center`}>
        No dealerships found
      </Text>
      <Text className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-base mt-2 text-center`}>
        Try adjusting your search
      </Text>
    </View>
  ), [isDarkMode])

  const renderShimmer = useCallback(() => (
    <View className='px-4'>
      {[...Array(5)].map((_, index) => (
        <ShimmerPlaceholder
          key={index}
          style={{
            width: '100%',
            height: 100,
            marginBottom: 16,
            borderRadius: 16
          }}
          shimmerColors={
            isDarkMode
              ? ['#333', '#3A3A3A', '#333']
              : ['#f6f7f8', '#edeef1', '#f6f7f8']
          }
        />
      ))}
    </View>
  ), [isDarkMode])

  return (
    <View className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
      <CustomHeader title={'Dealerships'} />
      
      <View className="px-4 pb-3">
        <View className="flex-row gap-2">
          <View className={`flex-1 flex-row items-center rounded-full border border-[#ccc] px-4 ${isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white'}`}>
            <FontAwesome name="search" size={20} color={isDarkMode ? 'white' : 'black'} />
            <TextInput
              className={`flex-1 p-3 ${isDarkMode ? 'text-white' : 'text-black'}`}
              placeholder="Search dealerships..."
              placeholderTextColor={isDarkMode ? 'lightgray' : 'gray'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          
          <TouchableOpacity
            onPress={() => setShowSortModal(true)}
            className={`items-center justify-center w-12 h-12 rounded-full border border-[#ccc] ${
              isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white'
            }`}
          >
            <FontAwesome 
              name="sort" 
              size={20} 
              color={isDarkMode ? 'white' : 'black'} 
            />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={sortedAndFilteredDealerships}
        renderItem={({ item }) => (
          <DealershipCard 
            item={item}
            onPress={handleDealershipPress}
            isDarkMode={isDarkMode}
          />
        )}
        keyExtractor={item => `${item.id}`}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#D55004']}
            tintColor={isDarkMode ? '#FFFFFF' : '#000000'}
          />
        }
        contentContainerStyle={{ 
          paddingVertical: 8,
          flexGrow: 1
        }}
      />

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