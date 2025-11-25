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
import { useMarkConversationRead } from '@/hooks/useMarkConversationRead';
import MessageBubble from '@/components/chat/MessageBubble';
import MessageComposer from '@/components/chat/MessageComposer';
import ConversationCarHeader from '@/components/chat/ConversationCarHeader';

export default function ConversationDetailScreen() {
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
  const markReadMutation = useMarkConversationRead();

  useEffect(() => {
    if (!conversation) return;

    const dealerLabel =
      conversation.dealership?.name ??
      t('chat.dealer', 'Dealer');

    navigation.setOptions({
      title: dealerLabel,
    });
  }, [conversation, navigation, t]);

  useFocusEffect(
    useCallback(() => {
      if (!conversationIdParam || !user || profile?.role !== 'user' || !conversation) {
        return;
      }

      // Determine the correct viewer role based on conversation type and user position
      let viewerRole: 'user' | 'seller_user' = 'user';
      if (conversation.conversation_type === 'user_user' && conversation.seller_user_id === user.id) {
        viewerRole = 'seller_user';
      }

      markReadMutation.mutate(
        {
          conversationId: conversationIdParam,
          viewerRole,
        },
        {
          onError: (error) => {
            console.warn('Failed to mark conversation read', error);
          },
        }
      );
    }, [conversationIdParam, user?.id, profile?.role])
  );

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
          senderRole: 'user',
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
          backgroundColor: isDarkMode ? '#020617' : '#F8FAFC',
          paddingHorizontal: 24,
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
          {t('chat.conversation_not_found', 'Conversation not found')}
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
            'chat.conversation_not_found_body',
            'This chat is no longer available. Try opening it again from the messages list.'
          )}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: isDarkMode ? '#020617' : '#F8FAFC',
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
          </View>
        ) : (
          <>
            {conversation && <ConversationCarHeader conversation={conversation} />}
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
