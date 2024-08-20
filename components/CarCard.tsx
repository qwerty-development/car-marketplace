import React from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Linking,
  Alert,
  Share,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { styled } from 'nativewind'
import { Divider } from '@rneui/themed';

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledImage = styled(Image)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledScrollView = styled(ScrollView)

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

export default function CarCard({
  car,
  onPress,
  onFavoritePress,
  isFavorite,
  tabBarHeight
}: any) {
  const cardHeight = SCREEN_HEIGHT - (tabBarHeight || 50)

  const handleCall = () => {
    if (car.dealership_phone) {
      Linking.openURL(`tel:${car.dealership_phone}`)
    } else {
      Alert.alert('Phone number not available')
    }
  }

  const handleWhatsApp = () => {
    if (car.dealership_phone) {
      const message = `Hi, I'm interested in the ${car.make} ${car.model}.`
      const url = `https://wa.me/${car.dealership_phone}?text=${encodeURIComponent(message)}`
      Linking.openURL(url)
    } else {
      Alert.alert('WhatsApp number not available')
    }
  }

  const handleChat = () => {
    Alert.alert('Chat feature coming soon!')
  }

  const handleShare = async () => {
    try {
      const result = await Share.share({
        message: `Check out this ${car.year} ${car.make} ${car.model} for $${car.price.toLocaleString()}!`,
        url: car.images[0]
      })
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // shared with activity type of result.activityType
        } else {
          // shared
        }
      } else if (result.action === Share.dismissedAction) {
        // dismissed
      }
    } catch (error: any) {
      Alert.alert(error.message)
    }
  }

  return (
    <StyledScrollView
      className="bg-black"
    >
      <StyledTouchableOpacity
        onPress={onPress}
        className="m-4 bg-black border shadow-xl shadow-white  border-gray rounded-lg  overflow-hidden "
      >
        <StyledView className="relative">
          <StyledImage
            source={{ uri: car.images[0] }}
            className="w-full h-64 rounded-t-lg"
          />
          <StyledView className="absolute top-4 right-4 bg-black/60 rounded-full p-2">
            <TouchableOpacity onPress={onFavoritePress}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={28}
                color={isFavorite ? '#EF4444' : '#D1D5DB'}
              />
            </TouchableOpacity>
          </StyledView>
        </StyledView>

        <StyledView className="p-6">
          <StyledView className="flex-row justify-between items-center mb-4">
            <StyledView className="flex-row items-center">
              <Ionicons name="eye-outline" size={18} color="#6B7280" />
              <StyledText className="ml-2 text-gray-400">
                {car.views || 0} views
              </StyledText>
            </StyledView>
            <StyledView className="flex-row items-center">
              <Ionicons name="heart" size={18} color="#EF4444" />
              <StyledText className="ml-2 text-gray-400">
                {car.likes || 0} likes
              </StyledText>
            </StyledView>
          </StyledView>
          <StyledView className="flex-row justify-between items-center mb-4">
            <StyledView>
              <StyledText className="text-2xl font-semibold text-white">
                {car.year} {car.make} {car.model}
              </StyledText>
              <StyledText className="text-xl text-red font-medium text-red-500 mt-1">
                ${car.price.toLocaleString()}
              </StyledText>
            </StyledView>
            {car.dealership_logo && (
              <StyledImage
                source={{ uri: car.dealership_logo }}
                className="w-12 h-12 rounded-full"
                alt={`${car.dealership_name} logo`}
              />
            )}
          </StyledView>

          <StyledView className="flex-row justify-between items-center mb-6">
            <InfoItem icon="speedometer-outline" text={`${car.mileage} km`} />
            <View className="h-full w-px bg-white mx-3" />
            <InfoItem icon="color-palette-outline" text={car.color} />
            <View className="h-full w-px bg-white mx-3" />
            <InfoItem icon="car-outline" text={car.condition} />
          </StyledView>


          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, height: 1, backgroundColor: 'white' }} />
            <View style={{ flex: 1, height: 1, backgroundColor: 'white' }} />
          </View>

          <StyledView className="rounded-lg p-4">
            <StyledView className="flex-row border  justify-between">
              <ActionButton
                icon="call-outline"
                text="Call"
                onPress={handleCall}
              />
              <ActionButton
                icon="logo-whatsapp"
                text="WhatsApp"
                onPress={handleWhatsApp}
              />
              <ActionButton
                icon="chatbubble-outline"
                text="Chat"
                onPress={handleChat}
              />
              <ActionButton
                icon="share-social-outline"
                text="Share"
                onPress={handleShare}
              />
            </StyledView>
          </StyledView>
        </StyledView>
      </StyledTouchableOpacity>
    </StyledScrollView>
  )
}

const InfoItem = ({ icon, text }: any) => (
  <StyledView className="items-center">
    <Ionicons name={icon} size={20} color="#FFFFFF" />
    <StyledText className="text-sm text-gray-400 mt-1">{text}</StyledText>
  </StyledView>
)

const ActionButton = ({ icon, text, onPress }: any) => (
  <StyledTouchableOpacity
    onPress={onPress}
    className="items-center justify-center"
  >
    <Ionicons name={icon} size={24} color="#D55004" />
    <StyledText className="text-white text-xs mt-1">{text}</StyledText>
  </StyledTouchableOpacity>
)