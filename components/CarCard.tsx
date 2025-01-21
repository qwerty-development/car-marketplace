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
  ActivityIndicator,
  TouchableWithoutFeedback,
  Pressable
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { styled } from 'nativewind'
import { useTheme } from '@/utils/ThemeContext'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'

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
        <View
          style={[
            style,
            {
              backgroundColor: isDarkMode ? '#2D2D2D' : '#E0E0E0',
              position: 'absolute',
              justifyContent: 'center',
              alignItems: 'center'
            }
          ]}>
          <ActivityIndicator size='large' color='#D55004' />
        </View>
      )}
      <StyledImage
        source={source}
        style={[style, { opacity: loaded ? 1 : 0 }]}
        onLoad={handleLoad}
        resizeMode='cover'
      />
    </View>
  )
}

const SpecItem = ({ icon, title, value, isDarkMode }: any) => (
  <StyledView className='flex-1 items-center justify-center'>
    <StyledText
      className={`text-xs mb-3 ${
        isDarkMode ? 'text-[#e6e6e6]' : 'text-textgray'
      }`}
      style={{ textAlign: 'center' }}>
      {title}
    </StyledText>
    <Ionicons
      name={icon}
      size={30}
      color={isDarkMode ? '#FFFFFF' : '#000000'}
      style={{ marginVertical: 3 }}
    />
    <StyledText
      className={`text-sm font-bold mt-3 ${
        isDarkMode ? 'text-white' : 'text-black'
      }`}
      style={{ textAlign: 'center' }}>
      {value}
    </StyledText>
  </StyledView>
)

const ActionButton = ({ icon, text, onPress, isDarkMode }: any) => (
  <StyledTouchableOpacity
    onPress={onPress}
    className='items-center justify-center px-4'>
    <Ionicons
      name={icon}
      size={25}
      color={isDarkMode ? '#FFFFFF' : '#000000'}
    />
    {text && (
      <StyledText
        className={`text-xs mt-0.5 ${
          isDarkMode ? 'text-white' : 'text-black'
        }`}>
        {text}
      </StyledText>
    )}
  </StyledTouchableOpacity>
)

export default function CarCard({
  car,
  onFavoritePress,
  isFavorite,
  isDealer = false
}: any) {
  const { isDarkMode } = useTheme()
  const router = useRouter()
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const flatListRef = useRef(null)

  const handleCardPress = useCallback(() => {
    router.push({
      pathname: isDealer 
        ? '/(home)/(dealer)/CarDetailModalIOS' 
        : '/(home)/(user)/CarDetails',
      params: { 
        carId: car.id,
        car: JSON.stringify(car),
        isDealerView: isDealer 
      }
    })
  }, [router, car, isDealer])

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
    const route = isDealer
      ? '/(home)/(dealer)/DealershipDetails'
      : '/(home)/(user)/DealershipDetails'
    router.push({
      pathname: route,
      params: { dealershipId: car.dealership_id }
    })
  }, [isDealer, router, car.dealership_id])

  const formattedLocation = useMemo(() => {
    if (car.dealership_location?.length > 20) {
      return (
        car.dealership_location.slice(0, 20) +
        '\n' +
        car.dealership_location.slice(20)
      )
    }
    return car.dealership_location
  }, [car.dealership_location])

  const handleWhatsApp = useCallback(() => {
    if (car.dealership_phone) {
      const message = `Hi, I'm interested in the ${car.year} ${car.make} ${car.model}.`
      Linking.openURL(
        `https://wa.me/${car.dealership_phone}?text=${encodeURIComponent(
          message
        )}`
      )
    } else {
      Alert.alert('WhatsApp number not available')
    }
  }, [car])

  const handleChat = useCallback(() => {
    Alert.alert('Chat feature coming soon!')
  }, [])

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentImageIndex(viewableItems[0].index)
    }
  }, [])

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50
  }).current

  const renderImage = useCallback(
    ({ item, index }: any) => (
      <Pressable onPress={handleCardPress}>
        <View className='relative'>
          <OptimizedImage
            source={{ uri: item }}
            style={{
              width: SCREEN_WIDTH - 30,
              height: 245
            }}
          />

          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            className='absolute bottom-0 left-0 right-0 h-32'
          />

          <StyledView className='absolute bottom-0 w-full p-4 flex-row justify-between items-center'>
            <StyledView className='flex-1'>
              <StyledText className='text-white text-2xl font-bold mb-1'>
                {car.make} {car.model}
              </StyledText>

              <View className='flex-row items-center'>
                <View className='flex-row items-center mr-4'>
                  <Ionicons name='eye-outline' size={16} color='#FFF' />
                  <StyledText className='text-zinc-200 text-sm ml-1'>
                    {car.views || 0}
                  </StyledText>
                </View>

                <View className='flex-row items-center mr-4'>
                  <Ionicons name='heart-outline' size={16} color='#FFF' />
                  <StyledText className='text-zinc-200 text-sm ml-1'>
                    {car.likes || 0}
                  </StyledText>
                </View>

                {car.category && (
                  <View className='bg-slate-700/70 px-2 py-1 rounded-full'>
                    <StyledText className='text-white text-xs'>
                      {car.category}
                    </StyledText>
                  </View>
                )}
              </View>
            </StyledView>

            <StyledView className='bg-red/90 px-4 py-2 rounded-2xl backdrop-blur-sm'>
              <StyledText className='text-white text-lg font-extrabold'>
                ${car.price.toLocaleString()}
              </StyledText>
            </StyledView>
          </StyledView>

          {car.images.length > 1 && (
            <View className='absolute top-4 left-4 bg-black/60 px-2 py-1 rounded-lg backdrop-blur-sm flex-row items-center'>
              <Ionicons name='images-outline' size={16} color='#FFF' />
              <Text className='text-white text-xs ml-1 font-medium'>
                {index + 1}/{car.images.length}
              </Text>
            </View>
          )}
          {!isDealer && (
            <StyledTouchableOpacity
              onPress={() => onFavoritePress(car.id)}
              className={`absolute top-4 right-4 ${
                isDarkMode ? 'bg-black/60' : 'bg-black/40'
              } rounded-full p-3 backdrop-blur-sm`}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={24}
                color={isFavorite ? '#EF4444' : '#FFFFFF'}
              />
            </StyledTouchableOpacity>
          )}
        </View>
      </Pressable>
    ),
    [car, isFavorite, isDealer, onFavoritePress, isDarkMode, currentImageIndex, handleCardPress]
  )

  return (
    <StyledView
      className={`m-4 mb-4 ${
        isDarkMode ? 'bg-textgray' : 'bg-[#e6e6e6]'
      } rounded-3xl overflow-hidden shadow-xl`}>
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
        decelerationRate='fast'
        snapToInterval={SCREEN_WIDTH - 30}
        snapToAlignment='center'
        bounces={false}
      />
      
      <StyledTouchableOpacity onPress={handleCardPress} activeOpacity={0.9}>
        <StyledView className='flex items-center justify-center'>
          <StyledView
            className={`${isDarkMode ? 'bg-gray' : 'bg-gray'} my-2 w-5/6`}
          />
        </StyledView>
        
        <StyledView className='flex-row justify-between mt-4 mb-4'>
          <SpecItem
            title='Year'
            icon='calendar-outline'
            value={car.year}
            isDarkMode={isDarkMode}
          />
          <SpecItem
            title='Mileage'
            icon='speedometer-outline'
            value={`${(car.mileage / 1000).toFixed(1)}k`}
            isDarkMode={isDarkMode}
          />
          <SpecItem
            title='Transm.'
            icon='cog-outline'
            value={
              car.transmission === 'Automatic'
                ? 'Auto'
                : car.transmission === 'Manual'
                ? 'Man'
                : car.transmission
            }
            isDarkMode={isDarkMode}
          />
          <SpecItem
            title='Condition'
            icon='car-sport-outline'
            value={car.condition}
            isDarkMode={isDarkMode}
          />
        </StyledView>

        <View className='w-full px-4'>
          <View className='h-[0.5px] mt-2 bg-textgray opacity-30' />
        </View>

        <StyledView className='p-4'>
          <StyledView className='flex-row items-start justify-between'>
            {car.dealership_logo && (
              <TouchableOpacity onPress={handleDealershipPress}>
                <OptimizedImage
                  source={{ uri: car.dealership_logo }}
                  style={{ width: 50, height: 48, borderRadius: 24 }}
                />
              </TouchableOpacity>
            )}

            <StyledView className='flex-row items-start justify-between flex-1 ml-2'>
              <StyledView style={{ flexShrink: 1, marginRight: 10 }}>
                <StyledText
                  className={`text-base font-medium ${
                    isDarkMode ? 'text-white' : 'text-black'
                  }`}
                  numberOfLines={1}
                  ellipsizeMode='tail'>
                  {car.dealership_name}
                </StyledText>
                <StyledText
                  className={`text-xs ${
                    isDarkMode ? 'text-[#e6e6e6]' : 'text-textgray'
                  }`}
                  numberOfLines={2}
                  ellipsizeMode='tail'>
                  {formattedLocation}
                </StyledText>
              </StyledView>

              <StyledView style={{ flexShrink: 0, flexDirection: 'row' }}>
                <ActionButton
                  icon='call-outline'
                  onPress={handleCall}
                  text='Call'
                  isDarkMode={isDarkMode}
                />
                <ActionButton
                  icon='chatbubble-outline'
                  onPress={handleChat}
                  text='Chat'
                  isDarkMode={isDarkMode}
                />
              </StyledView>
            </StyledView>
          </StyledView>
        </StyledView>
      </StyledTouchableOpacity>
    </StyledView>
  )
}