import React from 'react'
import { View, Image, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface DealerLogoPickerProps {
  logoUri?: string | null
  onPick: () => void | Promise<void>
  isUploading?: boolean
  size?: number
  isRTL?: boolean
  containerClassName?: string
  imageClassName?: string
  badgeClassName?: string
}

const PLACEHOLDER_URI = 'https://via.placeholder.com/150'

export const DealerLogoPicker: React.FC<DealerLogoPickerProps> = ({
  logoUri,
  onPick,
  isUploading = false,
  size = 128,
  isRTL = false,
  containerClassName = '',
  imageClassName = 'border-4 border-white/20',
  badgeClassName = 'bg-white/90'
}) => {
  return (
    <View
      className={`relative ${containerClassName}`}
      style={{ width: size, height: size }}
    >
      <Image
        source={{ uri: logoUri || PLACEHOLDER_URI }}
        className={`rounded-full ${imageClassName}`}
        style={{ width: size, height: size }}
      />
      <TouchableOpacity
        onPress={onPick}
        disabled={isUploading}
        className={`absolute bottom-0 p-2 rounded-full shadow-lg ${badgeClassName}`}
        style={isRTL ? { left: 0 } : { right: 0 }}
      >
        {isUploading ? (
          <ActivityIndicator color="#D55004" size="small" />
        ) : (
          <Ionicons name="camera" size={20} color="#D55004" />
        )}
      </TouchableOpacity>
    </View>
  )
}

