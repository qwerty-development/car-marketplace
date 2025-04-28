import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  SafeAreaView
} from 'react-native'
import { useTheme } from '@/utils/ThemeContext'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/utils/supabase'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useDealershipProfile } from './hooks/useDealershipProfile'
import * as Location from 'expo-location'
import MapView, { Marker } from 'react-native-maps'

const { width } = Dimensions.get('window')



export default function EditProfileScreen() {
  const { isDarkMode } = useTheme()
  const router = useRouter()
  const { dealershipId } = useLocalSearchParams()
  const { dealership, fetchDealershipProfile } = useDealershipProfile()
  const mapRef = useRef(null)
  
  const [activeTab, setActiveTab] = useState('info')
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    phone: '',
    latitude: '',
    longitude: ''
  })

  const [selectedLocation, setSelectedLocation] = useState(null)
  
  const [mapRegion, setMapRegion] = useState({
    latitude: 33.8547,
    longitude: 35.8623,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421
  })

  useEffect(() => {
    // Update form data when dealership data is loaded
    if (dealership) {
      setFormData({
        name: dealership.name || '',
        location: dealership.location || '',
        phone: dealership.phone || '',
        latitude: dealership.latitude?.toString() || '',
        longitude: dealership.longitude?.toString() || ''
      })

      if (dealership.latitude && dealership.longitude) {
        setSelectedLocation({
          latitude: dealership.latitude,
          longitude: dealership.longitude
        })
        
        setMapRegion({
          latitude: dealership.latitude,
          longitude: dealership.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421
        })
      }
    }
  }, [dealership])

  // Location handlers
  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow location access.')
        return
      }

      const location = await Location.getCurrentPositionAsync({})
      const { latitude, longitude } = location.coords

      setFormData(prev => ({
        ...prev,
        latitude: latitude.toString(),
        longitude: longitude.toString()
      }))
      
      setSelectedLocation({ latitude, longitude })
      
      setMapRegion({
        latitude,
        longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421
      })
      
      // Animate map to new location
      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421
      }, 1000)
    } catch (error) {
      console.error('Error getting location:', error)
      Alert.alert('Error', 'Failed to get location')
    }
  }

  const handleMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate
    setSelectedLocation({ latitude, longitude })
    setFormData(prev => ({
      ...prev,
      latitude: latitude.toString(),
      longitude: longitude.toString()
    }))
  }

  const updateProfile = async () => {
    if (!dealership?.id) {
      Alert.alert('Error', 'Dealership information not found')
      return
    }

    setIsLoading(true)
    try {
      // Create update object
      const updateData = {
        name: formData.name,
        location: formData.location,
        phone: formData.phone
      }
      
      // Add latitude and longitude if they exist
      if (formData.latitude && formData.longitude) {
        updateData.latitude = parseFloat(formData.latitude)
        updateData.longitude = parseFloat(formData.longitude)
      }

      const { error } = await supabase
        .from('dealerships')
        .update(updateData)
        .eq('id', dealership.id)

      if (error) throw error
      
      // Refresh the dealership profile data
      await fetchDealershipProfile()
      
      Alert.alert('Success', 'Profile updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ])
    } catch (error) {
      console.error('Error updating profile:', error)
      Alert.alert('Error', 'Failed to update profile')
    } finally {
      setIsLoading(false)
    }
  }

  // Dark mode map style
  const mapStyle = isDarkMode ? [
    {
      "elementType": "geometry",
      "stylers": [{ "color": "#212121" }]
    },
    {
      "elementType": "labels.icon",
      "stylers": [{ "visibility": "off" }]
    },
    {
      "elementType": "labels.text.fill",
      "stylers": [{ "color": "#757575" }]
    },
    {
      "elementType": "labels.text.stroke",
      "stylers": [{ "color": "#212121" }]
    },
    {
      "featureType": "administrative",
      "elementType": "geometry",
      "stylers": [{ "color": "#757575" }]
    },
    {
      "featureType": "administrative.country",
      "elementType": "labels.text.fill",
      "stylers": [{ "color": "#9e9e9e" }]
    },
    {
      "featureType": "administrative.locality",
      "elementType": "labels.text.fill",
      "stylers": [{ "color": "#bdbdbd" }]
    },
    {
      "featureType": "road",
      "elementType": "geometry",
      "stylers": [{ "color": "#2c2c2c" }]
    },
    {
      "featureType": "water",
      "elementType": "geometry",
      "stylers": [{ "color": "#000000" }]
    }
  ] : [];

  return (
    <View
      style={{ flex: 1 }}
      className={isDarkMode ? 'bg-black' : 'bg-white'}
    >
            <SafeAreaView style={{ 
              flex: 1, 
              backgroundColor: isDarkMode ? "#000000" : "#FFFFFF",
              padding: 20
            }}>
              <View className="flex-row items-center mb-6">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                  <Ionicons
                    name="arrow-back"
                    size={24}
                    color={isDarkMode ? "#fff" : "#000"}
                  />
                </TouchableOpacity>
                <Text
                  className={`text-xl font-semibold ${
                    isDarkMode ? "text-white" : "text-black"
                  }`}
                >
                  Edit Profile
                </Text>
              </View>
      {/* Tab Navigation */}
      <View className="flex-row px-4 pt-2">
        <TouchableOpacity
          onPress={() => setActiveTab('info')}
          className={`flex-1 py-3 rounded-t-xl ${
            activeTab === 'info' 
              ? isDarkMode ? 'bg-gray-900' : 'bg-gray-100' 
              : 'bg-transparent'
          }`}
        >
          <View className="flex-row justify-center items-center">
            <Ionicons 
              name="person-outline" 
              size={20} 
              color={activeTab === 'info' ? '#D55004' : isDarkMode ? '#999' : '#666'} 
              style={{ marginRight: 6 }}
            />
            <Text 
              className={`font-medium ${
                activeTab === 'info' 
                  ? isDarkMode ? 'text-white' : 'text-gray-800' 
                  : isDarkMode ? 'text-gray-500' : 'text-gray-500'
              }`}
            >
              Basic Info
            </Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => setActiveTab('location')}
          className={`flex-1 py-3 rounded-t-xl ${
            activeTab === 'location' 
              ? isDarkMode ? 'bg-gray-900' : 'bg-gray-100' 
              : 'bg-transparent'
          }`}
        >
          <View className="flex-row justify-center items-center">
            <Ionicons 
              name="location-outline" 
              size={20} 
              color={activeTab === 'location' ? '#D55004' : isDarkMode ? '#999' : '#666'} 
              style={{ marginRight: 6 }}
            />
            <Text 
              className={`font-medium ${
                activeTab === 'location' 
                  ? isDarkMode ? 'text-white' : 'text-gray-800' 
                  : isDarkMode ? 'text-gray-500' : 'text-gray-500'
              }`}
            >
              Location
            </Text>
          </View>
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        className={`flex-1 ${
          activeTab === 'info' 
            ? isDarkMode ? 'bg-gray-900' : 'bg-gray-100' 
            : activeTab === 'location'
              ? isDarkMode ? 'bg-gray-900' : 'bg-gray-100'
              : isDarkMode ? 'bg-black' : 'bg-white'
        }`}
      >
        {activeTab === 'info' && (
          <View className="p-4">
            <View className="mb-6">
              <Text className={`text-sm mb-1 font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Dealership Name
              </Text>
              <View 
                className={`flex-row items-center px-4 py-3 rounded-xl ${
                  isDarkMode ? 'bg-gray-800' : 'bg-white'
                }`}
              >
                <Ionicons 
                  name="business-outline" 
                  size={20} 
                  color={isDarkMode ? '#D55004' : '#D55004'} 
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Dealership Name"
                  placeholderTextColor={isDarkMode ? '#666' : '#999'}
                  className={isDarkMode ? 'text-white flex-1' : 'text-black flex-1'}
                />
              </View>
            </View>
            
            <View className="mb-6">
              <Text className={`text-sm mb-1 font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Address
              </Text>
              <View 
                className={`flex-row items-center px-4 py-3 rounded-xl ${
                  isDarkMode ? 'bg-gray-800' : 'bg-white'
                }`}
              >
                <Ionicons 
                  name="location-outline" 
                  size={20} 
                  color={isDarkMode ? '#D55004' : '#D55004'} 
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  value={formData.location}
                  onChangeText={(text) => setFormData({ ...formData, location: text })}
                  placeholder="Address"
                  placeholderTextColor={isDarkMode ? '#666' : '#999'}
                  className={isDarkMode ? 'text-white flex-1' : 'text-black flex-1'}
                />
              </View>
            </View>
            
            <View className="mb-6">
              <Text className={`text-sm mb-1 font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Phone Number
              </Text>
              <View 
                className={`flex-row items-center px-4 py-3 rounded-xl ${
                  isDarkMode ? 'bg-gray-800' : 'bg-white'
                }`}
              >
                <Ionicons 
                  name="call-outline" 
                  size={20} 
                  color={isDarkMode ? '#D55004' : '#D55004'} 
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  placeholder="Phone Number"
                  placeholderTextColor={isDarkMode ? '#666' : '#999'}
                  keyboardType="phone-pad"
                  className={isDarkMode ? 'text-white flex-1' : 'text-black flex-1'}
                />
              </View>
            </View>
          </View>
        )}
        
        {activeTab === 'location' && (
          <View>
            {/* Map */}
            <View className="w-full" style={{ height: 300 }}>
              <MapView
                ref={mapRef}
                style={{ width: '100%', height: '100%' }}
                region={mapRegion}
                onPress={handleMapPress}
                customMapStyle={mapStyle}
              >
                {selectedLocation && (
                  <Marker
                    coordinate={{
                      latitude: selectedLocation.latitude,
                      longitude: selectedLocation.longitude
                    }}
                    pinColor="#D55004"
                  />
                )}
              </MapView>
              
              <TouchableOpacity
                onPress={getLocation}
                className="absolute bottom-4 right-4 bg-white p-3 rounded-full shadow-lg"
              >
                <Ionicons name="locate" size={24} color="#D55004" />
              </TouchableOpacity>
            </View>
            
            {/* Location Information */}
            <View className="p-4">
              <View className="mb-5">
                <Text className={`text-sm mb-1 font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Latitude
                </Text>
                <View className={`flex-row items-center px-4 py-3 rounded-xl ${
                  isDarkMode ? 'bg-gray-800' : 'bg-white'
                }`}>
                  <Ionicons 
                    name="navigate-outline" 
                    size={20} 
                    color="#D55004" 
                    style={{ marginRight: 10 }}
                  />
                  <TextInput
                    value={formData.latitude}
                    onChangeText={(text) => setFormData({ ...formData, latitude: text })}
                    placeholder="Latitude"
                    placeholderTextColor={isDarkMode ? '#666' : '#999'}
                    keyboardType="numeric"
                    className={isDarkMode ? 'text-white flex-1' : 'text-black flex-1'}
                  />
                </View>
              </View>
              
              <View className="mb-5">
                <Text className={`text-sm mb-1 font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Longitude
                </Text>
                <View className={`flex-row items-center px-4 py-3 rounded-xl ${
                  isDarkMode ? 'bg-gray-800' : 'bg-white'
                }`}>
                  <Ionicons 
                    name="navigate-outline" 
                    size={20} 
                    color="#D55004" 
                    style={{ marginRight: 10 }}
                  />
                  <TextInput
                    value={formData.longitude}
                    onChangeText={(text) => setFormData({ ...formData, longitude: text })}
                    placeholder="Longitude"
                    placeholderTextColor={isDarkMode ? '#666' : '#999'}
                    keyboardType="numeric"
                    className={isDarkMode ? 'text-white flex-1' : 'text-black flex-1'}
                  />
                </View>
              </View>
              
              <TouchableOpacity
                onPress={getLocation}
                className="flex-row justify-center items-center p-3 mb-2 rounded-xl bg-blue-500/10"
              >
                <Ionicons name="locate" size={20} color="#3b82f6" style={{ marginRight: 8 }} />
                <Text className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>Use Current Location</Text>
              </TouchableOpacity>
              
              <Text className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-2 mb-4 text-center`}>
                Tap on the map to select a location or enter coordinates manually
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
      
      <View className="px-4 pb-6 pt-2 bg-transparent">
        <TouchableOpacity
          onPress={updateProfile}
          disabled={isLoading}
          className={`py-3 rounded-xl flex-row justify-center items-center ${
            isLoading ? 'bg-gray-500' : 'bg-[#D55004]'
          }`}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text className="text-white font-semibold text-lg">Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => router.back()}
          className="mt-3 py-3 rounded-xl flex-row justify-center items-center bg-transparent"
        >
          <Text className={isDarkMode ? "text-white" : "text-gray-700"}>Cancel</Text>
        </TouchableOpacity>
      </View>
      </SafeAreaView>
    </View>
  )
}