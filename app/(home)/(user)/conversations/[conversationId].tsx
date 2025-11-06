import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useQuery } from 'react-query';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/utils/ThemeContext';
import { useAuth } from '@/utils/AuthContext';
import { ChatService } from '@/services/ChatService';
import { useConversationMessages } from '@/hooks/useConversationMessages';
import { useSendMessage } from '@/hooks/useSendMessage';
import MessageBubble from '@/components/chat/MessageBubble';
import MessageComposer from '@/components/chat/MessageComposer';

export default function UserConversationDetailScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId?: string | string[] }>();
  const conversationIdParam = useMemo(() => {
    if (!conversationId) return null;
    return Array.isArray(conversationId) ? conversationId[0] : conversationId;
  }, [conversationId]);

  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  const listRef = useRef<FlatList>(null);
  const { t } = useTranslation();

  const {
    data: conversation,
    isLoading: isConversationLoading,
    error: conversationError,
  } = useQuery(
    ['conversation', conversationIdParam],
    () => ChatService.fetchConversationById(conversationIdParam!),
    {
      enabled: !!conversationIdParam,
    }
  );

  const {
    messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isMessagesLoading,
  } = useConversationMessages(conversationIdParam);

  const sendMessageMutation = useSendMessage(conversationIdParam ?? '');

  // Set header title based on dealership info
  useEffect(() => {
    if (!conversation) return;

    const dealership = conversation.dealership;
    const dealershipLabel = dealership?.name ?? t('chat.dealership', 'Dealership');

    navigation.setOptions({
      title: dealershipLabel,
    });
  }, [conversation, navigation, t]);

  // Mark as read when screen is focused (only once)
  const hasMarkedReadRef = useRef(false);
  
  useFocusEffect(
    useCallback(() => {
      if (!conversationIdParam || !user) {
        return;
      }

      // Check if already marked during this focus
      if (hasMarkedReadRef.current) {
        return;
      }

      // Mark the flag to prevent re-marking
      hasMarkedReadRef.current = true;

      // Mark conversation as read (from user perspective)
      ChatService.markConversationRead(conversationIdParam, 'user').catch((error) => {
        console.warn('Failed to mark conversation read', error);
      });

      // Reset flag when screen loses focus
      return () => {
        hasMarkedReadRef.current = false;
      };
    }, [conversationIdParam, user])
  );

  const handleSendMessage = useCallback(
    async (messageContent: string) => {
      if (!conversationIdParam || !user) {
        Toast.show({
          type: 'error',
          text1: t('chat.error', 'Error'),
          text2: t('chat.must_sign_in', 'You must be signed in to send messages'),
        });
        return;
      }

      try {
        await sendMessageMutation.mutateAsync({
          conversationId: conversationIdParam,
          senderId: user.id,
          senderRole: 'user',
          body: messageContent,
        });

        // Scroll to bottom after sending
        setTimeout(() => {
          listRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, 100);
      } catch (error: any) {
        console.error('Send message error:', error);
        Toast.show({
          type: 'error',
          text1: t('chat.send_failed', 'Failed to send message'),
          text2: error?.message ?? t('chat.try_again', 'Please try again'),
        });
      }
    },
    [conversationIdParam, user, sendMessageMutation, t]
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (!conversationIdParam) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <View className="items-center px-6">
          <View className="w-20 h-20 rounded-full bg-red-500/10 items-center justify-center mb-4">
            <Text className="text-3xl">❌</Text>
          </View>
          <Text
            className={`text-xl font-bold mb-2 ${
              isDarkMode ? 'text-white' : 'text-black'
            }`}
            style={{ textAlign: 'center' }}
          >
            {t('chat.invalid_conversation', 'Invalid Conversation')}
          </Text>
          <Text
            className={`text-base ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}
            style={{ textAlign: 'center' }}
          >
            {t('chat.conversation_not_found', 'This conversation could not be found.')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isConversationLoading || isMessagesLoading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#D55004" />
        <Text
          className={`mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
        >
          {t('chat.loading_messages', 'Loading messages...')}
        </Text>
      </SafeAreaView>
    );
  }

  if (conversationError) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <View className="items-center px-6">
          <View className="w-20 h-20 rounded-full bg-red-500/10 items-center justify-center mb-4">
            <Text className="text-3xl">⚠️</Text>
          </View>
          <Text
            className={`text-xl font-bold mb-2 ${
              isDarkMode ? 'text-white' : 'text-black'
            }`}
            style={{ textAlign: 'center' }}
          >
            {t('chat.error_loading', 'Error Loading Conversation')}
          </Text>
          <Text
            className={`text-base ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}
            style={{ textAlign: 'center' }}
          >
            {t('chat.please_try_again', 'Please try again later.')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!conversation) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <View className="items-center px-6">
          <View className="w-20 h-20 rounded-full bg-gray-500/10 items-center justify-center mb-4">
            <Text className="text-3xl">🔍</Text>
          </View>
          <Text
            className={`text-xl font-bold mb-2 ${
              isDarkMode ? 'text-white' : 'text-black'
            }`}
            style={{ textAlign: 'center' }}
          >
            {t('chat.conversation_not_found', 'Conversation Not Found')}
          </Text>
          <Text
            className={`text-base ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}
            style={{ textAlign: 'center' }}
          >
            {t('chat.conversation_may_deleted', 'This conversation may have been deleted.')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
      }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          inverted
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 8,
          }}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isOwn={item.sender_id === user?.id}
              isDarkMode={isDarkMode}
            />
          )}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#D55004" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                paddingVertical: 60,
              }}
            >
              <View className="w-20 h-20 rounded-full bg-gray-100 dark:bg-neutral-900 items-center justify-center mb-4">
                <Text className="text-4xl">💬</Text>
              </View>
              <Text
                className={`text-lg font-semibold mb-2 ${
                  isDarkMode ? 'text-white' : 'text-black'
                }`}
                style={{ textAlign: 'center' }}
              >
                {t('chat.no_messages_yet', 'No messages yet')}
              </Text>
              <Text
                className={`text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}
                style={{ textAlign: 'center' }}
              >
                {t('chat.start_conversation', 'Start the conversation below')}
              </Text>
            </View>
          }
        />

        <MessageComposer
          onSend={handleSendMessage}
          isSending={sendMessageMutation.isLoading}
          isDarkMode={isDarkMode}
          placeholder={t('chat.message_placeholder', 'Type a message…')}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
