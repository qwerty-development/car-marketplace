import Toast from 'react-native-toast-message';
import { ChatService } from '@/services/ChatService';

interface StartDealerChatOptions {
  dealershipId?: number | null;
  userId?: string | null;
  isGuest: boolean;
  router: {
    push: (params: { pathname: string; params?: Record<string, any> }) => void;
  };
  t: (key: string, defaultMessage?: string) => string;
  onAuthRequired?: () => void;
  setLoading?: (loading: boolean) => void;
  carId?: number | null;
  carRentId?: number | null;
}

export async function startDealerChat({
  dealershipId,
  userId,
  isGuest,
  router,
  t,
  onAuthRequired,
  setLoading,
  carId,
  carRentId,
}: StartDealerChatOptions): Promise<{ started: boolean; conversationId?: number }> {
  if (isGuest || !userId) {
    onAuthRequired?.();
    return { started: false };
  }

  if (!dealershipId) {
    Toast.show({
      type: 'error',
      text1: t('chat.dealership_not_found', 'Dealer unavailable'),
      text2: t(
        'chat.dealership_not_found_body',
        'We could not find dealership details for this listing.'
      ),
    });
    return { started: false };
  }

  try {
    setLoading?.(true);
    const conversation = await ChatService.ensureConversation({
      userId,
      dealershipId,
      conversationType: 'user_dealer',
      carId: carId ?? null,
      carRentId: carRentId ?? null,
    });

    router.push({
      pathname: '/(home)/(user)/conversations/[conversationId]',
      params: { conversationId: conversation.id.toString() },
    });

    return { started: true, conversationId: conversation.id };
  } catch (error: any) {
    console.error('[Chat] Failed to start conversation', error);
    Toast.show({
      type: 'error',
      text1: t('chat.start_failed', 'Unable to start chat'),
      text2: error?.message ?? t('chat.try_again', 'Try again in a moment.'),
    });
    return { started: false };
  } finally {
    setLoading?.(false);
  }
}

interface StartUserChatOptions {
  sellerUserId?: string | null;
  userId?: string | null;
  isGuest: boolean;
  router: {
    push: (params: { pathname: string; params?: Record<string, any> }) => void;
  };
  t: (key: string, defaultMessage?: string) => string;
  onAuthRequired?: () => void;
  setLoading?: (loading: boolean) => void;
  carId?: number | null;
  carRentId?: number | null;
}

export async function startUserChat({
  sellerUserId,
  userId,
  isGuest,
  router,
  t,
  onAuthRequired,
  setLoading,
  carId,
  carRentId,
}: StartUserChatOptions): Promise<{ started: boolean; conversationId?: number }> {
  if (isGuest || !userId) {
    onAuthRequired?.();
    return { started: false };
  }

  if (!sellerUserId) {
    Toast.show({
      type: 'error',
      text1: t('chat.seller_not_found', 'Seller unavailable'),
      text2: t(
        'chat.seller_not_found_body',
        'We could not find seller details for this listing.'
      ),
    });
    return { started: false };
  }

  if (userId === sellerUserId) {
    Toast.show({
      type: 'info',
      text1: t('chat.cannot_chat_yourself', 'Cannot chat with yourself'),
      text2: t('chat.cannot_chat_yourself_body', 'You cannot start a chat with yourself.'),
    });
    return { started: false };
  }

  try {
    setLoading?.(true);
    const conversation = await ChatService.ensureConversation({
      userId,
      sellerUserId,
      conversationType: 'user_user',
      carId: carId ?? null,
      carRentId: carRentId ?? null,
    });

    router.push({
      pathname: '/(home)/(user)/conversations/[conversationId]',
      params: { conversationId: conversation.id.toString() },
    });

    return { started: true, conversationId: conversation.id };
  } catch (error: any) {
    console.error('[Chat] Failed to start user chat', error);
    Toast.show({
      type: 'error',
      text1: t('chat.start_failed', 'Unable to start chat'),
      text2: error?.message ?? t('chat.try_again', 'Try again in a moment.'),
    });
    return { started: false };
  } finally {
    setLoading?.(false);
  }
}

