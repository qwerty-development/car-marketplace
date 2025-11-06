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

export default function DealerConversationDetailScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId?: string | string[] }>();
  const conversationIdParam = useMemo(() => {
    if (!conversationId) return null;
    return Array.isArray(conversationId) ? conversationId[0] : conversationId;
  }, [conversationId]);

  const { user, profile } = useAuth();
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

  // Set header title based on customer info
  useEffect(() => {
    if (!conversation) return;

    const user = conversation.user;
    const emailUsername = user?.email?.split('@')[0];
    const idSnippet = conversation.user_id
      ? conversation.user_id.slice(0, 8)
      : 'Customer';
    const customerLabel = user?.name ?? emailUsername ?? idSnippet ?? t('chat.customer', 'Customer');

    navigation.setOptions({
      title: customerLabel,
    });
  }, [conversation, navigation, t]);

  // Mark as read when screen is focused (only once)
  const hasMarkedReadRef = useRef(false);
  
  useFocusEffect(
    useCallback(() => {
      if (!conversationIdParam || !user || profile?.role !== 'dealer') {
        return;
      }

      // Check if already marked during this focus
      if (hasMarkedReadRef.current) {
        return;
      }

      // Mark the flag to prevent re-marking
      hasMarkedReadRef.current = true;

      // Mark conversation as read
      ChatService.markConversationRead(conversationIdParam, 'dealer').catch((error) => {
        console.warn('Failed to mark conversation read', error);
      });

      // Reset flag when screen loses focus
      return () => {
        hasMarkedReadRef.current = false;
      };
    }, [conversationIdParam, user, profile?.role])
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length === 0) return;
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 60);
  }, [messages.length]);

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!conversationIdParam || !user) {
        Toast.show({
          type: 'error',
          text1: t('chat.message_send_failed', 'Unable to send message'),
          text2: t('chat.try_again', 'Try again in a moment.'),
        });
        return;
      }

      try {
        await sendMessageMutation.mutateAsync({
          conversationId: conversationIdParam,
          senderId: user.id,
          senderRole: 'dealer',
          body: text,
        });

        setTimeout(() => {
          listRef.current?.scrollToEnd({ animated: true });
        }, 80);
      } catch (error: any) {
        Toast.show({
          type: 'error',
          text1: t('chat.message_send_failed', 'Unable to send message'),
          text2: error?.message ?? t('chat.try_again', 'Try again in a moment.'),
        });
      }
    },
    [conversationIdParam, sendMessageMutation, t, user]
  );

  if (!conversationIdParam || conversationError) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
          paddingHorizontal: 24,
        }}
      >
        <View className="items-center">
          <View className="w-20 h-20 rounded-full bg-red-500/10 items-center justify-center mb-4">
            <Text className="text-4xl">⚠️</Text>
          </View>
          <Text
            className={`text-xl font-bold mb-3 ${
              isDarkMode ? 'text-white' : 'text-black'
            }`}
            style={{ textAlign: 'center' }}
          >
            {t('chat.conversation_not_found', 'Conversation not found')}
          </Text>
          <Text
            className={`text-base ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}
            style={{ textAlign: 'center', lineHeight: 22 }}
          >
            {t(
              'chat.conversation_not_found_body',
              'This chat is no longer available. Try opening it again from the messages list.'
            )}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: isDarkMode ? '#000000' : '#F8FAFC',
      }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {isConversationLoading && isMessagesLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#D55004" />
            <Text
              className={`mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
            >
              {t('chat.loading_messages', 'Loading messages...')}
            </Text>
          </View>
        ) : (
          <>
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{
                paddingVertical: 16,
                paddingHorizontal: 4,
              }}
              renderItem={({ item }) => (
                <MessageBubble
                  message={item}
                  isOwn={item.sender_id === user?.id}
                  isDarkMode={isDarkMode}
                  onPressAttachment={(url) => {
                    Alert.alert(
                      t('chat.attachment', 'Attachment'),
                      url,
                      [
                        {
                          text: t('common.ok', 'OK'),
                        },
                      ],
                      { cancelable: true }
                    );
                  }}
                />
              )}
              onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage) {
                  fetchNextPage();
                }
              }}
              onEndReachedThreshold={0.2}
              ListFooterComponent={
                isFetchingNextPage ? (
                  <View style={{ paddingVertical: 16 }}>
                    <ActivityIndicator size="small" color="#D55004" />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                !isMessagesLoading ? (
                  <View
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingVertical: 80,
                    }}
                  >
                    <Text
                      className={`text-base ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}
                      style={{ textAlign: 'center' }}
                    >
                      {t('chat.no_messages_yet', 'No messages yet')}
                    </Text>
                    <Text
                      className={`text-sm mt-2 ${
                        isDarkMode ? 'text-gray-500' : 'text-gray-500'
                      }`}
                      style={{ textAlign: 'center' }}
                    >
                      {t('chat.start_conversation', 'Send a message to start the conversation')}
                    </Text>
                  </View>
                ) : null
              }
            />
            <MessageComposer
              onSend={handleSendMessage}
              isSending={sendMessageMutation.isLoading}
              isDarkMode={isDarkMode}
              placeholder={t('chat.message_placeholder', 'Type a message…')}
            />
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
