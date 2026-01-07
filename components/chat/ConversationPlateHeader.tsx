import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styled } from 'nativewind';
import { ConversationSummary } from '@/types/chat';
import { useTheme } from '@/utils/ThemeContext';
import { LicensePlateTemplate } from '@/components/NumberPlateCard';

const StyledView = styled(View);
const StyledText = styled(Text);
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


  const statusColor = plateData.status === 'available' ? '#16A34A' : '#DC2626';
  const statusText = plateData.status === 'available' ? 'Available' : plateData.status === 'sold' ? 'Sold' : plateData.status;

  return (
    <StyledView
      className={`px-4 py-3 border-b ${isDarkMode ? ' border-slate-700' : 'bg-gray-50 border-gray-200'
        }`}
    >
      <StyledView className="flex-row items-center justify-between ">
        {/* Plate Template Display */}
        <View className="mr-3">
          <LicensePlateTemplate
            letter={plateData.letter}
            digits={plateData.digits}
            width={130}
          />
        </View>

        {/* Plate Info */}
        <StyledView className="w-fit items-end justify-center">
          <StyledText
            className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'
              }`}
          >
            ${plateData.price.toLocaleString()}
          </StyledText>

          {/* Status indicator */}
          <StyledView className="flex-row items-center mt-1">
            <Ionicons
              name={plateData.status === 'available' ? 'checkmark-circle' : 'close-circle'}
              size={14}
              color={statusColor}
            />
            <StyledText
              className="text-sm ml-1 font-medium"
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
