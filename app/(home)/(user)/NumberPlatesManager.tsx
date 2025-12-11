import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { supabase } from '@/utils/supabase'
import { useTheme } from '@/utils/ThemeContext'
import { useAuth } from '@/utils/AuthContext'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/utils/LanguageContext'

export default function NumberPlatesManager() {
  const { isDarkMode } = useTheme()
  const { t } = useTranslation()
  const { language } = useLanguage()
  const router = useRouter()
  const params = useLocalSearchParams()
  const plateId = params.plateId ? parseInt(params.plateId as string) : null
  const isRTL = language === 'ar'
  const { user } = useAuth()

  const [formData, setFormData] = useState({
    letter: '',
    digits: '',
    price: '',
    picture: null as string | null
  })
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [numberPlates, setNumberPlates] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEditMode, setIsEditMode] = useState(false)

  useEffect(() => {
    if (user?.id) {
      if (plateId) {
        loadPlateForEdit(plateId)
      } else {
        fetchNumberPlates()
      }
    }
  }, [user?.id, plateId])

  const loadPlateForEdit = async (id: number) => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('number_plates')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      if (data) {
        setFormData({
          letter: data.letter,
          digits: data.digits,
          price: data.price.toString(),
          picture: data.picture
        })
        setIsEditMode(true)
      }
    } catch (error) {
      console.error('Error loading plate:', error)
      Alert.alert('Error', 'Failed to load plate data')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchNumberPlates = async () => {
    if (!user?.id) return
    
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('number_plates')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })

      if (error) throw error
      setNumberPlates(data || [])
    } catch (error) {
      console.error('Error fetching number plates:', error)
      Alert.alert('Error', 'Failed to load number plates')
    } finally {
      setIsLoading(false)
    }
  }

  const handleImagePick = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Sorry, we need camera roll permissions to upload plate pictures!'
        )
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        base64: false
      })

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return
      }

      setIsUploading(true)
      const imageUri = result.assets[0].uri

      // Upload to storage
      const publicUrl = await uploadImageToStorage(imageUri)
      if (publicUrl) {
        setFormData(prev => ({ ...prev, picture: publicUrl }))
      }
    } catch (error) {
      console.error('Error picking image:', error)
      Alert.alert('Error', 'Failed to pick image. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }, [user?.id])

  const uploadImageToStorage = async (imageUri: string): Promise<string | null> => {
    if (!user?.id) {
      Alert.alert('Error', 'User ID not found')
      return null
    }

    try {
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(7)
      const extension = imageUri.split('.').pop()?.toLowerCase() || 'jpg'
      const fileName = `plate_${timestamp}_${randomId}.${extension}`
      const filePath = `users/${user.id}/${fileName}`

      // Determine correct MIME type based on extension
      let mimeType = 'image/jpeg'
      if (extension === 'png') mimeType = 'image/png'
      else if (extension === 'jpg' || extension === 'jpeg') mimeType = 'image/jpeg'
      else if (extension === 'webp') mimeType = 'image/webp'
      else if (extension === 'heic') mimeType = 'image/heic'

      console.log('Uploading plate image:', { fileName, filePath, uri: imageUri, mimeType })

      // Read file as base64 and convert to ArrayBuffer for upload
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64
      })

      // Convert base64 to ArrayBuffer
      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('plate_numbers')
        .upload(filePath, bytes.buffer, {
          contentType: mimeType,
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error details:', uploadError)
        throw uploadError
      }

      // Get public URL
      const { data: publicURLData } = supabase.storage
        .from('plate_numbers')
        .getPublicUrl(filePath)

      if (!publicURLData?.publicUrl) {
        throw new Error('Failed to retrieve public URL')
      }

      console.log('Upload successful, public URL:', publicURLData.publicUrl)
      return publicURLData.publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      Alert.alert('Error', 'Failed to upload image. Please try again.')
      return null
    }
  }

  const handleSave = async () => {
    // Validation
    if (!formData.letter.trim()) {
      Alert.alert('Validation Error', 'Please enter the letter part of the plate')
      return
    }
    if (!formData.digits.trim()) {
      Alert.alert('Validation Error', 'Please enter the digits part of the plate')
      return
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid price')
      return
    }
    if (!formData.picture) {
      Alert.alert('Validation Error', 'Please upload a picture of the plate')
      return
    }

    setIsSaving(true)
    try {
      if (isEditMode && plateId) {
        // Update existing plate
        const { error } = await supabase
          .from('number_plates')
          .update({
            letter: formData.letter.trim(),
            digits: formData.digits.trim(),
            price: parseFloat(formData.price),
            picture: formData.picture
          })
          .eq('id', plateId)

        if (error) throw error

        Alert.alert('Success', 'Number plate updated successfully!', [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to MyListings
              router.back()
            }
          }
        ])
      } else {
        // Insert new plate
        const { error } = await supabase
          .from('number_plates')
          .insert({
            letter: formData.letter.trim(),
            digits: formData.digits.trim(),
            price: parseFloat(formData.price),
            picture: formData.picture,
            user_id: user?.id,
            dealership_id: null // Set to null for user-owned plates
          })

        if (error) throw error

        Alert.alert('Success', 'Number plate added successfully!', [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to MyListings
              router.back()
            }
          }
        ])
      }
      
      // Reset form if not in edit mode
      if (!isEditMode) {
        setFormData({
          letter: '',
          digits: '',
          price: '',
          picture: null
        })
        fetchNumberPlates()
      }
    } catch (error) {
      console.error('Error saving number plate:', error)
      Alert.alert('Error', 'Failed to save number plate. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const resolveStoragePathFromUrl = (publicUrl: string, bucket: string): string | null => {
    try {
      const { pathname } = new URL(publicUrl)
      const decodedPath = decodeURIComponent(pathname)
      const bucketPath = `/storage/v1/object/public/${bucket}/`
      if (!decodedPath.startsWith(bucketPath)) {
        console.warn('Bucket marker not found in URL:', publicUrl)
        return null
      }
      return decodedPath.slice(bucketPath.length)
    } catch (error) {
      console.error('Failed to resolve storage path from URL:', error)
      return null
    }
  }

  const handleDelete = async (plateId: number, pictureUrl: string) => {
    Alert.alert(
      'Delete Plate',
      'Are you sure you want to delete this number plate? It will be hidden from all users but conversations will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Soft delete: update status to 'deleted' instead of hard delete
              const { error: dbError } = await supabase
                .from('number_plates')
                .update({ status: 'deleted' })
                .eq('id', plateId)

              if (dbError) throw dbError

              Alert.alert('Success', 'Number plate deleted successfully')
              fetchNumberPlates()
            } catch (error) {
              console.error('Error deleting plate:', error)
              Alert.alert('Error', 'Failed to delete number plate')
            }
          }
        }
      ]
    )
  }

  return (
    <View className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
      {/* Header */}
      <LinearGradient
        colors={isDarkMode ? ['#D55004', '#000000'] : ['#D55004', '#DADADA']}
        className="pt-12 pb-6"
      >
        <View className={`flex-row items-center px-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4"
          >
            <Ionicons
              name={isRTL ? 'chevron-forward' : 'chevron-back'}
              size={28}
              color="white"
            />
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold flex-1">
            {isEditMode ? 'Edit License Plate' : 'Number Plates Manager'}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView className="flex-1 px-6 py-4" showsVerticalScrollIndicator={false}>
        {/* Add/Edit Plate Section */}
        <View className={`${isDarkMode ? 'bg-neutral-900' : 'bg-gray-50'} p-4 rounded-2xl mb-6`}>
          <Text className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-black'} mb-4`}>
            {isEditMode ? 'Edit Plate Details' : 'Add New Plate'}
          </Text>

          {/* Image Upload */}
          <TouchableOpacity
            onPress={handleImagePick}
            disabled={isUploading}
            className={`${isDarkMode ? 'bg-neutral-800' : 'bg-gray-200'} rounded-xl p-4 mb-4 items-center justify-center`}
            style={{ minHeight: 150 }}
          >
            {formData.picture ? (
              <Image
                source={{ uri: formData.picture }}
                className="w-full h-32 rounded-xl"
                resizeMode="cover"
              />
            ) : (
              <View className="items-center">
                {isUploading ? (
                  <ActivityIndicator size="large" color="#D55004" />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={48} color={isDarkMode ? '#fff' : '#000'} />
                    <Text className={`mt-2 ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                      Tap to upload plate picture
                    </Text>
                  </>
                )}
              </View>
            )}
          </TouchableOpacity>

          {/* Letter Input */}
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
              Letter
            </Text>
            <TextInput
              value={formData.letter}
              onChangeText={(text) => setFormData(prev => ({ ...prev, letter: text }))}
              placeholder="e.g. A, B, C..."
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              className={`${isDarkMode ? 'bg-neutral-800 text-white' : 'bg-white text-black'} p-4 rounded-xl`}
              maxLength={10}
            />
          </View>

          {/* Digits Input */}
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
              Digits
            </Text>
            <TextInput
              value={formData.digits}
              onChangeText={(text) => setFormData(prev => ({ ...prev, digits: text }))}
              placeholder="e.g. 123, 456..."
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              className={`${isDarkMode ? 'bg-neutral-800 text-white' : 'bg-white text-black'} p-4 rounded-xl`}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>

          {/* Price Input */}
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
              Price (USD)
            </Text>
            <TextInput
              value={formData.price}
              onChangeText={(text) => setFormData(prev => ({ ...prev, price: text }))}
              placeholder="Enter price"
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              className={`${isDarkMode ? 'bg-neutral-800 text-white' : 'bg-white text-black'} p-4 rounded-xl`}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving || isUploading}
            className="bg-orange-600 p-4 rounded-xl items-center"
            style={{ opacity: (isSaving || isUploading) ? 0.6 : 1 }}
          >
            {isSaving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-lg">
                {isEditMode ? 'Update Plate' : 'Add Plate'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Existing Plates List - Only show when not in edit mode */}
        {!isEditMode && (
          <View className="mb-6">
          <Text className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-black'} mb-4`}>
            Your Number Plates
          </Text>

          {isLoading ? (
            <ActivityIndicator size="large" color="#D55004" className="mt-8" />
          ) : numberPlates.length === 0 ? (
            <View className={`${isDarkMode ? 'bg-neutral-900' : 'bg-gray-50'} p-8 rounded-2xl items-center`}>
              <Ionicons name="document-text-outline" size={64} color={isDarkMode ? '#666' : '#999'} />
              <Text className={`mt-4 ${isDarkMode ? 'text-white/60' : 'text-gray-600'} text-center`}>
                No number plates added yet
              </Text>
            </View>
          ) : (
            numberPlates.map((plate) => (
              <View
                key={plate.id}
                className={`${isDarkMode ? 'bg-neutral-900' : 'bg-gray-50'} p-4 rounded-2xl mb-3`}
              >
                <View className="flex-row">
                  {plate.picture && (
                    <Image
                      source={{ uri: plate.picture }}
                      className="w-24 h-24 rounded-xl mr-3"
                      resizeMode="cover"
                    />
                  )}
                  <View className="flex-1">
                    <Text className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
                      {plate.letter} {plate.digits}
                    </Text>
                    <Text className={`text-lg text-orange-600 font-semibold mt-1`}>
                      ${parseFloat(plate.price).toLocaleString()}
                    </Text>
                    <Text className={`text-xs ${isDarkMode ? 'text-white/40' : 'text-gray-400'} mt-2`}>
                      Added {new Date(plate.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDelete(plate.id, plate.picture)}
                    className="justify-center"
                  >
                    <Ionicons name="trash-outline" size={24} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
