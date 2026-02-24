import React from 'react'
import { View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useTheme } from '@/utils/ThemeContext'

const SkeletonPlaceholder = ({ width, height, style }:any) => {
  const { isDarkMode } = useTheme()
  
  return (
    <View
      style={[
        {
          width,
          height,
          backgroundColor: isDarkMode ? '#333333' : '#E5E5E5',
          borderRadius: 8,
        },
        style,
      ]}
    />
  )
}

export const ListingSkeletonLoader = () => {
  const { isDarkMode } = useTheme()
  
  // Create an array of 3 skeletons
  return Array(3)
    .fill(0)
    .map((_, index) => (
      <Animated.View
        key={`skeleton-${index}`}
        entering={FadeInDown.delay(index * 100)}
        className={`m-4 mb-4 ${
          isDarkMode ? 'bg-textgray' : 'bg-[#e1e1e1]'
        } rounded-3xl overflow-hidden shadow-xl`}
      >
        {/* Image Skeleton */}
        <View className="relative">
          <SkeletonPlaceholder width="100%" height={300} />
          
          {/* Status Badge Skeleton */}
          <View className="absolute top-4 left-4 flex-row items-center">
            <SkeletonPlaceholder width={80} height={30} style={{ borderRadius: 20 }} />
            
            {/* Stats Container Skeleton */}
            <View className="flex-row space-x-2 ml-2">
              <SkeletonPlaceholder width={60} height={30} style={{ borderRadius: 20 }} />
              <SkeletonPlaceholder width={60} height={30} style={{ borderRadius: 20 }} />
            </View>
          </View>
          
          {/* Title and Price Skeleton */}
          <View className="absolute bottom-5 left-5">
            <SkeletonPlaceholder width={200} height={30} style={{ marginBottom: 5 }} />
            <SkeletonPlaceholder width={150} height={40} />
          </View>
        </View>
        
        {/* Car Specs Skeleton */}
        <View className="px-5 py-4">
          <View className="flex-row justify-between">
            {[1, 2, 3, 4].map((_, i) => (
              <View key={i} className="flex-1 items-center justify-center">
                <SkeletonPlaceholder width={40} height={10} style={{ marginBottom: 10 }} />
                <SkeletonPlaceholder width={30} height={30} style={{ borderRadius: 15, marginVertical: 5 }} />
                <SkeletonPlaceholder width={50} height={15} style={{ marginTop: 10 }} />
              </View>
            ))}
          </View>
        </View>
      </Animated.View>
    ))
}