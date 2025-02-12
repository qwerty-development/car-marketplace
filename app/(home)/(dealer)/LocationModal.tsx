import React from 'react'
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Pressable
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import MapView, { Marker } from 'react-native-maps'

interface LocationModalProps {
  visible: boolean
  onClose: () => void
  isDarkMode: boolean
  formData: {
    location: string
    latitude: string
    longitude: string
  }
  setFormData: (data: any) => void
  mapRef: React.RefObject<MapView>
  mapRegion: {
    latitude: number
    longitude: number
    latitudeDelta: number
    longitudeDelta: number
  }
  selectedLocation: {
    latitude: number
    longitude: number
  } | null
  setSelectedLocation: (location: { latitude: number; longitude: number } | null) => void
  getLocation: () => Promise<void>
  onUpdate: () => Promise<void>
  isLoading: boolean
}

export const LocationModal: React.FC<LocationModalProps> = ({
  visible,
  onClose,
  isDarkMode,
  formData,
  setFormData,
  mapRef,
  mapRegion,
  selectedLocation,
  setSelectedLocation,
  getLocation,
  onUpdate,
  isLoading
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable 
        className="flex-1 bg-black/50"
        onPress={onClose}
      >
        <View className="flex-1 justify-end">
          <Pressable 
            className={`${
              isDarkMode ? 'bg-neutral-900' : 'bg-white'
            } rounded-t-3xl p-6 shadow-lg h-3/4`}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}>
                Location Settings
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#fff' : '#000'} />
              </TouchableOpacity>
            </View>

            <View className="flex-1">
              <TextInput
                className={`${
                  isDarkMode ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-black'
                } p-4 rounded-xl mb-4`}
                value={formData.location}
                onChangeText={text => setFormData((prev: any) => ({ ...prev, location: text }))}
                placeholder="Address"
                placeholderTextColor={isDarkMode ? '#999' : '#666'}
                cursorColor="#D55004"
              />

              <MapView
                ref={mapRef}
                style={{ flex: 1, borderRadius: 12, marginBottom: 16 }}
                region={mapRegion}
                onPress={e => {
                  setSelectedLocation(e.nativeEvent.coordinate)
                  setFormData((prev: any) => ({
                    ...prev,
                    latitude: e.nativeEvent.coordinate.latitude.toString(),
                    longitude: e.nativeEvent.coordinate.longitude.toString()
                  }))
                }}
              >
                {selectedLocation && <Marker coordinate={selectedLocation} />}
              </MapView>

              <View className="flex-row space-x-4">
                <TouchableOpacity
                  className="flex-1 bg-blue-500 p-4 rounded-xl flex-row justify-center items-center"
                  onPress={getLocation}
                >
                  <Ionicons name="locate-outline" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text className="text-white font-semibold">Get Current Location</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                className="bg-red mt-4 p-4 rounded-xl flex-row justify-center items-center"
                onPress={() => {
                  onUpdate()
                  onClose()
                }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={20} color="white" style={{ marginRight: 8 }} />
                    <Text className="text-white font-semibold">Save Location</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  )
}