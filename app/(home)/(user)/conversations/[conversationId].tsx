import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
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
import { useMarkConversationRead } from '@/hooks/useMarkConversationRead';
import MessageBubble from '@/components/chat/MessageBubble';
import MessageComposer from '@/components/chat/MessageComposer';
import ConversationCarHeader from '@/components/chat/ConversationCarHeader';
import ConversationPlateHeader from '@/components/chat/ConversationPlateHeader';
import OfferBubble from '@/components/chat/OfferBubble';
import OfferSheet from '@/components/chat/OfferSheet';
import { useConversationOffers } from '@/hooks/useConversationOffers';
import type { ConversationOffer } from '@/types/chat';
import { TouchableOpacity } from 'react-native';

export default function ConversationDetailScreen() {
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
  const hasMarkedReadRef = useRef(false);
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
    refetch,
  } = useConversationMessages(conversationIdParam);

  const sendMessageMutation = useSendMessage(conversationIdParam ?? '');
  const markReadMutation = useMarkConversationRead();

  // Reverse messages for inverted FlatList (newest at index 0 = visual bottom)
  const invertedMessages = useMemo(() => [...messages].reverse(), [messages]);

  // MARK: - Offers (US-12 / US-13)
  const { offersById, pendingOffer, createOffer, respondOffer } = useConversationOffers(
    conversationIdParam,
    messages.length
  );
  const [offerSheet, setOfferSheet] = useState<
    { mode: 'create' } | { mode: 'counter'; offer: ConversationOffer } | null
  >(null);
  const [offerBusy, setOfferBusy] = useState(false);

  // Which side of a negotiation is the viewer on?
  const mySide: 'buyer' | 'seller' | null = useMemo(() => {
    if (!conversation || !user) return null;
    if (conversation.user_id === user.id) return 'buyer';
    if (
      conversation.conversation_type === 'user_user' &&
      conversation.seller_user_id === user.id
    ) {
      return 'seller';
    }
    return null;
  }, [conversation, user]);

  const listingPrice = useMemo(() => {
    if (!conversation) return null;
    return (
      conversation.car?.price ??
      conversation.carRent?.price ??
      conversation.numberPlate?.price ??
      null
    );
  }, [conversation]);

  const canMakeOffer =
    mySide === 'buyer' && listingPrice != null && Number(listingPrice) > 0 && !pendingOffer;

  const showOfferError = useCallback(
    (result: any) => {
      switch (result?.reason) {
        case 'below_minimum':
          Toast.show({
            type: 'error',
            text1: t('offers.belowMinimum', {
              amount: `$${Number(result?.min_amount ?? 0).toLocaleString()}`,
            }),
          });
          break;
        case 'pending_offer_exists':
          Toast.show({ type: 'error', text1: t('offers.pendingExists') });
          break;
        case 'not_buyer':
        case 'not_participant':
          Toast.show({ type: 'error', text1: t('offers.notAllowed') });
          break;
        case 'no_listing_price':
        case 'no_listing':
          Toast.show({ type: 'error', text1: t('offers.noListing') });
          break;
        default:
          if (result?.reason?.startsWith?.('already_')) {
            Toast.show({ type: 'error', text1: t('offers.alreadyResponded') });
          } else {
            Toast.show({ type: 'error', text1: t('offers.failed') });
          }
      }
    },
    [t]
  );

  const handleOfferSubmit = useCallback(
    async (amount: number) => {
      if (offerBusy) return;
      setOfferBusy(true);
      try {
        const result =
          offerSheet?.mode === 'counter'
            ? await respondOffer(offerSheet.offer.id, 'counter', amount)
            : await createOffer(amount);
        if (result?.success) {
          setOfferSheet(null);
          setTimeout(() => {
            listRef.current?.scrollToOffset({ offset: 0, animated: true });
          }, 150);
        } else {
          showOfferError(result);
        }
      } catch (error) {
        console.error('offer submit failed:', error);
        Toast.show({ type: 'error', text1: t('offers.failed') });
      } finally {
        setOfferBusy(false);
      }
    },
    [offerBusy, offerSheet, respondOffer, createOffer, showOfferError, t]
  );

  const handleOfferRespond = useCallback(
    async (offer: ConversationOffer, action: 'accept' | 'decline') => {
      if (offerBusy) return;
      setOfferBusy(true);
      try {
        const result = await respondOffer(offer.id, action);
        if (!result?.success) {
          showOfferError(result);
        }
      } catch (error) {
        console.error('offer respond failed:', error);
        Toast.show({ type: 'error', text1: t('offers.failed') });
      } finally {
        setOfferBusy(false);
      }
    },
    [offerBusy, respondOffer, showOfferError, t]
  );

  useEffect(() => {
    if (!conversation || !user) return;

    let headerTitle = t('chat.dealer', 'Dealer');

    if (conversation.conversation_type === 'user_dealer') {
      // User-to-Dealer conversation: show dealership name
      headerTitle = conversation.dealership?.name ?? t('chat.dealer', 'Dealer');
    } else if (conversation.conversation_type === 'user_user') {
      // User-to-User conversation: show the other user's name
      if (conversation.seller_user_id === user.id) {
        // Current user is the seller, show the buyer's name
        headerTitle = conversation.user?.name ?? t('chat.user', 'User');
      } else {
        // Current user is the buyer, show the seller's name
        headerTitle = conversation.seller_user?.name ?? t('chat.user', 'User');
      }
    }

    navigation.setOptions({
      title: headerTitle,
      headerTitleAlign: 'center',
      headerTitleStyle: {
        maxWidth: 200,
      },
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          style={{
            paddingHorizontal: 8,
            paddingVertical: 8,
            marginLeft: -4,
          }}
        >
          <Ionicons
            name="chevron-back"
            size={28}
            color={isDarkMode ? '#E5E7EB' : '#1F2937'}
          />
        </Pressable>
      ),
    });
  }, [conversation, navigation, t, user, isDarkMode]);

  // MARK: - Read Status Management
  const isFocused = useIsFocused();
  const lastProcessedMessageIdRef = useRef<number | null>(null);

  useEffect(() => {
    // 1. Basic checks
    if (!conversationIdParam || !user || !conversation || !isFocused) return;

    // 2. Check if we have messages to mark
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    // 3. Avoid duplicate calls for the same latest message
    if (lastProcessedMessageIdRef.current === lastMessage.id) return;

    // 4. Determine viewer role
    let viewerRole: 'user' | 'seller_user' = 'user';
    if (conversation.conversation_type === 'user_user' && conversation.seller_user_id === user.id) {
      viewerRole = 'seller_user';
    }

    // 5. Trigger mutation
    console.log('[ConversationDetail] Auto-marking read', {
      msgId: lastMessage.id,
      viewerRole
    });

    lastProcessedMessageIdRef.current = lastMessage.id;
    markReadMutation.mutate({
      conversationId: conversationIdParam,
      viewerRole,
    });
  }, [
    conversationIdParam,
    user,
    conversation,
    isFocused,
    messages, // Re-run when new messages arrive
    markReadMutation
  ]);

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!conversationIdParam || !user || !conversation) {
        Toast.show({
          type: 'error',
          text1: t('chat.message_send_failed', 'Unable to send message'),
          text2: t('chat.try_again', 'Try again in a moment.'),
        });
        return;
      }

      // The DB notification trigger picks the recipient from sender_role.
      // For user_user conversations the seller must send as 'seller_user',
      // otherwise the trigger treats them as the buyer and tries to notify
      // the seller (themselves), silently dropping the push to the buyer.
      const senderRole: 'user' | 'seller_user' =
        conversation.conversation_type === 'user_user' &&
        conversation.seller_user_id === user.id
          ? 'seller_user'
          : 'user';

      try {
        await sendMessageMutation.mutateAsync({
          conversationId: conversationIdParam,
          senderId: user.id,
          senderRole,
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
    [conversationIdParam, conversation, sendMessageMutation, t, user]
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
        backgroundColor: isDarkMode ? '#0A0A0A' : '#FAFAFA',
      }}
      edges={['bottom']}
    >
      {isConversationLoading && isMessagesLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#D55004" />
        </View>
      ) : (
        <>
          {conversation && (conversation.car || conversation.carRent) && (
            <ConversationCarHeader conversation={conversation} />
          )}
          {conversation && conversation.numberPlate && (
            <ConversationPlateHeader conversation={conversation} />
          )}
          <FlatList
            ref={listRef}
            data={invertedMessages}
            inverted
            keyExtractor={(item) => item.id.toString()}
            keyboardShouldPersistTaps="handled"
            renderScrollComponent={renderScrollComponent}
            style={{
              flex: 1,
            }}
            contentContainerStyle={{
              paddingVertical: 12,
              paddingHorizontal: 12,
            }}
            renderItem={({ item }) =>
              item.type === 'offer' && item.offer_id ? (
                <OfferBubble
                  message={item}
                  offer={offersById.get(item.offer_id) ?? null}
                  mySide={mySide}
                  isOwn={item.sender_id === user?.id}
                  isDarkMode={isDarkMode}
                  busy={offerBusy}
                  onAccept={(offer) => handleOfferRespond(offer, 'accept')}
                  onDecline={(offer) => handleOfferRespond(offer, 'decline')}
                  onCounter={(offer) => setOfferSheet({ mode: 'counter', offer })}
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
          />
          <KeyboardStickyView offset={{ opened: bottom }}>
            {canMakeOffer && (
              <View style={{ alignItems: 'flex-start', paddingHorizontal: 12, paddingBottom: 6 }}>
                <TouchableOpacity
                  onPress={() => setOfferSheet({ mode: 'create' })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(213, 80, 4, 0.12)',
                    borderColor: 'rgba(213, 80, 4, 0.4)',
                    borderWidth: 1,
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                  }}
                >
                  <Ionicons name="pricetags" size={15} color="#D55004" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#D55004', fontWeight: '700', fontSize: 13 }}>
                    {t('offers.makeOffer')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            <MessageComposer
              onSend={handleSendMessage}
              isSending={sendMessageMutation.isPending}
              isDarkMode={isDarkMode}
              placeholder={t('chat.message_placeholder', 'Type a message…')}
            />
          </KeyboardStickyView>
          <OfferSheet
            visible={offerSheet !== null}
            onClose={() => setOfferSheet(null)}
            onSubmit={handleOfferSubmit}
            listingPrice={listingPrice != null ? Number(listingPrice) : null}
            isCounter={offerSheet?.mode === 'counter'}
            busy={offerBusy}
          />
        </>
      )}
    </SafeAreaView>
  );
}
