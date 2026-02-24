import { useState } from 'react'
import * as Location from 'expo-location'
import { Alert } from 'react-native'

interface LocationState {
  latitude: number
  longitude: number
}

interface MapRegion extends LocationState {
  latitudeDelta: number
  longitudeDelta: number
}

export const useMapLocation = () => {
  const [selectedLocation, setSelectedLocation] = useState<LocationState | null>(null)
  const [mapRegion, setMapRegion] = useState<MapRegion>({
    latitude: 33.8547,
    longitude: 35.8623,
    latitudeDelta: 2,
    longitudeDelta: 2
  })

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow location access.')
        return
      }

      const location = await Location.getCurrentPositionAsync({})
      const { latitude, longitude } = location.coords

      setSelectedLocation({ latitude, longitude })
      setMapRegion({
        latitude,
        longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421
      })

      return { latitude, longitude }
    } catch (error) {
      Alert.alert('Error', 'Failed to get location')
      return null
    }
  }

  return {
    selectedLocation,
    setSelectedLocation,
    mapRegion,
    setMapRegion,
    getLocation
  }
}
