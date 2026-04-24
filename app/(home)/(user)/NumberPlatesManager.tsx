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
import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '@/utils/supabase'
import { useTheme } from '@/utils/ThemeContext'
import { useAuth } from '@/utils/AuthContext'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/utils/LanguageContext'
import { LicensePlateTemplate } from '@/components/NumberPlateCard'
import { useWindowDimensions } from 'react-native'

export default function NumberPlatesManager() {
  const { isDarkMode } = useTheme()
  const { t } = useTranslation()
  const { language } = useLanguage()
  const router = useRouter()
  const params = useLocalSearchParams()
  const plateId = params.plateId ? parseInt(params.plateId as string) : null
  const isRTL = language === 'ar'
  const { user } = useAuth()
  const { width: windowWidth } = useWindowDimensions()
  const platePreviewWidth = windowWidth - 80 // Account for padding

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
      Alert.alert(t('common.error'), t('plates.error_load_plate'))
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
      Alert.alert(t('common.error'), t('plates.error_load'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleImagePick = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          t('permissions.denied'),
          t('plates.permission_camera_roll')
        )
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        base64: false,
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
      Alert.alert(t('common.error'), t('plates.error_pick_image'))
    } finally {
      setIsUploading(false)
    }
  }, [user?.id])

  const uploadImageToStorage = async (imageUri: string): Promise<string | null> => {
    if (!user?.id) {
      Alert.alert(t('common.error'), t('plates.error_user_id'))
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
      Alert.alert(t('common.error'), t('plates.error_upload'))
      return null
    }
  }

  const handleSave = async () => {
    // Validation
    if (!formData.letter.trim()) {
      Alert.alert(t('car.validation_error'), t('plates.validation_letter'))
      return
    }
    if (!formData.digits.trim()) {
      Alert.alert(t('car.validation_error'), t('plates.validation_digits'))
      return
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      Alert.alert(t('car.validation_error'), t('plates.validation_price'))
      return
    }
    // Picture is now optional - plate template will always be shown

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

        Alert.alert(t('common.success'), t('plates.success_updated'), [
          {
            text: t('common.ok'),
            onPress: () => {
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

        Alert.alert(t('common.success'), t('plates.success_added'), [
          {
            text: t('common.ok'),
            onPress: () => {
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
      Alert.alert(t('common.error'), t('plates.error_save'))
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
      t('plates.delete_plate'),
      t('plates.delete_confirmation'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error: dbError } = await supabase
                .from('number_plates')
                .update({ status: 'deleted' })
                .eq('id', plateId)

              if (dbError) throw dbError

              Alert.alert(t('common.success'), t('plates.success_deleted'))
              fetchNumberPlates()
            } catch (error) {
              console.error('Error deleting plate:', error)
              Alert.alert(t('common.error'), t('plates.error_delete'))
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
            {isEditMode ? t('plates.edit_title') : t('plates.manager_title')}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView className="flex-1 px-6 py-4" showsVerticalScrollIndicator={false}>
        {/* Add/Edit Plate Section */}
        <View className={`${isDarkMode ? 'bg-neutral-900' : 'bg-gray-50'} p-4 rounded-2xl mb-6`}>
          <Text className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-black'} mb-4`}>
            {isEditMode ? t('plates.edit_details') : t('plates.add_new_plate')}
          </Text>

          {/* Live Plate Preview */}
          <View
            style={{
              paddingVertical: 20,
              paddingHorizontal: 12,
              backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
              borderRadius: 16,
              marginBottom: 16,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
              {t('plates.plate_preview')}
            </Text>
            <LicensePlateTemplate
              letter={formData.letter || 'B'}
              digits={formData.digits || '123456'}
              width={platePreviewWidth}
            />
          </View>

          {/* Letter Input */}
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
              {t('plates.letter')}
            </Text>
            <TextInput
              value={formData.letter}
              onChangeText={(text) => {
                const validLetters = ['A', 'B', 'G', 'S', 'T', 'Z', 'M', 'Y', 'O', 'N', 'P']
                const filtered = text.toUpperCase().split('').filter(char => validLetters.includes(char)).join('')
                setFormData(prev => ({ ...prev, letter: filtered }))
              }}
              placeholder={t('plates.letter_placeholder')}
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              className={`${isDarkMode ? 'bg-neutral-800 text-white' : 'bg-white text-black'} p-4 rounded-xl`}
              maxLength={1}
              autoCapitalize="characters"
            />
            <Text className={`text-xs mt-1 ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`}>
              {t('plates.valid_letters')}
            </Text>
          </View>

          {/* Digits Input */}
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
              {t('plates.digits')}
            </Text>
            <TextInput
              value={formData.digits}
              onChangeText={(text) => {
                const filtered = text.replace(/[^0-9]/g, '')
                setFormData(prev => ({ ...prev, digits: filtered }))
              }}
              placeholder={t('plates.digits_placeholder')}
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              className={`${isDarkMode ? 'bg-neutral-800 text-white' : 'bg-white text-black'} p-4 rounded-xl`}
              keyboardType="numeric"
              maxLength={7}
            />
            <Text className={`text-xs mt-1 ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`}>
              {t('plates.max_digits')}
            </Text>
          </View>

          {/* Price Input */}
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
              {t('plates.price_usd')}
            </Text>
            <TextInput
              value={formData.price}
              onChangeText={(text) => setFormData(prev => ({ ...prev, price: text }))}
              placeholder={t('plates.enter_price')}
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
                {isEditMode ? t('plates.update_plate') : t('plates.add_plate')}
              </Text>
            )}
          </TouchableOpacity>

          {/* Delete Button - Only show in edit mode */}
          {isEditMode && plateId && (
            <TouchableOpacity
              onPress={() => handleDelete(plateId, formData.picture || '')}
              className={`mt-3 p-4 rounded-xl items-center flex-row justify-center ${
                isDarkMode ? 'bg-red-900/30 border border-red-500/30' : 'bg-red-50 border border-red-200'
              }`}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text className="ml-2 font-bold text-lg" style={{ color: '#EF4444' }}>
                {t('plates.delete_plate')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Existing Plates List - Only show when not in edit mode */}
        {!isEditMode && (
          <View className="mb-6">
          <Text className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-black'} mb-4`}>
            {t('plates.your_plates')}
          </Text>

          {isLoading ? (
            <ActivityIndicator size="large" color="#D55004" className="mt-8" />
          ) : numberPlates.length === 0 ? (
            <View className={`${isDarkMode ? 'bg-neutral-900' : 'bg-gray-50'} p-8 rounded-2xl items-center`}>
              <Ionicons name="document-text-outline" size={64} color={isDarkMode ? '#666' : '#999'} />
              <Text className={`mt-4 ${isDarkMode ? 'text-white/60' : 'text-gray-600'} text-center`}>
                {t('plates.no_plates_yet')}
              </Text>
            </View>
          ) : (
            numberPlates.map((plate) => (
              <View
                key={plate.id}
                className={`${isDarkMode ? 'bg-neutral-900' : 'bg-gray-50'} rounded-2xl mb-3 overflow-hidden`}
              >
                {/* Plate Template */}
                <View
                  style={{
                    paddingVertical: 16,
                    paddingHorizontal: 12,
                    backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <LicensePlateTemplate
                    letter={plate.letter}
                    digits={plate.digits}
                    width={platePreviewWidth}
                  />
                </View>
                
                {/* Info Section */}
                <View className="p-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-black'}`} style={{ letterSpacing: 2 }}>
                        {plate.letter} {plate.digits}
                      </Text>
                      <Text className={`text-lg text-orange-600 font-semibold mt-1`}>
                        ${parseFloat(plate.price).toLocaleString()}
                      </Text>
                      <Text className={`text-xs ${isDarkMode ? 'text-white/40' : 'text-gray-400'} mt-2`}>
                        {t('plates.added_date')} {new Date(plate.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDelete(plate.id, plate.picture)}
                      className="justify-center p-2"
                    >
                      <Ionicons name="trash-outline" size={24} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
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
