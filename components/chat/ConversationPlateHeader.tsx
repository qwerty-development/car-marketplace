import React from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styled } from 'nativewind';
import { ConversationSummary } from '@/types/chat';
import { useTheme } from '@/utils/ThemeContext';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledImage = styled(Image);
const StyledPressable = styled(Pressable);

interface ConversationPlateHeaderProps {
  conversation: ConversationSummary;
  isDealer?: boolean;
}

export default function ConversationPlateHeader({
  conversation,
  isDealer = false,
}: ConversationPlateHeaderProps) {
  const { isDarkMode } = useTheme();

  const plateData = conversation.numberPlate;

  if (!plateData) return null;

  const plateDisplay = `${plateData.letter} ${plateData.digits}`;
  const statusColor = plateData.status === 'available' ? '#16A34A' : '#DC2626';
  const statusText = plateData.status === 'available' ? 'Available' : plateData.status === 'sold' ? 'Sold' : plateData.status;

  return (
    <StyledView
      className={`px-4 py-3 border-b ${
        isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-200'
      }`}
    >
      <StyledView className="flex-row items-center">
        {/* Plate Image */}
        {plateData.picture ? (
          <StyledImage
            source={{ uri: plateData.picture }}
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
              name="id-card"
              size={28}
              color={isDarkMode ? '#fff' : '#666'}
            />
          </StyledView>
        )}

        {/* Plate Info */}
        <StyledView className="flex-1">
          <StyledView className="flex-row items-center justify-between">
            <StyledText
              className={`text-lg font-bold flex-1 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}
              style={{ letterSpacing: 1 }}
              numberOfLines={1}
            >
              {plateDisplay}
            </StyledText>
            <StyledView className="bg-orange-500 px-2 py-1 rounded ml-2">
              <StyledText className="text-xs font-semibold text-white">
                Plate
              </StyledText>
            </StyledView>
          </StyledView>

          <StyledText
            className={`text-sm mt-1 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            ${plateData.price.toLocaleString()}
          </StyledText>

          {/* Status indicator */}
          <StyledView className="flex-row items-center mt-1">
            <Ionicons
              name={plateData.status === 'available' ? 'checkmark-circle' : 'close-circle'}
              size={12}
              color={statusColor}
            />
            <StyledText
              className="text-xs ml-1"
              style={{ color: statusColor }}
            >
              {statusText.charAt(0).toUpperCase() + statusText.slice(1)}
            </StyledText>
          </StyledView>
        </StyledView>
      </StyledView>
    </StyledView>
  );
}
