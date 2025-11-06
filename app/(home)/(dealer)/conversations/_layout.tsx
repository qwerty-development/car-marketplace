import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/utils/ThemeContext';

export default function DealerConversationsLayout() {
  const { t } = useTranslation();
  const { isDarkMode } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
        },
        headerTintColor: isDarkMode ? '#FFFFFF' : '#000000',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t('chat.messages', 'Messages'),
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="[conversationId]"
        options={{
          title: t('chat.conversation', 'Conversation'),
          headerShown: true,
        }}
      />
    </Stack>
  );
}
