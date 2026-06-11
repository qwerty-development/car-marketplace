import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  View,
  TouchableOpacity,
  type ScrollViewProps,
} from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ChatScrollView from '@/components/chat/ChatScrollView';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { useAuth } from '@/utils/AuthContext';
import { ChatService } from '@/services/ChatService';
import { useConversationMessages } from '@/hooks/useConversationMessages';
import { useSendMessage } from '@/hooks/useSendMessage';
import { useUserName } from '@/hooks/useUserName';
import { useMarkConversationRead } from '@/hooks/useMarkConversationRead';
import MessageBubble from '@/components/chat/MessageBubble';
import MessageComposer from '@/components/chat/MessageComposer';
import ConversationCarHeader from '@/components/chat/ConversationCarHeader';
import ConversationPlateHeader from '@/components/chat/ConversationPlateHeader';
import OfferBubble from '@/components/chat/OfferBubble';
import OfferSheet from '@/components/chat/OfferSheet';
import { useConversationOffers } from '@/hooks/useConversationOffers';
import type { ConversationOffer } from '@/types/chat';

export default function DealerConversationDetailScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId?: string | string[] }>();
  const conversationIdParam = useMemo(() => {
    if (!conversationId) return null;
    return Array.isArray(conversationId) ? conversationId[0] : conversationId;
  }, [conversationId]);

  const { user, profile } = useAuth();
  const { isDarkMode } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const navigation = useNavigation();
  const listRef = useRef<FlatList>(null);
  const { t } = useTranslation();

  const renderScrollComponent = useCallback(
    (props: ScrollViewProps) => <ChatScrollView {...props} />,
    [],
  );

  const {
    data: conversation,
    isLoading: isConversationLoading,
    error: conversationError,
  } = useQuery({
    queryKey: ['conversation', conversationIdParam],
    queryFn: () => ChatService.fetchConversationById(conversationIdParam!),
    enabled: !!conversationIdParam,
  });

  const {
    messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isMessagesLoading,
  } = useConversationMessages(conversationIdParam);

  const sendMessageMutation = useSendMessage(conversationIdParam ?? '');

  // Reverse messages for inverted FlatList (newest at index 0 = visual bottom)
  const invertedMessages = useMemo(() => [...messages].reverse(), [messages]);

  // MARK: - Offers (US-13): the dealer is always the seller side here.
  const { offersById, respondOffer } = useConversationOffers(
    conversationIdParam,
    messages.length
  );
  const [counterTarget, setCounterTarget] = useState<ConversationOffer | null>(null);
  const [offerBusy, setOfferBusy] = useState(false);

  const showOfferError = useCallback(
    (result: any) => {
      if (result?.reason === 'below_minimum') {
        Toast.show({
          type: 'error',
          text1: t('offers.belowMinimum', {
            amount: `$${Number(result?.min_amount ?? 0).toLocaleString()}`,
          }),
        });
      } else if (result?.reason?.startsWith?.('already_')) {
        Toast.show({ type: 'error', text1: t('offers.alreadyResponded') });
      } else {
        Toast.show({ type: 'error', text1: t('offers.failed') });
      }
    },
    [t]
  );

  const handleOfferRespond = useCallback(
    async (offer: ConversationOffer, action: 'accept' | 'decline') => {
      if (offerBusy) return;
      setOfferBusy(true);
      try {
        const result = await respondOffer(offer.id, action);
        if (!result?.success) showOfferError(result);
      } catch (error) {
        console.error('offer respond failed:', error);
        Toast.show({ type: 'error', text1: t('offers.failed') });
      } finally {
        setOfferBusy(false);
      }
    },
    [offerBusy, respondOffer, showOfferError, t]
  );

  const handleCounterSubmit = useCallback(
    async (amount: number) => {
      if (!counterTarget || offerBusy) return;
      setOfferBusy(true);
      try {
        const result = await respondOffer(counterTarget.id, 'counter', amount);
        if (result?.success) {
          setCounterTarget(null);
          setTimeout(() => {
            listRef.current?.scrollToOffset({ offset: 0, animated: true });
          }, 150);
        } else {
          showOfferError(result);
        }
      } catch (error) {
        console.error('counter offer failed:', error);
        Toast.show({ type: 'error', text1: t('offers.failed') });
      } finally {
        setOfferBusy(false);
      }
    },
    [counterTarget, offerBusy, respondOffer, showOfferError, t]
  );

  // Fetch user name via RPC if not available directly (helps with RLS)
  const { data: fetchedUserName } = useUserName(
    conversation?.user_id,
    !!conversation && (!conversation.user || !conversation.user.name)
  );

  // Set header title based on customer info
  useEffect(() => {
    if (!conversation) return;

    const user = conversation.user;
    const emailUsername = user?.email?.split('@')[0];
    const idSnippet = conversation.user_id
      ? conversation.user_id.slice(0, 8)
      : 'Customer';
    // Use fetched name from RPC if direct access is blocked by RLS
    const customerLabel = fetchedUserName ?? user?.name ?? emailUsername ?? idSnippet ?? t('chat.customer', 'Customer');

    navigation.setOptions({
      title: customerLabel,
      headerTitleStyle: {
        maxWidth: 200,
      },
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ paddingHorizontal: 8, paddingVertical: 6 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={22} color={isDarkMode ? '#fff' : '#000'} />
        </TouchableOpacity>
      ),
    });
  }, [conversation, navigation, t, fetchedUserName]);

  // MARK: - Read Status Management
  const isFocused = useIsFocused();
  const lastProcessedMessageIdRef = useRef<number | null>(null);
  const markReadMutation = useMarkConversationRead();

  useEffect(() => {
    // 1. Basic checks
    if (!conversationIdParam || !user || !conversation || !isFocused) return;

    // 2. Check if we have messages to mark
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    // 3. Avoid duplicate calls for the same latest message
    if (lastProcessedMessageIdRef.current === lastMessage.id) return;

    // 4. Trigger mutation
    console.log('[DealerConversationDetail] Auto-marking read', {
      msgId: lastMessage.id,
      role: 'dealer'
    });

    lastProcessedMessageIdRef.current = lastMessage.id;
    markReadMutation.mutate({
      conversationId: conversationIdParam,
      viewerRole: 'dealer',
    });
  }, [
    conversationIdParam,
    user,
    conversation,
    isFocused,
    messages,
    markReadMutation
  ]);

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

        // In inverted list, offset 0 = visual bottom (newest messages)
        setTimeout(() => {
          listRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, 100);
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
            className={`text-xl font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-black'
              }`}
            style={{ textAlign: 'center' }}
          >
            {t('chat.conversation_not_found', 'Conversation not found')}
          </Text>
          <Text
            className={`text-base ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
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
      edges={['bottom']}
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
          {conversation && (conversation.car || conversation.carRent) && (
            <ConversationCarHeader
              conversation={conversation}
              dealershipId={conversation.dealership_id ?? undefined}
              isDealer={true}
            />
          )}
          {conversation && conversation.numberPlate && (
            <ConversationPlateHeader
              conversation={conversation}
              isDealer={true}
            />
          )}
          <FlatList
            ref={listRef}
            data={invertedMessages}
            inverted
            keyExtractor={(item) => item.id.toString()}
            keyboardShouldPersistTaps="handled"
            renderScrollComponent={renderScrollComponent}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingVertical: 16,
              paddingHorizontal: 4,
            }}
            renderItem={({ item }) =>
              item.type === 'offer' && item.offer_id ? (
                <OfferBubble
                  message={item}
                  offer={offersById.get(item.offer_id) ?? null}
                  mySide="seller"
                  isOwn={item.sender_id === user?.id}
                  isDarkMode={isDarkMode}
                  busy={offerBusy}
                  onAccept={(offer) => handleOfferRespond(offer, 'accept')}
                  onDecline={(offer) => handleOfferRespond(offer, 'decline')}
                  onCounter={(offer) => setCounterTarget(offer)}
                />
              ) : (
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
                    className={`text-base ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    style={{ textAlign: 'center' }}
                  >
                    {t('chat.no_messages_yet', 'No messages yet')}
                  </Text>
                  <Text
                    className={`text-sm mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'
                      }`}
                    style={{ textAlign: 'center' }}
                  >
                    {t('chat.start_conversation', 'Send a message to start the conversation')}
                  </Text>
                </View>
              ) : null
            }
          />
          <KeyboardStickyView offset={{ opened: bottom }}>
            <MessageComposer
              onSend={handleSendMessage}
              isSending={sendMessageMutation.isPending}
              isDarkMode={isDarkMode}
              placeholder={t('chat.message_placeholder', 'Type a message…')}
            />
          </KeyboardStickyView>
          <OfferSheet
            visible={counterTarget !== null}
            onClose={() => setCounterTarget(null)}
            onSubmit={handleCounterSubmit}
            listingPrice={counterTarget ? Number(counterTarget.listing_price_snapshot) : null}
            isCounter
            busy={offerBusy}
          />
        </>
      )}
    </SafeAreaView>
  );
}
