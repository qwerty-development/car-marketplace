import React from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styled } from 'nativewind';
import { useRouter } from 'expo-router';
import { ConversationSummary } from '@/types/chat';
import { useTheme } from '@/utils/ThemeContext';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledImage = styled(Image);
const StyledPressable = styled(Pressable);

interface ConversationCarHeaderProps {
  conversation: ConversationSummary;
  dealershipId?: number;
  isDealer?: boolean;
}

export default function ConversationCarHeader({
  conversation,
  dealershipId,
  isDealer = false,
}: ConversationCarHeaderProps) {
  const { isDarkMode } = useTheme();
  const router = useRouter();

  const carData = conversation.car || conversation.carRent;
  const isRental = !!conversation.carRent;

  if (!carData) return null;

  const handlePress = () => {
    // For dealers - navigate to edit listing
    if (isDealer && dealershipId) {
      router.push({
        pathname: '/(home)/(dealer)/AddEditListing',
        params: {
          dealershipId: dealershipId.toString(),
          listingId: carData.id.toString(),
          mode: isRental ? 'rent' : 'sale',
        },
      });
    } else {
      // For users - navigate to car details (existing behavior)
      if (isRental) {
        router.push({
          pathname: '/(home)/(user)/CarDetails',
          params: { carId: carData.id.toString(), isRental: 'true' },
        });
      } else {
        router.push({
          pathname: '/(home)/(user)/CarDetails',
          params: { carId: carData.id.toString() },
        });
      }
    }
  };

  const price = isRental
    ? (carData as any).price
    : (carData as any).price;
  const priceLabel = isRental ? 'per day' : '';

  return (
    <StyledPressable
      onPress={handlePress}
      className={`px-4 py-3 border-b ${
        isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-200'
      }`}
    >
      <StyledView className="flex-row items-center">
        {/* Car Image */}
        {carData && (carData as any).images && (carData as any).images.length > 0 ? (
          <StyledImage
            source={{ uri: (carData as any).images[0] }}
            className="w-16 h-16 rounded-lg mr-3"
            resizeMode="cover"
          />
        ) : (
          <StyledView
            className={`w-16 h-16 rounded-lg mr-3 items-center justify-center ${
              isDarkMode ? 'bg-gray-800' : 'bg-gray-200'
            }`}
          >
            <Ionicons
              name="car"
              size={28}
              color={isDarkMode ? '#fff' : '#666'}
            />
          </StyledView>
        )}

        {/* Car Info */}
        <StyledView className="flex-1">
          <StyledView className="flex-row items-center justify-between">
            <StyledText
              className={`text-sm font-semibold flex-1 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}
              numberOfLines={1}
            >
              {carData.make} {carData.model}
            </StyledText>
            {isRental && (
              <StyledView className="bg-orange-500 px-2 py-1 rounded ml-2">
                <StyledText className="text-xs font-semibold text-white">
                  For Rent
                </StyledText>
              </StyledView>
            )}
          </StyledView>

          <StyledText
            className={`text-xs mt-1 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            {carData.year} • {price.toLocaleString()} {priceLabel}
          </StyledText>

          {!isRental && 'status' in carData && carData.status && (
            <StyledView className="flex-row items-center mt-1">
              <Ionicons
                name={
                  (carData as any).status === 'available'
                    ? 'checkmark-circle'
                    : (carData as any).status === 'sold'
                    ? 'close-circle'
                    : 'time'
                }
                size={12}
                color={
                  (carData as any).status === 'available'
                    ? '#16A34A'
                    : (carData as any).status === 'sold'
                    ? '#DC2626'
                    : '#EA580C'
                }
              />
              <StyledText
                className={`text-xs ml-1 ${
                  (carData as any).status === 'available'
                    ? 'text-green-600'
                    : (carData as any).status === 'sold'
                    ? 'text-red-600'
                    : 'text-orange-600'
                }`}
              >
                {(carData as any).status.charAt(0).toUpperCase() +
                  (carData as any).status.slice(1)}
              </StyledText>
            </StyledView>
          )}

          {isRental && 'status' in carData && carData.status && (
            <StyledView className="flex-row items-center mt-1">
              <Ionicons
                name={(carData as any).status === 'available' ? 'checkmark-circle' : 'close-circle'}
                size={12}
                color={(carData as any).status === 'available' ? '#16A34A' : '#DC2626'}
              />
              <StyledText
                className={`text-xs ml-1 ${
                  (carData as any).status === 'available' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {(carData as any).status === 'available' ? 'Available' : 'Unavailable'}
              </StyledText>
            </StyledView>
          )}
        </StyledView>

        {/* Chevron */}
        <Ionicons
          name="chevron-forward"
          size={20}
          color={isDarkMode ? '#666' : '#999'}
          style={{ marginLeft: 8 }}
        />
      </StyledView>
    </StyledPressable>
  );
}
