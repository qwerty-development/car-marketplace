// VideoPickerComponent.tsx
import React from 'react'
import { TouchableOpacity, Text, View, Dimensions, Alert } from 'react-native'
import { FontAwesome } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { Video } from 'expo-av'
import { useTheme } from '@/utils/ThemeContext'

interface VideoAsset {
  uri: string
  width: number
  height: number
  duration: number
  type?: string
  fileSize?: number
}

interface VideoPickerButtonProps {
  onVideoSelect: (video: VideoAsset) => void
  videoUri?: string
}

export default function VideoPickerButton({ onVideoSelect, videoUri }: VideoPickerButtonProps) {
  const { isDarkMode } = useTheme()
  const screenWidth = Dimensions.get('window').width

  const pickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to make this work!')
        return
      }
  
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 1,
        videoMaxDuration: 60,
      })
  
      if (!result.canceled && result.assets[0]) {
        const videoAsset = result.assets[0]
        
        if (!videoAsset.uri) {
          throw new Error('No video URI received')
        }
  
        // Check if it's a MOV file and force the correct mime type
        const isMovFile = videoAsset.uri.toLowerCase().endsWith('.mov')
        const assetWithType = {
          ...videoAsset,
          type: isMovFile ? 'video/quicktime' : 'video/mp4'
        }
  
        console.log('Selected video:', {
          uri: assetWithType.uri,
          type: assetWithType.type,
          fileSize: assetWithType.fileSize,
          duration: assetWithType.duration
        })
  
        onVideoSelect(assetWithType)
      }
    } catch (error) {
      console.error('Error picking video:', error)
      Alert.alert('Error', 'Failed to select video. Please try again.')
    }
  }

  return (
    <View>
      <TouchableOpacity 
        onPress={pickVideo}
        className={`border-2 border-dashed border-red rounded-lg p-4 my-2 items-center
          ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}
      >
        <FontAwesome 
          name={videoUri ? 'play' : 'video-camera'} 
          size={24} 
          color={isDarkMode ? '#FFFFFF' : '#000000'} 
        />
        <Text className={`mt-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
          {videoUri ? 'Change Video' : 'Select Video'}
        </Text>
        {videoUri && (
          <Text className={`mt-1 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Max duration: 60 seconds
          </Text>
        )}
      </TouchableOpacity>

      {videoUri && (
        <View className="mt-4 rounded-lg overflow-hidden">
          <Video
            source={{ uri: videoUri }}
            style={{ width: screenWidth - 32, height: 200 }}
            useNativeControls
            resizeMode="contain"
            isLooping
          />
        </View>
      )}
    </View>
  )
}