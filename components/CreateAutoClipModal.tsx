//createautoclipmodal
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  TextInput
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FontAwesome } from '@expo/vector-icons'
import VideoPickerButton from './VideoPickerComponent'
import CarSelector from './CarSelector'
import { ResizeMode, Video } from 'expo-av'

interface CreateAutoClipModalProps {
  isVisible: boolean
  onClose: () => void
  dealership: { id: number } | null
  onSuccess: () => void
}

interface VideoAsset {
  uri: string
  width: number
  height: number
  duration: number
  type?: string
  fileSize?: number
}

interface Car {
  id: number
  make: string
  model: string
  year: number
  price: number
  status: 'available' | 'pending' | 'sold'
}

export default function CreateAutoClipModal({ 
  isVisible, 
  onClose, 
  dealership, 
  onSuccess 
}: CreateAutoClipModalProps) {
  const { isDarkMode } = useTheme()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null)
  const [video, setVideo] = useState<VideoAsset | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [cars, setCars] = useState<Car[]>([])

  useEffect(() => {
    if (dealership && isVisible) {
      fetchCars()
    }
  }, [dealership, isVisible])

  const fetchCars = async () => {
    try {
      const { data, error } = await supabase
        .from('cars')
        .select('id, make, model, year, price, status')
        .eq('dealership_id', dealership!.id)
        .in('status', ['available', 'pending'])

      if (error) throw error
      setCars(data || [])
    } catch (error) {
      console.error('Error fetching cars:', error)
      Alert.alert('Error', 'Failed to load cars')
    }
  }

  const handleSubmit = async () => {
    if (!title || !selectedCarId || !video) {
      Alert.alert('Error', 'Please fill in all required fields')
      return
    }
  
    setIsLoading(true)
    try {
      const fileUri = video.uri
      const isMovFile = fileUri.toLowerCase().endsWith('.mov')
      const fileExtension = isMovFile ? 'mov' : 'mp4'
  
      const timestamp = Date.now()
      const random = Math.floor(Math.random() * 10000)
      const fileName = `${timestamp}_${random}.${fileExtension}`
      const filePath = `${dealership!.id}/${fileName}`
  
      // Direct upload of the video file
      const { error: uploadError } = await supabase.storage
        .from('autoclips')
        .upload(filePath, {
          uri: fileUri,
          type: isMovFile ? 'video/quicktime' : 'video/mp4',
          name: fileName,
        })
  
      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw uploadError
      }
  
      const { data: { publicUrl } } = supabase.storage
        .from('autoclips')
        .getPublicUrl(filePath)
  
      const { error: dbError } = await supabase
        .from('auto_clips')
        .insert({
          dealership_id: dealership!.id,
          car_id: selectedCarId,
          title: title.trim(),
          description: description.trim(),
          video_url: publicUrl,
          thumbnail_url: publicUrl,
          status: 'published',
          views: 0,
          likes: 0,
          viewed_users: [],
          liked_users: [],
          published_at: new Date().toISOString()
        })
  
      if (dbError) throw dbError
  
      Alert.alert('Success', 'AutoClip created successfully')
      onSuccess()
      onClose()
      resetForm()
  
    } catch (error: any) {
      console.error('Error:', error)
      Alert.alert('Error', error.message || 'Failed to create AutoClip')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setSelectedCarId(null)
    setVideo(null)
  }

  return (
    <Modal
      visible={isVisible}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <LinearGradient
        colors={isDarkMode ? ['#000000', '#1A1A1A'] : ['#FFFFFF', '#F0F0F0']}
        className="flex-1"
      >
        <SafeAreaView className="flex-1">
          <View className="flex-row justify-between items-center p-4 border-b border-red">
            <TouchableOpacity onPress={onClose}>
              <FontAwesome name="times" size={24} color={isDarkMode ? 'white' : 'black'} />
            </TouchableOpacity>
            <Text className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
              Create AutoClip
            </Text>
            <TouchableOpacity 
              onPress={handleSubmit}
              disabled={isLoading}
            >
              <Text className={`text-red font-bold ${isLoading ? 'opacity-50' : ''}`}>
                {isLoading ? 'Creating...' : 'Create'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            className="flex-1 p-4"
            keyboardShouldPersistTaps="handled"
          >
            <View className="mb-4">
              <Text className={`mb-2 font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}>
                Title *
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Enter title"
                placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
                className={`border border-red rounded-lg p-3 ${
                  isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-black'
                }`}
                maxLength={100}
              />
            </View>

            <View className="mb-4">
              <Text className={`mb-2 font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}>
                Description
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Enter description"
                placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
                multiline
                numberOfLines={4}
                maxLength={500}
                className={`border border-red rounded-lg p-3 min-h-[100px] ${
                  isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-black'
                }`}
                textAlignVertical="top"
              />
            </View>

            <CarSelector
    cars={cars}
    selectedCarId={selectedCarId}
    onCarSelect={setSelectedCarId}
  />

  <VideoPickerButton
    onVideoSelect={setVideo}
    videoUri={video?.uri}
  />

  {video && (
    <View className="mt-4">
      <Video
        source={{ uri: video.uri }}
        style={{ width: '100%', height: 200 }}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        isLooping
        shouldPlay={false}
        className="rounded-lg"
      />
      <Text className={`mt-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
        Video size: {(video.fileSize! / (1024 * 1024)).toFixed(2)} MB
      </Text>
    </View>
  )}
</ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  )
}