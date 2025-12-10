import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/utils/ThemeContext';
import { useAuth } from '@/utils/AuthContext';
import { useGuestUser } from '@/utils/GuestUserContext';
import { useFocusEffect } from '@react-navigation/native';
import ConversationListItem from '@/components/chat/ConversationListItem';
import { useConversations } from '@/hooks/useConversations';
import { Ionicons } from '@expo/vector-icons';

export default function ChatTabScreen() {
  const { isDarkMode } = useTheme();
  const { user, isLoaded } = useAuth();
  const { isGuest } = useGuestUser();
  const { t } = useTranslation();
  const router = useRouter();

  const {
    data: conversations,
    isLoading,
    refetch,
    isRefetching,
    error: conversationsError,
  } = useConversations({
    userId: user?.id ?? null,
    enabled: !!user && !isGuest,
  });

  useFocusEffect(
    useCallback(() => {
      if (user && !isGuest) {
        refetch();
      }
    }, [refetch, user, isGuest])
  );

  const handleOpenConversation = useCallback(
    (conversationId: number) => {
      router.push({
        pathname: '/(home)/(user)/conversations/[conversationId]',
        params: { conversationId: conversationId.toString() },
      });
    },
    [router]
  );

  if (!isLoaded) {
    return (
      <SafeAreaView
        edges={['top']}
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: isDarkMode ? '#000' : '#FFFFFF',
        }}
      >
        <ActivityIndicator size="large" color="#D55004" />
      </SafeAreaView>
    );
  }

  if (!user || isGuest) {
    return (
      <SafeAreaView
        edges={['top']}
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
          backgroundColor: isDarkMode ? '#000' : '#FFFFFF',
        }}
      >
        <Ionicons
          name="chatbubbles-outline"
          size={64}
          color={isDarkMode ? '#4B5563' : '#9CA3AF'}
          style={{ marginBottom: 16 }}
        />
        <Text
          style={{
            fontSize: 18,
            fontWeight: '600',
            color: isDarkMode ? '#E2E8F0' : '#0F172A',
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          {t('chat.sign_in_required_title', 'Sign in to continue')}
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: isDarkMode ? '#94A3B8' : '#475569',
            textAlign: 'center',
            lineHeight: 22,
          }}
        >
          {t(
            'chat.sign_in_required_body',
            'Create an account or sign in to message dealers about vehicles you love.'
          )}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: isDarkMode ? '#000' : '#FFFFFF',
      }}
    >
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: isDarkMode ? '#1F2937' : '#E5E7EB',
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: '700',
            color: isDarkMode ? '#FFFFFF' : '#0F172A',
          }}
        >
          {t('navbar.messages', 'Messages')}
        </Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#D55004" />
        </View>
      ) : (
        <FlatList
          data={conversations ?? []}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{
            paddingVertical: 12,
            paddingBottom: 100, // Extra padding for tab bar
          }}
          renderItem={({ item }) => (
            <ConversationListItem
              conversation={item}
              viewerRole="user"
              isDarkMode={isDarkMode}
              onPress={(conversation) => handleOpenConversation(conversation.id)}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#D55004"
              colors={['#D55004']}
            />
          }
          ListEmptyComponent={
            <View
              style={{
                marginTop: 120,
                paddingHorizontal: 24,
                alignItems: 'center',
              }}
            >
              <Ionicons
                name="chatbubbles-outline"
                size={64}
                color={isDarkMode ? '#4B5563' : '#9CA3AF'}
                style={{ marginBottom: 16 }}
              />
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: isDarkMode ? '#E2E8F0' : '#0F172A',
                  textAlign: 'center',
                  marginBottom: 12,
                }}
              >
                {t('chat.no_conversations_title', 'No conversations yet')}
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  color: isDarkMode ? '#94A3B8' : '#475569',
                  textAlign: 'center',
                  lineHeight: 22,
                }}
              >
                {t(
                  'chat.no_conversations_body',
                  'Find a car you love and tap "Chat with dealer" to start a conversation.'
                )}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
