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

export default function UserConversationsScreen() {
  const { isDarkMode } = useTheme();
  const { user, profile, isLoaded } = useAuth();
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

  // Debug logging
  React.useEffect(() => {
    console.log('[ConversationsList] User ID:', user?.id);
    console.log('[ConversationsList] Conversations count:', conversations?.length || 0);
    console.log('[ConversationsList] Conversations:', conversations);
    console.log('[ConversationsList] Error:', conversationsError);
    console.log('[ConversationsList] Loading:', isLoading);
  }, [conversations, conversationsError, isLoading, user?.id]);

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
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: isDarkMode ? '#020617' : '#F8FAFC',
        }}
      >
        <ActivityIndicator size="large" color="#D55004" />
      </SafeAreaView>
    );
  }

  if (!user || isGuest) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
          backgroundColor: isDarkMode ? '#020617' : '#F8FAFC',
        }}
      >
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

  // Allow dealers to use user messaging as well - they can message other dealers
  // This enables dealers to act as users when browsing the marketplace

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: isDarkMode ? '#020617' : '#EFEFF4',
      }}
    >
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
            paddingBottom: 32,
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
                  'Find a car you love and tap “Chat with dealer” to start a conversation.'
                )}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

