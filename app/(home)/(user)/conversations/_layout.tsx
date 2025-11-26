import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/utils/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function UserMessagesLayout() {
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
        },
        headerTitleStyle: {
          color: isDarkMode ? '#F8FAFC' : '#0F172A',
          fontWeight: '600',
        },
        headerTintColor: '#D55004',
        contentStyle: {
          backgroundColor: isDarkMode ? '#020617' : '#F8FAFC',
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t('chat.messages', 'Messages'),
        }}
      />
      <Stack.Screen
        name="[conversationId]"
        options={{
          title: t('chat.conversation', 'Conversation'),
        }}
      />
    </Stack>
  );
}

