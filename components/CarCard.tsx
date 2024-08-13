import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledImage = styled(Image);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

export default function CarCard({
  car,
  onPress,
  onFavoritePress,
  isFavorite,
}: any) {
  return (
    <StyledScrollView className="bg-white h-screen">
      <StyledTouchableOpacity onPress={onPress}>
        <StyledView className="relative">
          <StyledImage
            source={{ uri: car.images[0] }}
            className="w-full h-72"
          />
          <StyledView className="absolute top-4 right-4  rounded-full p-2">
            <TouchableOpacity onPress={onFavoritePress}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={28}
                color={isFavorite ? 'red' : 'white'}
              />
            </TouchableOpacity>
          </StyledView>
        </StyledView>
        
        <StyledView className="flex-row justify-between items-center px-6 py-2 border-b border-red">
          <StyledView className="flex-row items-center">
            <Ionicons name="eye-outline" size={20} color="gray" />
            <StyledText className="ml-1 text-gray-600">{car.views}</StyledText>
          </StyledView>
          <StyledView className="flex-row items-center">
            <Ionicons name="heart-outline" size={20} color="gray" />
            <StyledText className="ml-1 text-gray-600">{car.likes}</StyledText>
          </StyledView>
        </StyledView>

        <StyledView className="p-6">
          <StyledText className="text-3xl font-bold text-gray-800 mb-2">
            {car.make} {car.model}
          </StyledText>
          <StyledText className="text-2xl text-red font-semibold text-red-600 mb-4">
            ${car.price.toLocaleString()}
          </StyledText>

          <StyledView className="flex-row  justify-between mb-6">
            <InfoItem icon="calendar-outline"  text={car.year} />
            <InfoItem icon="speedometer-outline" text={`${car.mileage} mi`} />
            <InfoItem icon="color-palette-outline" text={car.color} />
            <InfoItem icon="car-outline" text={car.condition} />
          </StyledView>

          <StyledView className="mt-4">
            <StyledText className="text-xl text-red font-semibold">{car.dealership_name}</StyledText>
          </StyledView>
        </StyledView>
      </StyledTouchableOpacity>
    </StyledScrollView>
  );
}

const InfoItem = ({ icon, text }) => (
  <StyledView className="items-center">
    <Ionicons name={icon} size={24} color="gray" />
    <StyledText className="text-sm text-gray-600 mt-1">{text}</StyledText>
  </StyledView>
);

// SpecItem and Divider components are kept for potential future use
const SpecItem = ({ icon, text }) => (
  <StyledView className="flex-row items-center mr-4 mb-2">
    <FontAwesome name={icon} size={18} color="gray" />
    <StyledText className="ml-2 text-gray-700">{text}</StyledText>
  </StyledView>
);

const Divider = () => (
  <StyledView className="border-t border-gray-200 my-4" />
);