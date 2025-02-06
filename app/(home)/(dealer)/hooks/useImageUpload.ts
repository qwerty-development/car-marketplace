import { useState, useCallback } from 'react'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { Alert } from 'react-native'
import { supabase } from '@/utils/supabase'

export const useImageUpload = (dealershipId: string | undefined) => {
  const [isUploading, setIsUploading] = useState(false)

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow photo access.')
        return null
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1
      })

      if (!result.canceled && result.assets?.[0]) {
        return result.assets[0].uri
      }
      return null
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image')
      return null
    }
  }

  const uploadImage = async (imageUri: string) => {
    if (!dealershipId) return null

    setIsUploading(true)
    try {
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
      const filePath = `${dealershipId}/${fileName}`
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64
      })

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, Buffer.from(base64, 'base64'), {
          contentType: 'image/jpeg'
        })

      if (uploadError) throw uploadError

      const { data: publicURLData } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath)

      if (!publicURLData?.publicUrl) throw new Error('Failed to get public URL')

      return publicURLData.publicUrl
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image')
      return null
    } finally {
      setIsUploading(false)
    }
  }

  const handleImageUpload = async () => {
    const imageUri = await pickImage()
    if (imageUri) {
      const publicUrl = await uploadImage(imageUri)
      return publicUrl
    }
    return null
  }

  return {
    isUploading,
    handleImageUpload
  }
}