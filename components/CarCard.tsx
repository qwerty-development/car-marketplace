import React, { useMemo, useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Linking,
  Alert,
  FlatList,
  Image,
  ActivityIndicator
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { styled } from 'nativewind'
import { useTheme } from '@/utils/ThemeContext'
import { useRouter } from 'expo-router'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledImage = styled(Image)
const StyledTouchableOpacity = styled(TouchableOpacity)

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const OptimizedImage = ({ source, style, onLoad }: any) => {
  const [loaded, setLoaded] = useState(false)
  const { isDarkMode } = useTheme()

  const handleLoad = useCallback(() => {
    setLoaded(true)
    onLoad?.()
  }, [onLoad])

  return (
    <View style={[style, { overflow: 'hidden' }]}>
      {!loaded && (
        <View style={[style, {
          backgroundColor: isDarkMode ? '#2D2D2D' : '#E0E0E0',
          position: 'absolute',
          justifyContent: 'center',
          alignItems: 'center'
        }]}>
          <ActivityIndicator size="large" color="#D55004" />
        </View>
      )}
      <StyledImage
        source={source}
        style={[style, { opacity: loaded ? 1 : 0 }]}
        onLoad={handleLoad}
        resizeMode="cover"
      />
    </View>
  )
}

const SpecItem = ({ icon, title, value, isDarkMode }: any) => (
  <StyledView className="flex-1 items-center justify-center">
    <StyledText
      className={`text-xs mb-3 ${isDarkMode ? 'text-[#e6e6e6]' : 'text-textgray'}`}
      style={{ textAlign: 'center' }}
    >
      {title}
    </StyledText>
    <Ionicons
      name={icon}
      size={20}
      color={isDarkMode ? '#FFFFFF' : '#000000'}
      style={{ marginVertical: 3 }}
    />
    <StyledText
      className={`text-sm font-bold mt-3 ${isDarkMode ? 'text-white' : 'text-black'}`}
      style={{ textAlign: 'center' }}
    >
      {value}
    </StyledText>
  </StyledView>
)

const ActionButton = ({ icon, text, onPress, isDarkMode }: any) => (
  <StyledTouchableOpacity
    onPress={onPress}
    className="items-center justify-center flex-1">
    <Ionicons
      name={icon}
      size={24}
      color={isDarkMode ? '#FFFFFF' : '#000000'}
    />
    <StyledText
      className={`text-xs mt-1 ${isDarkMode ? 'text-white' : 'text-black'}`}>
      {text}
    </StyledText>
  </StyledTouchableOpacity>
)

export default function CarCard({
  car,
  onPress,
  onFavoritePress,
  isFavorite,
  isDealer = false
}: any) {
  const { isDarkMode } = useTheme()
  const router = useRouter()
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const flatListRef = useRef(null)

  const formattedPrice = useMemo(() => {
    return `$${car.price.toLocaleString()}`
  }, [car.price])

  const handleCall = useCallback(() => {
    if (car.dealership_phone) {
      Linking.openURL(`tel:${car.dealership_phone}`)
    } else {
      Alert.alert('Phone number not available')
    }
  }, [car.dealership_phone])

  const handleDealershipPress = useCallback(() => {
    const route = isDealer ? '/(home)/(dealer)/DealershipDetails' : '/(home)/(user)/DealershipDetails'
    router.push({
      pathname: route,
      params: { dealershipId: car.dealership_id }
    })
  }, [isDealer, router, car.dealership_id])

  const handleWhatsApp = useCallback(() => {
    if (car.dealership_phone) {
      const message = `Hi, I'm interested in the ${car.year} ${car.make} ${car.model}.`
      Linking.openURL(`https://wa.me/${car.dealership_phone}?text=${encodeURIComponent(message)}`)
    } else {
      Alert.alert('WhatsApp number not available')
    }
  }, [car])

  const handleChat = useCallback(() => {
    Alert.alert('Chat feature coming soon!')
  }, [])

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentImageIndex(viewableItems[0].index)
    }
  }).current

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50
  }).current

  const renderImage = useCallback(
    ({ item }: any) => (
      <View className="relative">
        <OptimizedImage
          source={{ uri: item }}
          style={{
            width: SCREEN_WIDTH - 35,
            height: 245,
          }}
        />
        <StyledView className="w-full p-4 flex flex-row justify-between">
          <StyledView className="rounded-lg py-1">
            <StyledText className={`text-xl font-medium ${isDarkMode ? 'text-white' : 'text-black'}`}>
              {car.make} {car.model}
            </StyledText>
          </StyledView>
          <StyledView className="bg-red rounded-full px-3 py-1">
            <StyledText className="text-white text-xl font-bold">
              {formattedPrice}
            </StyledText>
          </StyledView>
        </StyledView>
        {!isDealer && (
          <StyledTouchableOpacity
            onPress={onFavoritePress}
            className={`absolute top-4 right-4 ${isDarkMode ? 'bg-black/60' : 'bg-black/40'} rounded-full p-2`}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorite ? '#EF4444' : '#FFFFFF'}
            />
          </StyledTouchableOpacity>
        )}
      </View>
    ),
    [formattedPrice, isFavorite, isDealer, onFavoritePress, isDarkMode]
  )

  return (
    <StyledView
      className={`m-4 mb-4 ${
        isDarkMode ? 'bg-gray' : 'bg-[#e6e6e6]'
      } rounded-3xl overflow-hidden shadow-xl`}>
      <StyledTouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <FlatList
          ref={flatListRef}
          data={car.images}
          renderItem={renderImage}
          keyExtractor={(item, index) => index.toString()}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews={true}
        />

        <StyledView className="flex-row justify-between mt-4 mb-4">
          <SpecItem
            title="Year"
            icon="calendar-outline"
            value={car.year}
            isDarkMode={isDarkMode}
          />
          <SpecItem
            title="Mileage"
            icon="speedometer-outline"
            value={`${(car.mileage / 1000).toFixed(1)}k`}
            isDarkMode={isDarkMode}
          />
          <SpecItem
            title="Transmission"
            icon="cog-outline"
            value={car.transmission}
            isDarkMode={isDarkMode}
          />
          <SpecItem
            title="Condition"
            icon="car-sport-outline"
            value={car.condition}
            isDarkMode={isDarkMode}
          />
        </StyledView>

        <StyledView className="p-4">
          <StyledView className="flex-row items-center mb-4">
            {car.dealership_logo && (
              <TouchableOpacity onPress={handleDealershipPress}>
                <OptimizedImage
                  source={{ uri: car.dealership_logo }}
                  style={{ width: 48, height: 48, borderRadius: 24 }}
                />
              </TouchableOpacity>
            )}
            <StyledView className="ml-3 flex-1">
              <StyledText
                className={`text-base font-medium ${
                  isDarkMode ? 'text-white' : 'text-black'
                }`}>
                {car.dealership_name}
              </StyledText>
              <StyledText
                className={`text-sm ${
                  isDarkMode ? 'text-[#e6e6e6]' : 'text-textgray'
                }`}>
                {car.dealership_location}
              </StyledText>
            </StyledView>
          </StyledView>

          <StyledView className="flex-row justify-between">
            <ActionButton
              icon="call-outline"
              text="Call"
              onPress={handleCall}
              isDarkMode={isDarkMode}
            />
            <ActionButton
              icon="chatbubble-outline"
              text="Chat"
              onPress={handleChat}
              isDarkMode={isDarkMode}
            />
          </StyledView>
        </StyledView>
      </StyledTouchableOpacity>
    </StyledView>
  )
}